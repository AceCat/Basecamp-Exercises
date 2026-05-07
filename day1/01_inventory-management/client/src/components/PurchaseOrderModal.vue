<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen && backlogItem" class="modal-overlay" @click="close">
        <div class="modal-container" @click.stop>
          <div class="modal-header">
            <h3 class="modal-title">
              {{ mode === 'create' ? 'Create Purchase Order' : 'Purchase Order Details' }}
            </h3>
            <button class="close-button" @click="close">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div class="modal-body">
            <!-- Item context header -->
            <div class="item-context">
              <div class="item-context-info">
                <h4 class="item-name">{{ backlogItem.item_name }}</h4>
                <div class="item-sku">SKU: {{ backlogItem.item_sku }}</div>
              </div>
              <span class="priority-badge" :class="backlogItem.priority?.toLowerCase()">
                {{ backlogItem.priority }} Priority
              </span>
            </div>

            <div class="shortage-summary">
              <div class="summary-card danger">
                <div class="summary-label">Shortage Amount</div>
                <div class="summary-value">{{ shortage }} units</div>
              </div>
              <div class="summary-card info">
                <div class="summary-label">Backlog ID</div>
                <div class="summary-value summary-value--id">{{ backlogItem.id }}</div>
              </div>
            </div>

            <!-- Create mode: form -->
            <template v-if="mode === 'create'">
              <div v-if="formError" class="form-error">{{ formError }}</div>

              <form class="po-form" @submit.prevent="submitForm">
                <div class="form-group">
                  <label class="form-label" for="supplier_name">Supplier Name <span class="required">*</span></label>
                  <input
                    id="supplier_name"
                    v-model="form.supplier_name"
                    type="text"
                    class="form-input"
                    placeholder="Enter supplier name"
                    required
                    :disabled="submitting"
                  />
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="quantity">Quantity <span class="required">*</span></label>
                    <input
                      id="quantity"
                      v-model.number="form.quantity"
                      type="number"
                      class="form-input"
                      min="1"
                      required
                      :disabled="submitting"
                    />
                  </div>

                  <div class="form-group">
                    <label class="form-label" for="unit_cost">Unit Cost ($) <span class="required">*</span></label>
                    <input
                      id="unit_cost"
                      v-model.number="form.unit_cost"
                      type="number"
                      class="form-input"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      required
                      :disabled="submitting"
                    />
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label" for="expected_delivery_date">Expected Delivery Date <span class="required">*</span></label>
                  <input
                    id="expected_delivery_date"
                    v-model="form.expected_delivery_date"
                    type="date"
                    class="form-input"
                    required
                    :disabled="submitting"
                  />
                </div>

                <div v-if="form.unit_cost > 0 && form.quantity > 0" class="total-cost-preview">
                  <span class="total-cost-label">Estimated Total</span>
                  <span class="total-cost-value">{{ formatCurrency(form.quantity * form.unit_cost) }}</span>
                </div>

                <div class="form-group">
                  <label class="form-label" for="notes">Notes</label>
                  <textarea
                    id="notes"
                    v-model="form.notes"
                    class="form-textarea"
                    rows="3"
                    placeholder="Optional notes..."
                    :disabled="submitting"
                  ></textarea>
                </div>
              </form>
            </template>

            <!-- View mode: read-only display -->
            <template v-else>
              <div v-if="viewLoading" class="view-loading">Loading purchase order...</div>
              <div v-else-if="viewError" class="form-error">{{ viewError }}</div>
              <div v-else-if="poData" class="po-details">
                <div class="info-grid">
                  <div class="info-item">
                    <div class="info-label">PO ID</div>
                    <div class="info-value info-value--id">{{ poData.id }}</div>
                  </div>

                  <div class="info-item">
                    <div class="info-label">Status</div>
                    <div class="info-value">
                      <span class="badge" :class="poStatusClass(poData.status)">{{ poData.status }}</span>
                    </div>
                  </div>

                  <div class="info-item">
                    <div class="info-label">Supplier</div>
                    <div class="info-value">{{ poData.supplier_name }}</div>
                  </div>

                  <div class="info-item">
                    <div class="info-label">Quantity</div>
                    <div class="info-value">{{ poData.quantity }} units</div>
                  </div>

                  <div class="info-item">
                    <div class="info-label">Unit Cost</div>
                    <div class="info-value">{{ formatCurrency(poData.unit_cost) }}</div>
                  </div>

                  <div class="info-item">
                    <div class="info-label">Total Cost</div>
                    <div class="info-value info-value--total">{{ formatCurrency(poData.quantity * poData.unit_cost) }}</div>
                  </div>

                  <div class="info-item">
                    <div class="info-label">Expected Delivery</div>
                    <div class="info-value">{{ formatDate(poData.expected_delivery_date) }}</div>
                  </div>

                  <div class="info-item">
                    <div class="info-label">Created Date</div>
                    <div class="info-value">{{ formatDate(poData.created_at) }}</div>
                  </div>
                </div>

                <div v-if="poData.notes" class="info-item notes-item">
                  <div class="info-label">Notes</div>
                  <div class="info-value">{{ poData.notes }}</div>
                </div>
              </div>
            </template>
          </div>

          <div class="modal-footer">
            <button class="btn-secondary" @click="close" :disabled="submitting">Close</button>
            <button
              v-if="mode === 'create'"
              class="btn-primary"
              :disabled="submitting"
              @click="submitForm"
            >
              {{ submitting ? 'Creating...' : 'Create Purchase Order' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { api } from '../api'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  backlogItem: {
    type: Object,
    default: null
  },
  mode: {
    type: String,
    default: 'create',
    validator: (v) => ['create', 'view'].includes(v)
  }
})

const emit = defineEmits(['close', 'po-created'])

// Create mode state
const form = ref({
  supplier_name: '',
  quantity: 0,
  unit_cost: 0,
  expected_delivery_date: '',
  notes: ''
})
const submitting = ref(false)
const formError = ref(null)

// View mode state
const poData = ref(null)
const viewLoading = ref(false)
const viewError = ref(null)

const shortage = computed(() => {
  if (!props.backlogItem) return 0
  return props.backlogItem.quantity_needed - props.backlogItem.quantity_available
})

// Reset form when modal opens in create mode
watch(
  () => [props.isOpen, props.backlogItem, props.mode],
  ([isOpen, item, mode]) => {
    if (!isOpen || !item) return

    if (mode === 'create') {
      form.value = {
        supplier_name: '',
        quantity: shortage.value,
        unit_cost: 0,
        expected_delivery_date: '',
        notes: ''
      }
      formError.value = null
      submitting.value = false
    } else {
      // View mode: use existing PO if already on the item, else fetch
      poData.value = null
      viewError.value = null

      if (item.purchase_order) {
        poData.value = item.purchase_order
      } else {
        loadPO(item.id)
      }
    }
  },
  { immediate: true }
)

const loadPO = async (backlogItemId) => {
  viewLoading.value = true
  viewError.value = null
  try {
    poData.value = await api.getPurchaseOrderByBacklogItem(backlogItemId)
  } catch (err) {
    viewError.value = 'Failed to load purchase order details.'
    console.error(err)
  } finally {
    viewLoading.value = false
  }
}

const submitForm = async () => {
  if (!form.value.supplier_name.trim()) {
    formError.value = 'Supplier name is required.'
    return
  }
  if (!form.value.quantity || form.value.quantity < 1) {
    formError.value = 'Quantity must be at least 1.'
    return
  }
  if (!form.value.unit_cost || form.value.unit_cost < 0) {
    formError.value = 'Unit cost must be a valid number.'
    return
  }
  if (!form.value.expected_delivery_date) {
    formError.value = 'Expected delivery date is required.'
    return
  }

  submitting.value = true
  formError.value = null

  try {
    const payload = {
      backlog_item_id: props.backlogItem.id,
      supplier_name: form.value.supplier_name.trim(),
      quantity: form.value.quantity,
      unit_cost: form.value.unit_cost,
      expected_delivery_date: form.value.expected_delivery_date,
      notes: form.value.notes?.trim() || null
    }

    const result = await api.createPurchaseOrder(payload)
    emit('po-created', result)
  } catch (err) {
    formError.value = err?.response?.data?.detail || 'Failed to create purchase order. Please try again.'
    console.error(err)
  } finally {
    submitting.value = false
  }
}

const close = () => {
  if (!submitting.value) {
    emit('close')
  }
}

const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return dateString
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

const formatCurrency = (value) => {
  if (value == null || isNaN(value)) return '$0.00'
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

const poStatusClass = (status) => {
  if (!status) return ''
  const s = status.toLowerCase()
  if (s === 'pending') return 'warning'
  if (s === 'approved' || s === 'delivered') return 'success'
  if (s === 'cancelled') return 'danger'
  return 'info'
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 1rem;
}

.modal-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15);
  max-width: 700px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.025em;
}

.close-button {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.close-button:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
}

/* Item context header */
.item-context {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 1.5rem;
}

.item-context-info {
  flex: 1;
  min-width: 0;
}

.item-name {
  font-size: 1.125rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 0.25rem 0;
}

.item-sku {
  font-size: 0.875rem;
  color: #64748b;
  font-family: 'Monaco', 'Courier New', monospace;
}

/* Priority badge */
.priority-badge {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  flex-shrink: 0;
}

.priority-badge.high {
  background: #fecaca;
  color: #991b1b;
}

.priority-badge.medium {
  background: #fed7aa;
  color: #92400e;
}

.priority-badge.low {
  background: #dbeafe;
  color: #1e40af;
}

/* Shortage summary cards */
.shortage-summary {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-bottom: 2rem;
}

.summary-card {
  padding: 1.25rem;
  border-radius: 10px;
  border: 2px solid;
}

.summary-card.danger {
  border-color: #fecaca;
  background: #fef2f2;
}

.summary-card.info {
  border-color: #bfdbfe;
  background: #eff6ff;
}

.summary-label {
  font-size: 0.813rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
  margin-bottom: 0.5rem;
}

.summary-value {
  font-size: 1.875rem;
  font-weight: 700;
  color: #0f172a;
}

.summary-card.danger .summary-value {
  color: #dc2626;
}

.summary-card.info .summary-value {
  color: #1d4ed8;
}

.summary-value--id {
  font-size: 1rem;
  font-family: 'Monaco', 'Courier New', monospace;
}

/* Form styles */
.po-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}

.required {
  color: #dc2626;
}

.form-input,
.form-textarea {
  padding: 0.625rem 0.875rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.938rem;
  color: #0f172a;
  background: white;
  font-family: inherit;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  width: 100%;
  box-sizing: border-box;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-input:disabled,
.form-textarea:disabled {
  background: #f9fafb;
  color: #9ca3af;
  cursor: not-allowed;
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.total-cost-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
}

.total-cost-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #15803d;
}

.total-cost-value {
  font-size: 1.125rem;
  font-weight: 700;
  color: #15803d;
}

/* Error */
.form-error {
  padding: 0.75rem 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #dc2626;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

/* View mode */
.view-loading {
  text-align: center;
  color: #64748b;
  padding: 2rem;
  font-size: 0.938rem;
}

.po-details {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.notes-item {
  grid-column: 1 / -1;
}

.info-label {
  font-size: 0.813rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
}

.info-value {
  font-size: 0.938rem;
  color: #0f172a;
  font-weight: 500;
}

.info-value--id {
  font-family: 'Monaco', 'Courier New', monospace;
  color: #2563eb;
}

.info-value--total {
  font-size: 1.125rem;
  font-weight: 700;
  color: #15803d;
}

/* Status badges */
.badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.813rem;
  font-weight: 600;
  text-transform: capitalize;
}

.badge.success {
  background: #dcfce7;
  color: #15803d;
}

.badge.warning {
  background: #fef9c3;
  color: #854d0e;
}

.badge.danger {
  background: #fee2e2;
  color: #991b1b;
}

.badge.info {
  background: #dbeafe;
  color: #1e40af;
}

/* Footer */
.modal-footer {
  padding: 1.5rem;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.btn-secondary {
  padding: 0.625rem 1.25rem;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-weight: 500;
  font-size: 0.875rem;
  color: #334155;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}

.btn-secondary:hover:not(:disabled) {
  background: #e2e8f0;
  border-color: #cbd5e1;
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  padding: 0.625rem 1.25rem;
  background: #3b82f6;
  border: 1px solid #3b82f6;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.875rem;
  color: white;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
  border-color: #2563eb;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Modal transition animations */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.2s ease;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.95);
}
</style>

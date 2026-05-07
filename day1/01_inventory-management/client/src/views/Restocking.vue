<template>
  <div class="restocking">
    <div class="page-header">
      <h2>{{ t('restocking.title') }}</h2>
      <p>{{ t('restocking.description') }}</p>
    </div>

    <div v-if="loading" class="loading">{{ t('common.loading') }}</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else>
      <!-- Success Banner -->
      <div v-if="orderPlaced" class="success-banner">
        {{ t('restocking.orderPlaced') }} —
        <router-link to="/orders" class="banner-link">{{ t('restocking.viewInOrders') }}</router-link>
      </div>

      <!-- Config Card -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Configuration</h3>
        </div>
        <div class="config-grid">
          <div class="config-col">
            <label class="config-label">{{ t('restocking.budgetLabel') }}</label>
            <input
              type="range"
              v-model.number="budget"
              min="0"
              max="500000"
              step="1000"
              class="budget-slider"
            />
            <div class="budget-display">
              <span class="budget-allocated">{{ formatCurrency(budgetUsed) }} {{ t('restocking.budgetAllocated') }}</span>
              <span class="budget-separator">of</span>
              <span class="budget-total">{{ formatCurrency(budget) }} total</span>
            </div>
          </div>
          <div class="config-col">
            <label class="config-label">{{ t('restocking.leadTimeLabel') }}</label>
            <input
              type="number"
              v-model.number="leadTimeDays"
              min="1"
              max="365"
              class="lead-time-input"
            />
            <div class="progress-bar-wrap">
              <div class="progress-bar-track">
                <div
                  class="progress-bar-fill"
                  :style="{ width: budgetPercent + '%' }"
                  :class="{ 'progress-full': budgetPercent >= 100 }"
                ></div>
              </div>
              <div class="progress-label">{{ budgetPercent.toFixed(1) }}% of budget used</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recommendations -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">
            {{ t('restocking.recommendationsTitle') }}
            <span class="count-badge">{{ recommendations.length }}</span>
          </h3>
        </div>

        <div v-if="recommendations.length === 0 && budget > 0" class="empty-state">
          {{ t('restocking.noRecommendations') }}
        </div>
        <div v-else-if="budget === 0" class="empty-state">
          Set a budget to see restocking recommendations.
        </div>
        <div v-else class="table-container">
          <table>
            <thead>
              <tr>
                <th>{{ t('restocking.table.itemName') }}</th>
                <th>{{ t('restocking.table.sku') }}</th>
                <th>{{ t('restocking.table.trend') }}</th>
                <th>{{ t('restocking.table.currentDemand') }}</th>
                <th>{{ t('restocking.table.forecastedDemand') }}</th>
                <th>{{ t('restocking.table.qtyToOrder') }}</th>
                <th>{{ t('restocking.table.unitCost') }}</th>
                <th>{{ t('restocking.table.totalCost') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="forecast in recommendations" :key="forecast.id">
                <td>{{ forecast.item_name }}</td>
                <td><strong>{{ forecast.item_sku }}</strong></td>
                <td>
                  <span :class="['badge', forecast.trend]">
                    {{ t(`trends.${forecast.trend}`) }}
                  </span>
                </td>
                <td>{{ forecast.current_demand }}</td>
                <td><strong>{{ forecast.forecasted_demand }}</strong></td>
                <td>{{ forecast.quantity }}</td>
                <td>{{ formatCurrency(forecast.unit_cost) }}</td>
                <td><strong>{{ formatCurrency(forecast.total_cost) }}</strong></td>
              </tr>
            </tbody>
            <tfoot v-if="recommendations.length > 0">
              <tr class="totals-row">
                <td colspan="5"><strong>Totals</strong></td>
                <td><strong>{{ recommendations.reduce((s, r) => s + r.quantity, 0) }}</strong></td>
                <td></td>
                <td><strong>{{ formatCurrency(budgetUsed) }}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Action Row -->
        <div class="action-row">
          <div class="action-summary">
            <span class="action-summary-label">Total:</span>
            <span class="action-summary-value">{{ formatCurrency(budgetUsed) }}</span>
            <span class="action-summary-of">of {{ formatCurrency(budget) }} budget used</span>
          </div>
          <button
            class="btn-primary"
            :disabled="placing || recommendations.length === 0 || budget === 0"
            @click="placeOrder"
          >
            {{ placing ? 'Placing...' : t('restocking.placeOrder') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { api } from '../api'
import { useI18n } from '../composables/useI18n'

export default {
  name: 'Restocking',
  setup() {
    const { t, currentCurrency } = useI18n()

    const budget = ref(50000)
    const leadTimeDays = ref(14)
    const allForecasts = ref([])
    const allInventory = ref([])
    const loading = ref(false)
    const placing = ref(false)
    const orderPlaced = ref(false)
    const error = ref(null)

    const formatCurrency = (value) => {
      if (currentCurrency.value === 'JPY') {
        return '¥' + Math.round(value).toLocaleString()
      }
      return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    }

    const recommendations = computed(() => {
      // Build inventory map by SKU
      const inventoryMap = {}
      allInventory.value.forEach(item => {
        inventoryMap[item.sku] = item
      })

      // Filter forecasts to only those with increasing demand
      const candidates = allForecasts.value
        .filter(f => f.forecasted_demand > f.current_demand)
        .reduce((acc, f) => {
          const invItem = inventoryMap[f.item_sku]
          if (!invItem) return acc

          const quantity = f.forecasted_demand - f.current_demand
          const unit_cost = invItem.unit_cost != null ? invItem.unit_cost : invItem.price
          if (unit_cost == null) return acc

          const total_cost = quantity * unit_cost

          const trendPriority = f.trend === 'increasing' ? 0 : f.trend === 'stable' ? 1 : 2

          acc.push({
            ...f,
            quantity,
            unit_cost,
            total_cost,
            trend_priority: trendPriority
          })
          return acc
        }, [])

      // Sort: trend_priority ASC, then quantity DESC within each tier
      candidates.sort((a, b) => {
        if (a.trend_priority !== b.trend_priority) return a.trend_priority - b.trend_priority
        return b.quantity - a.quantity
      })

      // Greedy fill within budget
      let remaining = budget.value
      const selected = []
      for (const item of candidates) {
        if (item.total_cost <= remaining) {
          selected.push(item)
          remaining -= item.total_cost
        }
      }

      return selected
    })

    const budgetUsed = computed(() =>
      recommendations.value.reduce((s, i) => s + i.total_cost, 0)
    )

    const budgetPercent = computed(() =>
      budget.value > 0 ? Math.min(100, (budgetUsed.value / budget.value) * 100) : 0
    )

    const loadData = async () => {
      loading.value = true
      error.value = null
      try {
        const [forecastsData, inventoryData] = await Promise.all([
          api.getDemandForecasts(),
          api.getInventory({})
        ])
        allForecasts.value = forecastsData
        allInventory.value = inventoryData
      } catch (err) {
        error.value = 'Failed to load data'
        console.error(err)
      } finally {
        loading.value = false
      }
    }

    const placeOrder = async () => {
      placing.value = true
      try {
        const items = recommendations.value.map(r => ({
          sku: r.item_sku,
          name: r.item_name,
          quantity: r.quantity,
          unit_price: r.unit_cost
        }))
        await api.createRestockingOrder({
          items,
          lead_time_days: leadTimeDays.value,
          total_value: budgetUsed.value
        })
        orderPlaced.value = true
      } catch (err) {
        error.value = 'Failed to place order'
        console.error(err)
      } finally {
        placing.value = false
      }
    }

    onMounted(loadData)

    return {
      t,
      budget,
      leadTimeDays,
      loading,
      placing,
      orderPlaced,
      error,
      recommendations,
      budgetUsed,
      budgetPercent,
      formatCurrency,
      placeOrder
    }
  }
}
</script>

<style scoped>
.config-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
}

.config-col {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.config-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.budget-slider {
  width: 100%;
  accent-color: #2563eb;
  cursor: pointer;
}

.budget-display {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.938rem;
  color: #334155;
}

.budget-allocated {
  font-weight: 700;
  color: #0f172a;
}

.budget-separator {
  color: #94a3b8;
}

.budget-total {
  color: #64748b;
}

.lead-time-input {
  width: 120px;
  padding: 0.5rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.938rem;
  color: #0f172a;
  background: white;
}

.lead-time-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.progress-bar-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.progress-bar-track {
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: #2563eb;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-bar-fill.progress-full {
  background: #dc2626;
}

.progress-label {
  font-size: 0.813rem;
  color: #64748b;
}

.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  background: #e0e7ff;
  color: #3730a3;
  font-size: 0.75rem;
  font-weight: 700;
  border-radius: 12px;
  margin-left: 0.5rem;
  vertical-align: middle;
}

.empty-state {
  padding: 3rem;
  text-align: center;
  color: #64748b;
  font-size: 0.938rem;
}

.totals-row {
  background: #f8fafc;
  border-top: 2px solid #e2e8f0;
}

.totals-row td {
  font-size: 0.875rem;
  padding: 0.625rem 0.75rem;
}

.action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 0 0.25rem;
  border-top: 1px solid #e2e8f0;
  margin-top: 1rem;
}

.action-summary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.938rem;
}

.action-summary-label {
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  font-size: 0.813rem;
  letter-spacing: 0.05em;
}

.action-summary-value {
  font-weight: 700;
  font-size: 1.125rem;
  color: #0f172a;
}

.action-summary-of {
  color: #64748b;
  font-size: 0.875rem;
}

.btn-primary {
  padding: 0.625rem 1.5rem;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.938rem;
  cursor: pointer;
  transition: background 0.2s ease, opacity 0.2s ease;
}

.btn-primary:hover:not(:disabled) {
  background: #1d4ed8;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.success-banner {
  background: #d1fae5;
  border: 1px solid #6ee7b7;
  color: #065f46;
  padding: 1rem 1.25rem;
  border-radius: 8px;
  margin-bottom: 1.25rem;
  font-size: 0.938rem;
  font-weight: 500;
}

.banner-link {
  color: #047857;
  font-weight: 600;
  text-decoration: underline;
}

.banner-link:hover {
  color: #065f46;
}
</style>

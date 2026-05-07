const playwright = require('/Users/benn/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const { chromium } = playwright;
const { writeFileSync, mkdirSync } = require('fs');

const SCREENSHOTS_DIR = '/tmp/restocking_test';
try { mkdirSync(SCREENSHOTS_DIR, { recursive: true }); } catch {}

const log = (msg) => console.log(`[TEST] ${msg}`);

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect console messages
  const consoleErrors = [];
  const consoleWarnings = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    if (msg.type() === 'warning') consoleWarnings.push(msg.text());
    if (msg.type() === 'log') {} // silent
  });
  page.on('pageerror', err => consoleErrors.push(`PAGE ERROR: ${err.message}`));

  // ── Step 1: Navigate to /restocking ──────────────────────────────────────
  log('Step 1: Navigating to http://localhost:3000/restocking');
  await page.goto('http://localhost:3000/restocking', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // ── Step 2: Screenshot + report ──────────────────────────────────────────
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/01_restocking_initial.png`, fullPage: true });
  log('Step 2: Screenshot 01 saved');

  const pageTitle = await page.title();
  const h1Text = await page.$eval('h1', el => el.textContent.trim()).catch(() => 'No h1 found');
  const bodyText = await page.$eval('body', el => el.innerText.substring(0, 800)).catch(() => '');
  log(`  Page title: ${pageTitle}`);
  log(`  H1 text: ${h1Text}`);
  log(`  Body text preview:\n${bodyText}`);

  // ── Step 3: Console errors ────────────────────────────────────────────────
  log(`Step 3: Console errors count: ${consoleErrors.length}`);
  consoleErrors.forEach(e => log(`  ERROR: ${e}`));

  // ── Step 4: Budget slider ─────────────────────────────────────────────────
  log('Step 4: Looking for budget slider...');
  const slider = await page.$('input[type="range"]');
  if (slider) {
    const sliderVal = await slider.inputValue();
    const box = await slider.boundingBox();
    log(`  Slider found. Current value: ${sliderVal}. Box: ${JSON.stringify(box)}`);
    if (box) {
      // Move to 75% mark
      await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2);
      await page.waitForTimeout(500);
      const newVal = await slider.inputValue();
      log(`  Slider value after moving to 75%: ${newVal}`);
    }
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/02_slider_moved.png`, fullPage: true });
    log('  Screenshot 02 saved (after slider move)');
  } else {
    log('  WARNING: No range input found. Dumping all inputs:');
    const allInputs = await page.$$eval('input', els => els.map(e => ({
      type: e.type, id: e.id, name: e.name, placeholder: e.placeholder, class: e.className
    })));
    log(`  Inputs: ${JSON.stringify(allInputs, null, 2)}`);
  }

  // ── Step 5: Recommendations table ────────────────────────────────────────
  log('Step 5: Checking recommendations table...');
  const hasTable = await page.$('table');
  if (hasTable) {
    const rowCount = await page.$$eval('table tbody tr', rows => rows.length).catch(() => 0);
    log(`  Table found with ${rowCount} tbody rows`);
    if (rowCount > 0) {
      const firstRow = await page.$eval('table tbody tr:first-child', r => r.textContent.replace(/\s+/g, ' ').trim().substring(0, 150)).catch(() => 'N/A');
      log(`  First row: ${firstRow}`);
    }
  } else {
    log('  No <table> found. Checking for other structures...');
    const cards = await page.$$eval('[class*="card"], [class*="item"], [class*="row"]', els => els.length).catch(() => 0);
    log(`  Card/item/row elements: ${cards}`);
  }

  // ── Step 6: Lead time input ───────────────────────────────────────────────
  log('Step 6: Setting lead time to 10 days...');
  // Try various selectors for lead time
  let leadTimeInput = null;
  const leadSelectors = [
    'input[id*="lead"]',
    'input[name*="lead"]',
    'input[placeholder*="lead" i]',
    'input[placeholder*="Lead" i]',
    'input[placeholder*="days" i]',
    'label:has-text("Lead") ~ input',
    'label:has-text("lead") + input',
    '.lead-time input',
    '[class*="lead"] input',
  ];
  for (const sel of leadSelectors) {
    leadTimeInput = await page.$(sel).catch(() => null);
    if (leadTimeInput) {
      log(`  Found lead time input with selector: ${sel}`);
      break;
    }
  }
  // Fallback: find number inputs
  if (!leadTimeInput) {
    const numberInputs = await page.$$('input[type="number"]');
    log(`  Number inputs found: ${numberInputs.length}`);
    if (numberInputs.length > 0) leadTimeInput = numberInputs[0];
  }

  if (leadTimeInput) {
    await leadTimeInput.click({ clickCount: 3 });
    await leadTimeInput.fill('10');
    const val = await leadTimeInput.inputValue();
    log(`  Lead time value set to: ${val}`);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/03_lead_time_set.png`, fullPage: true });
    log('  Screenshot 03 saved (lead time set)');
  } else {
    log('  WARNING: No lead time input found. All inputs on page:');
    const allInputs = await page.$$eval('input', els => els.map(e => ({
      type: e.type, id: e.id, name: e.name, placeholder: e.placeholder, class: e.className, value: e.value
    })));
    log(`  ${JSON.stringify(allInputs, null, 2)}`);
  }

  // ── Step 7: Click "Place Order" ───────────────────────────────────────────
  log('Step 7: Clicking Place Order button...');
  const allButtons = await page.$$eval('button', btns => btns.map(b => b.textContent.trim()));
  log(`  All buttons: ${JSON.stringify(allButtons)}`);

  // Find Place Order button by iterating all buttons
  let placeOrderBtn = null;
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const txt = await btn.textContent();
    if (txt && txt.trim().toLowerCase().includes('place order')) {
      placeOrderBtn = btn;
      break;
    }
  }

  if (placeOrderBtn) {
    log('  Place Order button found, clicking...');
    await placeOrderBtn.click();
    log('  Clicked Place Order');
    await page.waitForTimeout(2500);
  } else {
    log('  WARNING: Place Order button not found by text');
  }

  // ── Step 8: Screenshot after placing order ────────────────────────────────
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/04_after_place_order.png`, fullPage: true });
  log('Step 8: Screenshot 04 saved (after place order)');

  // Check for success/banner
  const bodyAfter = await page.$eval('body', el => el.innerText.substring(0, 600)).catch(() => '');
  log(`  Page content after placing order:\n${bodyAfter}`);

  const alertEl = await page.$('[role="alert"], [class*="success"], [class*="banner"], [class*="notification"], [class*="toast"]');
  if (alertEl) {
    const alertText = await alertEl.textContent();
    log(`  Alert/banner found: "${alertText.trim().substring(0, 200)}"`);
  } else {
    log('  No alert/success banner element found via selector');
  }

  // ── Step 9: Navigate to /orders ───────────────────────────────────────────
  log('Step 9: Navigating to http://localhost:3000/orders');
  await page.goto('http://localhost:3000/orders', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // ── Step 10: Screenshot orders page ──────────────────────────────────────
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/05_orders_page.png`, fullPage: true });
  log('Step 10: Screenshot 05 saved (orders page)');

  const ordersBodyText = await page.$eval('body', el => el.innerText.substring(0, 1000)).catch(() => '');
  log(`  Orders page content:\n${ordersBodyText}`);

  const hasSubmittedOrders = ordersBodyText.toLowerCase().includes('submitted order');
  log(`  "Submitted Orders" section visible: ${hasSubmittedOrders}`);

  // ── Final summary ─────────────────────────────────────────────────────────
  log(`\n=== FINAL SUMMARY ===`);
  log(`Console errors: ${consoleErrors.length}`);
  consoleErrors.forEach(e => log(`  - ${e}`));
  log(`Console warnings: ${consoleWarnings.length}`);
  log(`Screenshots at: ${SCREENSHOTS_DIR}`);
  log('=== TEST COMPLETE ===');

  await browser.close();
}

run().catch(err => {
  console.error('[TEST FATAL]', err);
  process.exit(1);
});

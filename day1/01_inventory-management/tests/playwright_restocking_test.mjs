import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const SCREENSHOTS_DIR = '/tmp/restocking_test';
import { mkdirSync } from 'fs';
try { mkdirSync(SCREENSHOTS_DIR, { recursive: true }); } catch {}

const log = (msg) => console.log(`[TEST] ${msg}`);

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect console errors
  const consoleErrors = [];
  const consoleWarnings = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    if (msg.type() === 'warning') consoleWarnings.push(msg.text());
  });

  // Step 1: Navigate to /restocking
  log('Navigating to http://localhost:3000/restocking');
  await page.goto('http://localhost:3000/restocking', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Step 2: Take initial screenshot
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/01_restocking_initial.png`, fullPage: true });
  log('Screenshot 01 taken: initial restocking page');

  // Report page title and visible text
  const pageTitle = await page.title();
  log(`Page title: ${pageTitle}`);

  const h1Text = await page.$eval('h1', el => el.textContent).catch(() => 'No h1 found');
  log(`H1 text: ${h1Text}`);

  // Step 3: Check console errors
  log(`Console errors so far: ${consoleErrors.length}`);
  consoleErrors.forEach(e => log(`  ERROR: ${e}`));

  // Step 4: Verify budget slider is visible and functional
  log('Looking for budget slider...');
  const slider = await page.$('input[type="range"]');
  if (slider) {
    const sliderVal = await slider.inputValue();
    log(`Slider found, current value: ${sliderVal}`);

    // Move the slider
    const box = await slider.boundingBox();
    if (box) {
      // Click at 75% of the slider width to increase value
      await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2);
      await page.waitForTimeout(300);
      const newVal = await slider.inputValue();
      log(`Slider value after moving to 75%: ${newVal}`);

      // Take screenshot after slider move
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/02_after_slider_move.png`, fullPage: true });
      log('Screenshot 02 taken: after slider move');
    }
  } else {
    log('WARNING: No range slider found on page');
    // Try to find any slider-like elements
    const inputs = await page.$$eval('input', els => els.map(e => ({ type: e.type, id: e.id, class: e.className })));
    log(`All inputs on page: ${JSON.stringify(inputs)}`);
  }

  // Step 5: Verify recommendations table shows items
  log('Looking for recommendations table...');
  const tableRows = await page.$$('table tbody tr, .recommendations-table tr, [class*="table"] tr').catch(() => []);
  log(`Table rows found: ${tableRows.length}`);

  // Try to find any list/table with recommendations
  const hasTable = await page.$('table');
  if (hasTable) {
    const rowCount = await page.$$eval('table tbody tr', rows => rows.length).catch(() => 0);
    log(`Table tbody rows: ${rowCount}`);
    if (rowCount > 0) {
      const firstRow = await page.$eval('table tbody tr:first-child', row => row.textContent.trim().substring(0, 100)).catch(() => 'N/A');
      log(`First row content: ${firstRow}`);
    }
  } else {
    log('No table element found - checking for other list structures');
    const listItems = await page.$$eval('[class*="item"], [class*="row"], [class*="card"]', els => els.length).catch(() => 0);
    log(`List-like items: ${listItems}`);
  }

  // Step 6: Set lead time to 10 days
  log('Looking for lead time input...');
  const leadTimeInput = await page.$('input[placeholder*="lead"], input[id*="lead"], input[name*="lead"], input[type="number"]');
  if (leadTimeInput) {
    await leadTimeInput.triple_click().catch(async () => {
      await leadTimeInput.click({ clickCount: 3 });
    });
    await leadTimeInput.fill('10');
    const leadVal = await leadTimeInput.inputValue();
    log(`Lead time set to: ${leadVal}`);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/03_lead_time_set.png`, fullPage: true });
    log('Screenshot 03 taken: lead time set');
  } else {
    log('WARNING: No lead time input found');
    // Dump all inputs
    const allInputs = await page.$$eval('input', els => els.map(e => ({
      type: e.type,
      id: e.id,
      name: e.name,
      placeholder: e.placeholder,
      value: e.value
    })));
    log(`All inputs: ${JSON.stringify(allInputs, null, 2)}`);
  }

  // Step 7: Click "Place Order"
  log('Looking for Place Order button...');
  const placeOrderBtn = await page.$('button:has-text("Place Order"), button:has-text("place order"), [class*="place-order"]');
  if (placeOrderBtn) {
    log('Place Order button found, clicking...');
    await placeOrderBtn.click();
    await page.waitForTimeout(2000);

    // Step 8: Take screenshot after placing order
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/04_after_place_order.png`, fullPage: true });
    log('Screenshot 04 taken: after place order');

    // Check for success banner
    const successBanner = await page.$('[class*="success"], [class*="banner"], [class*="alert"], [role="alert"]');
    if (successBanner) {
      const bannerText = await successBanner.textContent();
      log(`Success banner text: ${bannerText.trim().substring(0, 200)}`);
    } else {
      log('WARNING: No success banner found after clicking Place Order');
      // Check for any new text that appeared
      const bodyText = await page.$eval('body', el => el.innerText.substring(0, 500));
      log(`Page body text snippet: ${bodyText}`);
    }
  } else {
    log('WARNING: Place Order button not found');
    // List all buttons
    const buttons = await page.$$eval('button', btns => btns.map(b => b.textContent.trim()));
    log(`All buttons: ${JSON.stringify(buttons)}`);
  }

  // Final console error check
  log(`Total console errors: ${consoleErrors.length}`);
  consoleErrors.forEach(e => log(`  ERROR: ${e}`));

  // Step 9: Navigate to /orders
  log('Navigating to http://localhost:3000/orders');
  await page.goto('http://localhost:3000/orders', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Step 10: Take screenshot of orders page
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/05_orders_page.png`, fullPage: true });
  log('Screenshot 05 taken: orders page');

  const ordersH1 = await page.$eval('h1', el => el.textContent).catch(() => 'No h1');
  log(`Orders page H1: ${ordersH1}`);

  // Check for "Submitted Orders" section
  const pageContent = await page.content();
  const hasSubmittedOrders = pageContent.toLowerCase().includes('submitted orders') ||
                             pageContent.toLowerCase().includes('submitted-orders');
  log(`"Submitted Orders" section found: ${hasSubmittedOrders}`);

  if (hasSubmittedOrders) {
    // Try to get the text of that section
    const submittedSection = await page.$eval(
      '*',
      el => {
        const all = document.querySelectorAll('*');
        for (const node of all) {
          if (node.textContent.trim().toLowerCase().startsWith('submitted orders')) {
            return node.closest('section, div, article')?.textContent.trim().substring(0, 300) || node.textContent.trim();
          }
        }
        return null;
      }
    ).catch(() => null);
    if (submittedSection) {
      log(`Submitted Orders section content: ${submittedSection.substring(0, 300)}`);
    }
  }

  // Final console error summary
  log(`Final total console errors: ${consoleErrors.length}`);
  log(`Final total console warnings: ${consoleWarnings.length}`);

  await browser.close();

  log('=== TEST COMPLETE ===');
  log(`Screenshots saved to: ${SCREENSHOTS_DIR}`);

  return {
    consoleErrors,
    consoleWarnings,
    screenshotsDir: SCREENSHOTS_DIR
  };
}

run().catch(err => {
  console.error('[TEST FATAL]', err);
  process.exit(1);
});

// @ts-nocheck
import { chromium } from 'playwright';
import * as path from 'path';

const BASE_URL = 'http://localhost:3000';
const SCREENSHOTS_DIR =
  'D:/SaaS Project/trading-alerts-saas-public/e2e-testing/screenshots/05-davintrade-academy';

async function captureModal() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  // Login as admin
  await page.goto(`${BASE_URL}/login`);
  await page.click('button:has-text("Admin Test")');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Navigate to tutorials
  await page.goto(`${BASE_URL}/admin/tutorials`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Click Add Tutorial
  const addBtn = page.getByRole('button', { name: /Add Tutorial/i }).first();
  await addBtn.click();
  await page.waitForTimeout(1000);

  // Fill form to show live preview
  await page.fill('#tutorial-title', 'Advanced Order Block Breakout Strategy');
  await page.fill(
    '#tutorial-url',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  );
  await page.fill(
    '#tutorial-description',
    'Learn how institutional order blocks and liquidity sweeps signal high-probability trading setups.'
  );

  await page.waitForTimeout(1500);

  const modalPath = path.join(
    SCREENSHOTS_DIR,
    '07-admin-tutorials-add-modal-dialog.png'
  );
  await page.screenshot({ path: modalPath, fullPage: true });
  console.log('Updated modal screenshot:', modalPath);

  await browser.close();
}

captureModal().catch(console.error);

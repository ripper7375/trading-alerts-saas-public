// @ts-nocheck
import { chromium } from 'playwright';
import * as path from 'path';

const BASE_URL = 'http://localhost:3000';
const SCREENSHOTS_DIR =
  'D:/SaaS Project/trading-alerts-saas-public/e2e-testing/screenshots/04-affiliate-commission';

async function captureAffiliateDetail() {
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

  // Navigate to admin affiliates list
  await page.goto(`${BASE_URL}/admin/affiliates`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Find first affiliate link
  const affLink = page
    .locator('tbody tr td a[href^="/admin/affiliates/"]')
    .first();
  if (await affLink.isVisible().catch(() => false)) {
    console.log('Clicking affiliate link:', await affLink.getAttribute('href'));
    await affLink.click();
    await page.waitForTimeout(2500);
  } else {
    console.log('No affiliate link found in table, checking direct API...');
  }

  const detailPath = path.join(
    SCREENSHOTS_DIR,
    '03-admin-affiliate-detail-clawback.png'
  );
  await page.screenshot({ path: detailPath, fullPage: true });
  console.log('Saved admin affiliate detail screenshot:', detailPath);

  await browser.close();
}

captureAffiliateDetail().catch(console.error);

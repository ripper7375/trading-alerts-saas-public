// @ts-nocheck
import { chromium } from 'playwright';

async function testLoginStep() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', (msg) =>
    console.log('BROWSER CONSOLE:', msg.type(), msg.text())
  );

  console.log('Visiting /login...');
  await page.goto('http://localhost:3000/login');

  // Click Admin Test preset button
  const adminBtn = page.locator('button', { hasText: 'Admin Test' });
  console.log('Admin button visible:', await adminBtn.isVisible());
  await adminBtn.click();

  const emailVal = await page.inputValue('input[type="email"]');
  const passVal = await page.inputValue('input[type="password"]');
  console.log('Filled email:', emailVal, 'password length:', passVal.length);

  // Click Submit
  const submitBtn = page.locator('button[type="submit"]');
  console.log('Submit button disabled:', await submitBtn.isDisabled());
  await submitBtn.click();

  // Wait 4s and check URL and cookies
  await page.waitForTimeout(4000);
  console.log('Current URL after submit:', page.url());
  const cookies = await context.cookies();
  console.log(
    'Cookies in context:',
    cookies.map((c) => c.name)
  );

  // Check if error message is on page
  const errorText = await page
    .locator('.text-rose-600, .bg-rose-500')
    .allTextContents()
    .catch(() => []);
  console.log('Error texts on page:', errorText);

  // Try going to /admin
  console.log('Navigating to /admin...');
  await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' });
  console.log('Post /admin URL:', page.url());

  await browser.close();
}

testLoginStep().catch(console.error);

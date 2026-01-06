Verification Commands for Each Prompt

After Prompt 1 (Billing Page - Cancel Modal \& Resubscribe)
npx playwright test e2e/tests/path3-subscription-cancel.spec.ts

Expected improvement: 32 failed → ~0 failed (95 passed)

After Prompt 2 (Alerts Client - data-testid)
npx playwright test e2e/tests/path7-alert-notifications.spec.ts

Expected improvement: 67 failed → ~30 failed

After Prompt 3 (Alert Form - data-testid)
npx playwright test e2e/tests/path7-alert-notifications.spec.ts

Expected improvement: ~30 failed → ~0 failed (170 passed)

After Prompt 4 (Seed Data - Discount Codes)
npx prisma db seed \&\& npx playwright test e2e/tests/path4-discount-redemption.spec.ts

Expected improvement: 95 failed → ~35 failed (API tests pass)

After Prompt 5 (Checkout Flow - Discount Input)
npx playwright test e2e/tests/path4-discount-redemption.spec.ts

Expected improvement: ~35 failed → ~0 failed (125 passed)

After Prompt 6 (Alert Card/List - data-testid)
npx playwright test e2e/tests/path7-alert-notifications.spec.ts

Expected: Confirms all 170 tests pass (may not be needed if Prompt 2+3 covered everything)

Quick Reference Table
Prompt Command Before After
1 npx playwright test e2e/tests/path3-subscription-cancel.spec.ts 32 fail 0 fail
2 npx playwright test e2e/tests/path7-alert-notifications.spec.ts 67 fail ~30 fail
3 npx playwright test e2e/tests/path7-alert-notifications.spec.ts ~30 fail 0 fail
4 npx prisma db seed \&\& npx playwright test e2e/tests/path4-discount-redemption.spec.ts 95 fail ~35 fail
5 npx playwright test e2e/tests/path4-discount-redemption.spec.ts ~35 fail 0 fail
6 npx playwright test e2e/tests/path7-alert-notifications.spec.ts 0 fail 0 fail

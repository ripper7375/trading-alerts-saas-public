# Part 17A-1: Affiliate Portal - Foundation & Backend APIs with TDD

## CRITICAL: THIS IS PART 17A-1 OF 2

**Part 17A is split into TWO parts to prevent Long Running Agent issues:**

- **Part 17A-1 (THIS PART)**: Foundation + Backend APIs (29 files, Steps 1-27)
- **Part 17A-2 (NEXT PART)**: API Testing + Frontend (17 files, Steps 28-44)

**Dependencies (MUST EXIST)**

lib/auth/session.ts # Part 5: requireAuth(), requireAffiliate()
lib/auth-options.ts # Part 5: NextAuth config
app/api/webhooks/stripe/route.ts # Part 12: Stripe webhook
app/api/checkout/create-session/route.ts # Part 12: Checkout
prisma/schema.prisma # Database schema

## PART 17A-1 BUILD SEQUENCE: 34 FILES

**Build Order:** Test files (T#) BEFORE implementation files (F#)

PHASE 0: TEST INFRASTRUCTURE (2 files)
├─ Step 1: T1 - **tests**/setup.ts
└─ Step 2: T2 - **tests**/helpers/supertest-setup.ts

PHASE A: FOUNDATION (13 files)
├─ Step 3: F1 - prisma/schema.prisma (VERIFY)
├─ Step 4: F2 - lib/affiliate/constants.ts
├─ Step 5: T3 - **tests**/lib/affiliate/code-generator.test.ts (RED)
├─ Step 6: F3 - lib/affiliate/code-generator.ts (GREEN)
├─ Step 7: F3 - lib/affiliate/code-generator.ts (REFACTOR)
├─ Step 8: T4 - **tests**/lib/affiliate/commission-calculator.test.ts (RED)
├─ Step 9: F4 - lib/affiliate/commission-calculator.ts (GREEN)
├─ Step 10: F5 - lib/affiliate/report-builder.ts
├─ Step 11: F6 - lib/affiliate/validators.ts
├─ Step 12: F7 - lib/email/templates/affiliate/welcome.tsx
├─ Step 13: F8 - lib/email/templates/affiliate/code-distributed.tsx
├─ Step 14: F9 - lib/email/templates/affiliate/code-used.tsx
└─ Step 15: F10 - Migration (if needed)

PHASE B: BACKEND APIs (14 files)
├─ Step 16: T5 - **tests**/lib/affiliate/registration.test.ts (RED)
├─ Step 17: F11 - app/api/affiliate/auth/register/route.ts (GREEN)
├─ Step 18: F12 - app/api/affiliate/auth/verify-email/route.ts
├─ Step 19: F13 - app/api/affiliate/dashboard/stats/route.ts
├─ Step 20: F14 - app/api/affiliate/dashboard/codes/route.ts
├─ Step 21: F15 - app/api/affiliate/dashboard/code-inventory/route.ts
├─ Step 22: F16 - app/api/affiliate/dashboard/commission-report/route.ts
├─ Step 23: F17 - app/api/affiliate/profile/route.ts
├─ Step 24: F18 - app/api/affiliate/profile/payment/route.ts
├─ Step 25: F19 - app/api/checkout/validate-code/route.ts (NEW)
├─ Step 26: F20 - app/api/checkout/create-session/route.ts (UPDATE)
└─ Step 27: F21 - app/api/webhooks/stripe/route.ts (UPDATE)

TOTAL: 29 implementation files + 5 test files = 34 files

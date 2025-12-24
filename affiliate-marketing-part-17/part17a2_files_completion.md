# Part 17A-2: Affiliate Portal - API Testing & Frontend with TDD

## ⚠️ CRITICAL: THIS IS PART 17A-2 OF 2 - REQUIRES PART 17A-1

**Part 17A is split into TWO parts:**

- **Part 17A-1 (COMPLETED)**: Foundation + Backend APIs (29 files) ✅
- **Part 17A-2 (THIS PART)**: API Testing + Frontend (17 files)

**DEPENDENCIES - MUST VERIFY FIRST:**

# Check Part 17A-1 files exist

ls -la lib/affiliate/code-generator.ts
ls -la lib/affiliate/commission-calculator.ts
ls -la lib/affiliate/report-builder.ts
ls -la app/api/affiliate/auth/register/route.ts
ls -la app/api/affiliate/dashboard/stats/route.ts
ls -la **tests**/setup.ts

**Dependencies from Part 17A-1 (MUST EXIST)**
lib/affiliate/code-generator.ts
lib/affiliate/commission-calculator.ts
lib/affiliate/report-builder.ts
lib/affiliate/validators.ts
lib/affiliate/constants.ts
app/api/affiliate/auth/register/route.ts
app/api/affiliate/auth/verify-email/route.ts
app/api/affiliate/dashboard/stats/route.ts
app/api/affiliate/dashboard/codes/route.ts
app/api/checkout/validate-code/route.ts
**tests**/setup.ts
**tests**/helpers/supertest-setup.ts

```

## PART 17A-2 BUILD SEQUENCE: 17 FILES

**Build Order:** Test files (T#) BEFORE implementation files (F#)

```

PHASE C: API E2E TESTING (3 test files)
├─ Step 28: T6 - **tests**/api/affiliate-registration.supertest.ts
├─ Step 29: T7 - **tests**/api/affiliate-dashboard.supertest.ts
└─ Step 30: T8 - **tests**/api/affiliate-conversion.supertest.ts

PHASE D: FRONTEND (14 files)
├─ Component Tests & Implementation (6 files)
│ ├─ Step 31: T9 - **tests**/components/affiliate/stats-card.test.tsx (RED)
│ ├─ Step 32: F30 - components/affiliate/stats-card.tsx (GREEN)
│ ├─ Step 33: T10 - **tests**/components/affiliate/code-table.test.tsx (RED)
│ ├─ Step 34: F31 - components/affiliate/code-table.tsx (GREEN)
│ ├─ Step 35: T11 - **tests**/components/affiliate/commission-table.test.tsx (RED)
│ └─ Step 36: F32 - components/affiliate/commission-table.tsx (GREEN)
│
└─ Pages (8 files)
├─ Step 37: F22 - app/affiliate/layout.tsx
├─ Step 38: F23 - app/affiliate/register/page.tsx
├─ Step 39: F24 - app/affiliate/verify/page.tsx
├─ Step 40: F25 - app/affiliate/dashboard/page.tsx
├─ Step 41: F26 - app/affiliate/dashboard/codes/page.tsx
├─ Step 42: F27 - app/affiliate/dashboard/commissions/page.tsx
├─ Step 43: F28 - app/affiliate/dashboard/profile/page.tsx
└─ Step 44: F29 - app/affiliate/dashboard/profile/payment/page.tsx

TOTAL: 11 implementation files + 6 test files = 17 files

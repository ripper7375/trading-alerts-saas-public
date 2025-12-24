# Part 17B-1: Admin Portal - Backend & Reports with TDD

## ⚠️ CRITICAL: THIS IS PART 17B-1 OF 2 - REQUIRES PART 17A

**Part 17B is split into TWO parts:**

- **Part 17B-1 (THIS PART)**: Admin Backend + Reports (20 files, Steps 1-23)
- **Part 17B-2 (NEXT PART)**: Automation + Components (22 files, Steps 24-45)

**DEPENDENCIES - MUST VERIFY FIRST:**

# Check Part 17A files exist (CRITICAL)

ls -la lib/affiliate/code-generator.ts
ls -la lib/affiliate/commission-calculator.ts
ls -la lib/affiliate/report-builder.ts
ls -la lib/affiliate/validators.ts
ls -la lib/affiliate/constants.ts
ls -la app/api/affiliate/auth/register/route.ts
ls -la **tests**/setup.ts

**Dependencies from Part 17A (MUST EXIST)**
lib/affiliate/code-generator.ts # distributeCodes()
lib/affiliate/commission-calculator.ts # calculateCommission()
lib/affiliate/report-builder.ts # buildCodeInventoryReport()
lib/affiliate/validators.ts
lib/affiliate/constants.ts # AFFILIATE_CONFIG
**tests**/setup.ts
**tests**/helpers/supertest-setup.ts

## PART 17B-1 BUILD SEQUENCE: 20 FILES

PHASE 0: VERIFY DEPENDENCIES (3 steps)
├─ Step 1: VERIFY - Part 17A files exist
├─ Step 2: T1 - Verify setup.ts exists
└─ Step 3: T2 - Verify supertest-setup.ts exists

PHASE E: ADMIN BACKEND WITH TDD (14 files)
├─ Admin List & Detail (2 files)
│ ├─ Step 4: T3 - **tests**/lib/admin/affiliate-management.test.ts (RED)
│ ├─ Step 5: F1 - app/api/admin/affiliates/route.ts (GREEN)
│ └─ Step 6: F2 - app/api/admin/affiliates/[id]/route.ts
│
├─ Code Distribution (3 files)
│ ├─ Step 7: T4 - **tests**/lib/admin/code-distribution.test.ts (RED)
│ ├─ Step 8: F3 - app/api/admin/affiliates/[id]/distribute-codes/route.ts (GREEN)
│ ├─ Step 9: F4 - app/api/admin/affiliates/[id]/suspend/route.ts
│ └─ Step 10: F5 - app/api/admin/affiliates/[id]/reactivate/route.ts
│
├─ P&L Reports (6 files)
│ ├─ Step 11: T5 - **tests**/lib/admin/pnl-calculator.test.ts (RED)
│ ├─ Step 12: F6 - app/api/admin/affiliates/reports/profit-loss/route.ts (GREEN)
│ ├─ Step 13: F7 - app/api/admin/affiliates/reports/sales-performance/route.ts
│ ├─ Step 14: F8 - app/api/admin/affiliates/reports/commission-owings/route.ts
│ ├─ Step 15: F9 - app/api/admin/affiliates/reports/code-inventory/route.ts
│ ├─ Step 16: F10 - app/api/admin/commissions/pay/route.ts
│ └─ Step 17: F11 - app/api/admin/codes/[code]/cancel/route.ts

PHASE F: ADMIN FRONTEND (6 files)
├─ Step 18: F12 - app/admin/affiliates/page.tsx
├─ Step 19: F13 - app/admin/affiliates/[id]/page.tsx
├─ Step 20: F14 - app/admin/affiliates/reports/profit-loss/page.tsx
├─ Step 21: F15 - app/admin/affiliates/reports/sales-performance/page.tsx
├─ Step 22: F16 - app/admin/affiliates/reports/commission-owings/page.tsx
└─ Step 23: F17 - app/admin/affiliates/reports/code-inventory/page.tsx

TOTAL: 14 implementation files + 6 test files = 20 files

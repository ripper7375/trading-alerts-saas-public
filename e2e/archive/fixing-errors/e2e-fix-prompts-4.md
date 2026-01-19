## Prompt 4: Add Test Seed Data for Discount Codes

**Priority:** High
**Files:** 1 file
**Estimated Tests Fixed:** 60 (DSC-001 to DSC-011 API tests)

```
Please add discount code seed data to the database seeding script for E2E tests.

File to modify: prisma/seed.ts

Add the following test discount codes. First, check the Prisma schema for the DiscountCode model structure, then add seeding logic:

Required test codes:
1. TESTCODE10:
   - discountPercent: 10
   - commissionPercent: 5
   - status: 'ACTIVE'
   - expiresAt: 1 year from now

2. TESTCODE20:
   - discountPercent: 20
   - commissionPercent: 10
   - status: 'ACTIVE'
   - expiresAt: 1 year from now

3. EXPIREDCODE:
   - discountPercent: 15
   - commissionPercent: 7
   - status: 'EXPIRED'
   - expiresAt: yesterday (expired)

4. USEDCODE:
   - discountPercent: 10
   - commissionPercent: 5
   - status: 'USED'
   - usedAt: now
   - expiresAt: 1 year from now

5. SUSPENDEDAFF:
   - discountPercent: 10
   - commissionPercent: 5
   - status: 'ACTIVE'
   - expiresAt: 1 year from now
   - affiliateId: link to a test affiliate with SUSPENDED status

Implementation pattern:
1. Create or find a test affiliate user first
2. Use prisma.discountCode.upsert() for each code
3. Link codes to the test affiliate
4. For SUSPENDEDAFF code, ensure the linked affiliate has SUSPENDED status

Make sure to handle the case where the seed script runs multiple times (use upsert to avoid duplicates).
```

---

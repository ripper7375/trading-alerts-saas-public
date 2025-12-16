# Affiliate Marketing Platform - Integration Checklist

**Project:** Trading Alerts SaaS V7
**Feature:** 2-Sided Marketplace with Affiliate Self-Service Portal
**Created:** 2025-11-14
**Updated:** 2025-11-14 (Comprehensive Update)
**Current Milestone:** 1.6 (Phase 1: Documentation & Policies)

---

## 📋 OVERVIEW

This checklist outlines document updates needed to integrate the **comprehensive 2-sided marketplace platform** for affiliate marketing into Trading Alerts SaaS V7.

**Core Requirements:**

- Affiliate self-service registration and authentication
- Automated monthly code distribution (15 codes per affiliate)
- Accounting-style reports (code inventory, commission receivable)
- Admin business intelligence (P&L, Sales Performance, Commission Owings, Aggregate Inventory)
- 4 payment preference options
- Monthly automated processes

**Design Documents:**

- `/docs/AFFILIATE-MARKETING-DESIGN.md` - Complete technical design
- `/ui-frontend-user-journey/saas-user-journey-updated.md` - User flows (TO BE CREATED)
- `/ui-frontend-user-journey/mermaid-diagrams/journey-4-affiliate-registration.mermaid` - (TO BE CREATED)
- `/ui-frontend-user-journey/mermaid-diagrams/journey-5-affiliate-dashboard.mermaid` - (TO BE CREATED)
- `/ui-frontend-user-journey/mermaid-diagrams/journey-6-admin-affiliate-management.mermaid` - (TO BE CREATED)

---

## ✅ SCOPE SUMMARY

### What's Being Added

**Database:**

- 5 new tables: `Affiliate`, `AffiliateCode`, `Commission`, `SystemConfig`, `SystemConfigHistory`
- 4 new enums: `PaymentMethod`, `AffiliateStatus`, `CodeStatus`, `CommissionStatus`
- Updates to `User` table (role enum, relations)
- Updates to `Subscription` table (code tracking)

**API Endpoints:**

- 34+ new endpoints across authentication, dashboard, management, reporting, and configuration
  - Configuration: GET /api/config/affiliate (public)
  - Admin Settings: GET/PATCH /api/admin/settings/affiliate
  - Settings History: GET /api/admin/settings/affiliate/history

**Frontend:**

- Affiliate registration pages
- Affiliate login pages
- Affiliate dashboard (3 main pages)
- Admin affiliate management (5+ pages)
- Admin settings page (affiliate configuration management)
- Checkout integration (discount code input)
- Frontend hook: useAffiliateConfig() for dynamic percentages

**Background Jobs:**

- Monthly code distribution (Vercel Cron)
- Monthly code expiry (Vercel Cron)
- Monthly report emails (Vercel Cron)

**Estimated Files:** 60+ new files
**Estimated Build Time:** 120 hours (8 phases)

---

## 📄 DOCUMENTS REQUIRING UPDATES

### ✅ COMPLETED

1. **docs/AFFILIATE-MARKETING-DESIGN.md** ✅
   - Status: Complete comprehensive design specification
   - Sections: Executive Summary, Business Requirements, System Architecture, Database Schema, API Endpoints (30+), Implementation Phases
   - Time: 8 hours (completed)

2. **docs/AFFILIATE-MARKETING-INTEGRATION-CHECKLIST.md** ✅
   - Status: This document (being updated)
   - Time: 2 hours (in progress)

---

### ⏳ TO BE UPDATED

### 3. User Journey Documentation

**File:** `ui-frontend-user-journey/saas-user-journey-updated.md`

**Changes Required:**

- Add new Section 13: Affiliate Registration & Onboarding
- Add new Section 14: Affiliate Dashboard Daily Workflow
- Add new Section 15: Admin Affiliate Management
- Update Section 6 (Checkout) to include discount code input

**New Content Summary:**

```markdown
## 13. Affiliate Registration & Onboarding

- Public registration page
- Email verification flow
- Initial 15 codes distribution
- Welcome email with dashboard link

## 14. Affiliate Dashboard Daily Workflow

- Login to affiliate portal
- View code inventory report (with drill-downs)
- View commission receivable report (with drill-downs)
- Update profile and payment preferences
- Monitor conversions

## 15. Admin Affiliate Management

- List all affiliates
- View affiliate details
- Manual code distribution
- Cancel specific codes
- View P&L Report (3 months)
- View Sales Performance by Affiliate
- View Commission Owings Report
- Process bulk commission payouts
- View Aggregate Code Inventory
```

**Status:** ⏳ **TO BE CREATED**
**Estimated Time:** 4 hours

---

### 4. Mermaid Diagrams for Affiliate Workflows

**Files to Create:**

**a) journey-4-affiliate-registration.mermaid**

- Affiliate visits registration page
- Fills form with personal info and payment preferences
- Submits registration
- Receives verification email
- Clicks verification link
- Email verified → 15 codes generated
- Receives welcome email
- Logs in to dashboard

**b) journey-5-affiliate-dashboard.mermaid**

- Affiliate logs in
- Views dashboard overview (stats summary)
- Opens code inventory report
- Opens commission receivable report
- Clicks drill-down on "Earned" line item
- Views list of specific conversions
- Updates profile information
- Logs out

**c) journey-6-admin-affiliate-management.mermaid**

- Admin logs in
- Navigates to Affiliates section
- Views list of all affiliates
- Clicks on affiliate details
- Views affiliate performance stats
- Opens P&L Report
- Opens Sales Performance Report
- Opens Commission Owings Report
- Selects pending commissions
- Bulk marks as paid
- System sends payment notifications

**Status:** ⏳ **TO BE CREATED**
**Estimated Time:** 3 hours

---

### 5. Database Schema Documentation

**File:** `docs/v5-structure-division.md`

**Section:** Part 2: Database Schema & Migrations

**Changes Required:**

````markdown
## Affiliate Marketing Platform - Database Schema

### New Tables

#### Affiliate Table

Complete entity for affiliate marketers with authentication, profile, and payment preferences.

**Fields:**

- id, email (unique), password (hashed)
- emailVerified (timestamp)
- fullName, country
- Social media URLs (5 optional fields)
- paymentMethod (enum: BANK_TRANSFER | CRYPTO | GLOBAL_WALLET | LOCAL_WALLET)
- Payment details (conditional based on method):
  - Bank: bankName, bankAccountNumber, bankAccountHolder, bankSwiftCode, bankCurrency
  - Crypto: cryptoWalletAddress, cryptoNetwork
  - Global Wallet: paypalEmail, applePayId, googlePayEmail, stripeConnectId
  - Local Wallet: localWalletProvider, localWalletId, localWalletCurrency
- Tax info: taxId, vatNumber (optional)
- status (enum: PENDING_VERIFICATION | ACTIVE | SUSPENDED | TERMINATED)
- createdAt, updatedAt

**Relations:**

- codes → AffiliateCode[] (one-to-many)
- commissions → Commission[] (one-to-many)

#### AffiliateCode Table

Discount codes with comprehensive tracking (status lifecycle).

**Fields:**

- id, code (unique, >12 chars random)
- discountPercent, commissionPercent
- affiliateId (FK → Affiliate)
- distributedAt, expiresAt (auto-set to end of month)
- status (enum: ACTIVE | USED | EXPIRED | CANCELLED)
- usedBy (FK → User, nullable)
- usedAt (timestamp, nullable)
- cancelledBy (FK → User admin, nullable)
- cancelledAt, cancellationReason (nullable)
- createdAt, updatedAt

**Relations:**

- affiliate → Affiliate
- userWhoUsed → User (nullable)
- adminWhoCancelled → User (nullable)
- commissions → Commission[] (one-to-many)

#### Commission Table

Earnings tracking with payment status.

**Fields:**

- id
- affiliateId (FK → Affiliate)
- codeId (FK → AffiliateCode)
- userId (FK → User)
- subscriptionId (FK → Subscription, unique)
- regularPrice, discountPercent, discountedPrice
- commissionPercent, commissionAmount
- status (enum: PENDING | PAID | CANCELLED)
- paidAt, paidBy (FK → User admin)
- paymentReference, paymentMethod, paymentNotes
- createdAt, updatedAt

**Relations:**

- affiliate → Affiliate
- code → AffiliateCode
- user → User
- paidByUser → User (nullable)

#### SystemConfig Table

Centralized configuration for affiliate discount and commission percentages.

**Fields:**

- id
- key (unique, e.g., "affiliate_discount_percent", "affiliate_commission_percent")
- value (stored as string, parsed as needed)
- valueType ("number" | "boolean" | "string")
- description (human-readable explanation)
- category ("affiliate" | "payment" | "general")
- updatedBy (FK → User admin, nullable)
- updatedAt, createdAt

**Relations:**

- None (standalone configuration table)

**Purpose:** Allows admin to change affiliate percentages from dashboard. All pages automatically reflect new values within 1-5 minutes via SWR cache.

#### SystemConfigHistory Table

Audit trail for all configuration changes.

**Fields:**

- id
- configKey (which setting was changed)
- oldValue (previous value)
- newValue (new value)
- changedBy (admin user ID or email)
- changedAt (timestamp)
- reason (optional: why the change was made)

**Relations:**

- None (audit log table)

**Purpose:** Provides complete audit trail of all configuration changes. Admins can review who changed what, when, and why.

**Default Configuration Values:**

```typescript
const defaultConfig = [
  {
    key: 'affiliate_discount_percent',
    value: '20.0',
    valueType: 'number',
    description: 'Default discount percentage for affiliate codes',
    category: 'affiliate',
  },
  {
    key: 'affiliate_commission_percent',
    value: '20.0',
    valueType: 'number',
    description: 'Default commission percentage for affiliates',
    category: 'affiliate',
  },
  {
    key: 'affiliate_codes_per_month',
    value: '15',
    valueType: 'number',
    description: 'Number of codes distributed to each affiliate monthly',
    category: 'affiliate',
  },
];
```
````

### Updated Tables

#### User Table

**New Fields:**

- role (enum: USER | ADMIN)

**New Relations:**

- codeUsages → AffiliateCode[]
- codeCancellations → AffiliateCode[]
- commissions → Commission[]
- paidCommissions → Commission[]

#### Subscription Table

**New Fields:**

- codeId (FK → AffiliateCode, nullable)
- originalPrice (Decimal, nullable)
- discountedPrice (Decimal, nullable)

````

**Status:** ⏳ **TO BE UPDATED**
**Estimated Time:** 2 hours

---

### 6. API Specification (OpenAPI)

**File:** `docs/trading_alerts_openapi.yaml`

**Changes Required:**

**New Tag:**
```yaml
tags:
  - name: Affiliate Marketing
    description: 2-sided marketplace for affiliate marketers
````

**New Endpoint Groups:**

1. **Affiliate Authentication** (5 endpoints)
   - POST /api/affiliate/register
   - POST /api/affiliate/verify-email
   - POST /api/affiliate/login
   - POST /api/affiliate/forgot-password
   - POST /api/affiliate/reset-password

2. **Affiliate Dashboard** (4 endpoints)
   - GET /api/affiliate/dashboard
   - GET /api/affiliate/codes/inventory
   - GET /api/affiliate/commissions/receivable
   - GET /api/affiliate/profile
   - PATCH /api/affiliate/profile

3. **Admin Affiliate Management** (6 endpoints)
   - GET /api/admin/affiliates
   - GET /api/admin/affiliates/:id
   - POST /api/admin/affiliates/:id/distribute-codes
   - PATCH /api/admin/affiliates/:id/status
   - POST /api/admin/affiliates/codes/:id/cancel

4. **Admin Business Intelligence** (5 endpoints)
   - GET /api/admin/reports/profit-loss
   - GET /api/admin/reports/sales-performance
   - GET /api/admin/reports/sales-performance/:affiliateId
   - GET /api/admin/reports/commission-owings
   - POST /api/admin/reports/commission-owings/bulk-pay
   - GET /api/admin/reports/aggregate-code-inventory

5. **Public** (1 endpoint)
   - POST /api/public/validate-code

**Updated Endpoint:**

- POST /api/checkout/create-session (add optional discountCode field)

**New Schemas (10+):**

- Affiliate
- AffiliateCode
- Commission
- PaymentMethod enum
- AffiliateStatus enum
- CodeStatus enum
- CommissionStatus enum
- RegisterAffiliateRequest
- CodeInventoryReport
- CommissionReceivableReport
- ProfitLossReport
- SalesPerformanceReport
- CommissionOwingsReport
- AggregateCodeInventoryReport
- ... and more

**Status:** ⏳ **TO BE UPDATED**
**Estimated Time:** 4 hours

---

### 7. Architecture Rules

**File:** `docs/policies/03-architecture-rules.md`

**New Section to Add:**

```markdown
## 10. AFFILIATE MARKETING PLATFORM RULES

### 10.1 Affiliate Authentication

- Separate authentication from end users (different JWT tokens)
- Email verification REQUIRED before code generation
- Password hashing: bcrypt with 10 rounds minimum

### 10.2 Code Generation

- MUST use crypto.randomBytes for secure random generation
- Minimum length: 12 characters
- Format: Random alphanumeric (case-sensitive)
- Uniqueness check before insertion

### 10.3 Monthly Automation

- Code distribution: 1st of month, 00:00 UTC
- Code expiry: Last day of month, 23:59 UTC
- Report emails: 1st of month, 09:00 UTC
- Use Vercel Cron for scheduling

### 10.4 Code Lifecycle Management

- Status transitions:
  - ACTIVE → USED (when redeemed)
  - ACTIVE → EXPIRED (monthly automation)
  - ACTIVE → CANCELLED (admin action)
- One-time use enforcement (status check)

### 10.5 Commission Calculation

- ALWAYS use centralized utility: lib/affiliate/commission.ts
- Formula: (regularPrice × (100% - discount%)) × commission%
- Round to 2 decimal places
- NEVER calculate inline in components

### 10.6 Report Generation

- Opening/closing balance calculation
- Monthly aggregation queries
- Drill-down data structure
- Chart data preparation
- PDF export (future enhancement)

### 10.7 Payment Processing

- Admin manually processes external payments
- Bulk payment operations supported
- Payment reference tracking
- Payment method copied from affiliate profile
- Email notifications after payment

### 10.8 Security

- Admin-only endpoints: require ADMIN role
- Affiliate endpoints: require affiliate authentication
- Rate limiting on code validation: 10/15min
- Audit logging for admin actions
- SQL injection prevention (use Prisma)
```

**Status:** ⏳ **TO BE UPDATED**
**Estimated Time:** 1.5 hours

---

### 8. Coding Patterns

**File:** `docs/policies/05-coding-patterns.md`

**New Patterns to Add:**

```markdown
## Pattern 9: Affiliate Self-Registration with Email Verification

## Pattern 10: Accounting-Style Report Generation

## Pattern 11: Monthly Cron Job (Code Distribution/Expiry)

## Pattern 12: Bulk Commission Payment Operation

## Pattern 13: Drill-Down Report Implementation
```

**Status:** ⏳ **TO BE UPDATED**
**Estimated Time:** 2 hours

---

### 9. Project Structure

**File:** `docs/v5-structure-division.md`

**New Part to Add:**

```markdown
## PART 18: Affiliate Marketing Platform (2-Sided Marketplace)

**Scope:** Complete affiliate self-service portal, admin management, business intelligence

**Folders & Files:**
```

app/affiliate/
├── (auth)/
│ ├── register/page.tsx
│ ├── login/page.tsx
│ ├── verify-email/page.tsx
│ └── reset-password/page.tsx
├── dashboard/
│ ├── page.tsx # Overview
│ ├── codes/page.tsx # Code inventory
│ ├── commissions/page.tsx # Commission receivable
│ └── profile/page.tsx # Profile management

app/api/affiliate/
├── register/route.ts
├── verify-email/route.ts
├── login/route.ts
├── forgot-password/route.ts
├── reset-password/route.ts
├── dashboard/route.ts
├── codes/
│ └── inventory/route.ts
├── commissions/
│ └── receivable/route.ts
└── profile/route.ts

app/admin/affiliates/
├── page.tsx # List all affiliates
├── [id]/page.tsx # Affiliate details
├── reports/
│ ├── profit-loss/page.tsx
│ ├── sales-performance/page.tsx
│ ├── commission-owings/page.tsx
│ └── code-inventory/page.tsx

app/api/admin/affiliates/
├── route.ts
├── [id]/
│ ├── route.ts
│ ├── distribute-codes/route.ts
│ └── status/route.ts
├── codes/
│ └── [id]/
│ └── cancel/route.ts
└── reports/
├── profit-loss/route.ts
├── sales-performance/
│ ├── route.ts
│ └── [affiliateId]/route.ts
├── commission-owings/
│ ├── route.ts
│ └── bulk-pay/route.ts
└── aggregate-code-inventory/route.ts

app/api/public/
└── validate-code/route.ts

app/api/cron/
├── monthly-code-distribution/route.ts
├── monthly-code-expiry/route.ts
└── monthly-reports/route.ts

lib/affiliate/
├── auth.ts # Authentication utilities
├── code-generator.ts # Secure random code generation
├── commission.ts # Commission calculation
├── validator.ts # Code validation
├── reports/
│ ├── code-inventory.ts
│ ├── commission-receivable.ts
│ ├── profit-loss.ts
│ ├── sales-performance.ts
│ └── aggregate-inventory.ts
└── **tests**/
├── code-generator.test.ts
├── commission.test.ts
├── validator.test.ts
└── reports.test.ts

components/affiliate/
├── registration-form.tsx
├── login-form.tsx
├── dashboard-overview.tsx
├── code-inventory-table.tsx
├── commission-table.tsx
├── profile-form.tsx
└── payment-preferences-form.tsx

components/admin/affiliate/
├── affiliate-list.tsx
├── affiliate-details.tsx
├── code-distribution-form.tsx
├── profit-loss-report.tsx
├── sales-performance-table.tsx
├── commission-owings-table.tsx
├── bulk-payment-modal.tsx
└── aggregate-inventory-chart.tsx

components/checkout/
├── discount-code-input.tsx # Updated
└── price-breakdown.tsx # Updated

lib/email/
├── affiliate-welcome.ts
├── affiliate-code-used.ts
├── affiliate-payment-confirmed.ts
└── affiliate-monthly-report.ts

```

**File Count:** ~60 files

**Implementation Notes:**
- Build AFTER Parts 1-17 (core features must exist first)
- Requires authentication system (Part 5)
- Requires Stripe integration (Part 12)
- Requires admin dashboard (Part 14)
- Separate from core user flows

**Dependencies:**
- Part 2: Database Schema (extend with 3 tables)
- Part 5: Authentication (add affiliate auth)
- Part 12: E-commerce (integrate discount codes)
- Part 14: Admin Dashboard (add affiliate management)
```

**Status:** ⏳ **TO BE UPDATED**
**Estimated Time:** 1 hour

---

### 10. Progress Tracking

**File:** `PROGRESS.md`

**Updates Required:**

1. **Update Overall Progress Metrics:**

```markdown
## 📊 Overall Progress

| Metric              | Status       | Notes                          |
| ------------------- | ------------ | ------------------------------ |
| **Total Files**     | 0 / 230 (0%) | 170 core + 60 affiliate        |
| **Parts Completed** | 0 / 18 (0%)  | 17 core + 1 affiliate platform |
| **Estimated Time**  | ~181 hours   | 61h core + 120h affiliate      |
```

2. **Add PART 18 to Build Order:**

```markdown
### PART 18: Affiliate Marketing Platform (Weeks 11-14, 120 hours)

**What:** Complete 2-sided marketplace with affiliate self-service portal

**Prerequisites:**

- ✅ Parts 1-17 complete (all core features working)

**Phases:**

1. Database & Infrastructure (16h)
2. Affiliate Authentication (16h)
3. Affiliate Dashboard (24h)
4. Admin Management (20h)
5. Admin BI Reports (24h)
6. Checkout Integration (12h)
7. Automation & Webhooks (16h)
8. Testing & Documentation (12h)

**Testing Checklist:**

- [ ] Affiliate registration works
- [ ] Email verification works
- [ ] 15 codes generated on verification
- [ ] Affiliate can login
- [ ] Code inventory report accurate
- [ ] Commission receivable report accurate
- [ ] Profile updates work
- [ ] Admin can view all affiliates
- [ ] Admin can distribute codes manually
- [ ] Admin can cancel codes
- [ ] P&L report accurate
- [ ] Sales performance report accurate
- [ ] Commission owings report accurate
- [ ] Bulk payment works
- [ ] Aggregate inventory report accurate
- [ ] Discount code validation works
- [ ] Checkout integration works
- [ ] Commission created on payment
- [ ] Monthly automation works
- [ ] Emails sent correctly
```

**Status:** ⏳ **TO BE UPDATED**
**Estimated Time:** 1 hour

---

## 📊 UPDATE SUMMARY

### Documents Status

| #   | Document                                     | Status      | Est. Time |
| --- | -------------------------------------------- | ----------- | --------- |
| 1   | AFFILIATE-MARKETING-DESIGN.md                | ✅ Complete | 8h (done) |
| 2   | AFFILIATE-MARKETING-INTEGRATION-CHECKLIST.md | ✅ Complete | 2h (done) |
| 3   | saas-user-journey-updated.md                 | ⏳ Pending  | 4h        |
| 4   | Mermaid diagrams (3 new files)               | ⏳ Pending  | 3h        |
| 5   | v5-structure-division.md                     | ⏳ Pending  | 2h        |
| 6   | trading_alerts_openapi.yaml                  | ⏳ Pending  | 4h        |
| 7   | 03-architecture-rules.md                     | ⏳ Pending  | 1.5h      |
| 8   | 05-coding-patterns.md                        | ⏳ Pending  | 2h        |
| 9   | PROGRESS.md                                  | ⏳ Pending  | 1h        |

**Total Estimated Time:** 27.5 hours

- Completed: 10 hours
- Remaining: 17.5 hours

---

## 🎯 RECOMMENDED WORKFLOW

### Option A: Update All Now (Before Phase 2)

**Workflow:**

1. Complete all document updates (17.5 hours)
2. Regenerate OpenAPI types (include affiliate endpoints)
3. Start Phase 2 with complete documentation

**Pros:**

- All documentation ready before building
- OpenAPI types include affiliate models
- Aider has full context from start

**Cons:**

- Delays Phase 2 start by ~2-3 weeks
- Large upfront documentation effort

---

### Option B: Phased Documentation Updates ✨ **RECOMMENDED**

**Workflow:**

**Now (Week 1):**

1. ✅ AFFILIATE-MARKETING-DESIGN.md (done)
2. ✅ AFFILIATE-MARKETING-INTEGRATION-CHECKLIST.md (done)
3. Review and approve design decisions

**Later (Week 10 - Before Part 18):**

1. ⏳ Create user journeys and mermaid diagrams (7h)
2. ⏳ Update database schema docs (2h)
3. ⏳ Update OpenAPI spec (4h)
4. ⏳ Update architecture rules (1.5h)
5. ⏳ Update coding patterns (2h)
6. ⏳ Update progress tracking (1h)
7. Regenerate OpenAPI types
8. Begin Part 18 implementation

**Pros:**

- Can start Phase 2 immediately
- Core features built first
- Documentation updated when needed
- Less cognitive overhead

**Cons:**

- Two documentation sessions
- Need to remember to update before Part 18

---

## ✅ IMMEDIATE NEXT STEPS

### This Week:

1. **Review Design Document**
   - Read `docs/AFFILIATE-MARKETING-DESIGN.md`
   - Review Section 15 (Design Decisions & Open Questions)
   - Approve or request changes

2. **Choose Workflow**
   - Option A: Update all docs now
   - Option B: Update later (Week 10) ← Recommended

3. **Complete Phase 1**
   - Finish Milestone 1.6 (Aider comprehension)
   - Complete Milestone 1.7 (Readiness check)

4. **Begin Phase 2** (if Option B)
   - Create Next.js project
   - Setup database
   - Generate OpenAPI types (core features only for now)

### Week 10 (if Option B):

5. **Complete Documentation Updates**
   - Create user journey documentation
   - Create 3 new mermaid diagrams
   - Update 5 existing documents
   - Regenerate OpenAPI types with affiliate models

6. **Begin Part 18 Implementation**
   - Database migration (3 tables, 4 enums)
   - Affiliate authentication system
   - Affiliate dashboard
   - Admin management and BI reports
   - Checkout integration
   - Monthly automation
   - Comprehensive testing

---

## 📞 QUESTIONS?

**Design Decisions:**

- See Section 15 of AFFILIATE-MARKETING-DESIGN.md

**Technical Implementation:**

- See Sections 3-8 of AFFILIATE-MARKETING-DESIGN.md

**API Endpoints:**

- See Section 5 of AFFILIATE-MARKETING-DESIGN.md

**Database Schema:**

- See Section 4 of AFFILIATE-MARKETING-DESIGN.md

**Testing Strategy:**

- See Section 12 of AFFILIATE-MARKETING-DESIGN.md

---

**Document Status:** Complete Integration Checklist
**Ready for:** Review and Workflow Decision
**Next Step:** User chooses Option A or B (recommended: B)
**Created:** 2025-11-14
**Last Updated:** 2025-11-14

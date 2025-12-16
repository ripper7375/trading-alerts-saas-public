# 🎯 Aider Prompts Reference (CORRECTED)

**Critical Update:** Use `/read-only` for build order files, NOT `/add`

## 🌟 V0 Seed Code References - Automatically Available

**IMPORTANT:** Aider automatically loads 52 seed code reference files via `.aider.conf.yml`:

- **31 V0 page.tsx components** - UI demo implementations
- **20 V0 custom components** - Business logic patterns
- **1 Python AI engine** - Market AI engine for Part 6

These files are configured as **read-only references** and provide:

- UI layout patterns and component structure
- Form handling and validation examples
- React patterns and TypeScript types
- Styling conventions (Tailwind CSS)
- Interactive behaviors and state management

# Custom system message additions

extra-prompt: |
CRITICAL DATABASE CONFIGURATION:

- All code must pass 108 test suite

**You don't need to manually load these files** - they're automatically available in every Aider session.

**Relevant seed components by part:**

- **Part 5 (Authentication):** next-js-login-form, registration-form-component-v2, forgot-password-form
- **Part 6 (Flask MT5):** market_ai_engine.py (Python reference)
- **Part 8 (Dashboard):** dashboard-home-component, dashboard-layout-component, dashboard-navigation-footer
- **Part 9 (Charts):** trading-chart-component, chart-controls-component
- **Part 10 (Watchlist):** watchlist-page-component
- **Part 11 (Alerts):** alerts-list-page, alert-creation-modal-component, alert-card-component
- **Part 12 (E-commerce):** pricing-table-component
- **Part 13 (Settings):** settings-page-layout-component, profile-settings-page, subscription-management-page
- **Part 15 (Notifications):** notification-bell-icon-component
- **Part 16 (Utilities):** empty-states-component, user-menu-component
- **Part 17 (Affiliate):** affiliate-dashboard-component, affiliate-portal-referrals-page, admin-affiliate-analytics-page
- **Part 18 (dLocal):** part-18-payment-method-selector, part-18-price-display-component, part-18-unified-checkout

**Note:** Build order files now reference these correct V0 paths with the actual folder structure (e.g., `seed-code/v0-components/next-js-login-form/app/page.tsx`).

---

## 📌 Starting Part 1 (Foundation)

```bash
# Load files (READ-ONLY!)
/read-only docs/build-orders/part-01-foundation.md
/read-only docs/implementation-guides/v5_part_a.md
```

```
Build Part 1: Foundation & Root Configuration

Follow the build order in part-01-foundation.md exactly.

Requirements:
- Build all 12 files in sequence
- Use patterns from 05-coding-patterns-compress.md
- QUALITY GATES (MANDATORY):
  * All functions must have explicit return types
  * No 'any' types (use proper TypeScript interfaces)
  * Try-catch blocks in all async functions
  * No console.log() statements (use console.error for errors)
  * Protected routes must check session
  * Input validation with Zod schemas for POST/PATCH/PUT
- Run validation after each file: npm run validate
- Auto-fix minor issues: npm run fix
- Auto-commit each file if approved
- Report progress after every 3 files

Start with File 1/12: .vscode/settings.json
```

---

## 📌 Continuing to Next File in Same Part

```
Continue with next file in Part 1.

Current: File 3/12 completed
Next: File 4/12: tailwind.config.ts

Follow the build order specifications.
```

---

## 📌 Starting Part 2 (Database)

```bash
# Drop Part 1 files first
/drop docs/build-orders/part-01-foundation.md
/drop docs/implementation-guides/v5_part_a.md

# Load Part 2 files (READ-ONLY!)
/read-only docs/build-orders/part-02-database.md
/read-only docs/implementation-guides/v5_part_b.md
```

```
Build Part 2: Database Schema & Migrations

Follow the build order in part-02-database.md exactly.

Requirements:
- Build all 4 files in sequence
- Generate Prisma schema with 2-tier system (FREE/PRO)
- Run prisma generate after schema created
- QUALITY GATES (MANDATORY):
  * All functions must have explicit return types
  * No 'any' types (use proper TypeScript interfaces)
  * Try-catch blocks in all async functions
  * No console.log() statements (use console.error for errors)
- Run validation after each file: npm run validate
- Auto-fix minor issues: npm run fix
- Auto-commit approved files

Start with File 1/4: prisma/schema.prisma
```

---

## 📌 Starting Part 3 (Type Definitions)

```bash
# Drop Part 2 files
/drop docs/build-orders/part-02-database.md
/drop docs/implementation-guides/v5_part_b.md

# Load Part 3 files (READ-ONLY!)
/read-only docs/build-orders/part-03-types.md
/read-only docs/implementation-guides/v5_part_c.md
```

```
Build Part 3: Type Definitions

Follow the build order in part-03-types.md exactly.

Requirements:
- Build all 6 type files in sequence
- Ensure strict TypeScript compliance
- Match OpenAPI specifications
- QUALITY GATES (MANDATORY):
  * All functions must have explicit return types
  * No 'any' types (use proper TypeScript interfaces)
  * All exports properly typed
  * Import from generated OpenAPI types where applicable
- Run validation after each file: npm run validate
- Auto-fix minor issues: npm run fix
- Auto-commit approved files

Start with File 1/6: types/user.ts
```

---

## 📌 Starting Part 4 (Tier System)

```bash
/drop docs/build-orders/part-03-types.md
/drop docs/implementation-guides/v5_part_c.md

/read-only docs/build-orders/part-04-tier-system.md
/read-only docs/implementation-guides/v5_part_d.md
```

```
Build Part 4: Tier System

Follow the build order in part-04-tier-system.md exactly.

Requirements:
- Build all 4 tier management files
- Implement FREE and PRO tier logic
- TIER VALIDATION QUALITY GATES (MANDATORY):
  * Symbol/timeframe restrictions enforced
  * Tier checks before all operations
  * Return 403 with clear message if tier insufficient
  * Use validateTierAccess() helper consistently
  * All functions have explicit return types
  * No 'any' types
  * Try-catch blocks in all async functions
- Run validation after each file: npm run validate
- Auto-commit approved files

Start with File 1/4: lib/tier-validation.ts
```

---

## 📌 Starting Part 5 (Authentication)

```bash
/drop docs/build-orders/part-04-tier-system.md
/drop docs/implementation-guides/v5_part_d.md

/read-only docs/build-orders/part-05-authentication.md
/read-only docs/implementation-guides/v5_part_e.md
/read-only docs/implementation-guides/v5_part_q.md
/read-only docs/policies/08-google-oauth-implementation-rules.md
/read-only docs/OAUTH_IMPLEMENTATION_READY.md
```

```
Build Part 5: Authentication (Unified System with RBAC)

Follow the build order in part-05-authentication.md exactly.

**V0 Seed Components Available (auto-loaded):**
- next-js-login-form/app/page.tsx + components/login-form.tsx
- registration-form-component-v2/app/page.tsx + components/registration-form.tsx
- forgot-password-form/app/page.tsx + components/forgot-password-flow.tsx

Use these as UI/UX patterns for form layouts, validation, and user flows.

Requirements:
- Build all 20 authentication files (includes admin login page)
- Implement Google OAuth + Email/Password (NextAuth v4)
- Implement unified authentication for SaaS users, affiliates, AND admins (RBAC)
- Follow 08-google-oauth-implementation-rules.md
- IMPORTANT: Unified Auth Approach
  * Single NextAuth system for all user types
  * Role-based access control (USER/ADMIN roles)
  * Affiliate status via User.isAffiliate boolean flag
  * Admin accounts: 2 fixed, pre-seeded (no dynamic admin registration)
  * Admin login page: /admin/login (credentials only, no Google OAuth)
  * Helpers: requireAffiliate(), requireAdmin(), isAffiliate(), isAdmin(), getAffiliateProfile()
  * Permissions: affiliate_dashboard, affiliate_codes, admin_dashboard, admin_users, admin_reports, etc.
- SECURITY QUALITY GATES (MANDATORY):
  * Session validation on every protected route
  * Return 401 for missing auth, 403 for forbidden
  * Verify resource ownership (userId matches session.user.id)
  * Admin routes use requireAdmin() helper (checks role='ADMIN')
  * Affiliate routes use requireAffiliate() helper (checks isAffiliate=true)
  * No hardcoded secrets or credentials
  * Proper error messages (user-friendly)
  * All functions have explicit return types
  * No 'any' types
  * Try-catch blocks in all async functions
  * Use type casts for Prisma enums (tier as 'FREE'|'PRO', role as 'USER'|'ADMIN')
- Run validation after each file: npm run validate
- Auto-commit approved files

Files to build:
1-2: Type extensions (Session, User, JWT with tier, role, isAffiliate)
3-5: NextAuth config, session helpers (including admin/affiliate), permissions
6-10: API routes (register, verify, forgot/reset password)
11-17: Frontend pages (login, register, verify, forgot/reset, admin login)
18-20: Components (register form, login form, social auth buttons)

Admin Account Seeding:
- Create prisma/seed.ts with 2 admin accounts:
  * Admin 1: admin@tradingalerts.com (role='ADMIN', isAffiliate=false)
  * Admin 2: admin-affiliate@tradingalerts.com (role='ADMIN', isAffiliate=true, has AffiliateProfile)
- Run: npx prisma db seed

Start with File 1/20: types/next-auth.d.ts
```

---

## 📌 Starting Part 6 (Flask MT5 Service)

```bash
/drop docs/build-orders/part-05-authentication.md
/drop docs/implementation-guides/v5_part_e.md
/drop docs/policies/08-google-oauth-implementation-rules.md
/drop docs/OAUTH_IMPLEMENTATION_READY.md

/read-only docs/build-orders/part-06-flask-mt5.md
/read-only docs/implementation-guides/v5_part_f.md
/read-only docs/flask_mt5_openapi.yaml
```

```
Build Part 6: Flask MT5 Service

Follow the build order in part-06-flask-mt5.md exactly.

**Python Seed Reference Available (auto-loaded):**
- seed-code/market_ai_engine.py - Market AI engine logic and data processing patterns

Use this as reference for Flask structure, MT5 integration patterns, and AI engine logic.

Requirements:
- Build all 15 Flask microservice files
- Follow flask_mt5_openapi.yaml specification
- Implement MT5 integration
- Include error handling and logging
- QUALITY GATES (MANDATORY):
  * All functions must have explicit return types (Python type hints)
  * Try-except blocks in all async functions
  * No print() statements (use logging.error for errors)
  * Protected endpoints must check authentication
  * Input validation with Pydantic models
- Run validation after each file: npm run validate
- Auto-commit approved files

Start with File 1/15: mt5-service/app.py
```

---

## 📌 Complete Part → Implementation Guide Mapping

**IMPORTANT:** Use this table to load the correct implementation guide for each part.

| Part | Build Order File             | Implementation Guide | Status                            |
| ---- | ---------------------------- | -------------------- | --------------------------------- |
| 1    | part-01-foundation.md        | v5_part_a.md         | ✅ Exists                         |
| 2    | part-02-database.md          | v5_part_b.md         | ✅ Exists                         |
| 3    | part-03-types.md             | v5_part_c.md         | ✅ Exists                         |
| 4    | part-04-tier-system.md       | v5_part_d.md         | ✅ Exists                         |
| 5    | part-05-authentication.md    | v5_part_e.md         | ✅ Exists                         |
| 6    | part-06-flask-mt5.md         | v5_part_f.md         | ✅ Exists                         |
| 7    | part-07-indicators-api.md    | v5_part_g.md         | ✅ Exists                         |
| 8    | part-08-dashboard.md         | v5_part_h.md         | ✅ Exists                         |
| 9    | part-09-charts.md            | v5_part_i.md         | ✅ Exists                         |
| 10   | part-10-watchlist.md         | v5_part_j.md         | ✅ Exists                         |
| 11   | part-11-alerts.md            | v5_part_k.md         | ✅ Exists                         |
| 12   | part-12-ecommerce.md         | v5_part_l.md         | ✅ Exists                         |
| 13   | part-13-settings.md          | v5_part_m.md         | ✅ Exists                         |
| 14   | part-14-admin.md             | v5_part_n.md         | ✅ Exists                         |
| 15   | part-15-notifications.md     | v5_part_o.md         | ✅ Exists                         |
| 16   | part-16-utilities.md         | v5_part_p.md         | ✅ Exists                         |
| 17A  | part-17a-affiliate-portal.md | v5_part_q.md         | ✅ Exists (32 files - Phases A-D) |
| 17B  | part-17b-admin-automation.md | v5_part_q.md         | ✅ Exists (35 files - Phases E-H) |
| 18   | part-18-dlocal.md            | v5_part_r.md         | ✅ Exists (37 files - 2680 lines) |

**All implementation guides now exist and are ready for use!**

**Note:** Part 17 was split into 17A and 17B (67 files total) to prevent token overflow during building. Build 17A first, then 17B.

---

## 📌 Starting Parts 7-16 (Standard Parts)

**Template for Parts 7-16:**

```bash
# Drop previous part files
/drop docs/build-orders/part-0X-[previous].md
/drop docs/implementation-guides/v5_part_[previous].md

# Load new part files (READ-ONLY!)
/read-only docs/build-orders/part-0X-[name].md
/read-only docs/implementation-guides/v5_part_[letter].md
```

**Quick Reference for Parts 7-16:**

- Part 7: v5_part_g.md (Indicators API)
- Part 8: v5_part_h.md (Dashboard)
- Part 9: v5_part_i.md (Charts)
- Part 10: v5_part_j.md (Watchlist)
- Part 11: v5_part_k.md (Alerts)
- Part 12: v5_part_l.md (E-commerce)
- Part 13: v5_part_m.md (Settings)
- Part 14: v5_part_n.md (Admin)
- Part 15: v5_part_o.md (Notifications)
- Part 16: v5_part_p.md (Utilities)

```
Build Part X: [Part Name]

Follow the build order in part-0X-[name].md exactly.

**V0 Seed Components:** Check the "Relevant seed components by part" section at the top of this document to see which V0 components are available for this part. These are automatically loaded and provide UI patterns, component structure, and business logic examples.

Requirements:
- Build all files in sequence
- Use patterns from 05-coding-patterns-compress.md
- Reference V0 seed components for UI/UX patterns where applicable
- QUALITY GATES (MANDATORY):
  * All functions must have explicit return types
  * No 'any' types (use proper TypeScript interfaces)
  * Try-catch blocks in all async functions
  * No console.log() statements (use console.error for errors)
  * Protected routes must check session
  * Input validation with Zod schemas for POST/PATCH/PUT
- Run validation after each file: npm run validate
- Auto-fix minor issues: npm run fix
- Auto-commit approved files
- Report progress regularly

Start with File 1/[total]: [first-file]
```

---

## 📌 Part 17A (Affiliate Portal - 32 files)

```bash
/drop docs/build-orders/part-16-utilities.md
/drop docs/implementation-guides/v5_part_p.md

/read-only docs/build-orders/part-17a-affiliate-portal.md
/read-only docs/implementation-guides/v5_part_q.md
/read-only docs/AFFILIATE-MARKETING-DESIGN.md
```

```
Build Part 17A: Affiliate Portal (Phases A-D)

Follow the build order in part-17a-affiliate-portal.md exactly.

**V0 Seed Components Available (auto-loaded):**
- affiliate-dashboard-component/app/page.tsx + components/affiliate-dashboard.tsx
- affiliate-portal-referrals-page/app/page.tsx + components/affiliate-referrals.tsx
- admin-affiliate-analytics-page/app/page.tsx

Use these as UI patterns for affiliate portal pages, dashboard layouts, and data visualization.

Requirements:
- Build all 32 files in sequence (Phases A, B, C, D)
- Phase A (Files 1-10): Foundation - Database models, business logic, email templates
- Phase B (Files 11-21): Affiliate Portal Backend - API routes
- Phase C (Files 22-23): Stripe Integration - Affiliate code discount
- Phase D (Files 24-32): Affiliate Portal Frontend - Pages and UI
- QUALITY GATES (MANDATORY):
  * All functions must have explicit return types
  * No 'any' types (use proper TypeScript interfaces)
  * Try-catch blocks in all async functions
  * No console.log() statements (use console.error for errors)
  * Protected routes must check affiliate JWT
  * Input validation with Zod schemas for POST/PATCH/PUT
  * Commission creation ONLY via Stripe webhook
- Run validation after each file: npm run validate
- Auto-fix minor issues: npm run fix
- Auto-commit approved files
- Report progress after every 5-8 files

Start with File 1/32: prisma/schema.prisma (UPDATE EXISTING)
Complete through File 32/32.
```

---

## 📌 Part 17B (Admin Portal & Automation - 35 files)

```bash
/drop docs/build-orders/part-17a-affiliate-portal.md

/read-only docs/build-orders/part-17b-admin-automation.md
/read-only docs/implementation-guides/v5_part_q.md
```

```
Build Part 17B: Admin Portal & Automation (Phases E-H)

Follow the build order in part-17b-admin-automation.md exactly.

**V0 Seed Components Available (auto-loaded):**
- admin-affiliate-analytics-page/app/page.tsx
- affiliate-dashboard-component/components/affiliate-dashboard.tsx (for admin views)

Use these as UI patterns for admin BI reports, analytics dashboards, and data tables.

Requirements:
- Build all 35 files in sequence (Phases E, F, G, H)
- Phase E (Files 1-11): Admin Portal Backend - Affiliate management API
- Phase F (Files 12-17): Admin Portal Frontend - BI reports pages
- Phase G (Files 18-21): Cron Jobs - Automated code distribution, expiry, reports
- Phase H (Files 22-35): Components - Reusable UI components
- QUALITY GATES (MANDATORY):
  * All functions must have explicit return types
  * No 'any' types (use proper TypeScript interfaces)
  * Try-catch blocks in all async functions
  * No console.log() statements (use console.error for errors)
  * Admin routes must check admin role
  * Input validation with Zod schemas for POST/PATCH/PUT
- Run validation after each file: npm run validate
- Auto-fix minor issues: npm run fix
- Auto-commit approved files
- Report progress after every 5-8 files

Start with File 1/35: app/api/admin/affiliates/route.ts
Complete through File 35/35.
```

---

## 📌 Part 18 (dLocal Payments - 37 files) - Multi-Session

### **Session 1: Database & Types & Services (Files 1-9)**

```bash
/drop docs/build-orders/part-17b-admin-automation.md
/drop docs/implementation-guides/v5_part_q.md

/read-only docs/build-orders/part-18-dlocal.md
/read-only docs/implementation-guides/v5_part_r.md
/read-only docs/dlocal-openapi-endpoints.yaml
```

```
Build Part 18 Session 1: dLocal Foundation

Follow the build order in part-18-dlocal.md.

**V0 Seed Components Available (auto-loaded):**
- part-18-payment-method-selector/app/page.tsx + components/payment-method-selector.tsx
- part-18-price-display-component/app/page.tsx + components/price-display.tsx
- part-18-unified-checkout/app/checkout/page.tsx
- part-18-renewal-reminder-email/app/preview-renewal-email/page.tsx

Use these as UI patterns for payment flows, price displays, and checkout experiences.

Requirements:
- Build Files 1-9 (Database Layer, Types & Constants, Services)
- Files 1-2: Database models (Payment, Subscription fields)
- Files 3-5: Type definitions (dLocal types, country/currency/payment constants)
- Files 6-9: Services (currency converter, payment methods, dLocal payment, country detector)
- Follow dlocal-openapi-endpoints.yaml specification
- Follow 07-dlocal-integration-rules-compress.md
- QUALITY GATES (MANDATORY):
  * All functions must have explicit return types
  * No 'any' types (use proper TypeScript interfaces)
  * Try-catch blocks in all async functions
  * No hardcoded API keys (use environment variables)
- Run validation after each file: npm run validate
- Auto-fix minor issues: npm run fix
- Auto-commit approved files

Start with File 1/37: prisma/schema.prisma (UPDATE EXISTING)
Stop after File 9/37.
```

### **Session 2: API Routes (Files 10-18)**

```
Build Part 18 Session 2: dLocal Payment API Routes

Continue Part 18 with Files 10-18.

**V0 Seed Components:** Same as Session 1 - all Part 18 components are available for reference.

Requirements:
- Implement all payment processing API routes
- Files 10-18: Payment endpoints + webhook handler
- Follow dlocal-openapi-endpoints.yaml specification
- Handle all 8 emerging markets (India, Nigeria, Pakistan, Vietnam, Indonesia, Thailand, South Africa, Turkey)
- QUALITY GATES (MANDATORY):
  * All functions must have explicit return types
  * Protected routes must check session
  * Input validation with Zod schemas
  * Try-catch blocks in all async functions
  * Proper error messages for payment failures
  * Webhook signature verification implemented
- Run validation after each file: npm run validate
- Auto-fix minor issues: npm run fix
- Auto-commit approved files

Start with File 10/37.
Stop after File 18/37.
```

### **Session 3: Frontend Components & Email & Cron (Files 19-31)**

```
Build Part 18 Session 3: UI Components & Automation

Continue Part 18 with Files 19-31.

**V0 Seed Components:** Use payment-method-selector, price-display-component, unified-checkout, and renewal-reminder-email as UI/UX patterns for Files 19-29.

Requirements:
- Build all frontend components, unified checkout, email templates, and cron jobs
- Files 19-24: Frontend components (country selector, plan selector, payment method grid, price display, discount input, payment button)
- File 25: Unified checkout (update to support both Stripe + dLocal)
- Files 26-29: Email templates (confirmation, reminder, expiry, failure)
- Files 30-31: Cron jobs (renewal reminders, expiry downgrade)
- QUALITY GATES (MANDATORY):
  * All React components must have explicit return types
  * No 'any' types (use proper TypeScript interfaces)
  * Proper error handling in payment flows
  * Email templates follow React Email standards
  * Cron jobs handle errors gracefully
- Run validation after each file: npm run validate
- Auto-fix minor issues: npm run fix
- Auto-commit approved files

Start with File 19/37.
Stop after File 31/37.
```

### **Session 4: Documentation & Configuration (Files 32-37)**

```
Build Part 18 Session 4: Documentation & Deployment Config

Complete Part 18 with Files 32-37.

**V0 Seed Components:** Not needed for documentation files.

Requirements:
- Complete all documentation and configuration files
- Files 32-35: Documentation (policy, OpenAPI spec, implementation guide, summary)
- Files 36-37: Configuration (vercel.json cron config, environment variables)
- QUALITY GATES (MANDATORY):
  * Documentation is comprehensive and accurate
  * Configuration files properly formatted
  * All environment variables documented
- Run validation after each file: npm run validate
- Auto-fix minor issues: npm run fix
- Auto-commit approved files

Start with File 32/37.
Complete through File 37/37.
```

---

## 📌 Validation Workflow (NEW - 2025-11-26)

### **After Each File Generated:**

Aider should automatically:

1. Generate code following quality gates
2. (Optional) Run `npm run validate` if uncertain
3. Auto-approve if all checks pass
4. Auto-fix with `npm run fix` if minor issues
5. Escalate if critical issues found

### **After Each Part Complete:**

YOU must manually run:

```bash
npm run validate
```

If it fails:

```bash
npm run fix       # Auto-fix
npm run validate  # Verify fixed
```

### **Before Git Push:**

Pre-push hook will automatically:

- Run TypeScript type checking
- Run quick Jest tests
- Block push if failures

This is GOOD - it prevents CI/CD failures!

### **Validation Commands Quick Reference:**

| Command                   | What It Does           | When to Use       |
| ------------------------- | ---------------------- | ----------------- |
| `npm run validate`        | All checks             | After each part   |
| `npm run validate:types`  | TypeScript only        | Debug type errors |
| `npm run validate:lint`   | ESLint only            | Debug lint errors |
| `npm run validate:format` | Prettier only          | Check formatting  |
| `npm run fix`             | Auto-fix lint + format | Fix minor issues  |
| `npm test`                | Run all tests          | Before final push |

---

## 📌 When Aider Asks for Clarification

```
Follow the build order specification exactly as written in part-0X-[name].md.

If something is ambiguous:
1. Check the implementation guide (v5_part_[letter].md)
2. Check the coding patterns (05-coding-patterns-compress.md)
3. If still unclear, escalate to me with specific question

Proceed with your best interpretation based on policies.
```

---

## 📌 When Aider Escalates

**Option 1: Approve**

```
Approved. Proceed with this implementation.
```

**Option 2: Changes Needed**

```
Make this change: [specific instruction]. Then proceed.
```

**Option 3: Major Issue**

```
Stop. Let me review the requirements. [Provide guidance]
```

---

## 📌 Resuming After Break

```
Resume Part [X] from where we left off.

Last completed: File [N]/[Total]
Next: File [N+1]/[Total]: [filename]

Continue following the build order.
```

---

## 📌 Verification After Part Complete

```
Run verification tests for Part [X]:

1. TypeScript: npx tsc --noEmit
2. Linting: pnpm lint
3. Build: pnpm build (if applicable)
4. Manual checks as specified in part-0X-[name].md

Report results and any issues found.
```

---

## 📌 If Something Goes Wrong

```
Stop current work.

Issue: [describe the problem]

Check these:
1. Are all dependencies met? (previous parts complete?)
2. Does the code follow the correct pattern?
3. Does it validate against policies?

Analyze the issue and provide a fix proposal.
If you cannot fix it, escalate with detailed explanation.
```

---

## 🎯 CRITICAL REMINDERS

### **✅ ALWAYS DO:**

- Use `/read-only` for build order files (NOT `/add`)
- Load implementation guides with `/read-only`
- Let Aider complete each file without interruption
- Trust the validation process
- Check progress reports

### **❌ NEVER DO:**

- Use `/add` for build orders (they become editable!)
- Interrupt Aider mid-file
- Skip verification tests
- Override build order without reason
- Panic when Aider escalates (it's designed to escalate)

---

## 🔧 TROUBLESHOOTING

### **Issue: "Cannot find v5_part_X.md"**

**Symptoms:**

- Aider says it cannot find an implementation guide
- Error: "File not found: docs/implementation-guides/v5_part_k.md"

**Solution:**

```bash
# Check if all 18 guides exist
cd docs/implementation-guides
ls -1 v5_part_{a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,r,s}.md | wc -l
# Should return: 18

# If any are missing, check the audit report
# All guides were created on 2025-11-21 and should exist
```

**All 18 guides now exist:**

- Parts 1-10: v5_part_a.md through v5_part_j.md ✅
- Parts 11-16: v5_part_k.md through v5_part_p.md ✅
- Part 17: v5_part_r.md ✅
- Part 18: v5_part_s.md ✅

### **Issue: Token limit exceeded**

**Solution:**

```bash
# Drop unused files
/drop docs/build-orders/part-XX-previous.md
/drop docs/implementation-guides/v5_part_previous.md

# Clear conversation if needed
/clear
```

### **Issue: Aider doesn't load policy files**

**Solution:**

```bash
# Verify .aider.conf.yml exists in project root
ls -la .aider.conf.yml

# Restart Aider to reload configuration
# Exit and start again with start-aider-anthropic.bat
```

---

## 📊 Token Usage Guidelines (Updated 2025-11-26)

| Phase          | Expected Tokens | Notes                              |
| -------------- | --------------- | ---------------------------------- |
| Base Load      | 147k            | Always loaded (policies + quality) |
| + Part Files   | +6-28k          | Varies by part (see table below)   |
| + Conversation | +20-30k         | Grows during build session         |
| **Safe Limit** | 190k            | Stay below this                    |
| **Max Limit**  | 204.8k          | Context overflow (MiniMax M2)      |

### Token Load by Part:

| Part    | Files | Docs Load | Total Usage | Margin | Status        |
| ------- | ----- | --------- | ----------- | ------ | ------------- |
| 1-16    | 4-25  | 6-13k     | 170-185k    | 20-35k | ✅ Safe       |
| **17A** | 32    | 14k       | ~186k       | 18.8k  | ⚠️ Tight      |
| **17B** | 35    | 12k       | ~184k       | 20.8k  | ⚠️ Tight      |
| **18**  | 37    | 28k       | ~200k       | 4.8k   | 🚨 Very Tight |

**If approaching 190k tokens:**

- Drop previous part files
- Clear conversation: `/clear`
- Keep responses brief during escalations
- Restart Aider if needed

**Part 17A & 17B were split to prevent overflow - build them sequentially!**
**Part 18 is tight - keep conversations concise, commit frequently.**

---

**Document Version:** 4.0 (V0 Seed Code References Added)
**Last Updated:** 2025-12-02
**Critical Updates:**

- **V4.0 (2025-12-02):** Added V0 seed code references section - 52 seed files automatically loaded via .aider.conf.yml
  - 31 V0 page.tsx components for UI patterns
  - 20 custom components for business logic
  - 1 Python AI engine (market_ai_engine.py)
  - Updated all part prompts to reference relevant seed components
  - Build order files now have correct V0 paths (e.g., seed-code/v0-components/next-js-login-form/app/page.tsx)
- **V3.0 (2025-11-26):** Part 17 split into 17A (32 files) + 17B (35 files) for token safety; Part 18 corrected: 37 files (not 45), sessions realigned
  **Status:** ✅ Tested and Verified

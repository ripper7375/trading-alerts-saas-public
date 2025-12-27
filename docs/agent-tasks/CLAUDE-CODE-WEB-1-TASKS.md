# Claude Code Web 1 - Enhancement Tasks

**Total Tasks:** 22
**Parts Owned:** 2, 5, 7, 11, 13, 17, 18
**Priority:** Execute tasks in Part order (ascending) to respect dependencies

---

## Instructions

You are responsible for implementing 22 enhancement tasks across Parts 2, 5, 7, 11, 13, 17, and 18.

**IMPORTANT RULES:**
1. Work on tasks in Part order (Part 2 → Part 5 → Part 7 → Part 11 → Part 13 → Part 17 → Part 18)
2. Within each Part, complete tasks in the order listed
3. Commit after completing each task with descriptive commit messages
4. Do NOT modify files in Parts: 1, 3, 4, 6, 8, 12, 14, 16, 19 (owned by another agent)
5. Reference `docs/files-completion-list/part-XX-files-completion.md` for file locations
6. Reference `docs/validation-reports/part-XX-actionable-fixes.md` for detailed fix prompts

---

## Part 2 - Database Schema (2 tasks)

**Files Reference:** `docs/files-completion-list/part-02-files-completion.md`
**Fix Details:** `docs/validation-reports/part-02-actionable-fixes.md`

### Task 1: Table Mappings
- **Category:** Testing & Quality
- **Priority:** Low
- **Description:** Add snake_case @@map for PostgreSQL convention
- **File:** `prisma/schema.prisma`
- **Action:** Add `@@map("table_name")` annotations to Prisma models to follow PostgreSQL snake_case naming convention

### Task 2: Documentation
- **Category:** Testing & Quality
- **Priority:** Low
- **Description:** Add JSDoc to complex Prisma fields
- **File:** `prisma/schema.prisma`
- **Action:** Add `///` documentation comments to complex fields explaining their purpose and relationships

---

## Part 5 - Authentication System (5 tasks)

**Files Reference:** `docs/files-completion-list/part-05-files-completion.md`
**Fix Details:** `docs/validation-reports/part-05-actionable-fixes.md`

### Task 3: Rate Limiting ⚠️ MEDIUM PRIORITY
- **Category:** Security & Authentication
- **Priority:** Medium
- **Description:** Add Upstash Redis rate limiter to auth endpoints
- **Files:**
  - `app/api/auth/[...nextauth]/route.ts`
  - `lib/rate-limit.ts` (create if needed)
- **Action:** Implement rate limiting using Upstash Redis for login, register, and password reset endpoints
- **Dependencies:** Requires `@upstash/ratelimit` and `@upstash/redis` packages

### Task 4: CSRF Protection ⚠️ MEDIUM PRIORITY
- **Category:** Security & Authentication
- **Priority:** Medium
- **Description:** Add origin validation for sensitive endpoints
- **Files:**
  - `lib/csrf.ts` (create)
  - `middleware.ts`
- **Action:** Implement CSRF token validation for POST/PUT/DELETE requests on sensitive endpoints

### Task 5: Email Integration 🔴 HIGH PRIORITY
- **Category:** Security & Authentication
- **Priority:** High
- **Description:** Implement Resend for verification/reset emails
- **Files:**
  - `lib/email.ts` (create or update)
  - `app/api/auth/verify-email/route.ts`
  - `app/api/auth/reset-password/route.ts`
- **Action:** Replace console.log placeholders with actual Resend email sending
- **Dependencies:** Requires `resend` package and RESEND_API_KEY env variable

### Task 6: shadcn Migration
- **Category:** UI/UX Improvements
- **Priority:** Low
- **Description:** Migrate auth forms to shadcn/ui components
- **Files:**
  - `app/(auth)/login/page.tsx`
  - `app/(auth)/register/page.tsx`
  - `app/(auth)/forgot-password/page.tsx`
- **Action:** Replace custom form components with shadcn/ui Form, Input, Button components

### Task 7: Password Special Char
- **Category:** UI/UX Improvements
- **Priority:** Low
- **Description:** Add special character requirement to password validation
- **Files:**
  - `lib/validations/auth.ts`
  - Auth form components
- **Action:** Update Zod schema to require at least one special character in passwords

---

## Part 7 - API Routes (3 tasks)

**Files Reference:** `docs/files-completion-list/part-07-files-completion.md`
**Fix Details:** `docs/validation-reports/part-07-actionable-fixes.md`

### Task 8: Rate Limiting
- **Category:** Security & Authentication
- **Priority:** Low
- **Description:** Tier-based rate limits on indicator endpoints
- **Files:**
  - `app/api/indicators/[symbol]/route.ts`
  - `lib/rate-limit.ts`
- **Action:** Implement different rate limits based on user tier (FREE: 10/min, BASIC: 30/min, PRO: 100/min)

### Task 9: Caching
- **Category:** Security & Authentication
- **Priority:** Low
- **Description:** Cache indicator data with timeframe-based TTL
- **Files:**
  - `app/api/indicators/[symbol]/route.ts`
  - `lib/cache.ts` (create if needed)
- **Action:** Implement caching with TTL based on timeframe (1m: 60s, 5m: 300s, 1h: 3600s)

### Task 10: Zod Validation
- **Category:** Security & Authentication
- **Priority:** Low
- **Description:** Add formal request validation schemas
- **Files:**
  - `lib/validations/indicators.ts` (create)
  - `app/api/indicators/*/route.ts`
- **Action:** Create Zod schemas for all indicator API request parameters

---

## Part 11 - Alerts System (4 tasks)

**Files Reference:** `docs/files-completion-list/part-11-files-completion.md`
**Fix Details:** `docs/validation-reports/part-11-actionable-fixes.md`

### Task 11: Loading State Toggle
- **Category:** UI/UX Improvements
- **Priority:** Low
- **Description:** Show loading when pausing/resuming alerts
- **File:** `app/(dashboard)/alerts/alerts-client.tsx`
- **Action:**
  1. Add `togglingIds` state: `useState<Set<string>>(new Set())`
  2. Update `handleTogglePause` to track loading state
  3. Show "Pausing..."/"Resuming..." text and disable button while loading

### Task 12: Optimistic Delete
- **Category:** UI/UX Improvements
- **Priority:** Low
- **Description:** Immediate UI feedback for delete operations
- **File:** `app/(dashboard)/alerts/alerts-client.tsx`
- **Action:** Implement optimistic updates - remove alert from UI immediately, rollback on error

### Task 13: Documentation Update ⚠️ MEDIUM PRIORITY
- **Category:** Infrastructure
- **Priority:** Medium
- **Description:** Add client components to completion list
- **File:** `docs/files-completion-list/part-11-files-completion.md`
- **Action:** Add these client components to the documentation:
  - `app/(dashboard)/alerts/alerts-client.tsx`
  - `app/(dashboard)/alerts/new/create-alert-client.tsx`

### Task 14: Zod Client Validation
- **Category:** Infrastructure
- **Priority:** Low
- **Description:** Add react-hook-form with zodResolver
- **File:** `app/(dashboard)/alerts/new/create-alert-client.tsx`
- **Action:**
  1. Install: `npm install react-hook-form @hookform/resolvers`
  2. Create Zod schema for alert form
  3. Use `useForm` with `zodResolver` for form validation

---

## Part 13 - Settings System (3 tasks)

**Files Reference:** `docs/files-completion-list/part-13-files-completion.md`
**Fix Details:** `docs/validation-reports/part-13-actionable-fixes.md`

### Task 15: Loading Skeletons
- **Category:** UI/UX Improvements
- **Priority:** Low
- **Description:** Add skeleton loading to settings pages
- **Files:**
  - `app/(dashboard)/settings/account/page.tsx`
  - `app/(dashboard)/settings/notifications/page.tsx`
  - `app/(dashboard)/settings/billing/page.tsx`
- **Action:** Replace spinner loading states with Skeleton components from shadcn/ui

### Task 16: Unsaved Changes Warning
- **Category:** UI/UX Improvements
- **Priority:** Low
- **Description:** Warn before navigating away with unsaved data
- **Files:** All settings page components
- **Action:**
  1. Track form dirty state
  2. Use `beforeunload` event to warn on page close
  3. Use Next.js router events to warn on navigation

### Task 17: Real API Sessions
- **Category:** Admin & Monitoring
- **Priority:** Low
- **Description:** Replace mock session data with real tracking
- **Files:**
  - `app/(dashboard)/settings/account/page.tsx`
  - `app/api/user/sessions/route.ts` (create if needed)
- **Action:** Implement real session tracking API and display actual user sessions

---

## Part 17 - Affiliate System (2 tasks)

**Files Reference:** `docs/files-completion-list/part17*.md`
**Fix Details:** `docs/validation-reports/part-17-actionable-fixes.md`

### Task 18: Loading Skeletons
- **Category:** UI/UX Improvements
- **Priority:** Low
- **Description:** Add skeleton states to affiliate pages
- **Files:**
  - `app/(dashboard)/affiliate/page.tsx`
  - `app/(dashboard)/affiliate/earnings/page.tsx`
  - `app/(dashboard)/affiliate/links/page.tsx`
- **Action:** Add Skeleton loading components matching the page layout

### Task 19: Table Pagination
- **Category:** UI/UX Improvements
- **Priority:** Low
- **Description:** Standardize pagination component
- **Files:**
  - `components/affiliate/pagination.tsx` (create)
  - Affiliate table components
- **Action:** Create reusable pagination component and apply to all affiliate tables

---

## Part 18 - Payments/dLocal (3 tasks)

**Files Reference:** `docs/files-completion-list/part-18*.md`
**Fix Details:** `docs/validation-reports/part-18-actionable-fixes.md`

### Task 20: Pagination
- **Category:** UI/UX Improvements
- **Priority:** Low
- **Description:** Add pagination to fraud alerts
- **File:** `app/(dashboard)/admin/fraud-alerts/page.tsx`
- **Action:** Implement pagination for fraud alerts table (10-25 items per page)

### Task 21: Export CSV
- **Category:** UI/UX Improvements
- **Priority:** Low
- **Description:** Add export functionality for alerts
- **File:** `app/(dashboard)/admin/fraud-alerts/page.tsx`
- **Action:** Add "Export CSV" button that downloads filtered fraud alerts as CSV

### Task 22: Bulk Actions
- **Category:** UI/UX Improvements
- **Priority:** Low
- **Description:** Select and process multiple alerts
- **File:** `app/(dashboard)/admin/fraud-alerts/page.tsx`
- **Action:**
  1. Add checkbox selection to each row
  2. Add "Select All" checkbox in header
  3. Add bulk action buttons (Mark Reviewed, Dismiss, etc.)

---

## Commit Message Format

Use conventional commits:
```
feat(part-XX): description of feature
fix(part-XX): description of fix
docs(part-XX): description of doc change
```

Example:
```
feat(part-05): add Upstash Redis rate limiting to auth endpoints
feat(part-11): add loading state to alert pause/resume toggle
docs(part-11): add client components to files completion list
```

---

## Verification Commands

After completing each Part, verify your changes:

```bash
# TypeScript check
npx tsc --noEmit

# Lint check
npm run lint

# Format check
npm run format:check
```

---

**Total: 22 tasks across 7 Parts**
**Estimated Effort: 8-12 hours**

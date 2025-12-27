# Claude Code Web 2 - Enhancement Tasks

**Total Tasks:** 24
**Parts Owned:** 1, 3, 4, 6, 8, 12, 14, 16, 19
**Priority:** Execute tasks in Part order (ascending) to respect dependencies

---

## Instructions

You are responsible for implementing 24 enhancement tasks across Parts 1, 3, 4, 6, 8, 12, 14, 16, and 19.

**IMPORTANT RULES:**
1. Work on tasks in Part order (Part 1 → Part 3 → Part 4 → Part 6 → Part 8 → Part 12 → Part 14 → Part 16 → Part 19)
2. Within each Part, complete tasks in the order listed
3. Commit after completing each task with descriptive commit messages
4. Do NOT modify files in Parts: 2, 5, 7, 11, 13, 17, 18 (owned by another agent)
5. Reference `docs/files-completion-list/part-XX-files-completion.md` for file locations
6. Reference `docs/validation-reports/part-XX-actionable-fixes.md` for detailed fix prompts

---

## Part 1 - Foundation & Configuration (1 task)

**Files Reference:** `docs/files-completion-list/part-01-files-completion.md`
**Fix Details:** `docs/validation-reports/part-01-actionable-fixes.md`

### Task 1: Tailwind Plugin
- **Category:** UI/UX Improvements
- **Priority:** Very Low
- **Description:** Enable prettier-plugin-tailwindcss
- **File:** `.prettierrc` or `prettier.config.js`
- **Action:**
  1. Install: `npm install -D prettier-plugin-tailwindcss`
  2. Add plugin to Prettier config: `"plugins": ["prettier-plugin-tailwindcss"]`
  3. Run `npm run format` to auto-sort Tailwind classes

---

## Part 3 - TypeScript Types (2 tasks)

**Files Reference:** `docs/files-completion-list/part-03-files-completion.md`
**Fix Details:** `docs/validation-reports/part-03-actionable-fixes.md`

### Task 2: JSDoc
- **Category:** Testing & Quality
- **Priority:** Low
- **Description:** Add examples to API type definitions
- **Files:**
  - `types/api.ts`
  - `types/indicators.ts`
  - `types/alerts.ts`
- **Action:** Add `@example` JSDoc annotations showing usage examples for complex types

### Task 3: Type Tests
- **Category:** Testing & Quality
- **Priority:** Low
- **Description:** Add tsd type validation tests
- **Files:**
  - `__tests__/types/` (create directory)
  - `types/*.test-d.ts` (create test files)
- **Action:**
  1. Install: `npm install -D tsd`
  2. Create type test files using tsd's `expectType`, `expectError` helpers
  3. Add to package.json: `"test:types": "tsd"`

---

## Part 4 - Business Logic Library (2 tasks)

**Files Reference:** `docs/files-completion-list/part-04-files-completion.md`
**Fix Details:** `docs/validation-reports/part-04-actionable-fixes.md`

### Task 4: Unit Tests
- **Category:** Testing & Quality
- **Priority:** Low
- **Description:** Test tier validation functions
- **Files:**
  - `__tests__/lib/tier-validation.test.ts` (create)
  - `__tests__/lib/tier-config.test.ts` (create)
- **Action:** Write unit tests for:
  - `validateTierAccess()`
  - `getTierLimits()`
  - `canAccessSymbol()`
  - `canAccessTimeframe()`

### Task 5: Rate Limit Validation
- **Category:** Testing & Quality
- **Priority:** Low
- **Description:** Add rate limit checking functions
- **File:** `lib/tier-validation.ts`
- **Action:** Add functions to check rate limits:
  - `getRateLimitForTier(tier: Tier): number`
  - `isRateLimitExceeded(userId: string, tier: Tier): Promise<boolean>`

---

## Part 6 - Flask MT5 Integration (2 tasks)

**Files Reference:** `docs/files-completion-list/part-06-files-completion.md`
**Fix Details:** `docs/validation-reports/part-06-actionable-fixes.md`

### Task 6: Test Coverage
- **Category:** Testing & Quality
- **Priority:** Low
- **Description:** Add integration tests with mocked MT5
- **Files:**
  - `mt5-service/tests/` (create directory)
  - `mt5-service/tests/test_indicators.py`
  - `mt5-service/tests/conftest.py`
- **Action:** Create pytest tests with mocked MT5 responses for all indicator endpoints

### Task 7: Pydantic Models
- **Category:** Testing & Quality
- **Priority:** Low
- **Description:** Add stronger request validation
- **Files:**
  - `mt5-service/models/` (create directory)
  - `mt5-service/models/requests.py`
  - `mt5-service/models/responses.py`
- **Action:** Create Pydantic models for request/response validation in Flask routes

---

## Part 8 - Dashboard Layout (3 tasks)

**Files Reference:** `docs/files-completion-list/part-08-files-completion.md`
**Fix Details:** `docs/validation-reports/part-08-actionable-fixes.md`

### Task 8: Loading States
- **Category:** UI/UX Improvements
- **Priority:** Low
- **Description:** Add skeleton loaders to dashboard widgets
- **Files:**
  - `app/(dashboard)/dashboard/page.tsx`
  - `components/dashboard/widget-skeleton.tsx` (create)
- **Action:** Create skeleton components that match widget layouts and use them during data loading

### Task 9: Keyboard Shortcuts
- **Category:** UI/UX Improvements
- **Priority:** Low
- **Description:** Add navigation shortcuts for power users
- **Files:**
  - `hooks/use-keyboard-shortcuts.ts` (create)
  - `app/(dashboard)/layout.tsx`
- **Action:** Implement keyboard shortcuts:
  - `g d` - Go to Dashboard
  - `g a` - Go to Alerts
  - `g s` - Go to Settings
  - `?` - Show shortcuts modal

### Task 10: Breadcrumbs
- **Category:** UI/UX Improvements
- **Priority:** Low
- **Description:** Add breadcrumb navigation on sub-pages
- **Files:**
  - `components/ui/breadcrumb.tsx` (create or use shadcn)
  - Dashboard sub-pages
- **Action:**
  1. Install: `npx shadcn-ui@latest add breadcrumb`
  2. Add breadcrumbs to nested pages showing navigation path

---

## Part 12 - E-commerce & Billing (2 tasks)

**Files Reference:** `docs/files-completion-list/part-12-files-completion.md`
**Fix Details:** `docs/validation-reports/part-12-actionable-fixes.md`

### Task 11: Email Sending 🔴 HIGH PRIORITY
- **Category:** Email & Notifications
- **Priority:** High
- **Description:** Replace console.log placeholders with Resend
- **Files:**
  - `lib/email.ts`
  - `app/api/webhooks/stripe/route.ts`
  - `lib/billing/notifications.ts` (create if needed)
- **Action:**
  1. Install: `npm install resend`
  2. Create email templates for: subscription confirmation, payment receipt, cancellation
  3. Replace all `console.log("Send email...")` with actual Resend calls

### Task 12: Affiliate Commission Email
- **Category:** Email & Notifications
- **Priority:** Low
- **Description:** Notify affiliates when code used
- **Files:**
  - `app/api/webhooks/stripe/route.ts`
  - `lib/email/templates/affiliate-commission.tsx` (create)
- **Action:** Send email to affiliate when their referral code is used for a purchase

---

## Part 14 - Admin Dashboard (4 tasks)

**Files Reference:** `docs/files-completion-list/part-14-files-completion.md`
**Fix Details:** `docs/validation-reports/part-14-actionable-fixes.md`

### Task 13: Toast Notifications ⚠️ MEDIUM PRIORITY
- **Category:** Email & Notifications
- **Priority:** Medium
- **Description:** Better user feedback in admin dashboard
- **Files:**
  - `app/(dashboard)/admin/layout.tsx`
  - Admin page components
- **Action:**
  1. Install: `npx shadcn-ui@latest add toast`
  2. Add `<Toaster />` to admin layout
  3. Replace alerts/console.logs with toast notifications

### Task 14: Chart Visualizations ⚠️ MEDIUM PRIORITY
- **Category:** UI/UX Improvements
- **Priority:** Medium
- **Description:** Add recharts for user growth/revenue
- **Files:**
  - `app/(dashboard)/admin/page.tsx`
  - `components/admin/charts/` (create directory)
- **Action:**
  1. Install: `npm install recharts`
  2. Create charts: UserGrowthChart, RevenueChart, SubscriptionChart
  3. Display on admin dashboard

### Task 15: User Export
- **Category:** Admin & Monitoring
- **Priority:** Low
- **Description:** Add CSV export for user list
- **File:** `app/(dashboard)/admin/users/page.tsx`
- **Action:** Add "Export CSV" button that exports filtered user list with columns: email, name, tier, createdAt, status

### Task 16: Real-Time Errors
- **Category:** Admin & Monitoring
- **Priority:** Low
- **Description:** WebSocket updates for critical errors
- **Files:**
  - `app/(dashboard)/admin/errors/page.tsx` (create if needed)
  - `lib/websocket/error-stream.ts` (create)
- **Action:** Implement real-time error notifications using WebSocket or Server-Sent Events

---

## Part 16 - Utilities & Infrastructure (2 tasks)

**Files Reference:** `docs/files-completion-list/part-16-files-completion.md`
**Fix Details:** `docs/validation-reports/part-16-actionable-fixes.md`

### Task 17: oklch Colors
- **Category:** Infrastructure
- **Priority:** Low
- **Description:** Convert HSL to oklch format
- **File:** `app/globals.css`
- **Action:** Convert CSS custom properties from HSL to oklch format for better color perception:
  ```css
  /* Before: --background: 0 0% 100%; */
  /* After:  --background: oklch(1 0 0); */
  ```
- **Note:** This is optional if browser compatibility is a concern

### Task 18: Sidebar Variables
- **Category:** Infrastructure
- **Priority:** Low
- **Description:** Add sidebar CSS variables for dashboard
- **File:** `app/globals.css`
- **Action:** Add sidebar-specific CSS variables:
  ```css
  --sidebar-background: ...;
  --sidebar-foreground: ...;
  --sidebar-border: ...;
  --sidebar-accent: ...;
  ```

---

## Part 19 - Disbursement System (6 tasks)

**Files Reference:** `docs/files-completion-list/part19*.md`
**Fix Details:** `docs/validation-reports/part-19-actionable-fixes.md`

### Task 19: Accessibility
- **Category:** UI/UX Improvements
- **Priority:** Low
- **Description:** Add aria-labels to disbursement pages
- **Files:**
  - `app/(dashboard)/admin/disbursement/page.tsx`
  - `app/(dashboard)/admin/disbursement/affiliates/page.tsx`
  - `app/(dashboard)/admin/disbursement/batches/page.tsx`
- **Action:** Add `aria-label` attributes to all interactive elements (buttons, links, form controls)

### Task 20: Loading Skeletons
- **Category:** UI/UX Improvements
- **Priority:** Low
- **Description:** Replace spinners with skeleton loaders
- **Files:**
  - `components/disbursement/skeletons.tsx` (create)
  - All Part 19 frontend pages
- **Action:** Create skeleton components matching page layouts and replace spinner loading states

### Task 21: Optimistic Updates
- **Category:** Admin & Monitoring
- **Priority:** Low
- **Description:** Immediate batch status updates
- **File:** `app/(dashboard)/admin/disbursement/batches/page.tsx`
- **Action:** Implement optimistic UI updates:
  1. Update UI immediately on action
  2. Rollback on API error
  3. Show error toast if rollback occurs

### Task 22: Real-time Polling
- **Category:** Admin & Monitoring
- **Priority:** Low
- **Description:** Auto-refresh dashboard data
- **File:** `app/(dashboard)/admin/disbursement/page.tsx`
- **Action:**
  1. Add 30-second polling interval for dashboard data
  2. Pause polling when tab is not visible
  3. Resume and refresh when tab becomes visible

### Task 23: Status Badges
- **Category:** Admin & Monitoring
- **Priority:** Low
- **Description:** Extract reusable status badge components
- **Files:**
  - `components/disbursement/status-badges.tsx` (create)
  - All Part 19 pages using status badges
- **Action:** Create reusable badge components:
  - `BatchStatusBadge`
  - `TransactionStatusBadge`
  - `KycStatusBadge`
  - `AuditStatusBadge`

### Task 24: Toast Notifications
- **Category:** Infrastructure
- **Priority:** Low
- **Description:** Use shadcn toasts instead of cards
- **Files:**
  - `app/(dashboard)/admin/disbursement/layout.tsx`
  - All Part 19 pages with success/error messages
- **Action:**
  1. Add `<Toaster />` to disbursement layout
  2. Replace success/error cards with toast notifications
  3. Use `useToast` hook for showing messages

---

## Commit Message Format

Use conventional commits:
```
feat(part-XX): description of feature
fix(part-XX): description of fix
docs(part-XX): description of doc change
test(part-XX): description of test addition
```

Example:
```
feat(part-12): add Resend email integration for billing notifications
feat(part-14): add recharts visualizations to admin dashboard
test(part-04): add unit tests for tier validation functions
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

# Run tests (if applicable)
npm test
```

---

**Total: 24 tasks across 9 Parts**
**Estimated Effort: 10-14 hours**

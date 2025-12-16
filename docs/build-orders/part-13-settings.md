# Part 13: Settings System - Build Order

**From:** `docs/v5-structure-division.md` Part 13
**Total Files:** 17 files
**Estimated Time:** 4 hours
**Priority:** ⭐⭐ Medium
**Complexity:** Low

---

## Overview

**Scope:** User settings pages for profile, billing, appearance, privacy, and account management.

**Implementation Guide References:**

- `docs/implementation-guides/v5_part_m.md` - Settings system business logic, user preferences, and account management

**Key Changes from V4:**

- ✅ Billing page: Show FREE/PRO tiers
- ✅ Remove ENTERPRISE mentions

**Dependencies:**

- Part 5 complete (Authentication)
- Part 12 complete (Billing/subscriptions)

---

## File Build Order

### Settings Pages (8 pages)

**File 1/17:** `app/(dashboard)/settings/layout.tsx`

- Settings layout with sidebar navigation
- Seed: `seed-code/v0-components/settings-page-with-tabs-v3/app/settings/page.tsx`
- Commit: `feat(settings): add settings layout`

**File 2/17:** `app/(dashboard)/settings/profile/page.tsx`

- Profile editing (name, email, image)
- Seed: `seed-code/v0-components/profile-settings-form/app/profile/settings/page.tsx`
- Custom Components:
  - `seed-code/v0-components/profile-settings-form/components/photo-upload-modal.tsx`
  - `seed-code/v0-components/profile-settings-form/components/unsaved-changes-modal.tsx`
- Commit: `feat(settings): add profile settings page`

**File 3/17:** `app/(dashboard)/settings/appearance/page.tsx`

- Theme selection (light/dark/system)
- Commit: `feat(settings): add appearance settings`

**File 4/17:** `app/(dashboard)/settings/account/page.tsx`

- Account management (change password, delete account)
- Commit: `feat(settings): add account settings`

**File 5/17:** `app/(dashboard)/settings/privacy/page.tsx`

- Privacy settings (data export, account visibility)
- Commit: `feat(settings): add privacy settings`

**File 6/17:** `app/(dashboard)/settings/billing/page.tsx`

- Subscription management
- Show current tier (FREE/PRO)
- Upgrade/cancel buttons
- Invoice history
- Seed: `seed-code/v0-components/billing-and-subscription-page-v3/app/billing/page.tsx`
- Commit: `feat(settings): add billing settings for 2-tier system`

**File 7/17:** `app/(dashboard)/settings/language/page.tsx`

- Language selection
- Commit: `feat(settings): add language settings`

**File 8/17:** `app/(dashboard)/settings/help/page.tsx`

- Help resources
- Contact support
- Commit: `feat(settings): add help page`

### API Routes (6 routes)

**File 9/17:** `app/api/user/profile/route.ts`

- GET/PATCH: User profile
- Commit: `feat(api): add profile update endpoint`

**File 10/17:** `app/api/user/preferences/route.ts`

- GET/PUT: User preferences
- Commit: `feat(api): add preferences endpoint`

**File 11/17:** `app/api/user/password/route.ts`

- POST: Change password
- Commit: `feat(api): add password change endpoint`

**File 12/17:** `app/api/user/account/deletion-request/route.ts`

- POST: Request account deletion
- Commit: `feat(api): add account deletion request`

**File 13/17:** `app/api/user/account/deletion-confirm/route.ts`

- POST: Confirm account deletion
- Commit: `feat(api): add account deletion confirmation`

**File 14/17:** `app/api/user/account/deletion-cancel/route.ts`

- POST: Cancel deletion request
- Commit: `feat(api): add account deletion cancellation`

### Utilities & Providers (3 files)

**File 15/17:** `lib/preferences/defaults.ts`

- Default user preferences
- Commit: `feat(settings): add default preferences`

**File 16/17:** `components/providers/theme-provider.tsx`

- Dark mode provider
- Commit: `feat(settings): add theme provider`

**File 17/17:** `components/providers/websocket-provider.tsx`

- WebSocket connection provider
- Commit: `feat(settings): add WebSocket provider`

---

## Success Criteria

- ✅ All 17 files created
- ✅ Settings pages render
- ✅ Profile updates work
- ✅ Billing shows correct tier
- ✅ Theme switching works
- ✅ Account deletion workflow complete

---

**Last Updated:** 2025-11-18

# Part 16: Utilities & Infrastructure - Build Order

**From:** `docs/v5-structure-division.md` Part 16
**Total Files:** 25 files
**Estimated Time:** 5 hours
**Priority:** ⭐⭐ Medium
**Complexity:** Low

---

## Overview

**Scope:** Helper functions, validation schemas, error handling, caching, email, and deployment config.

**Implementation Guide References:**

- `docs/implementation-guides/v5_part_p.md` - Utilities & infrastructure business logic, validation schemas, and helper functions

**Key Changes from V4:**

- ✅ NEW: `watchlist.ts` validation for symbol+timeframe combinations
- ✅ Updated constants: 9 timeframes, 15 symbols
- ✅ Tier-specific constants

**Dependencies:**

- Part 3 complete (Types)

---

## File Build Order (Grouped by Category)

### Email & Tokens (2 files)

**File 1/25:** `lib/email/email.ts`

- Send email with Resend
- Commit: `feat(email): add email service`

**File 2/25:** `lib/tokens.ts`

- Generate verification/reset tokens
- Commit: `feat(auth): add token generation`

### Error Handling (3 files)

**File 3/25:** `lib/errors/error-handler.ts`

- Global error handler
- Commit: `feat(errors): add error handler`

**File 4/25:** `lib/errors/api-error.ts`

- API error classes
- Commit: `feat(errors): add API error classes`

**File 5/25:** `lib/errors/error-logger.ts`

- Error logging service
- Commit: `feat(errors): add error logger`

### Caching (2 files)

**File 6/25:** `lib/redis/client.ts`

- Redis client
- Commit: `feat(cache): add Redis client`

**File 7/25:** `lib/cache/cache-manager.ts`

- Cache manager
- Commit: `feat(cache): add cache manager`

### Validation (4 files)

**File 8/25:** `lib/validations/auth.ts`

- Auth validation schemas
- Commit: `feat(validation): add auth schemas`

**File 9/25:** `lib/validations/alert.ts`

- Alert validation schemas
- Commit: `feat(validation): add alert schemas`

**File 10/25:** `lib/validations/watchlist.ts`

- Watchlist validation (symbol+timeframe combinations)
- Commit: `feat(validation): add watchlist schemas`

**File 11/25:** `lib/validations/user.ts`

- User validation schemas
- Commit: `feat(validation): add user schemas`

### Utils (3 files)

**File 12/25:** `lib/utils/helpers.ts`

- Helper functions
- Commit: `feat(utils): add helper functions`

**File 13/25:** `lib/utils/formatters.ts`

- Data formatters (date, currency, etc.)
- Commit: `feat(utils): add formatters`

**File 14/25:** `lib/utils/constants.ts`

- App-wide constants (9 timeframes, 15 symbols)
- Commit: `feat(utils): add app constants`

### Root App Files (3 files)

**File 15/25:** `app/layout.tsx`

- Root layout
- Commit: `feat(app): add root layout`

**File 16/25:** `app/globals.css`

- Global styles
- Commit: `feat(app): add global styles`

**File 17/25:** `app/error.tsx`

- Error page
- Commit: `feat(app): add error page`

### Marketing (2 files)

**File 18/25:** `app/(marketing)/layout.tsx`

- Marketing layout
- Commit: `feat(marketing): add marketing layout`

**File 19/25:** `app/(marketing)/page.tsx`

- Landing page
- Seed: `seed-code/v0-components/next-js-marketing-homepage-v2/app/page.tsx`
- Custom Components:
  - `seed-code/v0-components/empty-states-components/components/empty-states.tsx`
  - `seed-code/v0-components/user-profile-dropdown/components/user-profile-dropdown.tsx`
- Commit: `feat(marketing): add landing page`

### Public Assets (1 file)

**File 20/25:** `public/manifest.json`

- PWA manifest
- Commit: `feat(pwa): add manifest`

### GitHub Actions (3 files)

**File 21/25:** `.github/workflows/ci-nextjs.yml`

- Next.js CI pipeline
- Commit: `ci: add Next.js CI workflow`

**File 22/25:** `.github/workflows/ci-flask.yml`

- Flask CI pipeline
- Commit: `ci: add Flask CI workflow`

**File 23/25:** `.github/workflows/deploy.yml`

- Deployment workflow
- Commit: `ci: add deployment workflow`

### Docker (2 files)

**File 24/25:** `docker-compose.yml`

- All services (Next.js, Flask, PostgreSQL, Redis)
- Commit: `feat(docker): add docker-compose`

**File 25/25:** `.dockerignore`

- Docker ignore patterns
- Commit: `feat(docker): add dockerignore`

---

## Success Criteria

- ✅ All 25 files created
- ✅ Email sending works
- ✅ Validation schemas work
- ✅ Error handling works
- ✅ Landing page renders
- ✅ Docker compose works

---

**Last Updated:** 2025-11-18

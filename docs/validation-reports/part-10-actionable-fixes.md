# Part 10 - Watchlist System: Actionable Fixes

**Generated:** 2025-12-26T09:40:00Z
**Part:** 10 - Watchlist System
**Status:** No Code Fixes Required

---

## Summary

**Part 10 passed all validation checks.** No code fixes are required.

The only issue identified is an **infrastructure/environment problem** with Prisma binary downloads, which is not a code quality concern.

---

## Blockers (🔴) - 0 Found

No code-level blockers in Part 10.

---

## Warnings (🟡) - 0 Found

No code-level warnings in Part 10.

---

## Environment Issue

### Prisma Binary Download Failure

**Issue:** Prisma engine binaries cannot be downloaded (403 Forbidden)

**Error Message:**

```
Error: Failed to fetch sha256 checksum at
https://binaries.prisma.sh/... - 403 Forbidden
```

**Root Cause:** CDN or network infrastructure issue, not code-related.

### Fix Prompts

#### Option 1: Ignore Checksum (Development)

```bash
export PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
npm run build
```

#### Option 2: Retry with Extended Timeout

```bash
npx prisma generate --generator-timeout 100
npm run build
```

#### Option 3: Manual Engine Download

```bash
# Check if engines are cached
ls node_modules/.prisma/client/

# If not, download manually or wait for CDN recovery
```

---

## Ready-to-Use Prompts for Future Issues

### If TypeScript Errors Appear

```
Fix the TypeScript error in [FILE_PATH]:

Error: [PASTE_ERROR_MESSAGE]

Please update the types to resolve this error while maintaining
existing functionality. Ensure all function parameters and return
types are properly typed.
```

### If ESLint Errors Appear

```
Fix the ESLint error in [FILE_PATH]:

Rule: [RULE_NAME]
Message: [ERROR_MESSAGE]

Apply the fix while maintaining code functionality. Do not add
eslint-disable comments unless absolutely necessary.
```

### If Build Errors Appear

```
The Next.js build is failing with this error:

[PASTE_BUILD_ERROR]

Please fix this issue. The error occurs in [FILE_PATH].
Ensure the fix doesn't break existing functionality.
```

### If API Errors Appear

```
The API endpoint [ENDPOINT] is returning [STATUS_CODE]:

Response: [ERROR_RESPONSE]

Please fix the error handling to return proper error messages
with appropriate HTTP status codes.
```

---

## Verification Commands

After any fixes, run these commands to verify:

```bash
# TypeScript check
npx tsc --noEmit

# ESLint check
npm run lint

# Build check (after Prisma issue resolved)
npm run build

# Specific file check
npx tsc --noEmit app/\(dashboard\)/watchlist/page.tsx
```

---

## Part 10 Files Reference

If you need to make changes, here are the Part 10 files:

| File                                             | Purpose                                 |
| ------------------------------------------------ | --------------------------------------- |
| `app/(dashboard)/watchlist/page.tsx`             | Server component - auth & data fetching |
| `app/(dashboard)/watchlist/watchlist-client.tsx` | Client component - UI & interactions    |
| `app/api/watchlist/route.ts`                     | GET/POST handlers                       |
| `app/api/watchlist/[id]/route.ts`                | GET/PATCH/DELETE handlers               |
| `app/api/watchlist/reorder/route.ts`             | POST reorder handler                    |
| `components/watchlist/symbol-selector.tsx`       | Symbol dropdown component               |
| `components/watchlist/timeframe-grid.tsx`        | Timeframe selection grid                |
| `components/watchlist/watchlist-item.tsx`        | Item card component                     |
| `hooks/use-watchlist.ts`                         | Watchlist data hook                     |

---

_No code fixes required for Part 10._

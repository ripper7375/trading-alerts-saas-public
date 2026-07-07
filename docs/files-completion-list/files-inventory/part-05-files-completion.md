# Part 5: Authentication System - list of files completion

**File 1/22:** ✅ `types/next-auth.d.ts`
**File 2/22:** ✅ `lib/auth/errors.ts`
**File 3/22:** ✅ `lib/auth/auth-options.ts`
**File 4/22:** ✅ `lib/auth/session.ts`
**File 5/22:** ✅ `lib/auth/permissions.ts`
**File 6/22:** ✅ `app/api/auth/[...nextauth]/route.ts`
**File 7/22:** ✅ `app/api/auth/register/route.ts`
**File 8/22:** ✅ `app/api/auth/verify-email/route.ts`
**File 9/22:** ✅ `app/api/auth/forgot-password/route.ts`
**File 10/22:** ✅ `app/api/auth/reset-password/route.ts`
**File 11/22:** ✅ `app/api/auth/resend-verification/route.ts`
**File 12/22:** ✅ `app/(auth)/layout.tsx`
**File 13/22:** ✅ `app/(auth)/login/page.tsx`
**File 14/22:** ✅ `app/(auth)/register/page.tsx`
**File 15/22:** ✅ `app/(auth)/verify-email/page.tsx`
**File 16/22:** ✅ `app/(auth)/verify-email/pending/page.tsx`
**File 17/22:** ✅ `app/(auth)/forgot-password/page.tsx`
**File 18/22:** ✅ `app/(auth)/reset-password/page.tsx`
**File 19/22:** ✅ `app/admin/login/page.tsx`
**File 20/22:** ✅ `components/auth/register-form.tsx`
**File 21/22:** ✅ `components/auth/login-form.tsx`
**File 22/22:** ✅ `components/auth/social-auth-buttons.tsx`

## Status Summary

- **Completed:** 22/22 files (100%)
- **Missing:** None

## Update 2026-07-07 — V8 single-symbol architecture

`lib/auth/permissions.ts` (File 5/22) was rewritten for the V8 tier redesign
(`change-to-new-design.md`): `TIER_PERMISSIONS.FREE` dropped `view_watchlist` (feature deleted)
and `create_alerts` (Alerts are now PRO-exclusive); `TIER_PERMISSIONS.PRO` gained
`multi_timeframe_visualization` and `drawing_line_alerts`. New middleware exports:
`requireCreateAlerts`, `requireDrawingLineAlerts`, `requireMultiTimeframe` (replacing the removed
`requireViewAllSymbols`/`requireViewAllTimeframes`, since chart access is no longer tier-gated).
No files added or removed from this Part.

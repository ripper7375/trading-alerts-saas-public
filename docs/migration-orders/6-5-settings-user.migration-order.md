# Migration Order — Session 6-5 — Settings / User

> For a session that **builds the missing account-deletion confirm/cancel pages** — the real
> `POST /api/user/account/deletion-request|confirm|cancel` routes already exist and are live
> (Session 4B-11 PORT — `UsersController`/`shouldUseOperationServiceForUserProfile()`), but no
> page anywhere in the tree exists for a user to land on after clicking the confirm or cancel link
> in their deletion email (`find app -iname '*delet*' -name 'page.tsx'` returns nothing). Adapted
> from `TEMPLATE-UI-BUILD.md`, dial **High for the confirm/cancel flow UX, Low for data** (every
> read/write this session needs is already a real, live endpoint). Sourced from Session 6-4's own
> Next-session handoff and the Phase 6 domain-slice order in `CLAUDE.md`'s Next-session block —
> re-verify at CONFIRM, this PRE-DRAFT was authored from a direct codebase read at Session 6-4's
> close, not from re-opening the original gap-analysis documents.

**Session:** 6-5 · **Phase:** Phase 6 (Frontend Redesign) · **Variant:** UI-BUILD (dial HIGH for
confirm/cancel flow UX, LOW for data) · **Status:** PRE-DRAFT · **Generated:** 2026-08-10 (at
Session 6-4 close) · **Flags touched:** none · **Estimated time:** ~2-4h
**Surface:** `app/(dashboard)/settings/account/delete/confirm/page.tsx` (new, exact path TBD at
DRAFT), `app/(dashboard)/settings/account/delete/cancel/page.tsx` (new, exact path TBD at DRAFT) ·
**Feeds on:** `POST /api/user/account/deletion-confirm`, `POST /api/user/account/deletion-cancel`
(both deliberately unauthenticated/optional-auth — token-based email-link flow, per each route's
own header comment), `POST /api/user/account/deletion-request` (already has a UI trigger somewhere
in `app/(dashboard)/settings/account/page.tsx`, 740 lines — re-verify at CONFIRM/DRAFT whether that
existing initiation UI needs any changes or is untouched by this session).

---

## Context

- **The gap:** all 3 account-deletion API routes exist and are live (`deletion-request`, 123 lines;
  `deletion-confirm`, 152 lines; `deletion-cancel`, 156 lines — all under
  `app/api/user/account/`) — but zero pages exist anywhere for a user to actually land on after
  clicking the confirm or cancel link a deletion email would send them to. `deletion-confirm`'s own
  route accepts a `POST` with `{ token }` in the body, not a `GET` with a query param — meaning
  whatever page this session builds must itself read the token (from the URL) and fire the `POST`
  client-side, not simply link straight to the API route. Re-verify this exact contract shape at
  DRAFT/CONFIRM, don't assume a `GET`-based magic-link pattern.
- **A real, known drift between this route's own code comment and the actual product decision,
  flagged so the DRAFT doesn't get misled by it:** `deletion-confirm/route.ts`'s header comment
  says "24-hour grace period" — but `DECISION-LOG.md` **F21** (still OPEN) and Session 4B-11's own
  CLAUDE.md history record the REAL SOURCE behavior as a **7-day token-based grace window**
  (`AccountDeletionRequest.expiresAt`), not 24 hours. Whatever copy this session writes for the
  confirm page (e.g., "your account will be deleted in N days") must be checked against the live
  `AccountDeletionRequest` schema's actual `expiresAt` computation, not the stale comment
  (`LESSONS-LEARNED.md` L12-class: a comment isn't the contract).
- **`deletion-cancel` supports a real dual-mode flow, not just a token:** its own comment says "can
  cancel via token (from email) OR session (logged in)" — meaning a LOGGED-IN user should also be
  able to cancel a pending deletion from somewhere in `app/(dashboard)/settings/account/page.tsx`
  itself (session-based, no token), separate from the emailed-link/token path this session's new
  page primarily targets. Re-verify whether `settings/account/page.tsx` (740 lines, not read in
  full for this PRE-DRAFT) already has a session-based cancel UI, or whether that's also this
  session's own scope.
- **F21 stays OPEN, non-blocking, same as every prior Phase 6 session:** this session builds UI for
  the EXISTING token-based flow; it does not resolve the hard-delete-vs-anonymize product question
  F21 tracks.

## User Review Required

> [!IMPORTANT]
> **Unauthenticated pages, real user-facing risk of a wrong click:** both `deletion-confirm` and
> (partially) `deletion-cancel` are public, token-based routes — a page hitting `deletion-confirm`
> on load with no user confirmation step would let a single accidental click (e.g., an email
> preview-pane prefetch, a corporate email scanner) delete an account with no human-in-the-loop
> gate. DRAFT must decide: does the confirm PAGE itself require a second, explicit
> "Yes, delete my account" click before firing the `POST`, or does simply landing on the page
> (with the token pre-validated some other way) suffice? Needs a real decision, not a guess.

> [!NOTE]
> **`settings/account/page.tsx` not read in full for this PRE-DRAFT** — whether it already has a
> deletion-request trigger and/or a session-based cancel UI is unconfirmed. Read it in full at
> DRAFT/CONFIRM before deciding this session's exact file list.

## Entry criteria

- [ ] Session 6-4 CONFIRMED, executed, closed (2026-08-10 — see `CLAUDE.md` Current entry).
- [ ] All 3 `app/api/user/account/deletion-*` routes re-verified live at CONFIRM (file existence,
      line counts, request/response contracts, auth mode per route).
- [ ] `app/(dashboard)/settings/account/page.tsx` read in full at CONFIRM/DRAFT — the two open
      questions above (existing deletion-request trigger? existing session-based cancel UI?)
      resolved with evidence, not assumed either way.
- [ ] The confirm-page human-in-the-loop question (User Review above) resolved by Davin before
      DRAFT is finalized.
- [ ] Monolith baseline re-measured at CONFIRM (`tsc --noEmit`, `eslint app components lib hooks
--max-warnings 0`, `test:ci` — last known at 6-4's close: 134/134 suites, 2217/2217 tests, 3
      pre-existing lint warnings).
- [ ] Full Advisor DRAFT + Davin APPROVED before CONFIRM — not fast-path eligible (new pages, an
      unauthenticated-flow UX decision needs a real human call first).

## Integration points

- **In:** `POST /api/user/account/deletion-confirm`, `POST /api/user/account/deletion-cancel`,
  possibly `getServerSession()` for the session-based cancel path.
- **Out:** No backend service changes.
- **Owns:** the new confirm/cancel page(s) under `app/(dashboard)/settings/account/*` (exact paths
  TBD at DRAFT).

## Rules specific to this variant

- **UI Creativity (Dial HIGH):** full freedom on confirm/cancel page layout, success/error states,
  countdown-to-deletion messaging, cancel-confirmation UX.
- **Data Contract (Dial LOW):** payloads for the 2-3 deletion routes must strictly adhere to their
  real, live request/response shapes — verify each at DRAFT, don't invent fields.
- **No speculative retention-policy UI:** F21 (hard-delete vs. anonymize) stays out of scope; this
  session surfaces the EXISTING flow's real behavior, it does not change what deletion actually does
  server-side.

## Done when

- [ ] Both confirm and cancel pages exist, render correctly for a valid token, and call the correct
      real API route.
- [ ] An invalid/expired/already-used token shows a real, non-crashing error state (verify the
      route's actual error shape for this case, don't guess the UI copy).
- [ ] `tsc --noEmit` clean; `eslint --max-warnings 0` introduces 0 new warnings; `test:ci` green.

## Rollback

Same-stack UI work; rollback is `git revert`.

## Retire

N/A.

## Deviations

_(filled during execution)_

## Known wrinkles / do-not-touch

- `lib/api/index.ts` stays untouched (`EXECUTOR-PROTOCOL.md` §5).
- `frontend/` mirror tree is out of scope (`EXECUTOR-PROTOCOL.md` §5).
- `DECISION-LOG.md` **F21** (24h/7d grace-window product decision), **F50**, and **F64** stay open,
  non-blocking — this session surfaces existing behavior, it doesn't resolve F21.

## Next-session handoff

Session **6-6** (Admin) is next in Phase 6, per the session playbook's own remaining order.

---
type: Concept/AgentState
status: active
updated_at: 2026-09-26
last_numbered_session: '14-3 (CLOSED SUCCESSFUL 2026-08-30) — Phase 14 complete'
next_numbered_session: '12-0 (Phase 12, Stack D) — blocked on the handover-prompt re-draft, see waiting-on.md'
git_branch: main
max_sessions: 2
related_docs:
  - ./waiting-on.md
  - ./history/index.md
  - ../protocols/session-lifecycle.md
---

# Active session state

Holds **at most 2** session entries (newest first). When you add a third, move the oldest into
`history/YYYY-MM-sessions.md` per [session-lifecycle](../protocols/session-lifecycle.md).
Every entry older than these two is in [history](./history/index.md).

## Where the project stands

- **Playbook position:** last numbered session is **14-3** (Cutover + Runbook), closed
  2026-08-30; **Phase 14 (Web Chat) is complete**. Every session since then has been an
  ad-hoc session ("phase/session unchanged"). Next numbered work is **Phase 12 / Session 12-0**
  (`docs/migration-orders/12-0-decisions-and-contracts.migration-order.md`), gated on the
  Advisor re-drafting the Phase 12 handover prompt (see [waiting-on](./waiting-on.md)).
- **Status correction (2026-09-26, OKF refactor):** round 5 below says "NOT committed, NOT
  deployed". It has since been committed and merged to `main` via PR #474 (`31c2e8d4`).
  Deployment was not verified during the refactor.
- **Open follow-ups:** see [waiting-on.md](./waiting-on.md). Database traps:
  [database-traps.md](../architecture/database-traps.md).

## Latest sessions (verbatim)

<!-- CLAUDE.md L16-L36 -->

> **Same day (2026-09-26), round 5: the landing hero image and the page theme no longer disagree. On
> `main`, NOT committed, NOT deployed.** Davin's screenshots showed a dark page with the light hero
> artwork until a refresh. **Cause:** next-themes' `<ThemeProvider>` was still mounted in
> `app/providers.tsx`. Its theme was seeded from `localStorage['davintrade-theme']`, and its passive
> effect re-applied that value to `<html>` after AppearanceProvider's layout effect had applied the
> server value (DB, else the `davintrade-appearance` cookie). The root layout's inline script also
> preferred localStorage. So a stale value painted the page while `resolvedTheme` (hero image,
> charts) followed the server. Examples: the old dark default, or another account on the same
> browser. **Fix:** next-themes unmounted. The inline script paints only `?theme=` or the server
> theme ('system' resolved). AppearanceProvider's `storage` listener is removed, since two tabs on
> different themes would re-write the key back and forth, and so is its localStorage write.
> `ThemeSync` (`?theme=`) now goes through `updateSettings`.
> **Verified:** `tsc`/ESLint clean; `test:ci` **251/251 · 3213/3213** (new
> `__tests__/app/providers-theme.test.tsx`); mutation (next-themes restored) fails with
> `Expected "light" / Received "dark"`, restore byte-exact; live `next dev`: stale `dark` in
> localStorage with the server on light gives a light page and light images; the toggle switches
> both; the saved choice survives a reload over the opposite localStorage value. **Seen, not
> fixed:** `/` hydration mismatch when the `davintrade-locale` cookie is `zh` (server hero text
> English, client Chinese), which is the locale system, not theme. `components/theme-toggle.tsx`
> still imports next-themes but nothing imports it.

<!-- CLAUDE.md L37-L52 -->

> **Same day (2026-09-26), round 4 — commission cap in months, interval-aware MRR, one exchange-rate
> table. Branch `fix/commission-cap-mrr-fx-rates`, committed as `a0b87b73`, merged to `main` via PR #473,
> DEPLOYED to production (Vercel & Railway). Money change, done on Davin's explicit chat order.**
> (1) The recurring affiliate commission cap is now 24 **months**:
> `MAX_RECURRING_COMMISSION_MONTHS` + `getMaxCommissionCycles(interval)` = 24 monthly or 2 annual
> invoices (was 24 invoices = 24 years on the annual plan); the Stripe webhook passes the invoice
> interval in both apps. (2) Admin MRR = monthly PRO × base price + annual PRO (`planType`
> `YEARLY`) × annual price ÷ 12, via `lib/admin/analytics/mrr.ts` / money-service `admin-mrr.ts`.
> (3) Both apps share the USD rate table in Redis (`fx:usd_rates`, 1 h, read first, written on
> fetch, 500 ms timeout, optional); fallback rates unified to `CURRENCY_USD_RATES` (dLocal THB
> 35.25 → 35.0 etc.), guarded by `__tests__/lib/fx/usd-rates-parity.test.ts`.
> **Verified & Live:** `tsc` clean both; `test:ci` **250/250 · 3211/3211**; money-service **66/66 ·
> 650/650**; mutation **11/11**. Vercel `REDIS_URL` set to Railway Redis public proxy
> (`shuttle.proxy.rlwy.net:43928`). Live `/api/fx/rates` returns `"source": "live"`, and `fx:usd_rates`
> key verified populated in Railway Redis. Account: SystemConfig manifest §12.

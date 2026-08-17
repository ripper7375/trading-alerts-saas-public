# Codebase 2 ↔ Codebase 1 Parity + DavinTrade Design-System Audit — Master Plan

> **Source of truth:** `docs/files-completion-list/frontend-codebase-migration/ui-pages-replication.xlsx`
> (sheet `codebase_1_vs_codebase_2`, 95 rows). This plan splits that 95-row audit into 9
> self-contained batches so each can be run as its own Claude Code session without
> re-deriving the context below from scratch (that re-derivation is what burns tokens —
> this plan front-loads it once).

- **Codebase 1** = this repo's root (`app/`, `components/`, `lib/`, ...) — old **"Trading
  Alerts"** brand, full frontend + backend, **read-only reference for this task**.
- **Codebase 2** = `seed-code/trading-conversational-ai-ui-pages-increment` — new
  **"DavinTrade"** brand, frontend-only, **the only folder any batch may modify**.

---

## 0. Protected pages — never modify (confirmed by Davin, 2026-08-17)

These 6 pages are **complete and entirely out of scope for this audit**. Davin confirmed
directly (2026-08-17) they are already "fully well designed" — no Rule-1 check, no Rule-2
restyling, no cosmetic nitpicks, no edits of any kind. Do not open them expecting to find
something to fix.

| Route                  | Row No. | Batch it would otherwise fall in |
| ---------------------- | ------- | -------------------------------- |
| `/`                    | 1       | Batch 4                          |
| `/terminal`            | 57      | Batch 2                          |
| `/free`                | 58      | Batch 2                          |
| `/dashboard`           | 62      | Batch 2                          |
| `/settings/appearance` | 74      | Batch 3                          |
| `/settings/help`       | 76      | Batch 3                          |

Every batch file below that contains one of these rows marks it **`PROTECTED — DO NOT
MODIFY`** directly in its row table. Skip that row entirely when working through the batch
— don't diff it, don't screenshot-compare it, don't edit it, don't suggest changes to it in
your findings. If shared-shell work (Batch 0) or another batch's fix to a common component
would touch one of these 6 pages as a side effect, stop and flag it instead of proceeding.

---

## 1. The two rules, and how to read them

Davin's request:

1. **Functional layout structure, user flows, and core interactive elements** in the 95
   pages of Codebase 2 must be **exactly matched** against their counterparts in Codebase 1.
2. Codebase 2's **visual styling (colour, font, etc.), component modularity, and brand
   tokens** must comply with the **DavinTrade AI design system**.

**Interpretation used by every batch below (flag to Davin if wrong before starting):**
Rule 1 is about _information architecture and functionality_ — every nav item, form field,
button, flow step, and page section that exists in the Codebase-1 counterpart must also
exist and work in the Codebase-2 page. Rule 2 is about _presentation_ — every colour, font,
and component variant must come from DavinTrade's tokens, never Codebase 1's old plain
light "Trading Alerts" styling.

These two rules are **not in tension** and Rule 1 does **not** mean "make Codebase 2 look
like Codebase 1." Codebase 2 is allowed — expected — to carry DavinTrade-only elements
(AI mascot, live-ticker tape, "AI Workbench" nav item, stat tiles, Support Centre widget,
etc.) layered on top of the same functional skeleton, as long as nothing Codebase 1 offers
is missing, relocated in a way that breaks the flow, or non-functional.

Evidence for this reading: compare `codebase-1-non-login/row_01_landing_page.png` (plain
light marketing page: logo, 3 nav links, Sign In, one CTA pair) against
`codebase-2-non-login/row_01_landing_page.png` (dark DavinTrade hero with mascot, live
ticker, AI Workbench nav item, Support Centre panel, stat tiles) — Codebase 2 is a superset,
not a redesign-to-match. **Row 1 (the landing page) is itself now a Protected page (§0) and
must not be touched regardless of interpretation** — it's cited here only as the clearest
illustration of the DavinTrade design philosophy the remaining 89 in-scope pages should be
brought up to. Davin protecting this page (plus `/terminal`, `/free`, `/dashboard`,
`/settings/appearance`, `/settings/help`) as "already fully well designed" rather than
asking for it to be simplified is itself supporting evidence for this reading. If it still
turns out literal structural replication is wanted for any of the other 89 pages, flag it
before that specific batch starts rather than assuming.

---

## 2. Known structural exceptions (apply automatically — don't re-litigate per batch)

Confirmed by direct comparison of the xlsx `Codebase 1 Evidence` / `Codebase 2 Evidence`
columns against the live filesystem:

| Rows       | Route                                        | Status                                                                                                                                                                        | What it means for this audit                                                                                                                                    |
| ---------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 55, 56, 59 | `/charts/[symbol]/[timeframe]` ×2, `/charts` | **Retired in Codebase 2** (superseded by `/terminal` + `/free`)                                                                                                               | Confirm still absent from Codebase 2. Nothing to build. Don't touch.                                                                                            |
| 57, 58     | `/terminal`, `/free`                         | No Codebase 1 counterpart exists ("Not available")                                                                                                                            | Rule 1 is N/A (nothing to match). Rule 2 (DavinTrade compliance) still applies.                                                                                 |
| 94, 95     | `/admin/notifications/broadcast`, `/welcome` | Codebase 1 evidence says **"Proposed / Pending Creation"** — not actually built in Codebase 1                                                                                 | Same treatment as 57/58: Rule 1 N/A, Rule 2 applies.                                                                                                            |
| 86         | `/test-api`                                  | Codebase 1's `app/test-api/` was **deleted** by an earlier session (confirmed on disk — it no longer exists in the root `app/`); Codebase 2 still has `app/test-api/page.tsx` | Codebase 1's own counterpart is gone, so there's nothing left to structurally match. Flag as a retirement candidate to Davin — don't spend effort polishing it. |

Also: a handful of xlsx "Evidence" cells point at a related API route, component, or Prisma
schema file instead of the actual `page.tsx` (e.g. row 50 → `components/alerts/alert-form.tsx`,
row 80 → `lib/security/device-detection.ts`, row 68 → `components/notifications/notification-bell.tsx`).
That's just how the sheet was filled in — it does **not** mean the Codebase-1 page is missing.
Locate the real Codebase-1 `page.tsx` at the equivalent Next.js route under `app/` before
concluding a page doesn't exist there.

---

## 3. Hard constraints (every batch, no exceptions)

1. **Never modify the 6 Protected pages in §0** (`/`, `/terminal`, `/free`, `/dashboard`,
   `/settings/appearance`, `/settings/help`). This is the single most important constraint
   in this document — it overrides every other instruction below, including a batch file's
   own row table if one is ever edited to disagree with this.
2. **Only modify files inside `seed-code/trading-conversational-ai-ui-pages-increment`.**
   Codebase 1 (this repo's root `app/`, `components/`, `lib/`, etc.) is read-only reference
   material — never edit it for this task.
3. Don't touch the 3 retired pages (rows 55, 56, 59) — they must stay absent from Codebase 2.
4. **Keep DavinTrade branding.** Never reintroduce "Trading Alerts" wordmark/logo, the old
   plain blue-on-white palette, or generic unstyled shadcn defaults. If a Codebase-2 page
   currently _does_ still look like Codebase 1 (light theme, no DavinTrade tokens, old
   branding), that's the specific Rule-2 defect to fix — reskin it to DavinTrade, don't
   leave it as-is and don't copy Codebase 1's look verbatim either.
5. This repo runs a **non-standard Next.js version** — read
   `seed-code/trading-conversational-ai-ui-pages-increment/node_modules/next/dist/docs/`
   before writing code, per that folder's own `AGENTS.md`.
6. Verify with `tsc`/build inside `seed-code/trading-conversational-ai-ui-pages-increment`
   after edits — don't assume a change compiles.

---

## 4. Reference material (read once per batch, before touching code)

- This file.
- Your own batch file (row table + batch-specific notes).
- `davintrade-ui-design-stack/hand-off-to-claude-code-for-appearance-stack/HYBRID_APPEARANCE_HANDOFF_SPECIFICATION.md`
  — canonical DavinTrade colour tokens & theme system (dark trading-terminal palette,
  amber/emerald/blue/purple accent schemes, light-mode target colours).
- `seed-code/trading-conversational-ai-ui-pages-increment/app/globals.css` and
  `lib/appearance/types.ts` — the actual CSS variables/tokens available to use.
- The screenshot pairs for your rows (path convention below) — open both Codebase-1 and
  Codebase-2 screenshots for every applicable tier, and both source files, before editing.

**Do not treat `PAGES_INVENTORY.md` or `docs/app_pages_and_routes_inventory.md` (inside
Codebase 2) as authoritative page lists — both are stale (last covered ~24 of the current
95 pages).** Your batch's row table below and the master xlsx are the only authoritative
lists.

### Live deployment URLs (for verifying real interactive behaviour, not just source/screenshots)

Screenshots are static single-frame captures — they can't show hover states, dropdown
menus, modal dialogs, toasts, or form-validation behaviour. When a Rule-1 check needs to
confirm a _flow_ actually works the same way (not just that the markup exists), click
through the **live** deployments rather than guessing from a screenshot:

- Codebase 1 (Trading Alerts): `https://trading-alerts-saas-frontend.vercel.app` + the
  page's Route from your batch table (e.g. `/settings/billing`)
- Codebase 2 (DavinTrade): `https://trading-conversational-ai-ui-pages.vercel.app` + the
  same Route

You don't need the xlsx for this — the base URLs are fixed, and every batch table already
gives you the Route to append. Codebase 1's live site is the read-only reference; only ever
navigate it, never assume any action there needs reproducing outside Codebase 2.

### Screenshot path convention

```
davintrade-ui-design-stack/frontend-design/screenshot-image/codebase-{1|2}-{tier}/row_{NN}_{slug}.png
```

- `{tier}` ∈ `non-login`, `free`, `pro`, `affiliate-free`, `affiliate-pro`, `admin`
- `{NN}` = zero-padded row No. from your batch table (e.g. row 5 → `row_05_...`)
- `{slug}` = slugified page name. If unsure, `Glob` the folder for `row_{NN}_*` — filenames
  are identical across all 12 tier folders (only the folder differs) so one successful glob
  tells you the slug for every tier/codebase combination of that row.
- Not every tier applies to every page (e.g. Free-tier users can't reach Admin-only pages —
  the xlsx marks those cells "Not available"). Skip tiers that don't apply; don't treat a
  missing screenshot as a bug unless the xlsx cell for that row+tier has a real path that
  doesn't resolve to a file (that's a genuine capture gap worth flagging, not fixing).

---

## 5. What "done" means per page

For every row in your batch table:

1. Open the Codebase-1 screenshot(s) + Codebase-1 source file(s) for every applicable tier.
2. Open the Codebase-2 screenshot(s) + Codebase-2 source file for every applicable tier.
3. List concretely:
   - **Rule-1 gaps**: any interactive element / nav item / form field / flow step present
     in Codebase 1 but missing, relocated-and-broken, or non-functional in Codebase 2.
   - **Rule-2 gaps**: any colour/class/asset in Codebase 2 that is _not_ a DavinTrade token
     — leftover Trading-Alerts blue, wrong font, unstyled default shadcn look, missing
     brand asset, light-mode pages that don't follow the appearance-handoff spec's light
     palette.
4. Fix only inside `seed-code/trading-conversational-ai-ui-pages-increment`.
5. Re-render (dev server or build) the page after each fix to confirm it still compiles
   and looks right — don't ship an edit unverified.
6. Append your findings + fixes to your batch file under a `## Findings` section you add
   (row number, what was wrong, what you changed, file(s) touched) — this is what lets the
   next session (or Davin) know what happened without re-reading a diff.

---

## 6. Batch index & execution order

**Run Batch 0 first, alone.** It touches shared layout/navigation/global-error components
that every other batch's pages render through — fixing it first avoids 8 separate sessions
redundantly patching the same header/sidebar file and creating merge conflicts.

**Batches 1–8 are independent of each other** (separate route folders, no shared files) and
can run in parallel across separate Claude Code sessions once Batch 0 is merged.

| Batch | Name                                                              | Pages (in scope / protected) | Rows                                                | Notes                                                                                                                                                                   |
| ----- | ----------------------------------------------------------------- | ---------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Shared Shell & Global Pages                                       | 2 rows + component audit     | 92, 93                                              | **Run first, alone.** Layout/header/sidebar/providers audit + global-error/not-found.                                                                                   |
| 1     | Auth & Account-Token Pages                                        | 9 / 0                        | 3, 4, 65, 67, 71, 72, 88, 89, 90                    | Login/register/password/2FA/email-verify/account-deletion flows.                                                                                                        |
| 2     | Dashboard, Alerts & Trading Workspace                             | 9 / **3 protected**          | 49–51, 55–59, 62, 68, 86, 87                        | Rows 57 (`/terminal`), 58 (`/free`), 62 (`/dashboard`) are Protected (§0) — skip. Also includes the retired rows (55, 56, 59) and the `/test-api` retirement flag (86). |
| 3     | Settings Suite                                                    | 9 / **2 protected**          | 73–83                                               | Rows 74 (`/settings/appearance`), 76 (`/settings/help`) are Protected (§0) — skip.                                                                                      |
| 4     | Marketing, Legal & Commerce                                       | 14 / **1 protected**         | 1, 2, 52–54, 60, 61, 63, 64, 66, 69, 70, 84, 85, 95 | Row 1 (`/`) is Protected (§0) — skip. Includes row 95 (`/welcome`, no C1 counterpart).                                                                                  |
| 5     | Affiliate Portal                                                  | 14 / 0                       | 35–48                                               | `/affiliate/*`.                                                                                                                                                         |
| 6     | Admin — Affiliate Reports & Directory                             | 7 / 0                        | 5–11                                                | `/admin/affiliates*`.                                                                                                                                                   |
| 7     | Admin — Disbursement Suite                                        | 10 / 0                       | 13–22                                               | `/admin/disbursement/*`.                                                                                                                                                |
| 8     | Admin — Core (Users, Fraud, System, Login, Settings, API, Errors) | 15 / 0                       | 12, 23–34, 91, 94                                   | Includes row 94 (no C1 counterpart) and row 91 (admin sidebar nav card).                                                                                                |

Total: 2 + 9 + 12 + 11 + 15 + 14 + 7 + 10 + 15 = 95 rows, fully partitioned, no overlaps.
**89 rows are in scope for this audit; 6 rows (1, 57, 58, 62, 74, 76) are Protected per §0.**

## 7. How to hand a batch to another Claude Code agent

Open a fresh Claude Code session in this repo and give it this as the prompt:

> Read and execute `docs/files-completion-list/frontend-codebase-migration/codebase-2-parity-audit/00-MASTER-PLAN.md`
> for shared rules/constraints, then `docs/files-completion-list/frontend-codebase-migration/codebase-2-parity-audit/batch-N-<name>.md`
> for your row list. Work through every row's "done" checklist from the master plan and
> append your findings to the batch file.

Each batch file is self-contained (rules recap + its own row table) so the session doesn't
need this master file loaded in full context — but should skim it once for the exceptions
in §2 and constraints in §3.

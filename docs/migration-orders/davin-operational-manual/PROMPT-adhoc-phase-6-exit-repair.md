# Ad-Hoc Session Prompt — Phase 6 Exit Repair (post-6-12, pre-7-1)

**How to use.** Paste the block between `=== BEGIN` and `=== END` into a fresh Claude Code
terminal chat. No Advisor step, no DRAFT — `EXECUTOR-PROTOCOL.md` §6 permits ad-hoc repair
sessions. Stay in the chat: there is a decision checkpoint after Step 2 that needs your answer.

**Why this is legitimate rather than a bypass:** §6 explicitly allows ad-hoc sessions for
incidents and repairs outside the playbook numbering, provided they follow the same open/close
rituals and artifact updates, and are labelled clearly in `CLAUDE.md` with "phase/session
unchanged." This prompt does exactly that.

---

=== BEGIN COPY ===

Ad-hoc repair session — Phase 6 exit integrity. Not a playbook session: phase/session numbering
is unchanged (Phase 6 stays CLOSED, Phase 7 has not opened). Run it per `EXECUTOR-PROTOCOL.md`
§6 — same OPEN/CONFIRM/CLOSE rituals and artifact updates as any session, no Advisor DRAFT.

**Read first (and only these — the playbook, implementation plan and handbook need no changes,
Phase 6's structure is not being altered):**
`CLAUDE.md`, `docs/migration-orders/EXECUTOR-PROTOCOL.md`,
`docs/migration-orders/LESSONS-LEARNED.md`,
`docs/migration-orders/phase-6-frontend-gap-matrix.md`,
`docs/migration-orders/DECISION-LOG.md` (F11 entry),
`docs/files-completion-list/ui-page-gap-register.xlsx` (sheet `verification`).

**Background.** An independent post-6-12 re-audit of the live working tree found Phase 6's exit
claim — "all 59 gap-matrix rows triaged as BUILT / VERIFIED / OUT_OF_SCOPE" — does not hold for
one row. Full findings are in the `verification` sheet of the register. Phase 6 otherwise
delivered: 84 pages, zero mock data, zero dead links, orphaned endpoints 32 → 4, F11/F61/F62/F63
all resolved.

---

## Step 0 — CONFIRM the findings yourself. Do not take them on trust.

Re-verify each of these against live code and report what you find BEFORE changing anything.
If any finding does not reproduce, say so — a disproved finding is a good outcome, not a failure.

1. `app/(dashboard)/settings/security/activity/page.tsx` does not exist, and no page anywhere
   serves a security-activity surface.
2. The `SecurityAlert` Prisma model has **zero** UI consumers. Writers confirmed as
   `app/api/user/password/route.ts`, `app/api/user/2fa/disable/route.ts`,
   `app/api/user/2fa/verify-setup/route.ts`, and `operation-service`'s
   `users.service.ts` (~L240) and `two-factor.service.ts`.
3. No `security-alerts` endpoint exists in either the monolith (`app/api/user/`) or
   `operation-service` (`UsersController` has no such route).
4. `app/(dashboard)/settings/security/page.tsx` line ~177 still calls
   `fetch('/api/user/login-history?limit=20')` with no pagination, offset, or view-all.
5. `phase-6-frontend-gap-matrix.md` row **A2-12** carries triage `BUILT (Session 6-5)`, and row
   **A1-9** carries `BUILT (Session 6-5)`.
6. Session 6-5's own order (`6-5-settings-user.migration-order.md`) never scoped a
   security-activity page — confirm by reading its Ordered Steps and Done-when.
7. These 4 endpoints have no UI consumer: `POST /api/checkout/validate-code`,
   `GET /api/payments/dlocal/exchange-rate`, `GET /api/affiliate/profile/payment`,
   `GET /api/disbursement/reports/affiliate/[affiliateId]` (and
   `/api/disbursement/affiliates/[id]/commissions`).

Also re-measure the baseline: `tsc --noEmit`, `eslint app components lib hooks --max-warnings 0`,
`npm run test:ci`. Report the real numbers — do not quote 149/149 or 2322/2322 from any document.

---

## Step 1 — Correct the record (do this regardless of what I decide in Step 2)

This is the mandatory part. A false `BUILT` claim will be read as truth by Phase 7 planning.

- `phase-6-frontend-gap-matrix.md`: change row **A2-12** from `BUILT (Session 6-5)` to
  `OPEN — recorded BUILT in error, corrected <date> (ad-hoc)`. Change row **A1-9** to
  `PARTIAL (Session 6-5)` with a note stating exactly which sub-items shipped (the 2FA dummy-widget
  replacement) and which did not (login-history pagination, SecurityAlert surfacing).
- Add a correction note to the matrix header recording that its own "all 59 rows triaged" claim
  was inaccurate, when it was found, and how.
- `DECISION-LOG.md`: append to the **F11** entry. Do **not** flip F11 back to OPEN — the triage
  itself genuinely happened; one verdict was factually wrong. Record the correction and its cause.
- `docs/files-completion-list/ui-page-gap-register.xlsx`: the `verification` sheet already holds
  the finding; leave it as the evidence of record.

Commit this step on its own before touching any code.

---

## Step 2 — STOP and ask me two decisions

Do not proceed past this point without my answers.

**Decision A — build A2-12/A1-9, or re-triage it out?**
Present both honestly with what each costs:

- **Build it.** Requires a new `@Get('security-alerts')` on `operation-service`'s
  `UsersController` + service method + spec, a monolith `app/api/user/security-alerts/route.ts`
  following the exact flag-gated forwarding pattern already used by
  `app/api/user/login-history/route.ts`, lifting the `limit=20` cap, and the page itself.
  **This is a two-service change requiring a Railway deploy of `operation-service`
  (`railway up --path-as-root --service operation-service`) — an `EXECUTOR-PROTOCOL.md` §7
  escalation.** Tell me the realistic step count and where it could go wrong.
- **Re-triage `OUT_OF_SCOPE (Ticketed)`.** It was P3 in the original register — visibility, not a
  broken journey. Users still receive the security emails; they just cannot review them in-app.
  Same disposition as B2-13 `/welcome`.

**Decision B — the two orphaned endpoints needing triage.** For each, tell me whether anything
external could depend on it, then take my call: retire in Phase 8's deletion sweep, or keep.

- `GET /api/affiliate/profile/payment` — orphaned as a _consequence_ of A1-16 being built
  correctly (its page is now a redirect). Benign, but no order recorded this as intended.
- `GET /api/disbursement/reports/affiliate/[affiliateId]` + `/commissions` — A2-7 cited three
  endpoints as evidence; the page built at 6-6 calls only one.

For the record: `validate-code` and `exchange-rate` need **no** decision — I resolved those live
at 6-8 CONFIRM (their target components already had working consumers of different endpoints).
Confirm that's still the state and leave them alone.

---

## Step 3 — Execute only what I authorised in Step 2

If I said build: one commit per logical unit, tests alongside the code, `tsc --noEmit` and the
lint scope clean after each. Do not batch. Escalate before any deploy.

If I said re-triage: matrix + `DECISION-LOG.md` only, no code.

---

## Step 4 — Close

Per `EXECUTOR-PROTOCOL.md` §3, with one deliberate difference: **this is an ad-hoc session, so
label it clearly in `CLAUDE.md` as ad-hoc and state "phase/session unchanged" — do not create a
new Current session entry that implies Phase 7 opened or Phase 6 reopened.**

- Re-run the suites; show real results.
- Fill Deviations in the ad-hoc record.
- Update `CLAUDE.md`: what was repaired, what I decided, what remains ticketed.
- **Harvest the lesson.** A gap-matrix row was marked `BUILT` for work that was never scoped by
  the session it was attributed to, and that claim survived a phase-exit review. Distil the rule
  — not the story. Candidate shape: _"a row's triage verdict must cite the commit or file that
  closed it; 'BUILT (Session N)' is not evidence unless session N's own order scoped it."_
  Respect the file's hygiene rules (≤40 active entries, ≤6 lines each; consolidate if over cap).
- Do **not** PRE-DRAFT a next session — `7-1-api-client-reverify-and-generate.migration-order.md`
  already exists and is unaffected by this repair.

---

## Standing constraints

- Do not touch `lib/api/index.ts` — known-broken by design, Phase 7 owns it.
- Do not alter Phase 6's session structure, the playbook, the implementation plan, or the
  handbook. Only four factual records are wrong; the process itself is not.
- Value-blind on secrets always — existence checks only, never print a value.
- If anything in Step 0 fails to reproduce, stop and tell me before proceeding.

Start with Step 0 and report before changing anything.

=== END COPY ===

---

## What this prompt deliberately does NOT skip, and why

You asked about bypassing "unnecessary system markdown files." Here is the split:

**Safe to skip** (no changes needed — Phase 6's structure is not being altered):
`monolith-to-microservices-migration-session-playbook.md`,
`monolith-to-microservices-migration-implementation-plan.md`, the v9 handbook xlsx,
`00-SKELETON-AND-RULES.md`, all `TEMPLATE-*.md`, `migration-cutover-table.md`,
`migration-stack-analysis.md` (unless code is actually written in Step 3).

**Must not skip** — these are the files carrying the false claim, and the whole point of the
session is that the record is wrong:
`CLAUDE.md`, `DECISION-LOG.md` (F11), `phase-6-frontend-gap-matrix.md`,
`ui-page-gap-register.xlsx`, `LESSONS-LEARNED.md`.

Skipping the record-keeping to repair a record-keeping failure would reproduce the exact defect
being fixed.

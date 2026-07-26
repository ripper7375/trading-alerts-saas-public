# Migration Order — PORT variant (backend) + UI-BUILD variant (form)

> For sessions that build new backend surfaces guided by a frozen contract (PORT rules — the
> OpenAPI spec is the law, not a redesign target) and the frontend surface that consumes them
> (UI-BUILD — creativity on layout/interaction is expected, the DATA contract is not). Read
> `00-SKELETON-AND-RULES.md` first — §4 applies: **Low** dial for the backend service files
> (§7 endpoints below are fixed by `part19.5-wise-disbursement-openapi.yaml`, frozen at 4A-W1),
> **High** dial for the recipient-onboarding form itself.

**Session:** 4A-W3 · **Variant:** PORT (backend) + UI-BUILD (form) · **Status:** PRE-DRAFT
**Generated:** 2026-07-26 (Executor, at 4A-W2's close) · **Estimated time:** ~4h — **split into
W3a (backend) / W3b (UI) if it exceeds 4h**, per `00-SKELETON-AND-RULES.md` §3
**Flags touched:** **F39** (resolve — who fills the recipient form: affiliate self-service vs
admin-entered), **F41** (resolve — Wise recipient PII retention/deletion, interacts with F21)
**Phase / plan section:** Phase 4A — money-service · Part 19.5 (RiseWorks → Wise), session 3 of 8
**Target service:** money-service (`src/wise/*`, new module) + monolith frontend
(`app/(dashboard)/admin/disbursement/recipients` or an affiliate-facing equivalent, per F39)
**Contract:** `part19.5-wise-disbursement-openapi.yaml` (frozen at 4A-W1) +
`01-part-19.5-wise-disbursement-architecture-design.md` §6.1, §7
**Seeded from:** `docs/migration-orders/replace-rise-with-wise/04-rise-to-wise-migration-plan.md`
§4 "4A-W3 — BUILD recipient onboarding"

---

## Why this session, why now

4A-W2 (CONFIRMED, executed 2026-07-26) created the 5 new tables this session writes to and
proved `money_svc` can read/write all of them. This session builds the first real Wise API
integration: recipient onboarding — the prerequisite for every later Wise session (batch payout,
webhooks) to have anyone to pay. F39/F41 must resolve here because the onboarding surface's
shape (who fills the form, what's retained) depends on the answer.

---

## Entry criteria

_(verified at CONFIRM time, not assumed — `EXECUTOR-PROTOCOL.md` §1.3)_

- [ ] **4A-W2 closed CONFIRMED**; the 5 new tables live in production and proven writable by
      `money_svc` (both confirmed at 4A-W2's close).
- [ ] Sandbox Wise token works (re-verify — F39's guard choice depends on a working auth path).
- [ ] **F39 answered** (Davin) before Step 5 (controller guards depend on the answer).
- [ ] `WISE_API_TOKEN` set on money-service — **read-only is sufficient for this session**
      (full access not needed until 4A-W6); verify presence **value-blind** only (L17 — never
      `railway variables --kv`).
- [ ] File inventory below re-verified against the live codebase (paths + line counts) before
      Step 1 — money-service has grown across 4A-W2; do not trust this PRE-DRAFT's line-count
      placeholders without a fresh `wc -l`.

**A failed entry criterion means do not start** — propose the fix or the session swap.

---

## Integration points

- **In:** affiliate dashboard or admin UI (per F39) → `wise-recipients.controller.ts`
- **Out:** Wise API (`api.wise.com` production / sandbox, per `02-wise-platform-api-integration-reference.md`)
- **Owns:** `AffiliateWiseRecipient` (money-service writes; monolith never writes this table directly)

---

## Ordered steps

_(each step = change → immediate verification → rollback note; backend steps 1–6 are PORT-dialed
against the frozen contract, steps 7–8 are UI-BUILD-dialed)_

### 1. Backend scaffolding

`money-service/src/wise/wise.config.ts`, `wise.constants.ts`, `wise.types.ts`.
_Verify:_ money-service builds with the new empty module wired (or unwired, if deferred to step 5).
_Rollback:_ delete the new files.

### 2. Wise API client

`wise-api.client.ts` — `fetch`-based (no new dependency; Node ≥20 has native `fetch`),
`X-External-Correlation-Id` on every call, `429`/`Retry-After` handling with exponential
back-off. **Explicit body redaction for `POST /v1/accounts`** — never log the `details` object
(design §7.4; this is a hard PII rule, not a style preference).
_Verify:_ unit tests for retry/back-off logic; a redaction test asserting `details` never reaches
any logger call.
_Rollback:_ delete the file; nothing else depends on it yet.

### 3. Signature verifier (built here so 4A-W5 inherits it ready-made)

`wise-signature.constants.ts` (both published Wise PEMs, per `02-…reference.md`) +
`wise-signature.verifier.ts` with unit tests.
_Verify:_ valid / tampered / wrong-key / malformed-base64 / empty-body all covered by tests.
_Rollback:_ delete the files; 4A-W5 builds its own if this doesn't land.

### 4. Recipient service

`wise-recipient.service.ts`: `getAccountRequirements` (quote-scoped,
`Accept-Minor-Version: 1`, **including the `refreshRequirementsOnChange` POST round-trip** —
design/plan flag this explicitly, don't skip it), `createRecipient`, `getRecipient`,
`deactivateRecipient`.
_Verify:_ unit tests against recorded/mocked Wise responses for each method.
_Rollback:_ delete the file.

### 5. Recipient controller

`wise-recipients.controller.ts` → `GET /v1/wise/recipients/requirements`,
`POST /v1/wise/recipients`, `GET /v1/wise/recipients`, `GET /v1/wise/recipients/me`,
`POST /v1/wise/recipients/{id}/revalidate`. Guards per F39's answer (affiliate self-service vs
admin-only — do not guess this, it gates who can write PII-adjacent data).
_Verify:_ unauthenticated → 401 on every route (matches this repo's established pattern,
`LESSONS-LEARNED.md` L18 — a 401 proves the guard, not the schema; the real schema test is the
first authenticated call, step 8).
_Rollback:_ delete the file; unregister from `wise.module.ts`.

### 6. Fetch and commit the real THB requirement schema from production

Read-only call against **production** Wise (per `02-…reference.md` §10 — sandbox cannot produce
this, UK-region sandbox only stably supports GBP/USD/EUR). Commit the response as a fixture.
_Verify:_ fixture committed; no money moved, no recipient created (read-only endpoint).
_Rollback:_ delete the fixture; does not touch any state.

### 7. Frontend: schema-driven recipient form

Schema-driven form (affiliate self-service or admin, per F39) +
`/admin/disbursement/recipients` list page. UI-BUILD dial: High — propose freely on layout,
component structure, interaction; the contract only constrains the data shape.
_Verify:_ loading / empty / error states all reachable and designed; `__tests__/components/*`
written; role/tier gating from JWT claims, never client-side-only trust (never render Wise
recipient PII from client-side math or unchecked props).
_Rollback:_ flag off (build behind an env flag, same pattern as prior UI-BUILD sessions).

### 8. Tests + Safety Gate deploy

Verifier unit tests (already in step 3); requirements-schema normalisation tests; recipient
create/read tests; a sandbox integration test creating a **GBP** recipient (sandbox-supported
currency — THB cannot round-trip in sandbox, still true this session). Deploy to Railway at
unique paths — **no live traffic**, no subscription pointed at it yet (Safety Gate, same
pattern as 4A-4/4A-6).
_Verify:_ full suite green; deployed; `/v1/wise/recipients` returns 401 unauthenticated in the
deployed environment too, not just locally.
_Rollback:_ revert the deploy; no provider dashboard change, no money involved.

---

## Rules specific to this variant

- The OpenAPI contract (frozen at 4A-W1) is the law for the backend's request/response shapes —
  do not redesign endpoints found inconvenient; if the contract is genuinely wrong, stop and ask
  rather than silently deviating.
- Never log raw bank details, IBANs, account numbers anywhere — only `accountTail` (last 4
  digits) and `detailsFingerprint` (irreversible hash) persist locally, per design §4.4/§7.4.
- The recipient form's creativity is expected on layout/UX — record notable design decisions in
  Deviations so the next surface (4A-W6's batch UI) stays coherent with it.
- `money-service` never authors a migration this session — nothing here changes the schema
  4A-W2 already created (`LESSONS-LEARNED.md` L1 still applies if that assumption turns out
  wrong; stop and ask if a new column/table turns out to be needed).

---

## Done when

- [ ] A real sandbox recipient is created end-to-end from the UI and stored with `status=ACTIVE`.
- [ ] No raw bank details appear anywhere in the DB or in logs (grep the log output; assert in a test).
- [ ] `refreshRequirementsOnChange` proven: a country change reveals additional required fields.
- [ ] Signature verifier: valid / tampered / wrong-key / malformed-base64 / empty-body all covered.
- [ ] THB requirement fixture committed (fetched read-only from production).
- [ ] Suites green both sides; deployed; `/v1/wise/recipients` returns 401 unauthenticated.
- [ ] F39 and F41 resolved with `DECISION-LOG.md` entries.
- [ ] CLAUDE.md, DECISION-LOG.md, `migration-stack-analysis.md` updated.
- [ ] Next session's order exists at status `PRE-DRAFT`.

---

## Rollback

Revert the commit(s) + redeploy. No money moved this session (read-only Wise token sufficient),
no provider dashboard change. The recipient form stays behind its env flag until Davin reviews
on staging — flag off is the rollback for the UI half.

---

## Deviations

_(filled DURING execution — what / why / impact.)_

**Carried forward from 4A-W2's close, expected to be re-stated here if still true at this
session's own CONFIRM:**

- THB cannot be tested end-to-end in Wise's sandbox (UK-region, GBP/USD/EUR only) — this session
  works around it via steps 6 (real production fetch, read-only) and 8 (GBP sandbox integration
  test); re-state for continuity into W4+.
- money-service's `DATABASE_URL` (the `money_svc` credential) is not available in this local
  checkout — set directly on Railway by Davin, never handed to an agent
  (`money-service/.env.example`'s own header comment). Any grant/data verification against
  production money-service tables from this checkout must go through the monolith's own
  `DIRECT_URL` connection (confirmed as real production at 4A-W2) with `SET ROLE money_svc`,
  not a direct money-service credential.
- **`prisma migrate dev` must never be run against this production database** (`LESSONS-LEARNED.md`
  L22, discovered 4A-W2) — not expected to be relevant this session (no schema change), but
  restated as a standing hazard given this session also touches money-service.

---

## Known wrinkles / do-not-touch

- **`lib/api/index.ts`** — known-broken by design until Phase 7. Do not touch.
- **RiseWorks source, schema and rows** — F42: archived, never deleted, never renamed.
  Nothing in this session is RiseWorks-adjacent.
- **`DISBURSEMENT_PROVIDER` stays `MOCK` in production until 4A-W7`** — this session creates
  recipients but must not flip the active provider or move any real money.
- **No new npm dependency for the Wise API client** — `fetch` is native on Node ≥20, per step 2.

---

## Next-session handoff

_(PRE-DRAFT the next Part 19.5 session at this session's close — 4A-W4 per the plan is a
CONTRACT-variant CC-C/CC-D hardening gate for the money surface, seeded from
`04-rise-to-wise-migration-plan.md` §4 "4A-W4". Must carry, at minimum:_

- _F43 (funding-SLA alert delivery channel) gets registered at W4, not before._
- _4A-W4 changes already-cut-over money code (the live dLocal webhook route) — Davin must be
  present, `EXECUTOR-PROTOCOL.md` §7._
- _Whatever this session's own Deviations record about F39/F41's actual resolutions, since W4
  doesn't touch them but later Wise sessions build on top of this session's guard/PII choices.)_

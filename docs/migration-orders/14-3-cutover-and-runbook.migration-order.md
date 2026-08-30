# Migration Order — Session 14-3 — Cutover + Runbook

> For **cutovers, deletions, and exit reviews**. Read `00-SKELETON-AND-RULES.md` first — §4
> applies with the dial at **near zero**: checklists exist to be obeyed.
> **PRE-DRAFT written by the Executor at Session 14-2's close (2026-08-30).**
> Upgraded to full **DRAFT** by the Advisor / Antigravity (2026-08-30) per
> `MASTER-ROADMAP-PHASES-7-15.md` §"Phase 14" and Session 14-2's closed order.

**Session:** 14-3 · **Phase:** 14 (Web Chat / Contabo Support Stack, last of 4 sessions) · **Variant:** VERIFY-RETIRE · **Status:** CONFIRMED  
**Generated:** 2026-08-30 (Executor PRE-DRAFT) · **Upgraded to DRAFT:** 2026-08-30 (Advisor / Antigravity) · **Approved:** 2026-08-30 (Davin — explicit sign-off on Decision 1 production Vercel cutover) · **Confirmed:** 2026-08-30 (Executor — live codebase + runtime re-verification against this order; see CONFIRM Evidence below) · **Flags touched:** none (F72 already resolved in Session 14-0) · **Estimated time:** ~1–1.5h (Vercel production env configuration, live end-to-end user journeys on `davintrade.app`, rollback rehearsal, CC-G runbook creation, Phase 14 formal closure).  
**Target components:** Vercel production deployment (`https://davintrade.app`), new documentation artifact `docs/runbooks/contabo-chat-stack.md`, `migration-cutover-table.md`, `CLAUDE.md`. **Zero code changes to application source files.**

---

## Decisions taken

> Four authoritative technical choices taken by the Advisor per `00-SKELETON-AND-RULES.md` §1.0 & `DECISION-LOG.md` PD1.
> **Decision 1 carries `⚠ NEEDS EXPLICIT SIGN-OFF`** because it executes the live production cutover on Vercel.

1. **Production Environment Configuration & Live Vercel Cutover (`⚠ NEEDS EXPLICIT SIGN-OFF`)**
   - **Chosen:** Configure production environment variables in Vercel project dashboard:
     - `NEXT_PUBLIC_SOCKET_CHAT_URL=https://chat-api.davintrade.app`
     - `CHAT_JWT_SECRET=<the_exact_256bit_secret_from_session_14_1>`
   - Trigger a production deployment on Vercel to route all public visitors and authenticated subscribers on `https://davintrade.app` to the live Contabo/Vultr chat cluster.
   - **Rollback Invariant:** If any unexpected runtime error occurs, immediately unset or clear `NEXT_PUBLIC_SOCKET_CHAT_URL` in Vercel. The widget gracefully degrades to its built-in in-widget canned-response generator (`lib/socket-client.ts:148-199`), providing instant FAQ topic replies and directing users to `mailto:support@davintrade.app` with zero console errors and zero user downtime (proven offline-safe in Session 14-2 unit tests).
   - **Why:** Safely cutover customer live chat to production with an instant zero-risk rollback guarantee.
   - **How hard to undo:** Trivial (unset env var in Vercel).

2. **Live Production User Journey Verification Protocol**
   - **Chosen:** Execute 3 live end-to-end verification journeys directly on `https://davintrade.app`:
     - **Journey A (Unauthenticated Guest):** Open chat widget on marketing/help page as a guest visitor. Emit a question (`"What is the difference between FREE and PRO?"`). Verify real Gemini 3.5 Flash reply and verify 10 msg/hr IP rate limit enforcement.
     - **Journey B (Authenticated PRO User):** Log in to production account. Open widget. Verify BFF mints signed JWT via `GET /api/chat/token`. Socket server verifies JWT and stamps identity server-side (`socket.data.user = { userId, tier: 'PRO' }`). Bot delivers personalized PRO-tier assistance.
     - **Journey C (Offline & Degradation Fallback):** Verify widget behavior when `NEXT_PUBLIC_SOCKET_CHAT_URL` is empty, confirming in-widget canned FAQ responses and `mailto:support@davintrade.app` render cleanly without unhandled errors.
   - **Why:** Verifies true production runtime behavior across both guest and subscriber journeys.
   - **How hard to undo:** N/A (read-only verification).

3. **Operational Runbook Authoring (`docs/runbooks/contabo-chat-stack.md`) (CC-G Gate)**
   - **Chosen:** Commit a comprehensive operational runbook `docs/runbooks/contabo-chat-stack.md` detailing:
     - Architecture & container topology (`socket_chat_server`, `redis_broker`, `ai_bot_worker`, host Nginx).
     - Standard maintenance: restarting stack (`docker compose up -d`), upgrading LLM models (editing `LLM_MODEL` in `.env` + `docker compose up -d bot_worker`), and rotating secrets.
     - Monitoring: log streaming (`docker compose logs -f --tail=100`), Redis queue health, Let's Encrypt certificate auto-renewal validation (`certbot renew --dry-run`).
     - Disaster Recovery: complete VPS rebuild from repository `infra/contabo-chat-stack/` in <10 minutes.
   - **Why:** Satisfies CC-G operational readiness gates so future engineers can maintain and troubleshoot the stack without institutional knowledge.
   - **How hard to undo:** Low.

4. **Phase 14 Exit & Phase 12 Handoff Protocol**
   - **Chosen:** Formally close Phase 14 in `CLAUDE.md`, update `migration-cutover-table.md`, and author the Phase 12 handover prompt (`davin-operational-manual/antigravity/HANDOVER-PROMPT-phase-12.md`).
     - Un-park `12-0-decisions-and-contracts.migration-order.md` for Stack D (Central Multi-Model AI Router & Analysis Engine) per the 2026-08-30 roadmap reordering.
   - **Why:** Completes Phase 14 development chain and transitions cleanly to Phase 12.
   - **How hard to undo:** Low.

---

## CONFIRM Evidence (Executor, 2026-08-30, before execution)

**Two findings raised at CONFIRM, both resolved live in chat before executing:**

1. **Status-integrity gap (`LESSONS-LEARNED.md` L3, recurring):** at CONFIRM time the order's
   committed HEAD (`2d0e4be0`) was still the raw PRE-DRAFT; the DRAFT→APPROVED upgrade and Decision
   1's sign-off existed only as an uncommitted working-tree diff, with no corroborating record in
   `CLAUDE.md` or `DECISION-LOG.md`. Resolved: Davin gave live, explicit, separate confirmation in
   chat, 2026-08-30 — quoted verbatim: **"I explicitly confirm that I approve the Session 14-3 order
   and specifically sign off on Decision 1 (Production Vercel cutover with
   `NEXT_PUBLIC_SOCKET_CHAT_URL=https://chat-api.davintrade.app` and `CHAT_JWT_SECRET`)."** This
   commit is that corroborating record.
2. \*\*Decision 1's Rollback Invariant and Decision 2/Journey C, as originally drafted, claimed the
   widget "degrades site-wide to static Help pages... and `mailto:`" — live-tested (dev server,
   `NEXT_PUBLIC_SOCKET_CHAT_URL` unset, real browser, screenshot evidence) and found FALSE: the
   widget stays mounted and interactive everywhere (`components/providers/client-providers.tsx`,
   unconditional) and never redirects to or touches the static help pages; it falls back to its own
   in-widget canned-response generator (`lib/socket-client.ts:148-199`) instead, with zero console
   errors. Text corrected in place (this diff) to describe the real mechanism before Decision 1 was
   signed off — live code won over the plan's original claim, per `EXECUTOR-PROTOCOL.md` §0.

**Entry criteria, live-verified 2026-08-30 (all 5 now pass):** Session 14-2 CLOSED SUCCESSFUL
confirmed in `CLAUDE.md`; backend `curl -I https://chat-api.davintrade.app` → HTTP 200 (0.31s);
`CHAT_JWT_SECRET`/`NEXT_PUBLIC_SOCKET_CHAT_URL` presence confirmed in Vercel production (Davin,
live, via dashboard — value-blind, presence only); Decision 1 explicit sign-off (quoted above);
baselines re-run fresh and sequential per L24 — monolith `test:ci` **154/154 · 2265/2265**,
`operation-service` **43/43 · 401/401**, `money-service` **62/62 · 570/570** (1 flake on the full
run, L24's known `prisma.shutdown.spec.ts` parallel-worker timeout, 6th occurrence — re-ran isolated
with `--runInBand`, clean in 7.6s), `railway-gateway` **3/3 · 23/23** — zero drift from Session
14-2's own close baseline.

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §"Phase 14":
"14-3 — Cutover & runbook (VERIFY-RETIRE). Deploy to Vercel production with NEXT_PUBLIC_SOCKET_CHAT_URL set. Verify live connection, unauthenticated fallback, and authenticated PRO routing. Document operational runbook in docs/runbooks/contabo-chat-stack.md."

Sessions 14-0, 14-1, and 14-2 froze contracts, provisioned the live backend, ported the frontend widget, and verified local browser round-trips.

Session 14-3 is the final verification, cutover, and documentation session that takes the live chat system into full production on `davintrade.app` and closes Phase 14.

---

## Entry criteria

- [x] Session 14-2 confirmed **CLOSED SUCCESSFUL** (`CLAUDE.md` state block and order verified).
- [x] Backend at `https://chat-api.davintrade.app` confirmed live and responding (`curl -I https://chat-api.davintrade.app` returns HTTP 200).
- [x] `CHAT_JWT_SECRET` (from Session 14-1) and `NEXT_PUBLIC_SOCKET_CHAT_URL=https://chat-api.davintrade.app` configured in Vercel production environment variables. (Davin, live, via Vercel dashboard.)
- [x] Davin has explicitly authorized Decision 1 (Production Vercel cutover). (Quoted above.)
- [x] Baseline test suites re-measured and clean (monolith `test:ci`, `operation-service`, `money-service`, `railway-gateway` run sequentially per L24).

---

## Checklist (CUTOVER & EXIT block)

1. **Verify Pre-Cutover Evidence:** ✅ DONE — see CONFIRM Evidence above.
   - Confirm Session 14-2's live-verification results (real Gemini 3.5 Flash reply in browser, 0 console errors, 0 CSP violations, monolith `test:ci` 154/154 passing).

2. **Davin Approves Production Cutover:** ✅ DONE — quoted above.
   - Davin explicitly confirms production flip. Rollback is confirmed: unset `NEXT_PUBLIC_SOCKET_CHAT_URL` in Vercel to instantly revert to the widget's in-widget canned-response fallback with zero downtime (corrected mechanism — see CONFIRM Evidence, finding 2).

3. **Execute Production Vercel Deployment:**
   - Deploy latest `main` branch with `NEXT_PUBLIC_SOCKET_CHAT_URL=https://chat-api.davintrade.app` and `CHAT_JWT_SECRET` set in Vercel production.

4. **Live Production End-to-End Verification (`https://davintrade.app`):**
   - **Journey 1 (Guest):** Visit `https://davintrade.app/help`, open floating chat widget, send inquiry. Verify Gemini bot response received live with topic chips.
   - **Journey 2 (Authenticated User):** Sign in on `https://davintrade.app`, open chat widget, verify JWT handshake token minted via `GET /api/chat/token` and accepted by backend.
   - **Journey 3 (Rate Limiting & Fallback):** Verify guest rate limit notification and verify static Help page fallback renders cleanly.

5. **Rehearse Production Rollback:**
   - Verify that toggling `NEXT_PUBLIC_SOCKET_CHAT_URL` degrades widget cleanly without crashing the client bundle.

6. **Create Operational Runbook (`docs/runbooks/contabo-chat-stack.md`):**
   - Document stack architecture, maintenance procedures, log inspection, SSL renewal, and disaster recovery.

7. **Close Phase 14 & Record Artifacts:**
   - Update `migration-cutover-table.md` with new live row for Web Chat Stack.
   - Update `CLAUDE.md` rotating state to Session 14-3 CLOSED and Phase 14 COMPLETE.
   - Prepare Phase 12 handover prompt (`HANDOVER-PROMPT-phase-12.md`).

---

## Rules specific to this variant

- No application code modifications during this session (checklist, configuration, verification, and documentation only).
- Any runtime failure on production stops execution immediately for investigation.
- Secret values are never committed or printed in logs (value-blind rule per L4/L17).

---

## Done when

- [ ] Vercel production deployment is live with `NEXT_PUBLIC_SOCKET_CHAT_URL=https://chat-api.davintrade.app`.
- [ ] Live end-to-end guest and authenticated chat journeys verified on `https://davintrade.app`.
- [ ] Rollback procedure verified and documented.
- [ ] `docs/runbooks/contabo-chat-stack.md` authored and committed.
- [ ] `migration-cutover-table.md` and `CLAUDE.md` updated with Phase 14 complete.
- [ ] Phase 12 handover prompt authored.

---

## Rollback

If production issues occur on `davintrade.app`:

1. Unset or clear `NEXT_PUBLIC_SOCKET_CHAT_URL` in Vercel Project Settings → Environment Variables.
2. Trigger an immediate redeployment (or instant rollback to previous deployment in Vercel dashboard).
3. The chat widget immediately degrades to its built-in canned-response generator (`lib/socket-client.ts:148-199`), and static Help FAQ pages remain fully accessible with direct `mailto:support@davintrade.app` links with zero downtime.

---

## Deviations

_(filled during execution — what/why/impact)_

---

## Next-session handoff

Phase 14 closes with Session 14-3.

The next session will begin **Phase 12** (Stack D — Central Multi-Model LLM Router & Conversational Analysis Engine):

- Order: `docs/migration-orders/12-0-decisions-and-contracts.migration-order.md`
- Handover Prompt: `davin-operational-manual/antigravity/HANDOVER-PROMPT-phase-12.md`

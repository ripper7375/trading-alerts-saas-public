# Migration Order — Session 14-3 — Cutover + Runbook

> For **cutovers, deletions, and exit reviews**. Read `00-SKELETON-AND-RULES.md` first — §4
> applies with the dial at near zero: checklists exist to be obeyed. **Fast-path eligible**
> per `EXECUTOR-PROTOCOL.md` §3.5 — this PRE-DRAFT may go straight to Davin for APPROVED,
> skipping the Advisor DRAFT step, since VERIFY-RETIRE sessions are checklist-only.
> **PRE-DRAFT written by the Executor at Session 14-2's close (2026-08-30).**

**Session:** 14-3 · **Phase:** 14 (Web Chat / Contabo Support Stack, last of 4 sessions) ·
**Variant:** VERIFY-RETIRE · **Status:** PRE-DRAFT
**Generated:** 2026-08-30 (Executor PRE-DRAFT) · **Estimated time:** <1h.

## Entry criteria

- [ ] Session 14-2 confirmed **CLOSED SUCCESSFUL** (`CLAUDE.md` state block and order verified).
- [ ] Backend at `https://chat-api.davintrade.app` still live (`curl -I` returns HTTP 200).
- [ ] `CHAT_JWT_SECRET` and `NEXT_PUBLIC_SOCKET_CHAT_URL=https://chat-api.davintrade.app` set in
      Vercel production env vars (value-blind check per L4/L17 — presence only, never the value).
      **This is new setup, not carried over: Session 14-2 wrote both only to local `.env.local`.**
- [ ] Davin present/available — production cutover requires his live approval.

## Checklist (CUTOVER block)

1. Present a summary of Session 14-2's live-verification evidence (real Gemini round-trip,
   zero CSP violations, zero console errors, `test:ci` 154/154 · 100% passing). Any gap →
   abort, schedule investigation session.
2. Davin approves the production flip. His question: "what's the rollback?" — answer:
   unset `NEXT_PUBLIC_SOCKET_CHAT_URL` in Vercel, zero-downtime, widget degrades to the
   existing canned-response generator (proven offline-safe by Session 14-2's unit tests).
3. Flip: set `CHAT_JWT_SECRET` + `NEXT_PUBLIC_SOCKET_CHAT_URL` in Vercel production env,
   redeploy.
4. Run live end-to-end user journeys against the deployed production site
   (`davintrade.app`, not `localhost`): authenticated PRO user chat (real JWT minted,
   real reply), unauthenticated guest chat (`{ token: null }`, real reply, 10 msg/hr
   rate limit), and a forced `QUOTA_EXCEEDED`/`RATE_LIMIT_EXCEEDED` path if reproducible.
5. Rehearse the rollback for real: unset `NEXT_PUBLIC_SOCKET_CHAT_URL`, confirm the widget
   degrades gracefully with zero errors, then re-set it and confirm it reconnects.
6. Monitor for reconnect-loop / CORS / CSP issues (`LESSONS-LEARNED.md` L25, 4B-18c
   precedent) for a short live-observation window.
7. Record: `migration-cutover-table.md` (new row — this is the point it becomes genuinely
   traffic-carrying), `CLAUDE.md`. Create `docs/runbooks/contabo-chat-stack.md` (CC-G).
   Retire Phase 14's remaining open items in `DECISION-LOG.md` (F72 is already RESOLVED;
   confirm nothing else is outstanding for the phase).

- **Rollback:** unset `NEXT_PUBLIC_SOCKET_CHAT_URL` in Vercel — pre-verified safe by Session
  14-2's offline-mode unit tests (`initSocket()` never throws, `sendMessage()` degrades to the
  canned generator) and this session's own Step 5 rehearsal.

## Rules specific to this variant

- No new code, no fixes, no "while I'm here" — observation and execution only.
- Any red result = stop and document, never "probably fine".
- If Step 4 surfaces a real bug (not flakiness), do not patch it live in this session — scope
  it as its own follow-up per `LESSONS-LEARNED.md` L11.

## Deviations

_(should normally be empty; a deviation here is itself a warning sign)_

## Next-session handoff

_(Session 14-3 closes Phase 14. Per `MASTER-ROADMAP-PHASES-7-15.md`, 14-3 owes the Phase 12
handover prompt — `davin-operational-manual/antigravity/HANDOVER-PROMPT-phase-12.md` — since
the roadmap's 2026-08-30 reorder moved Phase 12 to run after Phase 14. Next order after this:
`12-0-decisions-and-contracts.migration-order.md`, currently PARKED per the roadmap's own note
— re-verify it fresh against the (possibly revised) Stack D/E architecture docs before treating
it as ready, do not just un-park it on the strength of this PRE-DRAFT.)_

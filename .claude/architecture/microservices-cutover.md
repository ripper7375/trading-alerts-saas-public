---
type: Concept/MigrationRoadmap
status: active
updated_at: 2026-09-26
source: "CLAUDE.md '## Key documents' (pre-OKF L5318-L5331, verbatim table) + standing notices from session history"
tags: [migration, roadmap, microservices, cutover, scope]
related_docs:
  - ../state/current-state.md
  - ../rules/non-negotiables.md
  - ./infrastructure.md
---

# Monolith → microservices migration: documents, position, scope

## Key documents

| What                                                                                                    | Where                                                                                     |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Master roadmap (Phases 7–15)**                                                                        | `docs/migration-orders/MASTER-ROADMAP-PHASES-7-15.md` **(new 2026-08-20 — read at OPEN)** |
| Operating manual (YOUR rules)                                                                           | `docs/migration-orders/EXECUTOR-PROTOCOL.md`                                              |
| Migration plan (phases, flags)                                                                          | `docs/migration-orders/monolith-to-microservices-migration-implementation-plan.md` (v1.3) |
| Session playbook                                                                                        | `docs/migration-orders/monolith-to-microservices-migration-session-playbook.md`           |
| Order rules + templates                                                                                 | `docs/migration-orders/00-SKELETON-AND-RULES.md` + `TEMPLATE-*.md`                        |
| Decision Log                                                                                            | `docs/migration-orders/DECISION-LOG.md`                                                   |
| Lessons learned (read at every OPEN)                                                                    | `docs/migration-orders/LESSONS-LEARNED.md`                                                |
| Cutover table                                                                                           | `docs/migration-orders/migration-cutover-table.md`                                        |
| File inventory                                                                                          | `docs/migration-orders/migration-stack-analysis.md`                                       |
| Locale/i18n compliance — incl. §0 CRITICAL Settings-page bug (read before building ANY new frontend UI) | `docs/policies/08-locale-i18n-compliance.md`                                              |

## Position

- Phase 7 closed (typed `operationApi`/`moneyApi` clients). Phase 14 (Web Chat) closed at
  Session 14-3 on 2026-08-30 — the chat widget is live against `chat-api.davintrade.app`.
- Next numbered work: **Phase 12 (Stack D, conversational AI) / Session 12-0**, waiting on the
  Advisor's re-draft of
  `docs/migration-orders/davin-operational-manual/antigravity/HANDOVER-PROMPT-phase-12.md`, which
  must first decide whether the 2026-08-30 Stack D material in `davintrade-stack-d-and-e/`
  supersedes the documents it cites.
- Per-slice status lives in `migration-cutover-table.md`; do not duplicate it here.

## Standing notice — webhook cutover order (Davin, 2026-07-22, narrowed 2026-07-24)

Chain-length-one originally meant "webhooks cut over FIRST (both providers) before 4A-7 or any
Slice 4 work". Davin narrowed it to **dLocal-cutover-first**; dLocal is CUT-OVER (Session 4A-5),
so Slice 3/4 build work is unblocked. **RiseWorks' own cutover (`4A-5-RW`) trails independently**,
gated on RiseWorks replying with webhook/API settings. Verbatim text: `state/history/2026-09-sessions.md`
(search "STANDING INSTRUCTION").

## Scope boundaries

- **SEPARATE_STACK, out of scope for the migration** (but direct, fully specified chat orders on
  them are allowed): `backend-stack-c/`, `mt5-service/`, the `frontend/` mirror.
- **`seed-code/**` is read-only reference, always\*\* — never edit the seed to make a port easier.
- **`railway-gateway/` ingest path must never blip**; touch it only where an order says so.
- Change-frozen (CC-F) slices: bugfixes only, mirrored to old AND new implementations.
- Money-service ↔ monolith mirrors (Stripe/dLocal webhooks, SystemConfig readers, disbursement
  settings) must change **in lockstep**, and money changes need Davin's explicit sign-off.

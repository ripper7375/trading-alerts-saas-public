# Decision Log — Flag Resolutions & Material Decisions

**What this is:** the append-only record of every flag resolution (F1–F19) and every
material decision made during the migration. The flag _register_ (what each flag asks) lives
in the plan §11; this file records _how each was resolved, by whom, with what evidence_.
The Executor writes entries at session close; Davin's sign-off is quoted where required.

**Entry format:**

```
## <ID> — <short title>
- Status: OPEN | RESOLVED | SUPERSEDED
- Session: <P-N where resolved>  ·  Date: <yyyy-mm-dd>
- Decision: <what was decided>
- Evidence: <commands run, docs read, URLs fetched, test results>
- Approved by: <Davin | n/a (technical, within bounds)>
```

---

## Flag register status (details in plan §11)

| Flag | Topic                                            | Status                                                      |
| ---- | ------------------------------------------------ | ----------------------------------------------------------- |
| F1   | OpenAPI coverage from live routes                | OPEN — due Session 0-2/0-3                                  |
| F2   | Pin next@16.2.10 / @nestjs/core@11.1.28          | RESOLVED — Session 0-1                                      |
| F3   | Where does the monolith's Postgres live?         | OPEN — due Session 1-1                                      |
| F4   | Full model census for schema split               | OPEN — due Session 2-2                                      |
| F5   | Prisma file-layout strategy                      | OPEN — due Session 2-2 (revisit under F19)                  |
| F6   | Auth strategy: bridge vs OpenAuth vs hand-rolled | OPEN — due Session 3-1 (Davin)                              |
| F7   | HS256 shared secret vs JWKS + rotation timing    | OPEN — due Session 3-1 (Davin)                              |
| F8   | Realtime/websocket architecture                  | OPEN — due Session 4B-17                                    |
| F9   | @trading-alerts/types packaging mechanics        | OPEN — due Session 4B-1                                     |
| F10  | Next.js 15→16 breaking-change audit              | OPEN — due Session 5-1                                      |
| F11  | Frontend gap matrix                              | OPEN — due Session 6-1 (Davin triage)                       |
| F12  | Whole-plan duration estimate                     | OPEN — revisit after F1–F5                                  |
| F13  | Observability/tracing backend                    | OPEN — due by first Phase 4 cutover                         |
| F14  | Tier-update: outbox vs direct call               | OPEN — due Session 4A-8                                     |
| F15  | Redis topology/namespacing                       | OPEN — due Session 4A-1                                     |
| F16  | Public URL scheme + /v1 versioning               | OPEN — due Session 4A-1 (Davin)                             |
| F17  | Staging data strategy                            | OPEN — due Session 0-5 (Davin)                              |
| F18  | RPO/RTO targets                                  | OPEN — due Session 1-1 (Davin)                              |
| F19  | Prisma 6.19.2→7.8.0 breaking-change audit        | OPEN — npm check RESOLVED (0-1); full audit due Session 2-1 |

---

_(Resolution entries append below this line — newest last)_

## F2 — Version pins: next@16.2.10 / @nestjs/core@11.1.28

- Status: RESOLVED
- Session: 0-1 · Date: 2026-07-17
- Decision: Both exact target versions exist on the npm registry — pin as specified, no
  nearest-stable substitution needed. Current installed baselines: `next@^15.5.11` (root
  `package.json`), `@nestjs/core@^10.4.15` (`railway-gateway/package.json`) — the actual
  version bump happens in Phase 5 (Next.js) and Phase 4 (NestJS services), not this session.
- Evidence:
  - `npm view next@16.2.10 version` → `16.2.10`
  - `npm view @nestjs/core@11.1.28 version` → `11.1.28`
  - `npm view @nestjs/core versions --json` → confirms `"11.1.28"` present in the full
    published version list
- Approved by: n/a (technical, within bounds — verification only, no deviation from the
  plan's stated target)

## F19 (npm-check portion) — Prisma 7.8.0 exists on npm; major-version-count correction

- Status: RESOLVED (npm-check only — full 6→7 breaking-change audit remains OPEN, due
  Session 2-1)
- Session: 0-1 · Date: 2026-07-17
- Decision: `prisma@7.8.0` exists on the npm registry — pin as specified. **Finding:** plan
  §2 step 0.6 frames this as a "5→6→7" jump (citing `scripts/test-prisma5-upgrade.ts` as
  evidence the 5.x upgrade "was only prepared, not necessarily landed"), but both
  `package.json` files (root and `railway-gateway/`) already show `prisma@^6.19.2` installed
  today. The real jump is 6.19.2 → 7.8.0 — one major version crossed, not two. Proposed
  amendment for Session 2-1: scope the breaking-change audit and guide-reading to the 6→7
  boundary only (the Prisma 5→6 guide is moot since 6.x is already live); the plan document
  itself is unedited here — this is a proposal for the Advisor/Davin, not a self-applied
  change to plan strategy text.
- Evidence:
  - `npm view prisma@7.8.0 version` → `7.8.0`
  - root `package.json:91,165` → `"@prisma/client": "^6.19.2"`, `"prisma": "^6.19.2"`
  - `railway-gateway/package.json:26,44` → `"@prisma/client": "^6.19.2"`,
    `"prisma": "^6.19.2"`
- Approved by: n/a (technical, within bounds — version-existence check only; the
  major-version-count finding is a proposed amendment, not an applied one)

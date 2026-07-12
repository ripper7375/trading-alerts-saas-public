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

| Flag | Topic                                            | Status                                     |
| ---- | ------------------------------------------------ | ------------------------------------------ |
| F1   | OpenAPI coverage from live routes                | OPEN — due Session 0-2/0-3                 |
| F2   | Pin next@16.2.10 / @nestjs/core@11.1.28          | OPEN — due Session 0-1                     |
| F3   | Where does the monolith's Postgres live?         | OPEN — due Session 1-1                     |
| F4   | Full model census for schema split               | OPEN — due Session 2-2                     |
| F5   | Prisma file-layout strategy                      | OPEN — due Session 2-2 (revisit under F19) |
| F6   | Auth strategy: bridge vs OpenAuth vs hand-rolled | OPEN — due Session 3-1 (Davin)             |
| F7   | HS256 shared secret vs JWKS + rotation timing    | OPEN — due Session 3-1 (Davin)             |
| F8   | Realtime/websocket architecture                  | OPEN — due Session 4B-17                   |
| F9   | @trading-alerts/types packaging mechanics        | OPEN — due Session 4B-1                    |
| F10  | Next.js 15→16 breaking-change audit              | OPEN — due Session 5-1                     |
| F11  | Frontend gap matrix                              | OPEN — due Session 6-1 (Davin triage)      |
| F12  | Whole-plan duration estimate                     | OPEN — revisit after F1–F5                 |
| F13  | Observability/tracing backend                    | OPEN — due by first Phase 4 cutover        |
| F14  | Tier-update: outbox vs direct call               | OPEN — due Session 4A-8                    |
| F15  | Redis topology/namespacing                       | OPEN — due Session 4A-1                    |
| F16  | Public URL scheme + /v1 versioning               | OPEN — due Session 4A-1 (Davin)            |
| F17  | Staging data strategy                            | OPEN — due Session 0-5 (Davin)             |
| F18  | RPO/RTO targets                                  | OPEN — due Session 1-1 (Davin)             |
| F19  | Prisma 5→7.8.0 breaking-change audit             | OPEN — due Session 2-1 (npm check 0-1)     |

---

_(Resolution entries append below this line — newest last)_

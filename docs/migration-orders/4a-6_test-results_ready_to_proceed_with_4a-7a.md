All 14 results are in, and this is a clean, fully green parity run. Here's the comparison against the monolith baseline:

| Route                                            | money-service                                            | Monolith baseline | Result                |
| ------------------------------------------------ | -------------------------------------------------------- | ----------------- | --------------------- |
| `/v1/affiliate/dashboard/stats`                  | 200, identical fields/values                             | 200, identical    | ✅ match              |
| `/v1/affiliate/dashboard/codes`                  | 200, same 2 codes, same order, same fields               | 200, identical    | ✅ match              |
| `/v1/affiliate/dashboard/code-inventory`         | 200, same balances                                       | 200, identical    | ✅ match              |
| `/v1/affiliate/dashboard/commission-report`      | 200, all zeros, empty array                              | 200, identical    | ✅ match              |
| `/v1/admin/affiliates`                           | 200, same affiliate, same codes                          | 200, identical    | ✅ match              |
| `/v1/admin/affiliates/<id>`                      | 200, full detail incl. discount/commission %, same order | 200, identical    | ✅ match              |
| `/v1/admin/analytics`                            | 200, same user/revenue counts                            | 200, identical    | ✅ match              |
| `/v1/admin/affiliates/reports/code-flows`        | 200, same balances                                       | 200, identical    | ✅ match              |
| `/v1/admin/affiliates/reports/code-inventory`    | 200, same counts, same `lowActiveCodesWarning:true`      | 200, identical    | ✅ match              |
| `/v1/admin/affiliates/reports/commission-owings` | 200, all zeros                                           | 200, identical    | ✅ match              |
| `/v1/admin/affiliates/reports/profit-loss`       | 200, all zeros, same `regularPrice:29`                   | 200, identical    | ✅ match              |
| `/v1/admin/affiliates/reports/sales-performance` | 200, same top performer, same metrics                    | 200, identical    | ✅ match              |
| No auth header → `/v1/admin/analytics`           | 401 `"Missing bearer token"`                             | —                 | ✅ pass (guard works) |
| Affiliate token → `/v1/admin/analytics`          | 403 `"Forbidden: Admin access required"`                 | —                 | ✅ pass (guard works) |

Only differences observed anywhere were the `period.start`/`period.end` timestamps on the report routes, which simply reflect each request's own execution time (the "3 months back from now" window) — not a data or serialization discrepancy, and expected to differ between any two independent calls regardless of backend.

No 500s, no null/missing fields on the money-service side, no numeric mismatches. So per §5, there's no F46/L18 schema-gap candidate to report from this run — money-service's hand-mirrored Prisma subset is returning data consistent with the monolith for all 12 routes, and both guard paths (AffiliateGuard, AdminGuard) correctly reject the negative cases with 401/403 rather than 500 or a silent 200.

This looks like a full pass across the "better" (all 12 routes) tier of your plan. Per your step 6 notes, this puts 4A-7a's step 5 in the position of being a re-confirmation rather than a first discovery.

========================================================

Here's a draft write-up you can drop into the F44 evidence entry:

---

**F44 Evidence — Read-API Parity Check (money-service vs. monolith)**

**Date:** 2026-07-25
**Scope:** All 12 route pairs from the Read-API Parity Check guide — 4 Affiliate-guarded routes, 8 Admin-guarded routes — plus both negative-case guard checks.

**Method:** Authenticated as Admin and separately as Affiliate on the monolith (trading-alerts-saas-frontend.vercel.app), captured baseline JSON from each `/api/...` route in a logged-in browser session. Extracted the corresponding session tokens and called the matching `/v1/...` routes on money-service (money-service-production.up.railway.app) with `Authorization: Bearer <token>`, using identical query parameters where applicable. Also verified both negative cases: no Authorization header, and an Affiliate token against an Admin-guarded route.

**Result: 12/12 routes green, both negative cases green.**

All 12 money-service routes returned `200 OK` with JSON structurally and numerically identical to the monolith baseline, including nested objects (affiliate codes, commission/report summaries, analytics overview). The only observed differences were `period.start` / `period.end` timestamps on the report routes, which reflect each request's own execution time (a rolling "N months back from now" window) rather than any data or serialization discrepancy — expected to differ between any two independently-timed calls regardless of backend.

Negative cases:

- No Authorization header against `/v1/admin/analytics` → `401 Unauthorized`, `"Missing bearer token"`.
- Affiliate token against `/v1/admin/analytics` → `403 Forbidden`, `"Forbidden: Admin access required"`.

Both guard paths (AffiliateGuard, AdminGuard) rejected correctly with the expected status codes — no 500s, no silent 200s.

**Schema-gap finding (F46/L18):** None. No route 500'd; no field was null/absent on the money-service side only. money-service's hand-mirrored Prisma subset returned data consistent with the monolith across all tested affiliate/admin/report surfaces, including the two highest-schema-surface reports (commission-owings, profit-loss).

**Explicit non-scope note:** This evidence confirms transport/schema parity on the read paths tested. It is submitted as F44 input only — it does not constitute an answer to F45 (the cutover decision), which remains a separate determination.

**Session hygiene:** Both test session tokens (Admin, Affiliate) used for this check were rotated (logged out/back in) after testing, and local shell history was cleared.

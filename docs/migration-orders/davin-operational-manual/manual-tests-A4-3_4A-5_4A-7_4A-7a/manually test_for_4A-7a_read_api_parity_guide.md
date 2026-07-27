# Read-API Parity Check — manual guide (run BEFORE Session 4A-7a)

**Supersedes:** `manually test_for_4A-7_read_api_shadow_run_guide.md` (kept; session 4A-7 itself is
SUPERSEDED by 4A-7a + 4A-7b).
**Updated:** 2026-07-25 · **Route paths verified against the live codebase the same day.**
**Who runs this:** Davin, by hand, in a browser + Postman/ThunderClient. No code, no deploy.
**When:** _before_ 4A-7a starts. It costs nothing and it can save the whole session.

---

## 0. What this check does and does not prove — read this first

The original guide's framing ("prove the new Read APIs… correctly authenticate you using your
NextAuth session token via the `Authorization: Bearer` header") is easy to over-read. Be precise:

**✅ It DOES prove four things, and each is worth having:**

| #   | Proves                                                                                                | Feeds                                                        |
| --- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | money-service's `JwtAuthGuard` accepts a real NextAuth JWE presented as `Authorization: Bearer`       | F7 Path-B, re-confirmed on live infrastructure               |
| 2   | The JWT secret matches between Vercel and Railway                                                     | would otherwise surface as a baffling 401 mid-session        |
| 3   | Old vs new response **parity**, per route                                                             | **F44** — this is the shadow-diff evidence, gathered by hand |
| 4   | **The first _authenticated_ read → so it exercises money-service's Prisma subset for the first time** | **F46 / L18** — see §5                                       |

Point 4 is the reason to run this _before_ writing any transport code: if a column or model is
missing from money-service's schema subset, you find out with **zero code written**, rather than
discovering it through a 500 from a brand-new fetch wrapper.

**❌ It does NOT prove that the frontend can do this unattended.**
You copying a cookie out of DevTools is **not** the same as a Next.js data hook obtaining a token.
DevTools _can_ display `httpOnly` cookies; JavaScript (`document.cookie`) **cannot**. That gap is
flag **F45**, still open, and it is decided in 4A-7a step 1 — not here. A green result on this guide
is **not** evidence that browser-direct Bearer calls are viable.

**❌ It is not a 48-hour shadow-run.** It is a point-in-time, single-sample parity check. Strong
input to F44 — possibly enough to justify choosing the progressive-cutover option — but F44 still
needs Davin's explicit ruling, recorded in `DECISION-LOG.md`.

---

## ⚠️ Before you start — a real security caution

Step 1 has you copy a **live production session JWE** into a desktop HTTP client.

- NextAuth JWEs are **stateless**. **Logging out does NOT invalidate it** — it stays valid until its
  `exp`, which is **30 days** (`SESSION_COOKIE_MAX_AGE = 30 * 24 * 60 * 60`).
- So: **do not save it into a synced/shared Postman collection**, don't paste it into chat, a ticket,
  or a commit. Put it in the request header, run the checks, then clear it.
- **Prefer a throwaway test account** if you have one — ideally one Affiliate and one Admin test user.
- This is also why `LESSONS-LEARNED.md` **L17** exists (never dump secret values): the same
  discipline applies to a session token, which is a bearer credential for a real account.

---

## 1. Get an active session token

1. Log into `trading-alerts-saas-frontend.vercel.app` as an **Admin** (and separately as an
   **Affiliate** — you need both roles to cover the two guard paths).
2. DevTools (F12) → **Application** tab (Chrome) / **Storage** (Firefox) → **Cookies** → your domain.
3. Copy the value of:
   - `__Secure-next-auth.session-token` in **production**, or
   - `next-auth.session-token` locally.
     _(Both names are defined in `lib/operation-service/cookies.ts` — production uses the `__Secure-`
     prefix. Session 3-3 found the Decision Log's plain name was the dev-only value, so take the name
     from what DevTools actually shows you, not from memory.)_

---

## 2. Baseline: call the monolith

`GET https://trading-alerts-saas-frontend.vercel.app/api/<path>` in a **logged-in browser tab**
(the cookie rides along automatically — no header needed). Save each JSON response.

## 3. Compare: call money-service

Same logical route on Railway, with the header:

```
Authorization: Bearer <the cookie value from step 1>
```

Base URL: `https://money-service-production.up.railway.app/v1/...`

### The 12 route pairs (verified 2026-07-25)

**Affiliate — needs an Affiliate session** (`AffiliateGuard`)

| Monolith (baseline)                          | money-service                               |
| -------------------------------------------- | ------------------------------------------- |
| `/api/affiliate/dashboard/stats`             | `/v1/affiliate/dashboard/stats`             |
| `/api/affiliate/dashboard/codes`             | `/v1/affiliate/dashboard/codes`             |
| `/api/affiliate/dashboard/code-inventory`    | `/v1/affiliate/dashboard/code-inventory`    |
| `/api/affiliate/dashboard/commission-report` | `/v1/affiliate/dashboard/commission-report` |

**Admin — needs an Admin session** (`AdminGuard`)

| Monolith (baseline)                               | money-service                                    |
| ------------------------------------------------- | ------------------------------------------------ |
| `/api/admin/affiliates`                           | `/v1/admin/affiliates`                           |
| `/api/admin/affiliates/<id>`                      | `/v1/admin/affiliates/<id>`                      |
| `/api/admin/analytics`                            | `/v1/admin/analytics`                            |
| `/api/admin/affiliates/reports/code-flows`        | `/v1/admin/affiliates/reports/code-flows`        |
| `/api/admin/affiliates/reports/code-inventory`    | `/v1/admin/affiliates/reports/code-inventory`    |
| `/api/admin/affiliates/reports/commission-owings` | `/v1/admin/affiliates/reports/commission-owings` |
| `/api/admin/affiliates/reports/profit-loss`       | `/v1/admin/affiliates/reports/profit-loss`       |
| `/api/admin/affiliates/reports/sales-performance` | `/v1/admin/affiliates/reports/sales-performance` |

**Minimum viable run:** one affiliate route + one admin route (the original guide's bar).
**Better:** all 12 — the reports carry the most schema surface, so they are where a subset gap
(§5) would actually show up. `commission-owings` and `profit-loss` are the highest-value two.

⚠️ **Query parameters matter.** Several report routes take date ranges or pagination. Send the
**identical** query string to both sides, or you will diff two different questions and call it a
mismatch.

---

## 4. Verify parity

For each pair:

- [ ] money-service returned **200**?
- [ ] JSON **matches** the monolith baseline?
- [ ] Also check the negative cases at least once each — they prove the guards, not just the happy path:
  - [ ] **no** `Authorization` header → **401**
  - [ ] **Affiliate** token against an `/v1/admin/*` route → **403** (not 200, and not 500)

**Interpreting a mismatch — this is the part that matters:**

| Symptom                                                          | Almost certainly                                                                | Do                                                                     |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `401` on every route                                             | JWT secret differs between Vercel and Railway, or you copied a truncated cookie | check the secret is the same value on both; re-copy the cookie         |
| `403` where you expected 200                                     | wrong role for that route                                                       | use the other test account                                             |
| `404`                                                            | wrong path — re-check the table above                                           | fix the URL; **do not** conclude the route is missing                  |
| **`500`, or a field that is `null`/absent on the new side only** | **⛔ likely a SCHEMA gap — see §5**                                             | **STOP. Do not work around it.**                                       |
| Numbers differ slightly                                          | ordering, rounding, or a `Decimal`→`number` cast                                | record it precisely; a money-figure difference is never "close enough" |
| Timestamps differ                                                | serialisation format, not data                                                  | note it; it still needs an explanation before cutover                  |

Record everything — the pass results _and_ every difference with your explanation. This becomes the
F44 evidence 4A-7b's entry criteria require.

---

## 5. ⛔ If a route 500s or a field is missing — this is governed by F46 / L18

**`DECISION-LOG.md` F46** (RESOLVED) and **`LESSONS-LEARNED.md` L18** apply here exactly as they do
inside 4A-7a:

> If the failure is on a Prisma column, model, relation or enum value, that is a **SCHEMA finding,
> not a transport or client bug.**

Why this check can find it and Session 4A-6 could not: 4A-6 verified these routes with
**unauthenticated** requests returning 401. `JwtAuthGuard` rejects _before_ Prisma is ever touched —
so 4A-6 proved the guards work and proved nothing at all about the database.
money-service defines a **hand-mirrored subset** of the monolith's schema
(`money-service/prisma/schema.prisma`, hand-synced with no automated check), so divergence is a live
possibility. Slice 1's crons already read through that subset, which makes a gap unlikely — but
unlikely is not verified, and _this request is the verification._

**What to do:** record the exact model + field + error text, and report it. It becomes its own scoped
session. Schema is authored **only** in `prisma/non-market-data/schema.prisma` (**L1**).

**What NOT to do — and this is the whole point of pre-deciding F46:** do not later let it be
"fixed" by a `select`/`omit` that dodges the field, by defaulting or mapping the value in the
transport, by editing money-service's `schema.prisma`, or by any Prisma write command from
money-service. A transport-side workaround makes the route return **plausible but wrong data** on
the affiliate-commission read path — numbers you and your affiliates both rely on — and bakes the
divergence in permanently.

---

## 6. When you're done

1. Save the results (responses + differences + explanations) somewhere 4A-7a can cite them.
2. Hand them to Claude Code at 4A-7a's CONFIRM as **F44 input** — explicitly _not_ as an answer to
   **F45**, which is still yours to decide.
3. If everything is green: 4A-7a's step 5 becomes a re-confirmation through the real transport rather
   than a first discovery, which is the ideal position to start a session from.
4. Clear the token from your HTTP client.

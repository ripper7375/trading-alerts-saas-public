# DavinTrade — Drawing Engine & Line-Touch Alerts: Architecture Design

**Status:** Blueprint (pre-implementation)
**Last updated:** 2026-06-18
**Owner:** DavinTrade
**Scope:** A clean-room drawing engine on TradingView Lightweight Charts v5 (6 tools) plus a
server-side "price touches drawn line → alert fires" engine, delivered across 6 phases.

---

## 1. Purpose & how to use this document

This is the implementation blueprint for two coupled features:

1. **Drawing engine (client):** users draw 6 tool types on the chart — (1) trendline/line
   segment, (2) horizontal line, (3) equidistant/parallel channel, (4) Fibonacci retracement,
   (5) Fibonacci extension by price, (6) text/annotations.
2. **Line-touch alerts (server):** users attach alerts to lines #1–#5; when live price crosses a
   line, an alert fires even if the browser is closed.

Every section cites the **existing stack** (with file paths) so you can map this design onto what
already exists, and lists the **technology libraries** each phase uses (existing vs. net-new).

---

## 2. Constraint: candleview is a reference only (clean-room)

`seed-code/candleview` is **AGPL-3.0-only** (`seed-code/candleview/LICENSE`). To keep DavinTrade
closed-source-safe, candleview is used **only as a pattern/architecture/algorithm reference**. No
candleview source is copied into this repo. We re-implement against the **Apache-2.0** public API of
Lightweight Charts.

- ✅ Reuse: ideas, the Mark+Manager pattern, geometry math, the retrofit specs in
  `seed-code/candleview/TRADINGVIEW-LIGHTWEIGHT-CHARTS-RETROFITS/` (01 top-bar, 02 left-toolbar,
  03 drawing-engine).
- ❌ Forbidden: pasting candleview `.ts` files, functions, or its `any`/`_internal__*` code.
- Enforcement: see §12 (CI license scanning + no-copyleft policy).

---

## 3. Existing stack inventory (the things to map against)

| Layer                      | Technology (version)                                                      | Where it lives in the repo                                                   |
| -------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Web framework              | **Next.js 15.5** (App Router), **React 19**, TypeScript                   | `app/`, `components/`, `package.json`                                        |
| Charts                     | **Lightweight Charts ^4.1.1** (→ upgrade to v5)                           | `components/charts/trading-chart.tsx`, `app/(dashboard)/charts/...`          |
| Live price (browser)       | **Socket.IO** client ^4.8                                                 | `hooks/use-ohlcv-socket.ts`                                                  |
| Live price (source)        | **Flask 3 + flask-socketio 5.3.5 + python-socketio**, pandas, MetaTrader5 | `mt5-service/` (Python, Windows prod)                                        |
| Price persistence pipeline | Python sync → PostgreSQL (psycopg2)                                       | `sync/`, writes `MarketData`                                                 |
| Database                   | **PostgreSQL** via **Prisma 6** (`@prisma/client`, `pg`)                  | `prisma/schema.prisma`                                                       |
| Price table                | `MarketData` (OHLCV + indicator columns)                                  | `prisma/schema.prisma:932`                                                   |
| Alert table                | `Alert` (`alertType` default `"PRICE_TOUCH_LINE"`)                        | `prisma/schema.prisma:383`                                                   |
| Notifications              | `Notification` model                                                      | `prisma/schema.prisma:666`                                                   |
| Tiering                    | `User`, `Subscription` (FREE/PRO)                                         | `prisma/schema.prisma:82,345`                                                |
| Auth                       | **NextAuth v4** + Prisma adapter, `getServerSession`                      | `lib/auth/auth-options.ts`, `lib/auth/session.ts`, `lib/auth/permissions.ts` |
| Cache / pub-sub            | **Redis** — `ioredis ^5.3.2` + `redis ^4.7.0` (already installed)         | dependency present                                                           |
| Realtime server            | **socket.io ^4.8.1** (server-side)                                        | dependency present                                                           |
| Email                      | **Resend ^2.1.0** + `@react-email/components`                             | `emails/`                                                                    |
| Payments                   | Stripe ^14                                                                | billing flows                                                                |
| Validation                 | **Zod ^3.22**                                                             | API routes                                                                   |
| Forms                      | react-hook-form + @hookform/resolvers                                     | UI                                                                           |
| Data fetching              | **SWR ^2.3**                                                              | client hooks                                                                 |
| UI kit                     | Radix UI + shadcn/ui + Tailwind + lucide-react + next-themes              | `components/`, `components.json`                                             |
| Testing                    | Jest + Testing Library, **Playwright** (e2e), Newman (Postman)            | `__tests__/`, `e2e/`, `postman/`                                             |
| Deployment                 | Railway, Vercel, Docker, nixpacks                                         | `railway.json`, `vercel.json`, `docker-compose.yml`, `nixpacks.toml`         |
| Quality gates              | `npm run validate` (tsc + ESLint + policy + Jest)                         | `CLAUDE.md`                                                                  |

**Key takeaway:** the only net-new infra for the whole feature is a **job queue** (BullMQ) and using
the **already-present Redis** for pub/sub. Everything else is already in your stack.

---

## 4. The two-pipeline model (system context)

Drawing/rendering is client-side; price is authoritative from MT5; the worker joins them.

```
PIPELINE 1 — PRICE (exists; flows FROM MT5; read-only to us)
  MT5 ─► Flask MT5 service ─► sync/ ─► PostgreSQL: MarketData
            │  (flask-socketio)                │
            ▼                                   │ (NEW) publish bar to Redis
   browser chart (Socket.IO)                    ▼
                                       Redis pub/sub channel: prices:{symbol}:{tf}

PIPELINE 2 — USER INTENT (new; flows FROM browser)
  Draw line (LWC v5, clean-room) + configure alert
        │  POST /api/drawings , /api/alerts (Next.js route handlers, NextAuth, Zod)
        ▼
  PostgreSQL: Drawing + DrawingAlert  (anchors in price/time, not pixels)

         ┌──────────── ALERT WORKER (Node, BullMQ) ────────────┐
  price ─► subscribes Redis prices channel (Pipeline 1)         │
  intent ► loads active DrawingAlert geometry (Pipeline 2)      │
          for each alert: value(t_now) from anchors →           │
          did price cross it? (+ tolerance, direction, cooldown)│
          on fire ─► Notification + Socket.IO push + Resend     │
         └─────────────────────────────────────────────────────┘
```

The worker **never** receives price from the browser. The browser **only** sends the line
definition + alert rule. (Direct analog of your MQL5 split: indicator read the drawn `OBJ_TREND`
and compared to bid/ask; here the worker reads the `Drawing` row and compares to `MarketData`.)

---

## 5. Shared core: geometry & alert evaluation (the heart of Phase 4)

Every drawable line reduces to **one or more price levels, each constant or linear in time**. This
pure module is framework-free, fully unit-testable, and reused by both client (rendering hints) and
server (alert evaluation).

```ts
type Anchor = { time: number; price: number }; // chart space, never pixels

// A "level" the alert engine can watch:
interface AlertLevel {
  id: string; // e.g. "fib_0.618", "channel_top"
  valueAt(time: number): number | null; // constant or linear interpolation
}
```

| Tool                         | Anchors    | Level(s) the worker watches                                      |
| ---------------------------- | ---------- | ---------------------------------------------------------------- |
| Horizontal line              | 1          | constant `p`                                                     |
| Trendline / segment          | 2          | `value(t)=p1+(p2−p1)·(t−t1)/(t2−t1)` (ray/extended configurable) |
| Equidistant/parallel channel | 2 + offset | `top(t)`, `bottom(t)` parallel lines                             |
| Fib retracement              | 2          | horizontal levels at 0/.236/.382/.5/.618/.786/1 of range         |
| Fib extension by price       | 3          | projected horizontal levels (1.272/1.618/…)                      |
| Text/annotation              | n/a        | **no alerts** (render only)                                      |

**Trigger semantics (recommended):** _crossing_ detection (previous bar on one side, current on the
other) + optional `tolerance`, with `direction` (cross-up / cross-down / either), `cooldownSec`, and
`oneShot`. Crossing avoids the missed-fast-move / double-fire problems your MQL5 tolerance-band had.

---

## 6. Data model (Phase 2 & 3)

New models + an extension to the existing `Alert`. All in `prisma/schema.prisma` (PostgreSQL).

```prisma
model Drawing {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  symbol    String
  timeframe String
  type      String   // TRENDLINE | HLINE | CHANNEL | FIB_RETRACE | FIB_EXT | TEXT
  anchors   Json     // [{ time, price }, ...]
  style     Json     // color, width, dash, fib levels, channel offset, label text...
  alerts    DrawingAlert[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([userId])
  @@index([symbol, timeframe])
}

model DrawingAlert {
  id          String   @id @default(cuid())
  drawingId   String
  drawing     Drawing  @relation(fields: [drawingId], references: [id], onDelete: Cascade)
  alertId     String   @unique
  alert       Alert    @relation(fields: [alertId], references: [id], onDelete: Cascade)
  targetLevel String   // which level: "line" | "channel_top" | "fib_0.618" ...
  direction   String   @default("either") // cross_up | cross_down | either
  tolerance   Float    @default(0)         // points; 0 = pure cross
  cooldownSec Int      @default(0)
  oneShot     Boolean  @default(false)
  @@index([drawingId])
}
// Alert (existing, :383) already has alertType="PRICE_TOUCH_LINE"; add: drawingAlert DrawingAlert?
```

---

## 7. Per-phase architecture

### Phase 0 — Decisions & v5 upgrade (~1 day)

- **Action:** bump `lightweight-charts` 4.1 → **v5**; migrate call sites (v4 `addCandlestickSeries`
  → v5 `addSeries(CandlestickSeries)`) in `components/charts/trading-chart.tsx`,
  `trading-chart-client.tsx`, `pro-indicator-overlay.tsx`.
- **Decisions to lock:** (a) v5 upgrade ✔, (b) alerts server-side ✔, (c) crossing semantics ✔,
  (d) **price-feed access for the worker** (Redis pub/sub vs DB-tail — see §11).
- **Libraries:** `lightweight-charts@^5` (existing dep, upgraded). No new libs.
- **Risk:** v4→v5 API drift — isolate as its own PR; covered by existing chart tests + Playwright.

### Phase 1 — Drawing engine + 6 tools, clean-room (1–1.5 wk)

- **New module:** `components/charts/drawing/` — your own engine, candleview as spec only.
  - `engine/` — tool router + pointer/crosshair event wiring + selection/hit-test (re: docs 02/03).
  - `marks/` — one Mark per tool implementing a `paneViews()` renderer via the v5 **primitive API**
    (`series.attachPrimitive()`); store geometry as `Anchor[]` (price/time).
  - `tools/` — per-tool create→preview→finalize→edit lifecycle controllers (the "Manager" role).
  - `state/` — active tool + in-progress drawing (lightweight store; **Zustand optional**).
  - `geometry/` — the §5 pure module (shared with server later).
  - `Toolbar.tsx` — left toolbar (re: doc 02), wired into `components/charts/chart-controls.tsx`.
- **Libraries:** `lightweight-charts@^5` (canvas via its primitive API — no extra canvas lib),
  React 19, Tailwind, lucide-react (icons), Radix popover (style editor). **Optional:** `zustand`
  for tool state. **No copyleft code.**
- **Quality:** strict TS (no `any`), no private `_internal__*` calls (use v5 public update path),
  real error handling — must pass `npm run validate`.

### Phase 2 — Persist drawings (3–4 d)

- **DB:** add `Drawing` model (§6), `prisma migrate`.
- **API:** `app/api/drawings/route.ts` (+ `[id]/route.ts`) — Next.js route handlers, **NextAuth**
  session + ownership checks (`lib/auth/session.ts`), **Zod** body validation, tier gating.
- **Client:** load on chart mount + autosave on draw/edit/delete via **SWR** mutations.
- **Libraries:** Prisma, Zod, NextAuth, SWR (all existing).

### Phase 3 — Attach alerts to lines (3–4 d)

- **DB:** add `DrawingAlert` (§6); relate to existing `Alert` (:383).
- **UI:** right-click a line (#1–#5) → "Add alert" popover (Radix + react-hook-form + Zod resolver);
  pick `targetLevel`, `direction`, `tolerance`, `cooldownSec`, `oneShot`. Text marks excluded.
- **API:** `app/api/alerts/...` create/update; reuse `alertType="PRICE_TOUCH_LINE"`.
- **Libraries:** Prisma, Zod, react-hook-form, Radix UI (all existing).

### Phase 4 — Server-side alert engine (~1 wk) — **the two-pipeline model**

- **Producer (Pipeline 1):** extend `mt5-service/` (Flask) to **publish each finalized bar/tick to
  Redis** channel `prices:{symbol}:{timeframe}` (Python `redis` client). Alternatively the worker
  DB-tails new `MarketData` rows (no Flask change; higher latency).
- **Worker (Node):** a **BullMQ** worker (Redis-backed) in the Node/Prisma world so it shares
  `@prisma/client`. On each price event:
  1. load active `DrawingAlert` + `Drawing` for that symbol/timeframe,
  2. compute `valueAt(t_now)` via the §5 geometry module,
  3. detect crossing (prev vs current) honoring tolerance/direction,
  4. enforce **cooldown/dedup** via Redis `SETEX` keys,
  5. enqueue a "fire" job.
- **Libraries (net-new):** **`bullmq`** (queue/worker, uses existing `ioredis`); **Redis pub/sub**
  via existing `ioredis`. _(Python alternative: **Celery + Redis** co-located with Flask — viable if
  you prefer the worker next to the feed, but then it must write Prisma-owned tables via raw SQL.
  Recommended path is the Node/BullMQ worker to share Prisma + types.)_
- **Risk:** worker→price reachability (see §11); idempotency of crossing across restarts.

### Phase 5 — Delivery & realtime (3–4 d)

- **In-app:** `Notification` rows (existing model :666) + live push over **Socket.IO** (existing
  server dep); for horizontal scale add **`@socket.io/redis-adapter`** (uses existing Redis).
- **Email:** **Resend** + `@react-email/components` templates in `emails/`.
- **Chart marker:** render an "alert fired here" mark using the Phase 1 engine (candleview's
  PriceEvent concept, re-implemented).
- **Libraries:** socket.io (existing) + `@socket.io/redis-adapter` (net-new, optional), Resend
  (existing).

### Phase 6 — Tiering, tests, polish (3–5 d)

- **Tiering:** gate tool set + max drawings/alerts by `Subscription` tier (`lib/auth/permissions.ts`,
  re: `00-tier-specifications`).
- **Tests:** Jest unit tests for §5 geometry (pure, high value), worker integration tests,
  **Playwright** e2e (draw → alert → fire), Newman for the new API routes.
- **Gates:** `npm run validate` green; CI license scan green (§12).

---

## 8. Technology stack summary (existing vs. net-new)

| Concern                       | Use (existing)                            | Add (net-new)                                            |
| ----------------------------- | ----------------------------------------- | -------------------------------------------------------- |
| Charting / drawing canvas     | Lightweight Charts (upgrade **v5**)       | —                                                        |
| Tool state                    | React 19                                  | `zustand` _(optional)_                                   |
| API / validation / auth       | Next.js route handlers, Zod, NextAuth v4  | —                                                        |
| ORM / DB                      | Prisma 6 / PostgreSQL                     | — (2 new models)                                         |
| Price fan-out (server→worker) | Redis (`ioredis`), Flask `redis` (Py)     | Redis **pub/sub** channel + Flask publisher              |
| Job queue / worker            | Redis (`ioredis`)                         | **`bullmq`** (Node worker) _(or Celery+Redis if Python)_ |
| Cooldown / dedup state        | Redis `SETEX`                             | —                                                        |
| Realtime to browser           | socket.io / socket.io-client              | `@socket.io/redis-adapter` _(scale-out, optional)_       |
| Email delivery                | Resend + react-email                      | —                                                        |
| Forms / UI                    | react-hook-form, Radix, Tailwind, lucide  | —                                                        |
| Data fetching                 | SWR                                       | —                                                        |
| Testing                       | Jest, Testing Library, Playwright, Newman | —                                                        |
| Deploy                        | Railway / Vercel / Docker / nixpacks      | worker as a separate Railway/Docker service              |

---

## 9. Deployment topology

- **Web (Next.js):** existing Vercel/Railway app — serves UI + API routes.
- **Flask MT5 service:** existing (Windows prod) — add Redis publish.
- **Alert worker:** **new long-running process** (BullMQ) — deploy as its own Railway service /
  Docker container (`docker-compose.yml` already present). Must NOT run on serverless/Vercel (needs a
  persistent process). Shares `DATABASE_URL` and `REDIS_URL`.
- **Redis:** managed instance (Railway/Upstash) shared by web + worker + Flask.

---

## 10. Cross-cutting requirements (per `CLAUDE.md`)

- **Auth:** every drawing/alert API call validates session (`getServerSession`) + ownership.
- **Tier validation:** before create — symbol/timeframe/tool/quota checks.
- **Input validation:** Zod schema on all POST/PATCH.
- **Error handling:** typed catches, proper 4xx/5xx, no swallowed errors.
- **Types:** no `any`; no private `_internal__*` chart APIs.
- **Do not** modify `package.json` `overrides`/`pnpm.overrides` on this feature branch.

---

## 11. Open decisions (resolve in Phase 0)

1. **Worker price source:** Redis pub/sub from Flask (low latency, needs Flask change) **[recommended]**
   vs. DB-tail of `MarketData` (no Flask change, latency = sync cadence).
2. **Worker language:** Node/BullMQ (shares Prisma + TS types) **[recommended]** vs. Python/Celery
   (next to feed, but cross-language DB access).
3. **Line extent for alerts:** ray/extended vs. segment-bounded (between anchors).
4. **Evaluation cadence:** per-tick vs. per-closed-bar (closed-bar = fewer false touches).
5. **Realtime scale-out:** add `@socket.io/redis-adapter` now or later.

---

## 12. Licensing guardrails (make "acceptance" enforceable)

- Written policy: **no AGPL/GPL/copyleft code** in the repo; permissive only.
- **CI license scan** (e.g. `license-checker`/ScanCode) that fails on copyleft deps or snippets.
- `THIRD-PARTY-NOTICES` file preserving Lightweight Charts (Apache-2.0) attribution/NOTICE.
- Clean-room paper trail: candleview studied for design only; implementation written independently.
- Vet transitive deps (do **not** inherit candleview's `ohlcv-ai` etc.).

---

## 13. Phase dependency graph

```
P0 ─► P1 (drawing) ─► P2 (persist) ─► P3 (attach alerts) ─┐
   └► P5/realtime infra (parallelizable)                  ├─► P4 (worker) ─► P5 ─► P6
   P4 geometry (§5) can start in parallel with P1 ────────┘
```

§5 geometry and P4's worker are independent of P1 rendering and can be built in parallel.

```

```

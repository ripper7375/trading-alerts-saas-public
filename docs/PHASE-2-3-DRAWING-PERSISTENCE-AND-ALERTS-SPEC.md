# Phase 2 & 3 — Drawing Persistence + Line-Alert Attachment Spec

**Status:** Implementation-ready spec
**Last updated:** 2026-06-18
**Parent docs:** `docs/DRAWING-ENGINE-AND-LINE-ALERTS-ARCHITECTURE.md` (§6 data model),
`docs/PHASE-1-DRAWING-ENGINE-CLEANROOM-SPEC.md` (§7 serialization),
`docs/PHASE-4-ALERT-ENGINE-SPEC.md` (§7 cache invalidation, §5 watch building)
**Scope:** The connective tissue between the client drawing engine (Phase 1) and the server alert
engine (Phase 4): persist drawings, attach alerts to lines, and expose the API both phases consume.

> **Why one document:** Phase 2 (persist drawings) and Phase 3 (attach alerts) share one data model,
> one API layer, and identical auth/Zod/tier conventions; `DrawingAlert` cannot exist without
> `Drawing`. They are presented as two clearly separated sections (§4 = Phase 2, §5 = Phase 3) within
> a single contract.

---

## 1. Conventions to mirror (cited from the existing codebase)

These API endpoints must match the established pattern in `app/api/watchlist/route.ts` (the closest
user-owned CRUD resource):

| Concern | Use exactly | Source |
|---|---|---|
| Session | `getServerSession(authOptions)` | `app/api/watchlist/route.ts`, `lib/auth/auth-options.ts` |
| Auth-required helper | `requireAuth()` | `lib/auth/session.ts:44` |
| Tier of user | `getUserTier()` | `lib/auth/session.ts:90` |
| Tier config / limits | `FREE_TIER_CONFIG`, `PRO_TIER_CONFIG`, `Tier` | `@/lib/tier-config` |
| Symbol/timeframe gating | `canAccessSymbol()`, `validateTimeframeAccess()` | `@/lib/tier-validation` |
| ORM | `prisma` | `@/lib/db/prisma` |
| Validation | Zod schemas | `zod` |
| Responses | typed `{ success, data?, error?, message? }` interfaces | watchlist route |
| Client data layer | SWR hooks | existing |

Every handler: validate session → validate input (Zod) → tier/ownership check → DB op → typed JSON,
with proper status codes (400/401/403/404/409/500) and no swallowed errors (per `CLAUDE.md`).

---

## 2. Data model (Prisma — extends `prisma/schema.prisma`)

```prisma
model Drawing {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  symbol    String
  timeframe String
  type      String   // TRENDLINE | HLINE | CHANNEL | FIB_RETRACE | FIB_EXT | TEXT
  anchors   Json     // [{ time, price }, ...]  (1–3 anchors; price/time, never pixels)
  style     Json     // color, width, dash + tool-specific extras (fib levels, offset, text…)
  alerts    DrawingAlert[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([symbol, timeframe])
  @@index([userId, symbol, timeframe])
}

model DrawingAlert {
  id          String   @id @default(cuid())
  drawingId   String
  drawing     Drawing  @relation(fields: [drawingId], references: [id], onDelete: Cascade)
  alertId     String   @unique
  alert       Alert    @relation(fields: [alertId], references: [id], onDelete: Cascade)
  targetLevel String   // 'line' | 'channel_top'|'channel_bottom'|'channel_median' | 'fib_0.618' | 'fib_ext_1.618' ...
  direction   String   @default("either")  // cross_up | cross_down | either
  tolerance   Float    @default(0)          // price units; 0 = pure cross
  cooldownSec Int      @default(60)
  oneShot     Boolean  @default(false)

  @@index([drawingId])
}

// ADD to existing Alert model (prisma/schema.prisma:383):
//   drawingAlert DrawingAlert?
//   (Alert already has: isActive, lastTriggered, triggerCount, alertType="PRICE_TOUCH_LINE")
```

**Migration:** `prisma migrate dev --name add_drawings_and_drawing_alerts`. `onDelete: Cascade`
means deleting a drawing removes its alerts (and via the `Alert` cascade, the alert rows too — verify
cascade direction; see §6 deletion semantics).

---

## 3. Shared Zod schemas (single source of truth)

Defined once in `components/charts/drawing/serialization/schema.ts` (Phase 1 §7) and **imported by
the API** so client and server validate identically.

```ts
export const AnchorZ = z.object({ time: z.number().int(), price: z.number().finite() });

export const StyleZ = z.object({
  color: z.string().regex(/^#([0-9a-fA-F]{6})$/),
  lineWidth: z.number().int().min(1).max(10),
  lineStyle: z.enum(['solid', 'dashed', 'dotted']),
}).passthrough();                         // tool-specific extras allowed

export const DrawingTypeZ = z.enum(['TRENDLINE','HLINE','CHANNEL','FIB_RETRACE','FIB_EXT','TEXT']);

export const DrawingCreateZ = z.object({
  symbol: z.string().min(1),
  timeframe: z.string().min(1),
  type: DrawingTypeZ,
  anchors: z.array(AnchorZ).min(1).max(3),
  style: StyleZ,
}).superRefine((d, ctx) => {              // anchor count must match type
  const need = { HLINE:1, TRENDLINE:2, CHANNEL:2, FIB_RETRACE:2, FIB_EXT:3, TEXT:1 }[d.type];
  if (d.anchors.length !== need) ctx.addIssue({ code:'custom',
    message:`${d.type} requires ${need} anchor(s)` });
});

export const DrawingUpdateZ = DrawingCreateZ.partial().omit({ symbol:true, timeframe:true, type:true });

export const AlertAttachZ = z.object({
  drawingId: z.string().cuid(),
  targetLevel: z.string().min(1),         // validated against the drawing's available levels (§5.2)
  direction: z.enum(['cross_up','cross_down','either']).default('either'),
  tolerance: z.number().min(0).default(0),
  cooldownSec: z.number().int().min(0).max(86400).default(60),
  oneShot: z.boolean().default(false),
  name: z.string().max(120).optional(),
});
```

---

# PHASE 2 — Drawing persistence

## 4. Endpoints

### `GET /api/drawings?symbol=&timeframe=`
- Auth: `requireAuth()`.
- Returns the user's drawings for a symbol/timeframe (or all if params omitted), newest first.
- Response: `{ success: true, drawings: DrawingDTO[] }`.

### `POST /api/drawings`
- Body: `DrawingCreateZ`.
- Checks: session → Zod → `canAccessSymbol(tier, symbol)` + `validateTimeframeAccess(tier, timeframe)`
  → **drawing quota** (`FREE_TIER_CONFIG.maxDrawings` vs `PRO_TIER_CONFIG.maxDrawings`; add these
  keys to `@/lib/tier-config`).
- Creates `Drawing` with `userId = session.user.id`.
- `201` `{ success:true, drawing }`; `403` on tier/quota; `400` on validation.

### `PATCH /api/drawings/[id]`
- Body: `DrawingUpdateZ` (anchors/style only; type/symbol/timeframe immutable).
- **Ownership:** load drawing, `403` if `drawing.userId !== session.user.id`.
- Publishes `alerts:changed` (see §6) so the Phase 4 worker rebuilds watches when geometry changes.

### `DELETE /api/drawings/[id]`
- Ownership-checked; cascades to its `DrawingAlert`s (and `Alert`s). Publishes `alerts:changed`.

```ts
interface DrawingDTO {
  id: string; symbol: string; timeframe: string;
  type: DrawingType; anchors: Anchor[]; style: DrawingStyle;
  alerts: { id: string; targetLevel: string; direction: string;
            tolerance: number; cooldownSec: number; oneShot: boolean; active: boolean }[];
  createdAt: string; updatedAt: string;
}
```

## 4a. Client integration (SWR)

- Hook `useDrawings(symbol, timeframe)` → `GET`, returns `DrawingDTO[]`; feeds `DrawingLayer` on mount
  (Phase 1 §10) to re-attach saved marks via `mark.fromSnapshot()`.
- Autosave: on `finalize`/`edit`/`delete` in the engine, call `POST/PATCH/DELETE` then
  `mutate()` the SWR key. Debounce drag edits (~400ms) to avoid write storms.

---

# PHASE 3 — Attach alerts to lines

## 5. Endpoints

### `POST /api/alerts/line`  (attach an alert to a drawn line)
- Body: `AlertAttachZ`.
- Flow:
  1. `requireAuth()`; load `Drawing` by `drawingId`; `404`/`403` (ownership).
  2. **Reject TEXT drawings** (`400` — text has no `alertLevels()`).
  3. **Validate `targetLevel`** against the drawing's available levels: compute
     `levelsForMark(drawing.toSnapshot()).map(l => l.id)` (shared `geometry/`); `400` if not a member.
  4. **Alert quota** by tier (`maxActiveAlerts`; add to `@/lib/tier-config`).
  5. In one `prisma.$transaction`: create `Alert` (`alertType:'PRICE_TOUCH_LINE'`, `symbol`,
     `timeframe` from the drawing, `isActive:true`, `name`) **and** `DrawingAlert` linking them.
  6. Publish `alerts:changed` `{ symbol, timeframe, alertId }` → Phase 4 worker adds the watch.
- `201` `{ success:true, alert }`.

### `PATCH /api/alerts/line/[id]`
- Update `direction`/`tolerance`/`cooldownSec`/`oneShot`/`name`/`isActive` (toggle pause/resume).
- Ownership via `DrawingAlert → Drawing.userId`. Publishes `alerts:changed`.

### `DELETE /api/alerts/line/[id]`
- Deletes `DrawingAlert` + its `Alert`; publishes `alerts:changed`.

### `GET /api/alerts/line?symbol=&timeframe=`
- Lists the user's line alerts (joined with their drawing) for the alerts panel.

## 5.1 `targetLevel` vocabulary (must match Phase 1 / Phase 4)

| Drawing type | Valid `targetLevel` values |
|---|---|
| HLINE | `line` |
| TRENDLINE | `line` |
| CHANNEL | `channel_top`, `channel_bottom`, `channel_median` |
| FIB_RETRACE | `fib_0`, `fib_0.236`, `fib_0.382`, `fib_0.5`, `fib_0.618`, `fib_0.786`, `fib_1` (enabled set) |
| FIB_EXT | `fib_ext_0`, `fib_ext_0.618`, `fib_ext_1`, `fib_ext_1.272`, `fib_ext_1.618`, `fib_ext_2`, … |
| TEXT | *(none — not alertable)* |

The endpoint derives the authoritative list from `levelsForMark()` at request time, so the UI and API
never drift from the geometry module.

## 5.2 UI (Phase 3)

- Right-click a line (#1–#5) → "Add alert" popover (Radix `@radix-ui/react-popover` +
  `react-hook-form` + `@hookform/resolvers` zod resolver), fields: target level (dropdown populated
  from the mark's `alertLevels()`), direction, tolerance, cooldown, one-shot, name.
- An "Alerts" side panel lists/toggles/deletes line alerts (SWR + `useLineAlerts`).
- Text marks: the "Add alert" action is hidden/disabled.

---

## 6. Cross-cutting: ownership, cascade, and cache invalidation

- **Ownership** is enforced on every mutation by loading the row and comparing `userId` to the
  session — never trust client-supplied `userId`.
- **Deletion semantics:** `Drawing` delete → cascade `DrawingAlert` → cascade `Alert`. Confirm the
  Prisma relation directions produce this (add explicit `onDelete: Cascade` on both relations);
  add a test.
- **`alerts:changed` channel (Redis pub/sub):** a tiny helper `publishAlertsChanged(payload)` called
  after every drawing/alert mutation that affects geometry or alert state. This is the exact signal
  Phase 4 §7 subscribes to for cache invalidation. Use the already-installed `ioredis`.

```ts
// lib/alerts/invalidate.ts
export async function publishAlertsChanged(p: {
  symbol: string; timeframe: string; alertId?: string; reason: string;
}): Promise<void> { await redis.publish('alerts:changed', JSON.stringify(p)); }
```

---

## 7. Tier config additions (`@/lib/tier-config`)

Add (values illustrative — confirm against `00-tier-specifications`):

| Key | FREE | PRO |
|---|---|---|
| `maxDrawings` | 10 | 200 |
| `maxActiveAlerts` | 3 | 50 |
| `allowedDrawingTypes` | `['HLINE','TRENDLINE']` | all 6 |

Enforced in `POST /api/drawings` (type + count) and `POST /api/alerts/line` (count). Return `403`
with an upgrade-hint message on breach (mirrors `requirePro()` semantics).

---

## 8. Testing plan

- **Unit (Jest):** Zod schemas — anchor-count `superRefine`, style regex; `targetLevel` validation
  against `levelsForMark()` for each type.
- **API (Jest + Newman):** auth required; ownership 403; tier quota 403; symbol/timeframe gating;
  cascade delete; `alerts:changed` published on each mutation (mock Redis).
- **Integration:** create drawing → attach alert → assert Phase 4 picks up the watch after
  `alerts:changed` (with the worker running).
- **E2E (Playwright):** draw line → reload page → drawing reappears (persistence); add alert →
  appears in alerts panel.
- Gate: `npm run validate` green.

---

## 9. Definition of done

1. `Drawing` + `DrawingAlert` migrated; `Alert` gains the relation.
2. Drawings CRUD API: auth + ownership + Zod + symbol/timeframe gating + drawing quota; SWR
   load/autosave wired into `DrawingLayer`.
3. Line-alert API: validates `targetLevel` against shared geometry, rejects TEXT, enforces alert
   quota, creates `Alert`(`PRICE_TOUCH_LINE`)+`DrawingAlert` atomically.
4. Every mutation publishes `alerts:changed` (Phase 4 contract honored).
5. Cascade deletes verified; no orphan alerts.
6. No `any`/copyleft; `npm run validate` passes.

---

## 10. Contracts this spec fixes for adjacent phases

- **For Phase 1:** `mark.toSnapshot()` ↔ `DrawingCreateZ`; `fromSnapshot()` consumes `DrawingDTO`.
- **For Phase 4:** the `DrawingAlert` shape + `targetLevel` vocabulary + `alerts:changed` payload are
  exactly what §5/§7 of the alert-engine spec consume.
- **Open item (architecture §11.3):** line extent (ray vs segment) is carried in `Drawing.style`
  (`extendLeft`/`extendRight`) and honored by `geometry` `valueAt → null`; the alert UI may surface
  it as an option but storage lives on the drawing, not the alert.

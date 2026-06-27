# Phase 5 — Delivery / Realtime + Chart Marker (implemented)

**Status:** Implemented
**Parent:** `docs/DRAWING-ENGINE-AND-LINE-ALERTS-ARCHITECTURE.md`,
`docs/PHASE-4-ALERT-ENGINE-SPEC.md`

Closes the Phase 4 gap: the alert worker runs in its own process and can't reach
the web server's Socket.IO connections directly. Phase 5 delivers fires live and
draws an "alert fired here" marker on the chart.

## Flow

```
 alert worker (process A)                     web server (process B)
 ─────────────────────────                    ──────────────────────
 evaluator → dispatcher                        initWebSocketServer()
   ├─ DB: Notification + Alert                   └─ startAlertDeliveryBridge()
   └─ publishAlertFired(redis) ──────────────►  SUBSCRIBE alerts:fired
                              Redis pub/sub        on message → parseAlertFired
                                                     ├─ sendNotificationToUser()  → 'notification'
                                                     └─ emit 'alert_fired' (marker) → chart
                                                                              │
 browser: useWebSocket({ onNotification, onAlertFired })  ◄───────────────────┘
   ├─ onNotification → existing bell/toast
   └─ onAlertFired   → useFiredAlertMarkers → createSeriesMarkers (marker on series)
```

## Components

| Piece                               | File                                                | Notes                                                                                                                                  |
| ----------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Fired-message build/parse + publish | `lib/alert-engine/notify-bridge.ts`                 | pure build/parse (tested); `publishAlertFired`; `startAlertDeliveryBridge` (web process, no-op without `REDIS_URL`)                    |
| Dispatcher publishes cross-process  | `lib/alert-engine/dispatcher.ts`                    | after DB write → `publishAlertFired` (best-effort Redis); injectable publisher                                                         |
| Web bridge wiring                   | `lib/websocket/server.ts`                           | `startAlertDeliveryBridge` in `initWebSocketServer`; delivers via `sendNotificationToUser` + `emit('alert_fired', {type,data:marker})` |
| Client event                        | `hooks/use-websocket.ts`                            | additive `onAlertFired` (mirrors the existing `notification` framing)                                                                  |
| Marker store (pure)                 | `components/charts/drawing/firedMarkers.ts`         | capped list (tested)                                                                                                                   |
| Marker hook                         | `components/charts/drawing/useFiredAlertMarkers.ts` | `createSeriesMarkers`; filters to current symbol/timeframe                                                                             |
| Chart wiring                        | `components/charts/trading-chart.tsx`               | `useFiredAlertMarkers(seriesApi, symbol, timeframe)`                                                                                   |

## Guarantees / notes

- **Durable record always:** the `Notification` row is written regardless of
  realtime delivery (user sees it on next load).
- **Live delivery requires the bridge in the web process** (auto-started in
  `initWebSocketServer`) and a shared `REDIS_URL`.
- The chart marker rides the **same Socket.IO framing as notifications** (mirrored
  exactly), so if notifications deliver, markers deliver; otherwise it degrades to
  notification-only.

## Future (not in this phase)

- BullMQ for fire durability/retry (dispatcher is already an interface).
- `@socket.io/redis-adapter` for multi-node web horizontal scaling.
- Marker expiry / styling per direction.

components/charts/drawing/geometry/
├── types.ts
├── trendline.ts
├── horizontal.ts
├── channel.ts
├── fib.ts
├── levels.ts
└── index.ts

**tests**/drawing/geometry/
└── geometry.test.ts

===========================================

package.json ← ONE-LINE edit (see below)
components/charts/
├── trading-chart.tsx ← MODIFIED (overwrite)
├── pro-indicator-overlay.tsx ← MODIFIED (overwrite)
└── drawing/
├── types.ts ← NEW
├── engine/
│ ├── coords.ts ← NEW
│ └── pixelMath.ts ← NEW
└── marks/
├── BaseMark.ts ← NEW
├── HorizontalLineMark.ts ← NEW
└── TrendlineMark.ts ← NEW
**tests**/drawing/engine/
└── pixelMath.test.ts ← NEW

===============================

package.json

- "lightweight-charts": "^4.1.1",

* "lightweight-charts": "^5.2.0",

===============================

components/charts/
├── trading-chart.tsx ← MODIFIED (overwrite)
└── drawing/
├── Toolbar.tsx ← NEW
├── DrawingLayer.tsx ← NEW
├── tools/index.ts ← NEW
└── engine/
├── DrawingEngine.ts ← NEW
└── PointerController.ts ← NEW

===============================

**tests**/drawing/engine/DrawingEngine.test.ts

===============================

components/charts/drawing/
├── marks/
│ ├── ChannelMark.ts ← NEW
│ ├── FibRetracementMark.ts ← NEW
│ ├── FibExtensionMark.ts ← NEW
│ └── TextMark.ts ← NEW
├── geometry/levels.ts ← MODIFIED (overwrite)
├── tools/index.ts ← MODIFIED (overwrite)
└── Toolbar.tsx ← MODIFIED (overwrite)

**tests**/drawing/marks/
└── newMarks.test.ts ← NEW

==================================

prisma/schema.prisma ← MODIFIED (Drawing + DrawingAlert models, relations)
types/prisma-stubs.d.ts ← MODIFIED (mirror new models/delegates)
lib/drawing/
├── schema.ts ← NEW (shared Zod + tier limits)
└── invalidate.ts ← NEW (alerts:changed publisher)
app/api/drawings/
├── route.ts ← NEW (GET, POST)
└── [id]/route.ts ← NEW (PATCH, DELETE)
app/api/alerts/line/
├── route.ts ← NEW (GET, POST)
└── [id]/route.ts ← NEW (PATCH, DELETE)

==================================

components/charts/drawing/
├── persistence.ts ← NEW
└── DrawingLayer.tsx ← MODIFIED (overwrite)
components/charts/trading-chart.tsx ← MODIFIED (overwrite)
**tests**/drawing/persistence.test.ts ← NEW

==================================

components/charts/drawing/
├── AlertDialog.tsx ← NEW
├── DrawingLayer.tsx ← MODIFIED
├── Toolbar.tsx ← MODIFIED
├── persistence.ts ← MODIFIED
└── engine/DrawingEngine.ts ← MODIFIED
**tests**/drawing/marks/newMarks.test.ts ← MODIFIED

==================================

lib/alert-engine/
├── types.ts ← PriceEvent / AlertWatch / FireEvent
├── detect.ts ← cross + intrabar-touch detection (pure)
├── state.ts ← Redis-backed prev/cooldown/fired (+ in-memory for tests)
├── watches.ts ← build watches from DrawingAlert via shared geometry
├── evaluator.ts ← evaluate → cross → gate → fire
├── dispatcher.ts ← Notification + Alert update + live push
└── worker.ts ← ioredis ingest + watch cache + invalidation
scripts/alert-worker.ts ← standalone entrypoint
**tests**/alert-engine/\*.test.ts ← 3 test files (20 tests)
mt5-service/REDIS-PUBLISH-SNIPPET.md ← the ~5-line Flask producer

==================================

lib/alert-engine/notify-bridge.ts ← NEW
lib/alert-engine/dispatcher.ts ← MODIFIED
lib/websocket/server.ts ← MODIFIED
hooks/use-websocket.ts ← MODIFIED
components/charts/drawing/firedMarkers.ts ← NEW
components/charts/drawing/useFiredAlertMarkers.ts ← NEW
components/charts/trading-chart.tsx ← MODIFIED
**tests**/alert-engine/notify-bridge.test.ts ← NEW
**tests**/drawing/firedMarkers.test.ts ← NEW
docs/PHASE-5-DELIVERY-AND-REALTIME-SPEC.md ← NEW

==================================

components/charts/drawing/
├── alertsApi.ts ← NEW (list/pause/delete client wrapper)
├── tierUsage.ts ← NEW (used/limit helpers)
├── StyleEditor.tsx ← NEW (color/width/dash + TEXT label editor)
├── AlertsPanel.tsx ← NEW (the side-panel)
├── engine/DrawingEngine.ts ← MODIFIED (selected style getters/update)
├── Toolbar.tsx ← MODIFIED (Palette + ListChecks buttons)
└── DrawingLayer.tsx ← MODIFIED (wires all three)
**tests**/drawing/alertsApi.test.ts ← NEW
**tests**/drawing/tierUsage.test.ts ← NEW
**tests**/drawing/marks/newMarks.test.ts ← MODIFIED (engine style tests)

==================================

lib/alert-engine/queue.ts ← NEW
lib/alert-engine/worker.ts ← MODIFIED
lib/websocket/server.ts ← MODIFIED
docs/SCALING-BULLMQ-AND-SOCKET-ADAPTER.md ← NEW

==================================

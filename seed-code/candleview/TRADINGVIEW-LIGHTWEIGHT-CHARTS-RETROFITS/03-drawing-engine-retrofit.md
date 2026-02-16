# Document 3: Drawing Engine — Retrofitting Guide

**Purpose:** Integrate CandleView's Drawing Engine into Trading Alerts SaaS using TradingView Lightweight Charts v5.x
**Source Reference:** `seed-code/candleview/core/src/components/CandleView/ChartLayer/`, `Mark/`, `MarkManager/`
**Date:** 2026-02-16

---

## 1. WHAT THE DRAWING ENGINE DOES

The Drawing Engine is the core system that makes marks (drawings) work on the chart. It handles:

- **Coordinate transformation** — Converting between price/time (chart space) and pixels (screen space)
- **Mouse event routing** — Capturing clicks, drags, and moves to drive drawing interactions
- **Mark rendering** — Drawing graphics on the chart via lightweight-charts primitive API
- **Mark lifecycle** — Create, preview, finalize, edit, drag, delete
- **Hit testing** — Detecting when user clicks on existing marks
- **State management** — Tracking active tool, drawing state, selected marks

**Key fact:** This is the most complex part of CandleView. The Left Toolbar (Document 2) is just UI that triggers tools. The Drawing Engine is what actually makes those tools work.

---

## 2. ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────┐
│  CandleView (Parent Component)                                  │
│    ├── state.activeTool: string                                 │
│    └── passes activeTool + chart + series to ChartLayer         │
└──────────────┬──────────────────────────────────────────────────┘
               ↓
┌─────────────────────────────────────────────────────────────────┐
│  ChartLayer (React Component — orchestrator)                    │
│    ├── ChartManager        → Wraps createChart()                │
│    ├── ChartEventManager   → Subscribes to chart events         │
│    ├── ChartMarkManager    → Routes tools to MarkManagers       │
│    └── ChartTypeManager    → Handles chart type switching       │
└──────────────┬──────────────────────────────────────────────────┘
               ↓
┌─────────────────────────────────────────────────────────────────┐
│  ChartMarkManager (Router)                                      │
│    ├── LineSegmentMarkManager                                   │
│    ├── RectangleMarkManager                                     │
│    ├── FibonacciRetracementMarkManager                          │
│    ├── PencilMarkManager                                        │
│    ├── ... (60+ managers, one per tool)                          │
│    Each manager owns:                                           │
│      - handleMouseDown(point)                                   │
│      - handleMouseMove(point)                                   │
│      - handleMouseUp(point)                                     │
│      - Its own mark instances array                             │
└──────────────┬──────────────────────────────────────────────────┘
               ↓
┌─────────────────────────────────────────────────────────────────┐
│  Mark Classes (Drawing objects)                                 │
│    ├── LineSegmentMark                                          │
│    ├── RectangleMark                                            │
│    ├── FibonacciRetracementMark                                 │
│    ├── PencilMark                                               │
│    ├── ... (60+ mark types)                                     │
│    Each mark implements:                                        │
│      - IGraph (type identity)                                   │
│      - IMarkStyle (style management)                            │
│      - IDeletableMark (eraser support)                          │
│      - paneViews() → Canvas rendering                           │
│    Attached to chart via:                                       │
│      series.attachPrimitive(mark)                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. SOURCE FILE MAP

```
seed-code/candleview/core/src/components/CandleView/
├── ChartLayer/
│   ├── index.tsx              # ChartLayer component (orchestrator)
│   ├── ChartManager.ts        # lightweight-charts createChart() wrapper
│   ├── ChartEventManager.ts   # Event subscription (crosshair, click, dblclick)
│   ├── ChartMarkManager.ts    # Tool → MarkManager router
│   ├── ChartTypeManager.ts    # Chart type switching with mark re-attachment
│   ├── MainChart/             # Chart type implementations per series type
│   └── Panes/                 # Multi-pane management for sub-chart indicators
│
├── Mark/                      # Interfaces
│   ├── IGraph.ts              # getMarkType(): MarkType
│   ├── IMarkStyle.ts          # updateStyles(), getCurrentStyles()
│   ├── IMarkManager.ts        # Manager contract (getAllMarks, getMarkAtPoint, etc.)
│   └── IDeletableMark.ts      # isPointNearPath() for eraser hit testing
│
├── MarkManager/               # 18+ subdirectories
│   ├── LineSegment/
│   │   ├── LineSegmentMark.ts         # Mark class (rendering + state)
│   │   └── LineSegmentMarkManager.ts  # Manager (mouse events + lifecycle)
│   ├── Rectangle/
│   │   ├── RectangleMark.ts
│   │   └── RectangleMarkManager.ts
│   ├── FibonacciRetracement/
│   │   ├── FibonacciRetracementMark.ts
│   │   └── FibonacciRetracementMarkManager.ts
│   ├── Pencil/
│   │   ├── PencilMark.ts
│   │   └── PencilMarkManager.ts
│   ├── HorizontalLine/
│   ├── VerticalLine/
│   ├── ArrowLine/
│   ├── ParallelChannel/
│   ├── Circle/
│   ├── Ellipse/
│   ├── Triangle/
│   ├── GannFan/
│   ├── Elliott*/
│   ├── XABCD/
│   └── ... (60+ total)
│
└── types.ts                   # MarkType enum, MarkDrawing interface, Point interface
```

---

## 4. COORDINATE TRANSFORMATION SYSTEM

This is the foundation of the entire drawing engine. Every mark must convert between two coordinate spaces:

### 4.1 Chart Space (Price/Time) vs Pixel Space (X/Y)

```
CHART SPACE (what marks store):          PIXEL SPACE (what canvas draws):
  time: Unix timestamp                     x: pixels from left edge
  price: decimal price value               y: pixels from top edge

CONVERSIONS (via lightweight-charts API):
  Price → Pixel Y:   series.priceToCoordinate(price) → pixelY
  Pixel Y → Price:   series.coordinateToPrice(pixelY) → price
  Time → Pixel X:    chart.timeScale().timeToCoordinate(time) → pixelX
  Pixel X → Time:    chart.timeScale().coordinateToTime(pixelX) → time
```

### 4.2 Why Dual Coordinates Matter

Marks store positions in **chart space** (price/time) so they stay anchored to the correct candle/price level when the user scrolls or zooms. But rendering happens in **pixel space** because Canvas API draws in pixels.

```
User draws a line from candle A ($100) to candle B ($105)
    ↓
Mark stores: { startTime: 1700000000, startPrice: 100, endTime: 1700003600, endPrice: 105 }
    ↓
On every render frame:
  startX = timeScale.timeToCoordinate(1700000000)  // Recalculates pixel position
  startY = series.priceToCoordinate(100)            // Accounts for zoom/scroll
  endX = timeScale.timeToCoordinate(1700003600)
  endY = series.priceToCoordinate(105)
    ↓
Canvas draws line from (startX, startY) to (endX, endY)
```

**When user scrolls/zooms:** Pixel coordinates change, but price/time coordinates stay fixed. The mark visually moves with the chart.

### 4.3 Mouse Position to Chart Coordinates

When the user clicks on the chart, the MarkManager converts pixel coordinates to chart coordinates:

```typescript
// From LineSegmentMarkManager.ts — mouse event handling
handleMouseDown(point: Point) {
  const chartElement = chart.chartElement();
  const chartRect = chartElement.getBoundingClientRect();
  const containerRect = containerRef.current?.getBoundingClientRect();

  // Calculate pixel position relative to chart
  const relativeX = point.x - (containerRect.left - chartRect.left);
  const relativeY = point.y - (containerRect.top - chartRect.top);

  // Convert to chart space
  const time = chart.timeScale().coordinateToTime(relativeX);
  const price = chartSeries.series.coordinateToPrice(relativeY);

  // Now use time/price to create or update mark
}
```

---

## 5. MARK RENDERING — THE PRIMITIVE API

### 5.1 How Marks Render on the Chart

CandleView uses lightweight-charts' **Primitives API** to render custom graphics on the chart canvas. Each mark class implements a `paneViews()` method that returns a renderer:

```typescript
// Simplified from LineSegmentMark.ts
class LineSegmentMark {
  private _chart: IChartApi;
  private _series: ISeriesApi;
  private _startTime: number;
  private _startPrice: number;
  private _endTime: number;
  private _endPrice: number;
  private _color: string;
  private _lineWidth: number;
  private _renderer: any;

  // This is the key API — lightweight-charts calls this to get renderers
  paneViews() {
    if (!this._renderer) {
      this._renderer = {
        draw: (target: any) => {
          const ctx = target.context ?? target._context;
          if (!ctx || !this._chart || !this._series) return;

          // Convert stored price/time to current pixel positions
          const startX = this._chart
            .timeScale()
            .timeToCoordinate(this._startTime);
          const startY = this._series.priceToCoordinate(this._startPrice);
          const endX = this._chart.timeScale().timeToCoordinate(this._endTime);
          const endY = this._series.priceToCoordinate(this._endPrice);

          if (startX == null || startY == null || endX == null || endY == null)
            return;

          // Draw on canvas
          ctx.save();
          ctx.strokeStyle = this._color;
          ctx.lineWidth = this._lineWidth;
          ctx.lineCap = 'round';

          // Preview mode: dashed line with transparency
          if (this._isPreview || this._isDragging) {
            ctx.globalAlpha = 0.7;
            ctx.setLineDash([5, 3]);
          }

          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();

          // Draw edit handles when selected
          if (this._showHandles || this._isDragging) {
            this.drawHandle(ctx, startX, startY, this._dragPoint === 'start');
            this.drawHandle(ctx, endX, endY, this._dragPoint === 'end');
          }

          ctx.restore();
        },
      };
    }
    return [{ renderer: () => this._renderer }];
  }

  // Edit handle rendering (circles at endpoints)
  private drawHandle(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    isActive: boolean
  ) {
    ctx.fillStyle = this._color;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();

    if (isActive) {
      ctx.strokeStyle = this._color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
```

### 5.2 Attaching/Detaching Marks

```typescript
// To show a mark on chart:
series.attachPrimitive(mark);

// To remove a mark from chart:
series.detachPrimitive(mark);

// The mark's paneViews() is called by lightweight-charts on every render frame
// This is how marks automatically update when the chart scrolls/zooms
```

### 5.3 Triggering Re-renders

When a mark's position or style changes, it must tell lightweight-charts to re-render:

```typescript
class LineSegmentMark {
  private requestUpdate() {
    // Trigger lightweight-charts to re-call paneViews()
    if (this._series) {
      // This forces a redraw by updating a dummy property
      this._series.applyOptions({});
    }
  }

  updateEndPoint(time: number, price: number) {
    this._endTime = time;
    this._endPrice = price;
    this.requestUpdate(); // Tell chart to re-render
  }
}
```

---

## 6. MARK LIFECYCLE — CREATE → EDIT → DELETE

### 6.1 Two-Click Drawing (Line, Fibonacci, Rectangle, etc.)

```
STEP 1: USER ACTIVATES TOOL
  LeftPanel.onToolSelect('line-segment')
    → ChartMarkManager routes to LineSegmentMarkManager
    → state.isLineSegmentMarkMode = true
    → Cursor changes to crosshair

STEP 2: FIRST CLICK (set start point)
  handleMouseDown(point):
    → Convert pixel to chart coords: { time, price }
    → Create PREVIEW mark: new LineSegmentMark(time, price, time, price, color, width, isPreview=true)
    → Attach to chart: series.attachPrimitive(previewMark)
    → Preview shows as dashed line with alpha=0.7

STEP 3: MOUSE MOVE (update preview)
  handleMouseMove(point):
    → Convert pixel to chart coords: { time, price }
    → Update preview end: previewMark.updateEndPoint(time, price)
    → Chart auto-re-renders preview line following cursor

STEP 4: SECOND CLICK (finalize)
  handleMouseDown(point):
    → Detach preview: series.detachPrimitive(previewMark)
    → Create FINAL mark: new LineSegmentMark(startTime, startPrice, endTime, endPrice, color, width, isPreview=false)
    → Attach final: series.attachPrimitive(finalMark)
    → Save to marks array: this.lineMarks.push(finalMark)
    → Exit drawing mode: state.isLineSegmentMarkMode = false
    → Call onCloseDrawing() callback
```

### 6.2 Continuous Drawing (Pencil, Brush, Pen)

```
STEP 1: USER ACTIVATES TOOL
  LeftPanel.onToolSelect('pencil')
    → state.isPencilMode = true

STEP 2: MOUSE DOWN (start stroke)
  handleMouseDown(point):
    → Create new PencilMark with first point: [{ time, price }]
    → Attach to chart: series.attachPrimitive(pencilMark)
    → state.isDrawing = true

STEP 3: MOUSE MOVE (add points while held)
  handleMouseMove(point):
    → Throttle: only add point if distance >= 3 pixels from last point
    → pencilMark.addPoint(time, price)
    → Chart re-renders with new point

STEP 4: MOUSE UP (end stroke)
  handleMouseUp(point):
    → If pencilMark has >= 2 points: save to marks array
    → If < 2 points: detach and discard (too small)
    → state.isDrawing = false
    → Pencil mode stays active for next stroke
```

### 6.3 Multi-Point Drawing (Elliott Wave, XABCD, etc.)

```
STEP 1-N: SEQUENTIAL CLICKS (one per wave point)
  First click  → Point 0 (wave start)
  Second click → Point 1 (wave 1 end)
  Third click  → Point 2 (wave 2 end)
  Fourth click → Point 3 (wave 3 end)
  Fifth click  → Point 4 (wave 4 end)
  Sixth click  → Point 5 (wave 5 end) → FINALIZE

Each click:
  → Adds point to mark's points array
  → Updates preview rendering
  → Checks if required point count reached
  → If complete: finalize and save
```

### 6.4 Editing Existing Marks

```
User clicks on existing mark (no tool active):

STEP 1: HIT TEST
  handleMouseDown(point):
    → For each mark in allMarks:
      → Check handle hit: mark.isPointNearHandle(x, y) → 'start' | 'end' | null
      → Check body hit: mark.isPointNearPath(x, y) → true | false

STEP 2A: HANDLE DRAG (resize/reshape)
  If clicked on handle (e.g., 'end'):
    → mark.setShowHandles(true)
    → state.dragTarget = mark
    → state.dragPoint = 'end'
  On mouse move:
    → mark.updateEndPoint(newTime, newPrice)
  On mouse up:
    → Commit new position

STEP 2B: BODY DRAG (move entire mark)
  If clicked on line body:
    → mark.setDragging(true, 'line')
    → Calculate pixel deltas during drag
    → mark.dragLineByPixels(deltaX, deltaY)
      → Internally converts pixel deltas to price/time deltas
      → Updates all stored coordinates
  On mouse up:
    → mark.setDragging(false)
```

### 6.5 Deleting Marks

**Via Eraser Tool:**

```
User activates eraser tool
    → state.isEraserMode = true
On mouse move over chart:
    → For each mark implementing IDeletableMark:
      → mark.isPointNearPath(mouseX, mouseY, threshold=15)
      → If true: highlight mark (preview deletion)
On click:
    → series.detachPrimitive(mark)
    → Remove from marks array
```

**Via Clear All Button:**

```
For each manager in allManagers:
  For each mark in manager.getAllMarks():
    series.detachPrimitive(mark)
  manager.clearState()
```

---

## 7. HIT TESTING — DETECTING CLICKS ON MARKS

### 7.1 Handle Hit Test (For Editing)

```typescript
// From LineSegmentMark
isPointNearHandle(x: number, y: number): string | null {
  const startX = this._chart.timeScale().timeToCoordinate(this._startTime);
  const startY = this._series.priceToCoordinate(this._startPrice);
  const endX = this._chart.timeScale().timeToCoordinate(this._endTime);
  const endY = this._series.priceToCoordinate(this._endPrice);

  const threshold = 10; // pixels

  // Check start handle
  if (Math.hypot(x - startX, y - startY) <= threshold) return 'start';
  // Check end handle
  if (Math.hypot(x - endX, y - endY) <= threshold) return 'end';

  return null;
}
```

### 7.2 Path Hit Test (For Eraser / Body Selection)

```typescript
// Point-to-line-segment distance (for line marks)
isPointNearPath(x: number, y: number, threshold: number = 15): boolean {
  const startX = this._chart.timeScale().timeToCoordinate(this._startTime);
  const startY = this._series.priceToCoordinate(this._startPrice);
  const endX = this._chart.timeScale().timeToCoordinate(this._endTime);
  const endY = this._series.priceToCoordinate(this._endPrice);

  // Point-to-line distance formula
  const A = x - startX;
  const B = y - startY;
  const C = endX - startX;
  const D = endY - startY;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = lenSq !== 0 ? dot / lenSq : -1;

  let closestX, closestY;
  if (param < 0) { closestX = startX; closestY = startY; }
  else if (param > 1) { closestX = endX; closestY = endY; }
  else { closestX = startX + param * C; closestY = startY + param * D; }

  const distance = Math.hypot(x - closestX, y - closestY);
  return distance <= threshold;
}
```

### 7.3 Fibonacci Level Hit Test

```typescript
// From FibonacciRetracementMark
isPointNearFibonacciLine(x: number, y: number, threshold: number = 15): number | null {
  const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618, 4.236];

  for (const level of levels) {
    const priceDiff = this._endPrice - this._startPrice;
    const fibPrice = this._startPrice + priceDiff * level;
    const fibY = this._series.priceToCoordinate(fibPrice);

    if (fibY !== null && Math.abs(y - fibY) <= threshold) {
      return level;  // Return which Fibonacci level was hit
    }
  }
  return null;
}
```

---

## 8. COMPLEX MARK EXAMPLE — FIBONACCI RETRACEMENT

This demonstrates how a sophisticated mark is implemented:

### 8.1 Data Model

```typescript
class FibonacciRetracementMark implements IGraph, IMarkStyle {
  private _startPrice: number;
  private _endPrice: number;
  private _startTime: number;
  private _endTime: number;
  private _levels: number[] = [
    0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618, 4.236, 6.854,
  ];
  private _colors: string[] = [
    '#FF4444',
    '#00A8FF',
    '#9C27B0',
    '#4CAF50',
    '#FF9800',
    '#795548',
    '#607D8B',
    '#E91E63',
    '#3F51B5',
    '#009688',
    '#FF5722',
  ];
}
```

### 8.2 Rendering

```typescript
paneViews() {
  return [{
    renderer: () => ({
      draw: (target) => {
        const ctx = target.context;
        const startX = this._chart.timeScale().timeToCoordinate(this._startTime);
        const endX = this._chart.timeScale().timeToCoordinate(this._endTime);
        const priceDiff = this._endPrice - this._startPrice;

        // Draw each Fibonacci level
        for (let i = 0; i < this._levels.length; i++) {
          const level = this._levels[i];
          const fibPrice = this._startPrice + priceDiff * level;
          const fibY = this._series.priceToCoordinate(fibPrice);

          if (fibY === null) continue;

          // Draw horizontal line at this level
          ctx.strokeStyle = this._colors[i];
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(startX, fibY);
          ctx.lineTo(endX, fibY);
          ctx.stroke();

          // Draw fill between levels
          if (i > 0) {
            const prevPrice = this._startPrice + priceDiff * this._levels[i - 1];
            const prevY = this._series.priceToCoordinate(prevPrice);
            if (prevY !== null) {
              ctx.fillStyle = this._colors[i] + '15'; // 15 = ~8% opacity hex
              ctx.fillRect(startX, Math.min(fibY, prevY), endX - startX, Math.abs(fibY - prevY));
            }
          }

          // Draw level label
          ctx.fillStyle = this._colors[i];
          ctx.font = '11px Arial';
          ctx.fillText(`${(level * 100).toFixed(1)}% (${fibPrice.toFixed(2)})`, endX + 5, fibY + 4);
        }
      }
    })
  }];
}
```

---

## 9. FREEHAND DRAWING EXAMPLE — PENCIL MARK

### 9.1 Data Model

```typescript
class PencilMark implements IGraph, IMarkStyle, IDeletableMark {
  private _points: Array<{ time: number; price: number }> = [];
  private _color: string;
  private _lineWidth: number;
}
```

### 9.2 Rendering (Connect-the-dots)

```typescript
paneViews() {
  return [{
    renderer: () => ({
      draw: (target) => {
        const ctx = target.context;
        if (this._points.length < 2) return;

        ctx.save();
        ctx.strokeStyle = this._color;
        ctx.lineWidth = this._lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        const firstX = this._chart.timeScale().timeToCoordinate(this._points[0].time);
        const firstY = this._series.priceToCoordinate(this._points[0].price);
        ctx.moveTo(firstX, firstY);

        for (let i = 1; i < this._points.length; i++) {
          const x = this._chart.timeScale().timeToCoordinate(this._points[i].time);
          const y = this._series.priceToCoordinate(this._points[i].price);
          if (x !== null && y !== null) {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
        ctx.restore();
      }
    })
  }];
}
```

### 9.3 Drag (Move Entire Pencil Stroke)

```typescript
dragByPixels(deltaX: number, deltaY: number) {
  const timeScale = this._chart.timeScale();
  const newPoints = [];

  for (const point of this._points) {
    const x = timeScale.timeToCoordinate(point.time);
    const y = this._series.priceToCoordinate(point.price);
    if (x === null || y === null) continue;

    // Apply pixel offset, then convert back to chart space
    const newTime = timeScale.coordinateToTime(x + deltaX);
    const newPrice = this._series.coordinateToPrice(y + deltaY);

    if (newTime !== null && !isNaN(newPrice)) {
      newPoints.push({ time: newTime, price: newPrice });
    }
  }

  if (newPoints.length === this._points.length) {
    this._points = newPoints;
    this.requestUpdate();
  }
}
```

---

## 10. EVENT SYSTEM

### 10.1 Chart Event Subscriptions

```typescript
// From ChartEventManager.ts — events used by drawing engine

// Crosshair move — for OHLC tooltip and mark hover detection
chart.subscribeCrosshairMove((event: MouseEventParams) => {
  // event.point = { x, y } in pixels
  // event.time = bar time at cursor
  // event.seriesData = Map of series → OHLC data
});

// Click — for mark creation and selection
chart.subscribeClick((event: MouseEventParams) => {
  // Same event structure as crosshairMove
});

// Double-click — for special actions (edit text, etc.)
chart.subscribeDblClick((event: MouseEventParams) => {
  // Same event structure
});

// Visible time range change — for mark visibility optimization
chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
  // range = { from: timestamp, to: timestamp } | null
});

// Visible logical range change — for scroll detection
chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
  // range = { from: logicalIndex, to: logicalIndex } | null
});
```

### 10.2 Mouse Event Flow

```
DOM mousedown on chart container
    ↓
ChartLayer captures event
    ↓
Calculates relative position within chart
    ↓
ChartMarkManager.handleMouseDown(point)
    ↓
Routes to active MarkManager (based on current tool)
    ↓
MarkManager decides:
  A) No active tool → check if clicking existing mark (hit test)
  B) Active tool, first click → create preview mark
  C) Active tool, second click → finalize mark
  D) Dragging existing mark → update position
    ↓
Returns updated state
```

---

## 11. MARK PERSISTENCE — DATA MODEL

### 11.1 MarkDrawing (Serialization Structure)

```typescript
interface MarkDrawing {
  id: string; // Unique identifier
  type: string; // Tool name (e.g., 'line-segment')
  markType: MarkType; // Enum value
  mark: any; // The mark object
  points: Point[]; // Screen coordinates (for reference)
  color: string; // Primary color
  lineWidth: number; // Line thickness
  isSelected?: boolean; // Currently selected?
  rotation?: number; // Rotation angle
  properties?: any; // Tool-specific data
  graphColor?: string; // Override color
  graphWidth?: number; // Override width
  graphStyle?: 'solid' | 'dashed' | 'dotted'; // Line style
}
```

### 11.2 History/Undo Support

```typescript
interface HistoryRecord {
  drawings: MarkDrawing[]; // Snapshot of all drawings at this point
  description: string; // What changed (for undo/redo display)
}
```

---

## 12. CHART TYPE SWITCHING — MARK RE-ATTACHMENT

When the user switches chart type (e.g., Candlestick → Line), all marks must be transferred because they are bound to a specific series:

```typescript
// From ChartTypeManager.ts — simplified flow
function switchChartType(chart: IChartApi, newType: MainChartType) {
  // 1. Collect all marks from all managers
  const allMarks = chartMarkManager.collectAllMarks();

  // 2. Detach all marks from old series
  for (const mark of allMarks) {
    oldSeries.detachPrimitive(mark);
  }

  // 3. Remove old series
  chart.removeSeries(oldSeries);

  // 4. Create new series of desired type
  let newSeries;
  switch (newType) {
    case MainChartType.Line:
      newSeries = chart.addSeries(LineSeries, lineOptions);
      break;
    case MainChartType.Candle:
      newSeries = chart.addSeries(CandlestickSeries, candleOptions);
      break;
    // ... etc
  }

  // 5. Set data on new series
  newSeries.setData(preparedData);

  // 6. Re-attach all marks to new series
  for (const mark of allMarks) {
    mark.updateSeriesReference(newSeries); // Update internal reference
    newSeries.attachPrimitive(mark);
  }

  // 7. Re-apply all indicators
  indicatorManager.reattachAll(chart, newSeries);
}
```

---

## 13. LIGHTWEIGHT-CHARTS APIs USED BY DRAWING ENGINE

| API                                                     | Used For                              |
| ------------------------------------------------------- | ------------------------------------- |
| `series.attachPrimitive(mark)`                          | Show mark on chart                    |
| `series.detachPrimitive(mark)`                          | Remove mark from chart                |
| `series.priceToCoordinate(price)`                       | Price → pixel Y                       |
| `series.coordinateToPrice(pixelY)`                      | Pixel Y → price                       |
| `chart.timeScale().timeToCoordinate(time)`              | Time → pixel X                        |
| `chart.timeScale().coordinateToTime(pixelX)`            | Pixel X → time                        |
| `chart.timeScale().coordinateToLogical(pixelX)`         | Pixel X → logical index               |
| `chart.subscribeCrosshairMove(cb)`                      | Mouse move events                     |
| `chart.subscribeClick(cb)`                              | Click events                          |
| `chart.subscribeDblClick(cb)`                           | Double-click events                   |
| `chart.timeScale().subscribeVisibleTimeRangeChange(cb)` | Scroll/zoom detection                 |
| `chart.chartElement()`                                  | Get DOM element for rect calculations |
| `series.applyOptions({})`                               | Force re-render                       |
| `chart.removeSeries(series)`                            | For chart type switching              |
| `chart.addSeries(Type, options)`                        | For chart type switching              |

---

## 14. RETROFITTING PLAN FOR TRADING ALERTS SAAS

### Step 1: Build the Core Framework

Create these foundational pieces:

```
src/chart/drawing/
├── DrawingEngine.ts           # Main orchestrator (routes events to managers)
├── types.ts                   # MarkType enum, interfaces, Point
├── interfaces/
│   ├── IGraph.ts              # Copy from CandleView
│   ├── IMarkStyle.ts          # Copy from CandleView
│   ├── IMarkManager.ts        # Copy from CandleView
│   └── IDeletableMark.ts      # Copy from CandleView
├── marks/                     # Mark classes (rendering + data)
│   ├── LineSegmentMark.ts
│   ├── HorizontalLineMark.ts
│   ├── RectangleMark.ts
│   ├── FibonacciRetracementMark.ts
│   └── PencilMark.ts
└── managers/                  # MarkManagers (event handling + lifecycle)
    ├── LineSegmentManager.ts
    ├── HorizontalLineManager.ts
    ├── RectangleManager.ts
    ├── FibonacciRetracementManager.ts
    └── PencilManager.ts
```

### Step 2: Implement in Priority Order

**Phase 1 — Foundation (get the pattern working):**

1. LineSegmentMark + LineSegmentManager (simplest two-click tool)
2. HorizontalLineMark + HorizontalLineManager (simplest one-click tool)
3. Eraser functionality

**Phase 2 — Essential Trading Tools:** 4. FibonacciRetracementMark + Manager 5. RectangleMark + Manager 6. PencilMark + Manager

**Phase 3 — Expand:** 7. Vertical Line, Arrow Line 8. Parallel Channel 9. Long/Short Position markers 10. Text annotations

**Phase 4 — Advanced:** 11. All Fibonacci variants 12. Gann tools 13. Elliott Wave patterns 14. Harmonic patterns (XABCD)

### Step 3: Integration Pattern

```typescript
// In your chart component
const chart = createChart(container, options);
const series = chart.addSeries(CandlestickSeries, seriesOptions);
series.setData(ohlcvData);

// Create drawing engine
const drawingEngine = new DrawingEngine(chart, series);

// Wire up events
chart.subscribeClick((event) => {
  if (activeTool) {
    drawingEngine.handleClick(event.point, activeTool);
  }
});

chart.subscribeCrosshairMove((event) => {
  if (activeTool && event.point) {
    drawingEngine.handleMouseMove(event.point);
  }
});

// Wire up tool selection from LeftToolbar
function onToolSelect(toolId: string) {
  setActiveTool(toolId);
  drawingEngine.activateTool(toolId);
}

// Wire up clear all
function onClearAll() {
  drawingEngine.clearAllMarks();
}
```

### Step 4: Key Implementation Notes

1. **Always store marks in chart space (price/time)** — never in pixels
2. **Convert to pixels only in paneViews() draw()** — this ensures marks track correctly on scroll/zoom
3. **Use series.attachPrimitive()** — this is the ONLY way to render custom graphics within lightweight-charts
4. **Handle chart type switching** — detach all marks before removing series, re-attach after creating new series
5. **Throttle pencil points** — only add a new point every 3+ pixels to avoid performance issues
6. **Hit test in pixel space** — convert mark positions to pixels before calculating distances

---

## 15. KEY FILES TO STUDY IN CANDLEVIEW

| File                                                           | What to Learn                                    |
| -------------------------------------------------------------- | ------------------------------------------------ |
| `ChartLayer/index.tsx`                                         | How ChartLayer orchestrates everything           |
| `ChartLayer/ChartManager.ts`                                   | Chart initialization with optimal options        |
| `ChartLayer/ChartEventManager.ts`                              | Event subscription patterns                      |
| `ChartLayer/ChartMarkManager.ts`                               | Tool routing and mark lifecycle                  |
| `ChartLayer/ChartTypeManager.ts`                               | Series switching with mark re-attachment         |
| `MarkManager/LineSegment/LineSegmentMark.ts`                   | Simplest two-point mark (learn the pattern here) |
| `MarkManager/LineSegment/LineSegmentMarkManager.ts`            | Simplest manager (learn the pattern here)        |
| `MarkManager/Pencil/PencilMark.ts`                             | Multi-point freehand mark                        |
| `MarkManager/Pencil/PencilMarkManager.ts`                      | Continuous drawing manager                       |
| `MarkManager/FibonacciRetracement/FibonacciRetracementMark.ts` | Complex calculated mark                          |
| `Mark/IGraph.ts`                                               | 8 lines — mark type identity                     |
| `Mark/IMarkStyle.ts`                                           | 7 lines — style interface                        |
| `Mark/IMarkManager.ts`                                         | 27 lines — manager contract                      |
| `Mark/IDeletableMark.ts`                                       | 6 lines — eraser support                         |
| `types.ts`                                                     | All shared types and enums                       |

---

_End of Document 3_

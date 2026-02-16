# Document 2: Left Toolbar — Retrofitting Guide

**Purpose:** Integrate CandleView's Left Toolbar functionality into Trading Alerts SaaS using TradingView Lightweight Charts v5.x
**Source Reference:** `seed-code/candleview/core/src/components/CandleView/LeftPanel/`
**Date:** 2026-02-16

---

## 1. WHAT THE LEFT TOOLBAR DOES

The Left Toolbar is a vertical icon strip (50px wide) on the left side of the chart providing access to 60+ drawing and annotation tools organized into categories:

| Category | Tools Count | Purpose |
|----------|-------------|---------|
| **Cursor Styles** | 6 | Change cursor appearance |
| **Line/Channel Tools** | 14 | Trendlines, channels, pitchforks |
| **Fibonacci & Gann** | 13 | Fibonacci retracements, Gann tools |
| **Shapes & Patterns** | 16 | Shapes, Elliott waves, harmonic patterns |
| **Project Info** | 7 | Ranges, positions, mock K-line |
| **Pen/Brush Tools** | 5 | Freehand drawing, eraser |
| **Text/Annotation** | 8 | Text, labels, flags, pins, bubbles |
| **Emoji** | 26,000+ | Emoji picker |
| **AI Tools** | 10 | AI chart analysis (5 providers x 2 functions) |
| **Script Tools** | 1 | Price event scripting |
| **Utility** | 3 | Show/hide marks, lock marks, clear all |

**Key fact:** TradingView Lightweight Charts provides NONE of these tools. All 100% custom React code.

---

## 2. SOURCE FILE MAP

```
seed-code/candleview/core/src/components/CandleView/
├── LeftPanel/
│   ├── index.tsx          # Main component (2,600+ lines)
│   └── Config.ts          # All tool definitions & icon mappings (362 lines)
├── Icons/                 # SVG icon components for every tool
├── types.ts               # MarkType enum (60+ types), CursorType enum
├── ChartLayer/
│   └── ChartMarkManager.ts  # Routes tool selection to correct MarkManager
├── Mark/                  # Interfaces: IGraph, IMarkStyle, IMarkManager, IDeletableMark
└── MarkManager/           # 18 subdirectories with 60+ manager implementations
```

---

## 3. LEFT TOOLBAR — UI LAYER

### 3.1 Visual Layout (Top to Bottom)

```
┌──────┐
│  ↗   │  Cursor selector (with dropdown arrow)
├──────┤
│  ╱   │  Line/Channel tools (with dropdown arrow)
├──────┤
│  ⌇   │  Fibonacci & Gann tools (with dropdown arrow)
├──────┤
│  ◎   │  Project info tools (with dropdown arrow)
├──────┤
│  ◇   │  Shapes & patterns (with dropdown arrow)
├──────┤
│  ✎   │  Pen/Brush tools (with dropdown arrow)
├──────┤
│  T   │  Text/Annotation tools (with dropdown arrow)
├──────┤
│  {}  │  Script editor
├──────┤
│  😀  │  Emoji picker (with dropdown arrow)
├──────┤
│  AI  │  AI tools (conditional, with dropdown arrow)
├──────┤
│  >_  │  Terminal
├──────┤
│  👁  │  Show/hide all marks (toggle)
├──────┤
│  🔒  │  Lock/unlock marks (toggle)
├──────┤
│  🗑  │  Clear all marks
└──────┘
```

### 3.2 Component Props

```typescript
interface LeftPanelProps {
  chart: IChartApi;                          // lightweight-charts instance
  chartSeries: ChartSeries | null;           // Current active series
  currentTheme: ThemeConfig;                 // Dark/light theme
  i18n: I18n;                                // Internationalization
  onToolSelect: (toolId: string) => void;    // When user selects a drawing tool
  onCursorChange: (cursor: CursorType) => void;
  onAIFunctionSelect: (aiToolId: string) => void;
  onClearAllMarks: () => void;
  onToggleMarksVisibility: () => void;
  onToggleMarksLock: () => void;
  leftpanel?: boolean;                       // Show/hide left panel
  ai?: boolean;                              // Enable AI tools
  aiconfigs?: AIConfig[];                    // AI provider configurations
}
```

### 3.3 Dropdown/Submenu Pattern

Each icon button with a dropdown arrow follows this pattern:

```
1. Button renders icon + small arrow indicator
2. On hover or click → submenu appears to the right of the button
3. Submenu is grouped by category with section titles
4. Each tool item shows: icon + name + optional description
5. Clicking a tool item:
   a. Closes the submenu
   b. Updates the button icon to show last-used tool
   c. Fires onToolSelect(toolId) callback
   d. CandleView enters drawing mode for that tool
```

---

## 4. LEFT TOOLBAR — API LAYER (Tool Definitions)

### 4.1 Tool Configuration Interface

**Source:** `LeftPanel/Config.ts`

```typescript
interface ToolConfig {
  cursorStyles: Array<{
    id: string;                        // e.g., 'default', 'crosshair'
    name: string;                      // Localized display name
    description: string;               // Localized tooltip
    icon: React.ComponentType<any>;    // SVG icon component
  }>;
  penTools: Array<{ title: string; tools: Array<ToolItem> }>;
  drawingTools: Array<{ title: string; tools: Array<ToolItem> }>;
  gannAndFibonacciTools: Array<{ title: string; tools: Array<ToolItem> }>;
  irregularShapeTools: Array<{ title: string; tools: Array<ToolItem> }>;
  projectInfoTools: Array<{ title: string; tools: Array<ToolItem> }>;
  textTools: Array<{ title: string; tools: Array<ToolItem> }>;
  aiTools: Array<{ title: string; tools: Array<ToolItem> }>;
  scriptTools: Array<{ title: string; tools: Array<ToolItem> }>;
}
```

### 4.2 Complete Tool Catalog

**Cursor Styles (6):**

| Tool ID | Name |
|---------|------|
| `default` | Arrow cursor |
| `crosshair` | Crosshair cursor |
| `circle` | Circle cursor |
| `dot` | Dot cursor |
| `sparkle` | Sparkle cursor |
| `emoji` | Emoji cursor |

**Line Tools (3):**

| Tool ID | Name |
|---------|------|
| `line-segment` | Line Segment |
| `horizontal-line` | Horizontal Line |
| `vertical-line` | Vertical Line |

**Arrow Tools (2):**

| Tool ID | Name |
|---------|------|
| `arrow-line` | Arrow Line |
| `thick-arrow-line` | Thick Arrow Line |

**Channel Tools (4):**

| Tool ID | Name |
|---------|------|
| `parallel-channel` | Parallel Channel |
| `linear-regression-channel` | Linear Regression Channel |
| `equidistant-channel` | Equidistant Channel |
| `disjoint-channel` | Disjoint Channel |

**Pitchfork Tools (3):**

| Tool ID | Name |
|---------|------|
| `andrew-pitchfork` | Andrew's Pitchfork |
| `enhanced-andrew-pitch-fork` | Enhanced Andrew's Pitchfork |
| `schiff-pitch-fork` | Schiff Pitchfork |

**Gann Tools (3):**

| Tool ID | Name |
|---------|------|
| `gann-fan` | Gann Fan |
| `gann-box` | Gann Box |
| `gann-rectang` | Gann Rectangle |

**Fibonacci Tools (10):**

| Tool ID | Name |
|---------|------|
| `fibonacci-retracement` | Fibonacci Retracement |
| `fibonacci-arc` | Fibonacci Arc |
| `fibonacci-circle` | Fibonacci Circle |
| `fibonacci-spiral` | Fibonacci Spiral |
| `fibonacci-wedge` | Fibonacci Wedge |
| `fibonacci-fan` | Fibonacci Fan |
| `fibonacci-channel` | Fibonacci Channel |
| `fibonacci-time-zoon` | Fibonacci Time Zones |
| `fibonacci-extension-base-price` | Fibonacci Price Extension |
| `fibonacci-extension-base-time` | Fibonacci Time Extension |

**Technical Pattern Tools (4):**

| Tool ID | Name |
|---------|------|
| `xabcd` | XABCD Harmonic Pattern |
| `head-and-shoulders` | Head and Shoulders |
| `abcd` | ABCD Pattern |
| `triangle-abcd` | Triangle ABCD |

**Elliott Wave Tools (5):**

| Tool ID | Name |
|---------|------|
| `elliott-lmpulse` | Elliott Impulse Wave |
| `elliott-corrective` | Elliott Corrective Wave |
| `elliott-triangle` | Elliott Triangle |
| `elliott-double-combo` | Elliott Double Combination |
| `elliott-triple-combo` | Elliott Triple Combination |

**Shape Tools (7):**

| Tool ID | Name |
|---------|------|
| `rectangle` | Rectangle |
| `circle` | Circle |
| `ellipse` | Ellipse |
| `triangle` | Triangle |
| `sector` | Sector |
| `curve` | Curve |
| `double-curve` | Double Curve |

**Range & Position Tools (6):**

| Tool ID | Name |
|---------|------|
| `time-range` | Time Range |
| `price-range` | Price Range |
| `time-price-range` | Time-Price Range |
| `heat-map` | Heat Map |
| `long-position` | Long Position |
| `short-position` | Short Position |

**Simulation Tool (1):**

| Tool ID | Name |
|---------|------|
| `mock-kline` | Mock K-Line |

**Pen Tools (5):**

| Tool ID | Name |
|---------|------|
| `pencil` | Pencil (freehand) |
| `pen` | Pen (smooth curves) |
| `brush` | Brush (thick strokes) |
| `marker-pen` | Marker Pen (highlight) |
| `eraser` | Eraser (delete by touching) |

**Text & Annotation Tools (8):**

| Tool ID | Name |
|---------|------|
| `text` | Text Edit |
| `price-note` | Price Note |
| `bubble-box` | Bubble Box |
| `pin` | Pin |
| `signpost` | Signpost |
| `price-label` | Price Label |
| `flag-mark` | Flag Mark |
| `image` | Image |

**Script Tools (1):**

| Tool ID | Name |
|---------|------|
| `price-event` | Price Event |

---

## 5. LEFT TOOLBAR — BACKEND LOGIC (Tool Selection Flow)

### 5.1 Tool Selection → Drawing Mode Activation

```
User clicks tool in LeftPanel (e.g., 'fibonacci-retracement')
    ↓
LeftPanel.onToolSelect('fibonacci-retracement')
    ↓
CandleView sets state:
  - activeTool = 'fibonacci-retracement'
  - Passes activeTool to ChartLayer
    ↓
ChartLayer.ChartMarkManager routes tool to correct MarkManager:
  - 'fibonacci-retracement' → FibonacciRetracementMarkManager
    ↓
MarkManager enters drawing mode:
  - state.isFibonacciRetracementMode = true
  - Cursor changes to crosshair
  - Mouse events now handled by FibonacciRetracementMarkManager
```

### 5.2 Tool ID → MarkType → MarkManager Mapping

The ChartMarkManager acts as a router, mapping tool IDs to their corresponding MarkManager:

```typescript
// Simplified routing logic from ChartMarkManager
function getManagerForTool(toolId: string): IMarkManager {
  switch (toolId) {
    // Lines
    case 'line-segment':        return lineSegmentMarkManager;
    case 'horizontal-line':     return horizontalLineMarkManager;
    case 'vertical-line':       return verticalLineMarkManager;
    case 'arrow-line':          return arrowLineMarkManager;
    case 'thick-arrow-line':    return thickArrowLineMarkManager;

    // Channels
    case 'parallel-channel':    return parallelChannelMarkManager;
    case 'equidistant-channel': return equidistantChannelMarkManager;
    // ... etc for all 60+ tools

    // Pen tools
    case 'pencil':              return pencilMarkManager;
    case 'pen':                 return penMarkManager;
    case 'brush':               return brushMarkManager;
    case 'eraser':              return eraserMarkManager;

    // Fibonacci
    case 'fibonacci-retracement': return fibonacciRetracementMarkManager;
    // ... etc
  }
}
```

### 5.3 MarkType Enum (Complete)

Every tool maps to a specific MarkType used for mark identification and serialization:

```typescript
enum MarkType {
  // Lines
  LineSegment, ArrowLine, ThickArrowLine, HorizontalLine, VerticalLine,
  // Channels
  ParallelChannel, LinearRegressionChannel, EquidistantChannel, DisjointChannel,
  // Pitchforks
  AndrewPitchfork, EnhancedAndrewPitchfork, SchiffPitchfork,
  // Shapes
  Rectangle, Circle, Ellipse, Sector, Triangle,
  Curve, DoubleCurve,
  // Gann
  GannFan, GannBox, GannRectangle,
  // Fibonacci
  FibonacciTimeZoon, FibonacciRetracement, FibonacciArc, FibonacciCircle,
  FibonacciSpiral, FibonacciWedge, FibonacciFan, FibonacciChannel,
  FibonacciExtensionBasePrice, FibonacciExtensionBaseTime,
  // Patterns
  XABCD, HeadAndShoulders, ABCD, TriangleABCD,
  // Elliott
  Elliott_Impulse, Elliott_Corrective, Elliott_Triangle,
  Elliott_Double_Combination, Elliott_Triple_Combination,
  // Ranges
  TimeRange, PriceRange, TimePriceRange,
  // Pen tools
  Pencil, Pen, Brush, MarkerPen, Eraser,
  // Annotations
  Text, Emoji, Image, Table,
  LongPosition, ShortPosition, PriceLabel, Flag, PriceNote, SignPost, Pin, BubbleBox,
  TextEdit,
  // Special
  MockKLine, HeatMap, TimeEvent, PriceEvent
}
```

### 5.4 Utility Button Logic

**Show/Hide All Marks (Eye Toggle):**

```
User clicks eye icon
    ↓
Toggle state: marksVisible = !marksVisible
    ↓
For each mark in allMarks:
  if marksVisible:
    series.attachPrimitive(mark)   // Show
  else:
    series.detachPrimitive(mark)   // Hide
```

**Lock/Unlock Marks (Lock Toggle):**

```
User clicks lock icon
    ↓
Toggle state: marksLocked = !marksLocked
    ↓
When marksLocked:
  - Mouse events on marks are ignored
  - Marks cannot be dragged, edited, or deleted
  - Drawing mode is disabled
```

**Clear All Marks (Trash):**

```
User clicks trash icon
    ↓
Confirmation prompt (optional)
    ↓
For each mark in allMarks:
  series.detachPrimitive(mark)
    ↓
Clear all mark arrays in all MarkManagers
Reset all drawing state
```

### 5.5 Cursor Change Logic

```
User selects cursor style (e.g., 'crosshair')
    ↓
CandleView.onCursorChange(CursorType.Crosshair)
    ↓
Chart container element: container.style.cursor = 'crosshair'
    ↓
For custom cursors (circle, dot, sparkle, emoji):
  - CSS cursor is set to 'none'
  - Custom cursor drawn on canvas overlay following mouse position
```

---

## 6. MARK INTERFACES (Contracts for All Drawing Tools)

Every drawing tool's mark object must implement these interfaces:

### 6.1 IGraph — Type Identity

```typescript
// Source: Mark/IGraph.ts
interface IGraph<T = any> {
  getMarkType(): MarkType;  // Returns which tool type this mark is
}
```

### 6.2 IMarkStyle — Style Management

```typescript
// Source: Mark/IMarkStyle.ts
interface IMarkStyle {
  updateStyles(styles: { [key: string]: any }): void;  // Apply style changes
  getCurrentStyles(): Record<string, any>;              // Get current styles
}
```

### 6.3 IMarkManager — Manager Contract

```typescript
// Source: Mark/IMarkManager.ts
interface IMarkManager<T = any> {
  getCurrentDragTarget(): T | null;       // Mark being dragged
  getCurrentDragPoint(): string | null;   // Which handle ('start', 'end', 'line')
  getCurrentOperatingMark(): T | null;    // Mark being operated on
  isOperatingOnChart(): boolean;          // Is user interacting with a mark?
  getAllMarks(): T[];                     // All marks of this type
  cancelOperationMode(): any;            // Cancel current drawing
  getMarkAtPoint(point: Point): T | null; // Hit test at coordinates
  clearState(): void;                    // Reset state
}
```

### 6.4 IDeletableMark — Eraser Support

```typescript
// Source: Mark/IDeletableMark.ts
interface IDeletableMark {
  isPointNearPath(x: number, y: number, threshold?: number): boolean;  // Hit test for eraser
  getMarkType(): MarkType;
}
```

---

## 7. RETROFITTING PLAN FOR TRADING ALERTS SAAS

### Step 1: Determine Which Tools You Need

**Recommended priority for a trading alerts platform:**

**Phase 1 — Essential (start here):**
- Line Segment, Horizontal Line, Vertical Line
- Fibonacci Retracement
- Rectangle
- Text annotation
- Pencil (freehand)
- Eraser
- Show/hide, lock, clear all

**Phase 2 — Important:**
- Arrow Line
- Parallel Channel
- Long Position / Short Position
- Price Range, Time Range
- Price Label, Flag

**Phase 3 — Advanced:**
- All Fibonacci tools
- Gann tools
- Elliott Wave patterns
- XABCD / Head and Shoulders
- All channel types
- All pen/brush variants

**Phase 4 — Optional:**
- AI tools
- Emoji picker
- Script tools
- Custom cursors

### Step 2: Build the LeftToolbar Component

```
<div style="display: flex; height: 100%">
  <LeftToolbar
    onToolSelect={handleToolSelect}
    onCursorChange={handleCursorChange}
    onClearAll={handleClearAll}
    onToggleVisibility={handleToggleVisibility}
    onToggleLock={handleToggleLock}
    activeTool={activeTool}
    theme={theme}
  />
  <div style="flex: 1; position: relative">
    <TopBar ... />
    <div ref={chartContainerRef}>
      <!-- lightweight-charts renders here -->
    </div>
  </div>
</div>
```

### Step 3: Implement Tool Router

Create a ChartMarkManager that routes tool selections to the correct MarkManager:

```typescript
class ChartMarkManager {
  private managers: Map<string, IMarkManager> = new Map();

  constructor(chart: IChartApi, series: ISeriesApi) {
    this.managers.set('line-segment', new LineSegmentMarkManager(chart, series));
    this.managers.set('horizontal-line', new HorizontalLineMarkManager(chart, series));
    this.managers.set('fibonacci-retracement', new FibonacciRetracementMarkManager(chart, series));
    // ... register managers for each tool
  }

  activateTool(toolId: string) {
    this.deactivateAll();
    const manager = this.managers.get(toolId);
    if (manager) manager.activate();
  }

  handleMouseDown(point: Point) {
    const activeManager = this.getActiveManager();
    if (activeManager) activeManager.handleMouseDown(point);
  }
  // ... handleMouseMove, handleMouseUp
}
```

### Step 4: Port Mark Implementations

For each tool you need, port the corresponding Mark and MarkManager from CandleView:

```
CandleView Source → Your Implementation
Mark/LineSegment/LineSegmentMark.ts → marks/LineSegmentMark.ts
MarkManager/LineSegment/LineSegmentMarkManager.ts → managers/LineSegmentManager.ts
```

Each mark uses lightweight-charts' `paneViews()` primitive API for rendering. See Document 3 (Drawing Engine) for detailed implementation patterns.

---

## 8. KEY FILES TO STUDY IN CANDLEVIEW

| File | Lines | What to Learn |
|------|-------|---------------|
| `LeftPanel/index.tsx` | ~2,600 | Full toolbar UI, dropdown/submenu rendering, tool selection handlers |
| `LeftPanel/Config.ts` | ~362 | Complete tool catalog with IDs, names, icons, grouping |
| `types.ts` | ~322 | MarkType enum (60+ types), CursorType, all shared types |
| `Mark/IGraph.ts` | 8 | Mark type identity interface |
| `Mark/IMarkStyle.ts` | 7 | Mark styling interface |
| `Mark/IMarkManager.ts` | 27 | Mark manager contract |
| `Mark/IDeletableMark.ts` | 6 | Eraser hit-test interface |
| `ChartLayer/ChartMarkManager.ts` | ~800 | Tool routing, mark lifecycle orchestration |
| `Icons/` | varies | SVG icon components for every tool |

---

*End of Document 2*

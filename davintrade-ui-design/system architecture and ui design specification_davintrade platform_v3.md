# SYSTEM ARCHITECTURE & UI DESIGN SPECIFICATION: DAVINTRADE PLATFORM

## 1. Executive Summary & Design Philosophy

The DavinTrade application is an institutional-grade, multi-asset quantitative trading dashboard designed to eliminate emotional interpretation and trade execution friction. Unlike traditional charting sandboxes that rely on subjective manual drawing, DavinTrade operates as an objective mathematical rendering engine.

The core architectural philosophy is rooted in **Distributed Layer Separation** and **Progressive Disclosure**, cleanly dividing massive macro-temporal data streams from precise, hyper-focused micro-execution triggers.

### The Psychological Advantage of Two Panels

Traders relying on real-time automated alerts must parse structural logic instantly to make rapid decisions under volatile market conditions.

- **Top Panel (The Map):** Houses the heavy quantitative mathematics—including the Primary, Secondary, and Impulsive Equidistant Trend (EDT) channels alongside the M15 Singular Spectrum Analysis (SSA) baseline. It answers a single macro question: _"Where are we in the macro structure, and what is the directional bias?"_

- **Bottom Panel (The Trigger):** Strips away the channel lines to focus purely on the noise-filtered ZigZag trend vector and Equal High/Low (EQH/EQL) pivot logic. It answers the immediate execution question: _"Is there an executable pattern forming right now?"_

---

## 2. Workspace Layout Grid (The 75/25 Layout)

The web application utilizes a fixed viewport layout optimized for standard 16:9 desktop monitors, structured via a razor-sharp asymmetric layout.

```css
/* Core Layout Blueprint */
.davin-dashboard-container {
  display: grid;
  grid-template-columns: 75fr 25fr;
  height: 100vh;
  width: 100vw;
  background-color: #0c0f12; /* Deep Obsidian */
  overflow: hidden;
}
```

### 2.1 The Left Charting Canvas (75% Width)

A vertical flex column containing two independent charting panes bound tightly to the same asset timeline:

- **Top Pane (Macro View):** Occupies a default baseline height of **60%**.
- **Bottom Pane (Micro View):** Occupies a default baseline height of **40%**.
- **The Resizer & Collapse Engine:** Panels are separated by a sleek, 4px horizontal divider bar (`#1c2229`) that serves as an interactive splitter. It changes the cursor to `row-resize` on hover, allowing users to dynamically drag the partition to adjust vertical ratios on the fly. For maximum screen space flexibility, power users can completely collapse the bottom pane into a minimized tray when they wish to focus exclusively on macro trend tracking.

```text
+-------------------------------------------------------------+
|  TOP CANVAS (MACROCONTEXT) - 60% HEIGHT                     |
|                                                             |
|   [Candlesticks/Bars] + [M15 SSA Trend Curves]              |
|   [WLS CFL Regression Boundaries + Outermost UOEDT / LOEDT] |
|   [DBSCAN Convex Hull Polygons + Mass Centroid Stars]       |
|   [Ex-Ante Target Line + Structural Invalidation Line]      |
|                                                             |
+====================== Splitter Resizer Bar =================+
|  BOTTOM CANVAS (MICRO EXECUTION TARGET) - 40% HEIGHT        |
|                                                             |
|   [Pure ZigZag Segment Array]                               |
|   [Python-Validated Invalidation EQH / EQL Horizontal Lines]|
|                                                             |
+-------------------------------------------------------------+

```

### 2.2 The Right AI Radar Feed (25% Width)

A fixed structural sidebar workspace housing an independent, scrolling scrolling viewport layout (`overflow-y: auto;`). It streams the real-time chronological data payloads pushed directly from the Python backend automation.

---

## 3. Dual-Panel Canvas Specifications

### 3.1 Top Canvas Components (The Layer Manager View)

The Top Panel handles multi-dimensional quantitative models. To prevent visual overload, it features an overlay layer system allowing users to independently toggle **12 separate mathematical states**. These components must be managed through an independent layer-rendering loop control system:

1. **Candlesticks:** Traditional OHLC price candles.
2. **Price Bars:** Minimalist high-low tick bars without wick bodies, designed to reduce visual noise.
3. **SSA Curve:** The underlying, non-linear smoothed polynomial trend line (`ExtSSATrend`).
4. **EMA-SSA Curve:** Signal baseline derived from an exponential moving average of the spectrum dataset (`ExtSSASignal`).
5. **SSA Cross Markers:** High-visibility arrows painted precisely at the intersection coordinates of the SSA and EMA-SSA arrays (`ExtSSACross`).
6. **108 Fractals:** High-contrast pivot labels mapping significant historical swing highs and lows (`ExtUpper108`/`ExtLower108`).
7. **119 Fractals:** Fast, hyper-responsive local micro-fractal targets (`ExtUpper119`/`ExtLower119`).
8. **Regression Grid (Base FL + CFL + LOEDT + UOEDT):** The primary boundary envelope. Comprises the center anchor line, the Upper Outermost Equidistant Trend line (UOEDT), and the Lower Outermost Equidistant Trend line (LOEDT).
9. **Cluster Polygons:** Translucent Convex Hull shading tracing the spatial boundaries calculated by the unsupervised machine learning backend.
10. **Cluster Centroids:** Geometric mass centers (stars) representing the focus nodes of each cluster.
11. **Structural Invalidation Line:** A solid Red horizontal line plotting the exact coordinate where the current setup mathematically fails.
12. **Ex-Ante Target Line:** A solid Green horizontal line plotting the dynamic mathematical exhaustion target.

### 3.2 Bottom Canvas Components (The Absolute Trigger Matrix)

The Bottom Panel isolates immediate structural execution triggers. Unlike the top panel, **this canvas is completely fixed and non-configurable**. Users are restricted from turning off or hiding any of its components:

1. **Pure ZigZag Line:** A noise-filtered continuous segment connecting major alternating market peaks and troughs.
2. **EQH / EQL Horizontal Lines:** Absolute support/resistance boundaries generated when consecutive peaks (Equal Highs) or troughs (Equal Lows) align within a strict tolerance window.

### 3.3 Visual Noise Control Filters

- **The "Clean Chart" Toggle Hotkey:** To mitigate multi-asset volatility tracking fatigue, the UI features a dedicated global hotkey. Pressing and holding the **Spacebar** instantly hides all regression channel lines, cluster shapes, and fractal nodes across the screen, revealing only the raw price action and the clean M15 SSA curve. Releasing the Spacebar immediately restores the full layered configuration.

- **Smart Y-Axis Labeling:** To maintain complete numerical clarity, the Y-axis axis scale is dynamically pruned. The canvas is forbidden from rendering overlapping price tags for all active channels simultaneously. Instead, it must only render the exact price tags for the specific `UOEDT` and `LOEDT` boundaries that the live market price is currently closest to.

### 3.4 Complete Canvas Synchronization Rules

- **Axis Lock Synchronization:** Panning or zooming inside _either_ pane via mouse interaction must instantly force the opposing pane to match the exact same timeline coordinates and bar indices.
- **Linked Crosshair Tracker:** Moving the cursor crosshair inside either workspace projects a continuous vertical indicator line that spans straight through both panes simultaneously, allowing immediate visual alignment across the separate charting spaces.

---

## 4. The Alphanumeric Letter-Mapping Blueprint

To bypass heavy frontend interactive overhead and maintain fast canvas rendering speeds, the application uses an elegant coordinate marker mapping layout. The Python backend processes incoming MT5 data frames and appends a `marker_id` column to the data pipeline, which the web interface maps onto the timeline canvas as uniform textile objects.

```text
TOP CANVAS (MACRO CONTEXT)
                      (A) <--- [M15 SSA hits UOEDT and rolls over]
                       *  <--- Cluster Centroid Star
                      /
====================================================================
BOTTOM CANVAS (MICRO EXECUTION)
                     |
                     |    <--- [Instantaneous Vertical Axis Correlation]
                     |
                     (A)  <--- [Unconfirmed ZigZag Peak triggers EQH Alert]
                      /\
                     /  \

```

### 4.1 Top Panel Mapping (Macro Context)

When an early warning event occurs, a clean, high-contrast text bubble maps directly to the absolute price coordinates:

- **The Reversal Marker (Bubble "A"):** If the M15 SSA Trend strikes the dynamic Upper Outermost EDT (UOEDT) boundary and rolls over, a sharp circle bubble **"A"** is plotted directly over the corresponding cluster centroid star.

- **The Breakdown Marker (Bubble "B"):** The exact second the smoothed spectrum curve breaches the Lower Outermost EDT (LOEDT) support line, a letter bubble **"B"** anchors immutably onto that specific breakdown candlestick.

### 4.2 Bottom Panel Mapping (Micro Execution)

Because the horizontal time-axis is completely locked between both canvas frames, the letter markers run vertically down the screen layout, bridging the two panels together with a clear spatial link:

- **The Exhaustion Mirror:** Directly underneath the top panel's **"A"** marker, the bottom panel renders an identical **"A"** bubble directly over the unconfirmed ZigZag peak that triggered the Equal High (EQH) calculation alert.

- This vertical geometry allows a trader's eye to draw an instantaneous structural correlation: the top chart displays a major resistance hit at **"A"**, while the bottom chart simultaneously confirms an active double top exhausting at **"A"**.

### 4.3 FIFO Queue Lifecycle Manager

- **Milestone Queue Size:** The user interface maintains a maximum buffer of **15 active milestone markers** on the screen at any single time.
- **The Rolling Flush:** The moment marker #16 is initialized by the socket, the oldest instance (marker #1) is flushed from the visual array, preventing chart congestion.
- **The Index Loop:** Markers map sequentially from character **A to Z**. If a trading session overflows past Z within the active 15-marker screen limit, the engine loops back and appends a sequence increment (e.g., **A1, B1, C1**).

---

## 5. Streamlined Sidebar Feed & Progressive Disclosure

The right-hand panel behaves as the decoding legend for the symbols drawn on the canvas, providing short, context-driven entries that act as a Chronological Ledger of Facts. **(Note: Ex-Ante data is intentionally excluded from this feed to prioritize instant execution readability in a separate HUD).**

### 5.1 Unified 3-Line Card Structure

Alert tokens print downwards chronologically inside unified, minimalist component card elements:

```text
+--------------------------------------------------------+
| [G]  14:15 - Active                                (i) |
| Event: Testing Secondary LOEDT support vector.         |
| Trigger: Unconfirmed ZigZag leg forming a developing EQL|
+--------------------------------------------------------+

```

- **Line 1 (The Anchor):** `[Letter Symbol] [Timestamp] - [Status Stage]` (e.g., _Active_ for live unconfirmed legs, or _Complete/Invalidated_ for older milestones).

- **Line 2 (The Structural Event):** Identifies the exact EDT line being crossed or rejected based on the M15 SSA or Base Line outputs.

- **Line 3 (The Execution Trigger):** States the raw structural pattern verified by the Python script utilizing your ZigZag peak and bottom logic.

### 5.2 Real-World Feed Examples

> **[G] 14:15 - Active** ⓘ
> **Event:** Testing Secondary LOEDT support vector.
> **Trigger:** Unconfirmed ZigZag leg forming a developing EQL.

> **[F] 13:45 - Complete** ⓘ
> **Event:** Secondary UOEDT + Impulsive UOEDT confluence resistance hit.
> **Trigger:** Confirmed ZigZag EQH pattern with a 0.02% variance.

---

## 6. Dynamic Ex-Ante Price Target & Execution HUD (Fixed Panel)

To allow the trader to grasp trading decisions instantly, the execution metrics are **removed from the scrolling sidebar feed**. Instead, they are housed in a dedicated, fixed-position Heads-Up Display (HUD) Card.

To maintain a completely unobstructed view of the charting canvas, **this HUD is locked persistently at the absolute top of the right-hand sidebar (The AI Radar Feed column).** It acts as a "sticky header"—while the chronological event ledger scrolls freely beneath it, the active Ex-Ante execution geometry remains permanently pinned to the top right of the user's screen so it never leaves their line of sight.

### 6.1 The Fixed Execution HUD Layout

```text
+-------------------------------------------------------------+
| 🎯 ACTIVE EX-ANTE PROJECTION                             (i) |
| 🧭 Trade Side:              SELL                             |
| 🟢 Max Target Price:        4515.00                      (i) |
| 🔴 Structural Invalidation: 4560.00                      (i) |
| ⚖️ Indicative R:R Ratio:    1 : 2.44                     (i) |
+-------------------------------------------------------------+

```

### 6.2 Progressive Disclosure (Info Balloon Architecture)

To keep the application pristine for professional operators while providing an accessible onboarding track for beginner traders, technical terms feature progressive disclosure triggers. A low-opacity info icon (`ⓘ`) sits adjacent to complex terms.

- **The Info Balloon Toggle:** A low-opacity info icon (`ⓘ`) sits adjacent to complex terms inside each card (e.g., `LOEDT`, `UOEDT`, `EQL`, `SSA Cross`).
- **Hover State UI:** Hovering over the `ⓘ` indicator pulls up a lightweight CSS tooltip detailing a crisp, 1-sentence mechanical definition of that term.
- **Click State UI:** Clicking the balloon launches a sleek, non-intrusive modal container drawer on the side of the viewport.

**Execution HUD Glossary Copy:**

- **Active Ex-Ante Projection ⓘ:** _"A mathematical projection of future price geometry based on the most recent structural breakout. All metrics are dynamically calculated using the current active market price against the channel boundaries."_
- **Structural Invalidation ⓘ:** _"This is the conceivable price level calculated by the system where the current breakout (breakup or breakdown) becomes invalid and is deemed a fakeout. Traders should manage their risk and execute independent stop-loss procedures once price touches this level to prevent further capital aggravation."_
- **Ex-Ante Max Target ⓘ:** _"This is the conceivable maximum target price projected by the system that the current momentum could reach. You should conservatively set your personal take-profit level to NOT EXCEED this price."_
- **Indicative R:R Ratio ⓘ:** _"This is an indicative Risk-to-Reward ratio calculated purely from the Current Close Price, the Ex-Ante Max Target, and the Structural Invalidation level. It strictly EXCLUDES execution spread and broker commissions. Your own personal R:R Ratio must be configured to be less than this indicative parameter."_

### 6.3 The External YouTube Video Canvas Frame Integration

To maintain small web footprint sizes and prevent native video render loops from slowing down the chart canvas pipeline, the application contains **zero native multimedia files**.

- **The Video Redirect Link:** Every educational modal drawer includes an external URL reference point linked to your dedicated YouTube tutorial repository.
- **The IFrame Theater Player Wrapper:** When launched, the pop-up modal initializes an inline player wrapper using the native `YouTube IFrame Player API`. This allows a short looping tutorial animation demonstrating the specific pattern geometry to stream cleanly directly inside the app workspace without forcing a browser tab redirect away from the live trading session window.

---

## 7. Frontend Layer Control Toolbar

To control the 12 dynamic variables inside the Top Panel (Macro Canvas), a minimalist, semi-transparent user overlay control container sits floating in the top-right corner of the left screen canvas.

### 7.1 Interface Controls Layout

The toolbar uses a flat, dark theme UI style (`background: rgba(20, 26, 31, 0.85); backdrop-filter: blur(8px);`). Toggles are grouped logically into simple, uniform vertical blocks using crisp, colored toggle checkboxes:

```text
[ LAYER CONTROL ]-------------------------------------
  PRICE CORE GEOMETRY
  [x] Candlesticks       [ ] Price Bars Only
  [x] SSA Smoothed Curve [x] EMA-SSA Signal Line
  [x] SSA Cross Markers

  CLUSTERING & DYNAMIC BOUNDARIES
  [x] Core EDT Channels  [ ] DBSCAN Convex Hulls
  [x] Centroid Gravity Nodes

  STRUCTURAL BREAKOUT NOISE
  [ ] 108 Swing Fractals [ ] 119 Micro-Fractals

  EX-ANTE PROJECTIONS
  [x] Target & Invalidation Lines
------------------------------------------------------

```

---

## 8. Recommended Production Stack & Engineering Directives

Developers implementing via Claude Code and Claude Design must strictly adhere to the following technical production configurations:

### 8.1 Charting Engine Selection

- **Library:** `TradingView Lightweight Charts` (HTML5 Canvas Engine).
- **Rationale:** Provides high-performance tick rendering across dense historical datasets while natively supporting crosshair synchronization links and vertical axis alignment arrays out of the box.

### 8.2 Data Stream Ingestion Core

- **Protocol:** `WebSockets`.
- **Mechanism:** Your Python backend continuously monitors the MT5 file outputs. The millisecond a data modification changes on disk at the 59th second of an execution loop, Python emits a uniform serialized JSON payload package through the WebSocket channel directly to the frontend application layer, replacing traditional, sluggish browser polling methods entirely.

### 8.3 Palette & Theming Configuration (Design System Override)

> **⚠️ ENGINEERING DIRECTIVE: DESIGN SYSTEM INHERITANCE**
> Claude Design and Claude Code must **strictly ignore** any hardcoded hex values, localized color codes, or temporary color suggestions (e.g., `#0c0f12`, `#ff8c00`, `#9400d3`) mentioned in any previous architectural discussions or wireframes.

To ensure absolute brand consistency and frontend scalability, all UI rendering must inherit directly from the pre-established **DavinTrade App UI Design System**.

- **Global Theme Tokens:** Map all container backgrounds, grid boundaries, and typographic elements directly to the established semantic color variables already prepared for the DavinTrade application (e.g., `var(--theme-bg-primary)`, `var(--theme-border-muted)`).
- **Canvas & Indicator Palette:** The 12 Top Canvas components and all Execution HUD text/icons must strictly utilize the pre-approved DavinTrade charting shades.
- **Semantic State Colors:** Actionable geometries (like the Red Structural Invalidation Line and Green Ex-Ante Target Line) must use the specific semantic "Danger/Risk" and "Success/Target" shades natively defined in the DavinTrade design library.

---

### DAVINTRADE: Web UI Layout Blueprint (16:9 Desktop View)

```text
===================================================================================================
|  DAVINTRADE DASHBOARD [ XAUUSD ] [ M15 SSA + EDTs ]                                     [ ⚙️ ]  |
===================================================================================================
|                                                                     |                           |
|  [ TOP CANVAS: MACRO VIEW ] (75% Width, 60% Height)                 | [ FIXED EXECUTION HUD ]   |
|                                                                     | +-----------------------+ |
|   4750.00 |                 * (A)                                   | | 🎯 EX-ANTE PROJECTION | |
|           |                / \                                      | | 🧭 Trade Side: SELL   | |
|   4700.00 |--- UOEDT -----/---\---------------------------          | | 🟢 Target: 4515.00    | |
|           |              /     \                                    | | 🔴 Inval:  4560.00    | |
|   4650.00 |....... SSA ./.......\.........................          | | ⚖️ R:R Ratio: 1:2.44  | |
|           |            /         \                                  | +-----------------------+ |
|   4600.00 |- - - - - -/- - - - - -\- - 🔴 Structural Invalidation   |                           |
|           |          /             \                                | [ SCROLLING AI FEED ]     |
|           |         /               \      +--------------------+   |                           |
|   4550.00 |--- LOEDT/----------------\-----| [ LAYER CONTROL ]  |   | [H] 15:30 - CONFIRMED ⓘ |
|           |        /       (B)        \    | [x] Candlesticks   |   | Event: SSA crosses      |
|   4500.00 |       /                    \   | [x] SSA Smoothed   |   |        Secondary LOEDT. |
|           |      /                      \  | [x] EDT Channels   |   |                         |
|   4450.00 |==============================\= 🟢 Max Target Line  |   | [G] 14:15 - Active    ⓘ |
|                                           \+--------------------+   | Event: Test Sec LOEDT   |
|============================================\========================| Trigger: EQH formed     |
|   ^ 4px Draggable Splitter Resizer Bar ^    \                       |                         |
|                                              \                      | [F] 13:45 - Complete  ⓘ |
|  [ BOTTOM CANVAS: MICRO VIEW ] (40% Height)   \                     | Event: UOEDT confluence |
|                                                \                    | Trigger: EQH formed     |
|           |                 (A)                 \                   |                         |
|           |                 /\                   \                  | [E] 12:10 - Complete  ⓘ |
|           |                /  \                   \                 | Event: Base Line Hold   |
|           |               /    \                   \                | Trigger: EQL formed     |
|           |              /      \                   \               |                         |
|           |             /        \                   \              | [D] 11:30 - Inval     ⓘ |
|           |------------/----------\-------------------\--- (EQH)    | Event: UOEDT Breach     |
|           |           /            \                   \            | Trigger: Invalidated    |
|           |          /              \                   \           |                         |
|           |         /                \                   \          | [C] 10:45 - Complete  ⓘ |
|           |        /                  \                   \         | Event: Primary LOEDT    |
|           |       /                    \                   \        | Trigger: Double Bottom  |
|           |      /                      \                   \       |                         |
|=================================================================================================|

```

### Key Architectural Translations in the Wireframe:

- **The 75/25 Grid:** The distinct vertical line separating the charting canvas on the left from the data columns on the right represents your CSS grid strict-split.
- **The HUD Anchor:** The `[ FIXED EXECUTION HUD ]` is locked perfectly into the top-right corner. It is boxed off to signify that it does not move, keeping the critical numerical limits (4515.00 and 4560.00) in permanent view.
- **The Layer Control Placement:** The floating Layer Manager is anchored on the top canvas in the bottom right corner (or top right, depending on price action), utilizing a semi-transparent background so it doesn't entirely block the candles behind it.
- **The Vertical Mapping (A & B):** You can clearly see how marker **(A)** on the Top Canvas directly aligns on the X-axis with marker **(A)** on the Bottom Canvas, forcing the trader's eyes to correlate the macro UOEDT rejection with the micro EQH formation.
- **The Progressive Disclosure Icons:** The `ⓘ` indicators are consistently placed on the right-hand side of the feed events, waiting for a user click to trigger the YouTube IFrame modals.

---

Clarification for those three specific UI behaviors to ensure Claude Code and Claude Design implement the constraints correctly.

### 1. Does the Layer Control Panel need to be collapsible or hidden?

**Yes, absolutely.**
Floating panels should never permanently obscure the charting canvas. Because the Top Canvas contains critical, dynamic price action, the Layer Control panel must act as a **toggleable overlay**.

- **Default State:** Hidden (Collapsed).
- **Interaction:** The gear icon `[ ⚙️ ]` located in the top-right header of the wireframe acts as the trigger button. When the user clicks the gear, the Layer Control panel drops down or slides in. When they click anywhere outside the panel (or click the gear again), the panel smoothly hides itself.
- **Why this matters:** This keeps the UI perfectly clean 99% of the time, only revealing the 12 layer checkboxes when the trader actively wants to reconfigure their screen.

### 2. Is 60% Height the _minimum_ height for the Top Canvas?

**No, 60% is the _default starting_ height, not the strict minimum.**
When a user first logs into the DavinTrade dashboard, the screen perfectly splits at 60/40. Because there is a draggable splitter bar, the user has the freedom to adjust this.

However, from an engineering perspective, you must set a **CSS `min-height` constraint** to prevent the user from breaking the UI.

- **The Practical Minimum:** The top canvas houses 12 layers of heavy mathematical data (channels, clusters, SSA curves). If a user drags the resizer bar too high, squishing the top canvas to 10% or 20% of the screen, the channels will become an illegible, overlapping mess.
- **The Code Implementation:** You should instruct Claude Code to set a CSS `min-height: 40vh` (40% viewport height) for the Top Canvas. This means a user can shrink the top macro chart from 60% down to 40%, but the system will physically stop them from shrinking it any further to protect the visual fidelity of the mathematics.

### 3. Is 40% Height the _maximum_ height for the Bottom Canvas?

**Functionally yes, though it is primarily the _default starting_ height.**
The Bottom Canvas only displays extremely minimalist, clean data: a single ZigZag line and horizontal EQH/EQL lines. It does not need massive vertical screen real estate to be readable.

- **The Interaction:** If the Top Canvas has a minimum height of 40% (as established above), it means the absolute maximum height the user could possibly drag the Bottom Canvas to is 60%.
- **The Collapse Feature:** More importantly, as established in Section 2.1 of your v3 document, the Bottom Canvas can be **fully collapsed (0% height)**. If a user double-clicks the resizer bar, the bottom canvas should snap shut, temporarily giving the Top Canvas 100% of the screen height for deep macro analysis.

### Summary for your Developers (Claude Code / Claude Design):

You can pass them these exact CSS constraints to govern the resizer bar behavior:

- **Top Canvas:** Default Height: `60%` | Minimum Height: `40%` | Maximum Height: `100%`
- **Bottom Canvas:** Default Height: `40%` | Minimum Height: `0%` (Collapsible) | Maximum Height: `60%`
- **Layer Control Panel:** `position: absolute`, `display: none` by default, toggled to `display: block` via the gear icon.

---

# Frontend Architecture — Next.js v16 + TradingView Lightweight Charts

**Document Type:** Frontend Architecture Design
**Version:** 1.0
**Date:** February 8, 2026
**Companion To:** Agentic AI Trading Model Architecture Blueprint v2.1, Agentic RAG Implementation Architecture v1.0, NestJS Backend Architecture v1.0
**Purpose:** Define the complete frontend architecture for the DavinTrade conversational trading AI SaaS, covering component hierarchy, state management, chart integration, real-time data flow, and dynamic instrument synchronization
**Target Stack:** Next.js v16 (Vercel), TradingView Lightweight Charts v4+, Zustand (state management), Socket.IO Client (WebSocket)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Component Hierarchy](#2-component-hierarchy)
3. [State Management — Zustand Store Design](#3-state-management--zustand-store-design)
4. [Dynamic Instrument Synchronization](#4-dynamic-instrument-synchronization)
5. [TradingView Lightweight Charts Integration](#5-tradingview-lightweight-charts-integration)
6. [S/R Data Card Components](#6-sr-data-card-components)
7. [Chat Panel Architecture](#7-chat-panel-architecture)
8. [WebSocket Client Layer](#8-websocket-client-layer)
9. [Page Layout and Routing](#9-page-layout-and-routing)
10. [TypeScript Interfaces](#10-typescript-interfaces)
11. [Error Handling and Loading States](#11-error-handling-and-loading-states)
12. [File Structure](#12-file-structure)

---

## 1. Architecture Overview

### 1.1 Design Principles

1. **Instrument-centric state**: The entire UI is driven by a single `activeInstrument` + `activeTfConfig` pair. When the conversation changes instrument, chart and cards follow automatically.
2. **Unidirectional data flow**: Backend → Zustand store → React components. No component fetches data independently; all data flows through the store.
3. **WebSocket-first for real-time**: All agent evaluation results, state changes, and bar-close alerts arrive via WebSocket. REST is used only for initial page load and historical data.
4. **Server Components where possible**: Next.js v16 App Router with React Server Components for static layout, Client Components only where interactivity is required (chart, chat input, cards receiving live updates).

### 1.2 High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Next.js v16 App (Vercel)                          │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Zustand Global Store                       │    │
│  │                                                             │    │
│  │  activeInstrument: "XAUUSD"                                │    │
│  │  activeTfConfig: "A"                                        │    │
│  │  activeConversationId: "conv_abc123"                        │    │
│  │  agentState: { current_state, convergence, zone, ... }     │    │
│  │  chartData: { candles, trendlines, srZones }               │    │
│  │  cardData: { navigation, decisionResistance, ... }         │    │
│  │  chatMessages: [...]                                        │    │
│  │  wsConnectionStatus: "connected"                            │    │
│  └──────┬───────────┬──────────────┬──────────────┬───────────┘    │
│         │           │              │              │                  │
│    ┌────▼────┐ ┌────▼─────┐ ┌─────▼─────┐ ┌─────▼──────┐          │
│    │  Chat   │ │  Chart   │ │  S/R Data │ │  Sidebar   │          │
│    │  Panel  │ │  Panel   │ │  Cards    │ │  Nav       │          │
│    └────┬────┘ └──────────┘ └───────────┘ └────────────┘          │
│         │                                                           │
│    User sends message                                               │
│         │                                                           │
│    ┌────▼────────────────────────────────────────────────────┐      │
│    │           WebSocket Client (Socket.IO)                   │      │
│    │  Connects to: wss://api.davintrade.com                  │      │
│    │  Rooms: conversation:{conversationId}                    │      │
│    └──────────────────────┬──────────────────────────────────┘      │
│                           │                                         │
└───────────────────────────┼─────────────────────────────────────────┘
                            │ WebSocket
                            ▼
                   NestJS v11 Backend (Railway)
```

---

## 2. Component Hierarchy

### 2.1 Component Tree

```
app/
└── (dashboard)/
    └── layout.tsx                          ← Server Component: sidebar + main area
        ├── Sidebar (Server Component)
        │   ├── NewChatButton
        │   ├── InstrumentSelector          ← Client: dropdown for instrument selection
        │   ├── NavigationLinks             ← Indicators, Incoming Chat, Chat Search, Archive
        │   ├── PinnedChats                 ← Client: subscribes to pinned conversations
        │   ├── RecentChats                 ← Client: subscribes to recent conversations
        │   └── UserMenu                    ← Settings, Dark mode toggle, User info
        │
        └── page.tsx                        ← Main dashboard page
            └── DashboardLayout (Client Component)
                ├── ChatPanel
                │   ├── ChatHeader          ← Shows instrument + TF config label
                │   ├── ChatMessages        ← Scrollable message list
                │   │   ├── UserMessage
                │   │   ├── AgentMessage     ← Renders markdown, convergence cards inline
                │   │   └── AlertMessage     ← State change alerts with urgency styling
                │   ├── ChatInput           ← Text input + send button + model selector
                │   └── ChatDisclaimer      ← "AI can make mistakes" footer
                │
                ├── ChartPanel
                │   ├── ChartHeader         ← Instrument label + timeframe tabs (M5–D1)
                │   ├── TradingViewChart    ← Lightweight Charts wrapper
                │   │   ├── CandlestickSeries
                │   │   ├── TrendlineOverlays  ← LineSeries for each trendline
                │   │   └── SRZoneOverlays     ← AreaSeries for zone bands
                │   └── ChartControls       ← Zoom, pan, screenshot controls
                │
                └── CardPanel
                    ├── NavigationCard       ← H2 (Config A) or H4 (Config B) top card
                    ├── DecisionResistanceCard ← H1 Resistance (Config A) or H2 Resistance (Config B)
                    ├── DecisionSupportCard   ← H1 Support or H2 Support
                    └── LowerDecisionCard     ← M30 (Config A) or H1 (Config B)
```

### 2.2 Client vs. Server Component Boundary

| Component | Type | Reason |
|---|---|---|
| `layout.tsx` | Server | Static shell, no interactivity |
| `Sidebar` | Server | Static links, no real-time data |
| `InstrumentSelector` | Client | Dropdown interaction, updates store |
| `PinnedChats` / `RecentChats` | Client | Real-time updates via WebSocket |
| `DashboardLayout` | Client | Orchestrates all interactive panels |
| `ChatPanel` + children | Client | User input, real-time messages |
| `ChartPanel` + children | Client | TradingView chart requires DOM |
| `CardPanel` + children | Client | Real-time card data updates |

---

## 3. State Management — Zustand Store Design

### 3.1 Why Zustand

- Minimal boilerplate compared to Redux
- No provider wrappers needed (works outside React tree for WebSocket handlers)
- Built-in support for subscriptions with selectors (components re-render only when their slice changes)
- Middleware support for devtools, persistence, and logging

### 3.2 Store Definition

```typescript
// src/stores/trading-store.ts

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';

interface TradingStore {
  // === Active Context ===
  activeInstrument: string | null;          // "XAUUSD", "BTCUSD", etc.
  activeTfConfig: TfConfig | null;          // "A" or "B"
  activeConversationId: string | null;
  activeTimeframeTab: string;               // Currently selected TF tab for chart display

  // === Agent State (from backend) ===
  agentState: AgentStateSnapshot | null;

  // === Chart Data ===
  chartData: ChartData | null;

  // === Card Data ===
  cardData: CardPanelData | null;

  // === Chat ===
  chatMessages: ChatMessage[];
  chatLoading: boolean;

  // === WebSocket ===
  wsStatus: 'connecting' | 'connected' | 'disconnected' | 'error';

  // === Actions ===
  setActiveInstrument: (instrument: string, tfConfig: TfConfig) => void;
  setActiveConversation: (conversationId: string) => void;
  setActiveTimeframeTab: (tf: string) => void;

  handleInstrumentContext: (payload: InstrumentContextPayload) => void;
  handleAgentStateUpdate: (payload: AgentStateSnapshot) => void;
  handleChartDataUpdate: (payload: ChartData) => void;
  handleCardDataUpdate: (payload: CardPanelData) => void;
  handleChatMessage: (message: ChatMessage) => void;
  handleStateChangeAlert: (alert: StateChangeAlert) => void;

  appendUserMessage: (text: string) => void;
  clearChat: () => void;
  setWsStatus: (status: TradingStore['wsStatus']) => void;
}
```

### 3.3 Key Design Decisions

**Single store vs. multiple stores**: Single store. The trading dashboard has tightly coupled state — changing the instrument affects chart, cards, agent state, and chat simultaneously. Splitting into separate stores would require cross-store coordination that adds complexity without benefit.

**Selector-based subscriptions**: Each component subscribes to only the slice it needs:

```typescript
// ChartPanel only re-renders when chartData changes
const chartData = useTradingStore(state => state.chartData);

// CardPanel only re-renders when cardData changes
const cardData = useTradingStore(state => state.cardData);

// ChatMessages only re-renders when messages change
const messages = useTradingStore(state => state.chatMessages);
```

**WebSocket handler updates store directly**: The Socket.IO client event handlers call store actions directly (Zustand stores are accessible outside React). This avoids the React render cycle for processing WebSocket events — the store updates atomically, and only subscribed components re-render.

---

## 4. Dynamic Instrument Synchronization

This is the core architectural feature: when the conversation's active instrument changes, the chart and cards update dynamically.

### 4.1 Trigger Sources

An instrument change can be triggered by:

1. **User selects instrument from dropdown** → `InstrumentSelector` calls `setActiveInstrument()`
2. **User sends chat message mentioning a new instrument** → Backend extracts instrument, emits `instrument_context` event
3. **User clicks a conversation in sidebar** → Conversation has a persisted instrument, loads it
4. **Agent auto-alert for a different instrument** → `state_change_alert` event with instrument field

### 4.2 Synchronization Flow

```
Trigger: User types "Analyze EURUSD H1"
    │
    ▼
ChatPanel.sendMessage("Analyze EURUSD H1")
    │
    ├── store.appendUserMessage("Analyze EURUSD H1")
    │
    └── wsClient.emit("chat_message", {
          conversationId: "conv_abc",
          message: "Analyze EURUSD H1"
        })
    │
    ▼
NestJS Backend:
    ├── Extracts instrument: "EURUSD"
    ├── Extracts tfConfig: "A" (H1 primary)
    ├── Queries PostgreSQL for EURUSD data
    ├── Runs agent evaluation
    │
    └── Emits WebSocket events (in sequence):
        │
        ├── Event 1: "instrument_context"
        │   {
        │     instrument: "EURUSD",
        │     tfConfig: "A",
        │     chart: { candles, trendlines, srZones },
        │     cards: { navigation, decisionResistance, decisionSupport, lowerDecision }
        │   }
        │
        └── Event 2: "agent_response"
            {
              message: "EURUSD H1: Currently in SCANNING state...",
              agentState: { current_state: "SCANNING", convergence: {...} },
              alerts: []
            }
    │
    ▼
Frontend WebSocket handler:
    │
    ├── On "instrument_context":
    │   store.handleInstrumentContext(payload)
    │     → Sets activeInstrument = "EURUSD"
    │     → Sets activeTfConfig = "A"
    │     → Sets chartData = payload.chart
    │     → Sets cardData = payload.cards
    │
    │   ChartPanel re-renders:
    │     → TradingViewChart detects chartData change
    │     → Calls chart.applyOptions() with new symbol
    │     → Updates candle series with setData()
    │     → Removes old trendline overlays
    │     → Adds new trendline LineSeries
    │     → Adds new SR zone AreaSeries
    │
    │   CardPanel re-renders:
    │     → NavigationCard shows EURUSD H2 data
    │     → DecisionResistanceCard shows EURUSD H1 Resistance
    │     → DecisionSupportCard shows EURUSD H1 Support
    │     → LowerDecisionCard shows EURUSD M30
    │
    └── On "agent_response":
        store.handleChatMessage(payload.message)
        store.handleAgentStateUpdate(payload.agentState)
```

### 4.3 Instrument Persistence Per Conversation

Each conversation has an associated instrument + tfConfig stored in the backend:

```
conversation_123 → { instrument: "XAUUSD", tfConfig: "A" }
conversation_456 → { instrument: "EURUSD", tfConfig: "B" }
```

When the user switches between conversations (clicking sidebar), the frontend:

1. Calls `store.setActiveConversation("conv_456")`
2. Emits `join_conversation` WebSocket event (leaves previous room, joins new room)
3. Backend responds with the conversation's persisted `instrument_context` event
4. Chart and cards update to the new conversation's instrument

---

## 5. TradingView Lightweight Charts Integration

### 5.1 Chart Wrapper Component Architecture

```
TradingViewChart (Client Component)
│
├── useRef: chartContainerRef (DOM element for chart mounting)
├── useRef: chartRef (IChartApi instance)
├── useRef: candleSeriesRef (ISeriesApi<'Candlestick'>)
├── useRef: trendlineSeriesRefs (Map<string, ISeriesApi<'Line'>>)
├── useRef: zoneSeriesRefs (Map<string, ISeriesApi<'Area'>>)
│
├── useEffect: Initialize chart on mount
│   → createChart(container, options)
│   → addCandlestickSeries()
│   → Set chart options (colors, grid, crosshair, time scale)
│
├── useEffect: Update data when chartData changes
│   → candleSeries.setData(chartData.candles)
│   → Remove stale trendline series
│   → Add new trendline LineSeries
│   → Remove stale zone series
│   → Add new zone AreaSeries
│   → chart.timeScale().fitContent()
│
└── useEffect: Cleanup on unmount
    → chart.remove()
```

### 5.2 Chart Data Mapping

The backend provides structured data. Here's how it maps to Lightweight Charts series:

**OHLC Candles → CandlestickSeries**

```typescript
// Backend provides:
interface CandleData {
  time: number;       // Unix timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
  momentum?: {        // Optional momentum classification
    zScore: number;
    classification: 'normal' | 'large' | 'extreme';
    direction: 'bullish' | 'bearish';
  };
}

// Mapped to Lightweight Charts:
candleSeries.setData(candles.map(c => ({
  time: c.time as UTCTimestamp,
  open: c.open,
  high: c.high,
  low: c.low,
  close: c.close,
  // Color override for momentum candles
  ...(c.momentum?.classification === 'extreme' && c.momentum.direction === 'bullish'
    ? { color: '#006400', wickColor: '#006400' }   // Dark green
    : {}),
  ...(c.momentum?.classification === 'extreme' && c.momentum.direction === 'bearish'
    ? { color: '#8B0000', wickColor: '#8B0000' }   // Dark red
    : {}),
  ...(c.momentum?.classification === 'large' && c.momentum.direction === 'bullish'
    ? { color: '#90EE90', wickColor: '#90EE90' }   // Light green
    : {}),
  ...(c.momentum?.classification === 'large' && c.momentum.direction === 'bearish'
    ? { color: '#FF69B4', wickColor: '#FF69B4' }   // Hot pink
    : {}),
})));
```

**Trendlines → LineSeries (one per trendline)**

```typescript
interface TrendlineOverlay {
  id: string;
  type: 'resistance' | 'support';
  status: 'intact' | 'broken' | 'role_reversed';
  points: Array<{ time: number; value: number }>;  // Start + end projected points
  touchCount: number;
  slopeDegrees: number;
}

// Each trendline becomes a separate LineSeries:
for (const tl of chartData.trendlines) {
  const series = chart.addLineSeries({
    color: tl.type === 'resistance' ? '#EF4444' : '#22C55E',  // Red / Green
    lineWidth: tl.touchCount >= 4 ? 2 : 1,
    lineStyle: tl.status === 'broken' ? LineStyle.Dashed : LineStyle.Solid,
    priceLineVisible: false,
    lastValueVisible: false,
  });
  series.setData(tl.points.map(p => ({
    time: p.time as UTCTimestamp,
    value: p.value,
  })));
  trendlineSeriesRefs.current.set(tl.id, series);
}
```

**S/R Zones → AreaSeries (semi-transparent bands)**

```typescript
interface SRZoneOverlay {
  id: string;
  upperBoundary: number;
  lowerBoundary: number;
  densityScore: number;
  levels: Array<{ price: number; sourceTimeframe: string }>;
}

// Each zone rendered as two area series (upper/lower boundary):
// Using horizontal price lines for zone boundaries
for (const zone of chartData.srZones) {
  const upperLine = chart.addLineSeries({
    color: 'rgba(59, 130, 246, 0.5)',  // Blue
    lineWidth: 1,
    lineStyle: LineStyle.Dotted,
    priceLineVisible: false,
    lastValueVisible: false,
  });
  // Zone filled area via custom rendering or histogram series
  // Lightweight Charts v4 supports plugins for custom renderers
}
```

### 5.3 Timeframe Tab Switching

The timeframe tabs (M5, M15, M30, H1, H2, H4, H8, D1) in the chart header change which timeframe's candle data is displayed on the chart.

```
User clicks "H2" tab
    │
    ▼
store.setActiveTimeframeTab("H2")
    │
    ▼
wsClient.emit("request_chart_data", {
  instrument: store.activeInstrument,
  timeframe: "H2",
  lookback: 300   // Number of candles
})
    │
    ▼
Backend responds with "chart_data_update" event
    │
    ▼
store.handleChartDataUpdate(payload)
    │
    ▼
TradingViewChart re-renders with H2 candles + H2 trendlines
```

The card panel does NOT change when the timeframe tab changes — cards always show the multi-TF overview for the active instrument's configured timeframes. Cards are tied to the 2-3-2 architecture, not the chart's display timeframe.

### 5.4 Chart Performance Considerations

- **Data point limit**: Cap at 500 candles per timeframe. Lightweight Charts handles this efficiently.
- **Series cleanup**: When instrument changes, call `chart.removeSeries()` on all trendline and zone series before creating new ones. Prevents memory leaks from accumulating series.
- **Throttle updates**: For Execution TF (M5), bar-close events arrive frequently. Throttle chart updates to at most 1 per second to prevent layout thrashing.
- **Resize observer**: Attach a `ResizeObserver` to the chart container for responsive sizing. Call `chart.resize()` on dimension changes.

---

## 6. S/R Data Card Components

### 6.1 Card Layout Mapping

The cards on the right side of the dashboard map directly to the 2-3-2 architecture layers. Which specific timeframes appear depends on the active `tfConfig`:

**Config A (H1 Primary Decision TF)**

| Card Position | Layer | Timeframe | Content |
|---|---|---|---|
| Top | Navigation | H2 | Price, H4 KC Zone, H4 S&R Zone, H2 R/S Trendline Slopes |
| Upper Middle | Decision (Resistance) | H1 | Keltner Zone, S&R Zone, Slope, Trend, Touches, % Breakout |
| Lower Middle | Decision (Support) | H1 | Same fields, support side |
| Bottom | Decision (Lower) | M30 | Same fields |

**Config B (H2 Primary Decision TF)**

| Card Position | Layer | Timeframe | Content |
|---|---|---|---|
| Top | Navigation | H4 | Price, H8 KC Zone, H8 S&R Zone, H4 R/S Trendline Slopes |
| Upper Middle | Decision (Resistance) | H2 | Keltner Zone, S&R Zone, Slope, Trend, Touches, % Breakout |
| Lower Middle | Decision (Support) | H2 | Same fields, support side |
| Bottom | Decision (Lower) | H1 | Same fields |

### 6.2 Card Component Structure

Each card displays a consistent set of fields:

```
┌─────────────────────────────────────────────┐
│  XAUUSD  H1        ┌──────────────┐        │
│                     │  Resistant   │        │  ← Type badge (Resistant/Support)
│                     └──────────────┘        │
│                     ┌──────────────┐        │
│                     │   2672.08    │        │  ← Current projected price
│                     └──────────────┘        │
│                                             │
│  Keltner Zone  :  5                         │
│  S & R Zone    :  2                         │
│  Slope         :  26                        │  ← Slope in degrees
│  Trend         :  Uptrend                   │
│  Touches       :  12                        │
│  % Breakout    :  76% (Continuation)        │
│                                      🐻     │  ← Bear/bull icon
└─────────────────────────────────────────────┘
```

### 6.3 Card Data Interface

```typescript
interface CardData {
  instrument: string;
  timeframe: string;
  type: 'resistance' | 'support';
  projectedPrice: number;
  keltnerZone: number;         // 1-5 scale
  srZone: number;              // Count of S&R levels
  slopeDegrees: number;
  trend: 'Uptrend' | 'Downtrend' | 'Ranging';
  touches: number;
  breakoutPct: number | null;  // null = N/A
  breakoutType: 'Continuation' | 'Reversal' | null;
}
```

### 6.4 Navigation Card (Top Card)

The navigation card has a different structure — it shows the Navigation layer's regime data:

```
┌─────────────────────────────────────────────┐
│  XAUUSD  H2          ┌────────────────┐    │
│                       │ R : 2673.93    │    │  ← Resistance price + color badge
│                       └────────────────┘    │
│  H4 KC Zone    :  6                         │
│  H4 S&R Zone   :  2                         │
│                                             │
│  H2 R Trendline Slope  :  23.3              │
│  H2 S Trendline Slope  :  23.3              │
│                       ┌──────────┐          │
│                       │ ████████ │          │  ← Green/red gradient bar
│                       └──────────┘          │
└─────────────────────────────────────────────┘
```

### 6.5 Dynamic Color Coding

Cards use color coding to convey information at a glance:

| Element | Red | Green |
|---|---|---|
| Type badge | Resistance | Support |
| Price badge background | Resistance price | Support price |
| Trend label | Downtrend | Uptrend |
| Slope text | Negative slope | Positive slope |
| Breakout % | Reversal | Continuation |

---

## 7. Chat Panel Architecture

### 7.1 Message Types

The chat panel renders four message types:

```typescript
type ChatMessage =
  | UserMessage          // User typed text
  | AgentAnalysis        // Agent evaluation response with structured data
  | StateChangeAlert     // Auto-pushed state transition alert
  | SystemNotification;  // Connection status, errors, etc.

interface UserMessage {
  type: 'user';
  id: string;
  text: string;
  timestamp: string;
}

interface AgentAnalysis {
  type: 'agent_analysis';
  id: string;
  text: string;                             // Markdown-formatted analysis text
  agentState?: AgentStateSnapshot;          // Optional inline state display
  convergence?: ConvergenceBreakdown;       // Optional inline score card
  timestamp: string;
}

interface StateChangeAlert {
  type: 'state_change';
  id: string;
  previousState: string;
  newState: string;
  instrument: string;
  message: string;
  urgency: 'low' | 'medium' | 'high';
  timestamp: string;
}

interface SystemNotification {
  type: 'system';
  id: string;
  text: string;
  level: 'info' | 'warning' | 'error';
  timestamp: string;
}
```

### 7.2 Chat Input Behavior

```
User types message → presses Enter or clicks Send
    │
    ├── Append UserMessage to chatMessages
    ├── Set chatLoading = true
    ├── Emit "chat_message" via WebSocket
    │     {
    │       conversationId: activeConversationId,
    │       message: text,
    │       instrument: activeInstrument,    // Current context (backend may override)
    │       tfConfig: activeTfConfig
    │     }
    │
    ▼
    Wait for "agent_response" event
    │
    ├── Append AgentAnalysis to chatMessages
    ├── Set chatLoading = false
    └── If instrument changed → handleInstrumentContext
```

### 7.3 Model Selector

The chat panel includes a model selector dropdown (bottom of the input area) that controls which Claude model the backend uses for the LLM evaluation:

```typescript
type ModelOption = 'claude-sonnet-4-5-20250929' | 'claude-opus-4-6';

// Sent with each chat message so the backend knows which model to call
```

### 7.4 Chat Message Rendering

Agent messages are rendered as Markdown with support for:
- Inline convergence score tables
- Code blocks for structured data
- Bold/italic for emphasis
- Emoji for alert urgency levels (only when received from backend)

State change alerts have colored borders based on urgency:
- `high`: Red left border + red background tint
- `medium`: Yellow left border
- `low`: Gray left border

---

## 8. WebSocket Client Layer

### 8.1 Connection Management

```typescript
// src/lib/ws/socket-client.ts

import { io, Socket } from 'socket.io-client';
import { useTradingStore } from '@/stores/trading-store';

class TradingSocketClient {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  connect(token: string): void {
    this.socket = io(process.env.NEXT_PUBLIC_WS_URL!, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.registerEventHandlers();
  }

  private registerEventHandlers(): void {
    const store = useTradingStore.getState();

    // Connection lifecycle
    this.socket!.on('connect', () => {
      store.setWsStatus('connected');
      this.reconnectAttempts = 0;
    });

    this.socket!.on('disconnect', () => {
      store.setWsStatus('disconnected');
    });

    this.socket!.on('connect_error', () => {
      store.setWsStatus('error');
    });

    // Trading events
    this.socket!.on('instrument_context', (payload: InstrumentContextPayload) => {
      store.handleInstrumentContext(payload);
    });

    this.socket!.on('agent_response', (payload: AgentResponsePayload) => {
      store.handleChatMessage({
        type: 'agent_analysis',
        id: crypto.randomUUID(),
        text: payload.message,
        agentState: payload.agentState,
        convergence: payload.convergence,
        timestamp: new Date().toISOString(),
      });
      if (payload.agentState) {
        store.handleAgentStateUpdate(payload.agentState);
      }
    });

    this.socket!.on('state_change_alert', (payload: StateChangeAlert) => {
      store.handleStateChangeAlert(payload);
    });

    this.socket!.on('chart_data_update', (payload: ChartData) => {
      store.handleChartDataUpdate(payload);
    });

    this.socket!.on('card_data_update', (payload: CardPanelData) => {
      store.handleCardDataUpdate(payload);
    });
  }

  // Emit methods
  sendChatMessage(conversationId: string, message: string, instrument: string | null, tfConfig: string | null): void {
    this.socket?.emit('chat_message', {
      conversationId,
      message,
      instrument,
      tfConfig,
    });
  }

  joinConversation(conversationId: string): void {
    this.socket?.emit('join_conversation', { conversationId });
  }

  leaveConversation(conversationId: string): void {
    this.socket?.emit('leave_conversation', { conversationId });
  }

  requestChartData(instrument: string, timeframe: string, lookback: number): void {
    this.socket?.emit('request_chart_data', {
      instrument,
      timeframe,
      lookback,
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}

export const tradingSocket = new TradingSocketClient();
```

### 8.2 WebSocket Event Catalog

**Client → Server Events**

| Event | Payload | Purpose |
|---|---|---|
| `chat_message` | `{ conversationId, message, instrument?, tfConfig? }` | User sends a chat message |
| `join_conversation` | `{ conversationId }` | Join a conversation room |
| `leave_conversation` | `{ conversationId }` | Leave a conversation room |
| `request_chart_data` | `{ instrument, timeframe, lookback }` | Request candle data for a specific TF |
| `request_card_data` | `{ instrument, tfConfig }` | Request card data refresh |

**Server → Client Events**

| Event | Payload | Purpose |
|---|---|---|
| `instrument_context` | `{ instrument, tfConfig, chart, cards }` | Full instrument data bundle (on instrument change) |
| `agent_response` | `{ message, agentState?, convergence?, alerts? }` | Response to a user chat message |
| `state_change_alert` | `{ previousState, newState, instrument, message, urgency }` | Auto-pushed state transition |
| `chart_data_update` | `{ candles, trendlines, srZones }` | Chart data for requested TF |
| `card_data_update` | `{ navigation, decisionResistance, decisionSupport, lowerDecision }` | Card data refresh |
| `bar_close` | `{ instrument, timeframe, candle }` | New bar close notification for live chart updates |
| `error` | `{ code, message }` | Server-side error |

### 8.3 Room Architecture

WebSocket rooms are conversation-scoped:

```
Room: conversation:{conversationId}

Behavior:
- Client joins one room at a time (active conversation)
- Server pushes all events for that conversation to the room
- Agent evaluation results, state changes, and alerts are room-scoped
- When user switches conversations, client leaves old room and joins new room
```

Additionally, a user-scoped room exists for cross-conversation alerts:

```
Room: user:{userId}

Behavior:
- Client always stays in this room
- Receives state_change_alert events for ANY instrument the user has active evaluations
- Enables sidebar notifications (e.g., "EURUSD just entered BREAKOUT_DETECTED")
```

---

## 9. Page Layout and Routing

### 9.1 Layout Structure

```
┌──────────────────────────────────────────────────────────────────────┐
│ ┌──────────┐  ┌──────────────────────────────┐  ┌───────────────┐  │
│ │          │  │                              │  │               │  │
│ │          │  │                              │  │  Navigation   │  │
│ │          │  │                              │  │  Card (H2)    │  │
│ │ Sidebar  │  │                              │  │               │  │
│ │          │  │     TradingView Chart        │  ├───────────────┤  │
│ │ - New    │  │                              │  │  Decision     │  │
│ │   Chat   │  │                              │  │  Resistance   │  │
│ │ - Indic  │  │                              │  │  Card (H1)    │  │
│ │ - Search │  │                              │  ├───────────────┤  │
│ │          │  ├──────────────────────────────┤  │  Decision     │  │
│ │ Pinned   │  │                              │  │  Support      │  │
│ │ Chats    │  │      Chat Panel              │  │  Card (H1)    │  │
│ │          │  │                              │  ├───────────────┤  │
│ │ Recent   │  │  Messages...                 │  │  Lower Dec.   │  │
│ │ Chats    │  │                              │  │  Card (M30)   │  │
│ │          │  │  [Input box] [Send]          │  │               │  │
│ │          │  │  Claude 3.5 Sonnet ▼         │  │               │  │
│ └──────────┘  └──────────────────────────────┘  └───────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### 9.2 Responsive Breakpoints

| Breakpoint | Layout |
|---|---|
| Desktop (≥1280px) | 3-column: Sidebar + Chart/Chat + Cards |
| Tablet (768–1279px) | 2-column: Sidebar collapsed + Chart/Chat + Cards as overlay panel |
| Mobile (<768px) | Single column with tab navigation between Chat, Chart, Cards |

### 9.3 Route Structure

```
/                           → Redirect to /dashboard
/dashboard                  → Main trading dashboard (default conversation)
/dashboard/c/[id]           → Specific conversation
/dashboard/indicators       → Indicator configuration page
/dashboard/incoming         → Incoming chat alerts page
/dashboard/search           → Chat search page
/dashboard/archive          → Archived conversations
/dashboard/settings         → User settings
/auth/login                 → Authentication
/auth/register              → Registration
```

---

## 10. TypeScript Interfaces

### 10.1 Core Types

```typescript
// src/types/trading.ts

// === Timeframe Configuration ===
type TfConfig = 'A' | 'B';

interface TfConfigMapping {
  navigation: [string, string];       // [upper, lower] e.g., ["H4", "H2"]
  decision: [string, string, string]; // [upper, primary, lower] e.g., ["H2", "H1", "M30"]
  execution: [string, string];        // [upper, lower] e.g., ["M15", "M5"]
}

const TF_CONFIGS: Record<TfConfig, TfConfigMapping> = {
  A: {
    navigation: ['H4', 'H2'],
    decision: ['H2', 'H1', 'M30'],
    execution: ['M15', 'M5'],
  },
  B: {
    navigation: ['H8', 'H4'],
    decision: ['H4', 'H2', 'H1'],
    execution: ['M30', 'M15'],
  },
};

// === Agent State Snapshot ===
interface AgentStateSnapshot {
  instrument: string;
  tfConfig: TfConfig;
  currentState: string;       // IDLE, NAVIGATING, SCANNING, etc.
  previousState: string | null;
  barsInState: number;
  tradeDirection: 'long' | 'short' | null;
  regimeClassification: string | null;
  counterTrendFlag: boolean;
  counterTrendModifier: number;
  convergence: ConvergenceBreakdown | null;
  srZone: SRZoneData | null;
  pricePattern: PricePatternData | null;
}

// === Convergence Score ===
interface ConvergenceBreakdown {
  trendline: number;       // -2 to +2
  momentum: number;        // -2 to +2
  temaHrma: number;        // -2 to +2
  navigation: number;      // -2 to +2
  pricePattern: number;    // -2 to +2
  rawTotal: number;        // -10 to +10
  counterTrendModifier: number;
  adjustedTotal: number;
  llmAdjustment: number;
  finalScore: number;
}

// === S/R Zone ===
interface SRZoneData {
  upperBoundary: number;
  lowerBoundary: number;
  midpoint: number;
  densityScore: number;
  levelCount: number;
  widthPct: number;
}

// === Price Pattern ===
interface PricePatternData {
  patternType: 'double_bottom' | 'double_top' | 'higher_low' | 'lower_high' | 'hammer' | 'engulfing' | null;
  developmentStatus: 'none' | 'forming' | 'completed';
  evidenceNotes: string;
}

// === Chart Data ===
interface ChartData {
  candles: CandleData[];
  trendlines: TrendlineOverlay[];
  srZones: SRZoneOverlay[];
  timeframe: string;
  instrument: string;
}

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  momentum?: {
    zScore: number;
    classification: 'normal' | 'large' | 'extreme';
    direction: 'bullish' | 'bearish';
  };
}

interface TrendlineOverlay {
  id: string;
  type: 'resistance' | 'support';
  status: 'intact' | 'broken' | 'role_reversed';
  points: Array<{ time: number; value: number }>;
  touchCount: number;
  slopeDegrees: number;
  sourceTimeframe: string;
}

interface SRZoneOverlay {
  id: string;
  upperBoundary: number;
  lowerBoundary: number;
  densityScore: number;
  levels: Array<{
    price: number;
    sourceTimeframe: string;
    touchCount: number;
  }>;
}

// === Card Panel Data ===
interface CardPanelData {
  navigation: NavigationCardData;
  decisionResistance: DecisionCardData;
  decisionSupport: DecisionCardData;
  lowerDecision: DecisionCardData;
}

interface NavigationCardData {
  instrument: string;
  timeframe: string;             // "H2" (Config A) or "H4" (Config B)
  price: number;
  priceType: 'resistance' | 'support';
  upperTfKcZone: number;         // H4 KC Zone (Config A) or H8 KC Zone (Config B)
  upperTfSrZone: number;
  rTrendlineSlope: number;
  sTrendlineSlope: number;
}

interface DecisionCardData {
  instrument: string;
  timeframe: string;
  type: 'resistance' | 'support';
  projectedPrice: number;
  keltnerZone: number;
  srZone: number;
  slopeDegrees: number;
  trend: 'Uptrend' | 'Downtrend' | 'Ranging';
  touches: number;
  breakoutPct: number | null;
  breakoutType: 'Continuation' | 'Reversal' | null;
}

// === WebSocket Payloads ===
interface InstrumentContextPayload {
  instrument: string;
  tfConfig: TfConfig;
  chart: ChartData;
  cards: CardPanelData;
}

interface AgentResponsePayload {
  message: string;
  agentState?: AgentStateSnapshot;
  convergence?: ConvergenceBreakdown;
  alerts?: StateChangeAlert[];
}

interface StateChangeAlert {
  type: 'state_change';
  id: string;
  previousState: string;
  newState: string;
  instrument: string;
  message: string;
  urgency: 'low' | 'medium' | 'high';
  timestamp: string;
}
```

---

## 11. Error Handling and Loading States

### 11.1 WebSocket Disconnection

When the WebSocket disconnects:
1. Store sets `wsStatus = 'disconnected'`
2. A banner appears at the top of the dashboard: "Connection lost. Reconnecting..."
3. Socket.IO's built-in reconnection handles automatic retry
4. On reconnect, client re-joins the active conversation room
5. Client emits `request_card_data` and `request_chart_data` to refresh stale data

### 11.2 Loading States

| State | UI Behavior |
|---|---|
| Initial page load | Skeleton loaders for chart, cards, and chat |
| Waiting for agent response | Typing indicator in chat panel + pulsing border on cards |
| Chart timeframe switching | Skeleton overlay on chart while new data loads |
| Instrument switching | All panels show skeleton loaders until `instrument_context` arrives |

### 11.3 Error States

| Error | UI Behavior |
|---|---|
| WebSocket connection failed | Banner + retry countdown |
| Agent response error | Error message in chat with retry button |
| Chart data load failed | "Failed to load chart data" message in chart panel |
| Invalid instrument | Toast notification: "Instrument not supported" |

---

## 12. File Structure

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── layout.tsx                    # Dashboard shell (Server Component)
│   │   ├── page.tsx                      # Default dashboard page
│   │   └── c/
│   │       └── [id]/
│   │           └── page.tsx              # Specific conversation page
│   ├── auth/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── layout.tsx                        # Root layout
│   └── globals.css
│
├── components/
│   ├── dashboard/
│   │   └── DashboardLayout.tsx           # Main 3-panel layout orchestrator
│   │
│   ├── sidebar/
│   │   ├── Sidebar.tsx
│   │   ├── InstrumentSelector.tsx
│   │   ├── PinnedChats.tsx
│   │   ├── RecentChats.tsx
│   │   └── UserMenu.tsx
│   │
│   ├── chat/
│   │   ├── ChatPanel.tsx
│   │   ├── ChatHeader.tsx
│   │   ├── ChatMessages.tsx
│   │   ├── ChatInput.tsx
│   │   ├── ChatDisclaimer.tsx
│   │   ├── messages/
│   │   │   ├── UserMessage.tsx
│   │   │   ├── AgentMessage.tsx
│   │   │   ├── AlertMessage.tsx
│   │   │   └── SystemNotification.tsx
│   │   └── ModelSelector.tsx
│   │
│   ├── chart/
│   │   ├── ChartPanel.tsx
│   │   ├── ChartHeader.tsx
│   │   ├── TradingViewChart.tsx          # Lightweight Charts wrapper
│   │   ├── ChartControls.tsx
│   │   └── TimeframeTabs.tsx
│   │
│   ├── cards/
│   │   ├── CardPanel.tsx
│   │   ├── NavigationCard.tsx
│   │   ├── DecisionCard.tsx              # Shared for Resistance/Support/Lower
│   │   └── CardBadge.tsx                 # Colored badge component
│   │
│   └── ui/
│       ├── Skeleton.tsx
│       ├── Banner.tsx
│       ├── Toast.tsx
│       └── TypingIndicator.tsx
│
├── stores/
│   └── trading-store.ts                  # Zustand store
│
├── lib/
│   ├── ws/
│   │   └── socket-client.ts             # Socket.IO client singleton
│   └── utils/
│       ├── tf-config.ts                  # TF config constants and helpers
│       └── format.ts                     # Number/price formatting
│
├── types/
│   └── trading.ts                        # All TypeScript interfaces
│
└── hooks/
    ├── useWebSocket.ts                   # Hook to initialize WS connection
    ├── useTradingStore.ts                # Typed selector hooks
    └── useChart.ts                       # Chart lifecycle management hook
```

---

_End of Frontend Architecture — Version 1.0_

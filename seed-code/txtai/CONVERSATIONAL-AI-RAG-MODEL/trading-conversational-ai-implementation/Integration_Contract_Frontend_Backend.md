# Integration Contract — Frontend ↔ Backend

**Document Type:** API and WebSocket Integration Contract
**Version:** 1.0
**Date:** February 8, 2026
**Companion To:** Frontend Architecture (Next.js v16), NestJS Backend Architecture v11
**Purpose:** Definitive contract for all communication between the Next.js v16 frontend (Vercel) and the NestJS v11 backend (Railway), covering WebSocket events, REST endpoints, payload schemas, and error codes
**Audience:** Frontend and backend developers — this document is the single source of truth for the integration interface

---

## Table of Contents

1. [Protocol Overview](#1-protocol-overview)
2. [Authentication](#2-authentication)
3. [WebSocket Connection](#3-websocket-connection)
4. [WebSocket Events — Client to Server](#4-websocket-events--client-to-server)
5. [WebSocket Events — Server to Client](#5-websocket-events--server-to-client)
6. [REST API Endpoints](#6-rest-api-endpoints)
7. [Shared TypeScript Types](#7-shared-typescript-types)
8. [Error Codes and Handling](#8-error-codes-and-handling)
9. [Data Flow Sequences](#9-data-flow-sequences)
10. [Rate Limits and Throttling](#10-rate-limits-and-throttling)

---

## 1. Protocol Overview

### 1.1 Communication Channels

| Channel | Protocol | Purpose | When to Use |
|---|---|---|---|
| **WebSocket** | Socket.IO over WSS | Real-time bidirectional communication | Chat messages, agent responses, state alerts, live chart updates |
| **REST API** | HTTPS JSON | Request-response for CRUD operations | Auth, conversation list, message history, settings, initial page load |

### 1.2 Design Rule

**WebSocket for real-time, REST for CRUD.**

- All chat messages flow through WebSocket (both directions)
- All agent evaluation results flow through WebSocket (server → client)
- All state change alerts flow through WebSocket (server → client)
- Conversation creation, listing, deletion use REST
- Authentication uses REST (JWT token exchange)
- The WebSocket connection is authenticated with the JWT token

### 1.3 Base URLs

```
REST API:      https://api.davintrade.com
WebSocket:     wss://api.davintrade.com/trading
```

---

## 2. Authentication

### 2.1 JWT Token Flow

```
1. User logs in via REST: POST /auth/login
   → Returns: { accessToken, refreshToken }

2. Frontend stores accessToken in memory (not localStorage)

3. WebSocket connects with token:
   io(WS_URL, { auth: { token: accessToken } })

4. REST requests include token:
   Authorization: Bearer {accessToken}

5. Token refresh: POST /auth/refresh
   → Returns new { accessToken, refreshToken }
```

### 2.2 REST Authentication

```
Header: Authorization: Bearer {jwt_token}
```

All REST endpoints (except `/auth/login` and `/auth/register`) require this header.

### 2.3 WebSocket Authentication

```typescript
// Client connection with auth
const socket = io('wss://api.davintrade.com/trading', {
  auth: { token: jwtToken },
  transports: ['websocket'],
});
```

The server validates the JWT on `handleConnection`. Invalid or expired tokens result in immediate disconnection.

---

## 3. WebSocket Connection

### 3.1 Connection Parameters

```typescript
// Client-side connection config
{
  url: 'wss://api.davintrade.com/trading',
  options: {
    auth: { token: string },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    reconnectionAttempts: 10,
  }
}
```

### 3.2 Room Architecture

| Room Pattern | Joined By | Purpose |
|---|---|---|
| `user:{userId}` | Auto on connect | Cross-conversation alerts (state changes for any instrument) |
| `conversation:{conversationId}` | On `join_conversation` event | Conversation-scoped messages and instrument context |

**Rules:**
- A client is in exactly one `conversation:` room at a time
- A client is always in their `user:` room
- Joining a new conversation automatically leaves the previous conversation room

### 3.3 Connection Lifecycle Events

| Event | Direction | Payload | Description |
|---|---|---|---|
| `connect` | Socket.IO built-in | — | Connection established |
| `disconnect` | Socket.IO built-in | — | Connection lost |
| `connect_error` | Socket.IO built-in | `{ message: string }` | Connection failed (auth error, server down) |
| `reconnect` | Socket.IO built-in | — | Successfully reconnected |

---

## 4. WebSocket Events — Client to Server

### 4.1 `chat_message`

Send a user message to the active conversation.

```typescript
// Emit
socket.emit('chat_message', payload);

// Payload
interface ChatMessagePayload {
  conversationId: string;       // UUID of the active conversation
  message: string;              // User's text message
  instrument: string | null;    // Current instrument context (backend may override if message mentions another)
  tfConfig: string | null;      // Current TF config ("A" or "B")
}

// Example
{
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Analyze XAUUSD for a long entry",
  "instrument": "EURUSD",      // User was previously looking at EURUSD
  "tfConfig": "A"
}
```

**Server behavior:**
1. Persists user message to DB
2. Extracts instrument from message (may differ from `payload.instrument`)
3. Runs agent orchestrator
4. If instrument changed → emits `instrument_context` first
5. Emits `agent_response`
6. Persists agent message to DB

---

### 4.2 `join_conversation`

Join a conversation room to receive its events.

```typescript
// Emit
socket.emit('join_conversation', payload);

// Payload
interface JoinConversationPayload {
  conversationId: string;       // UUID of the conversation to join
}
```

**Server behavior:**
1. Removes client from all previous `conversation:*` rooms
2. Adds client to `conversation:{conversationId}`
3. If conversation has a persisted instrument → emits `instrument_context`

---

### 4.3 `leave_conversation`

Leave a conversation room.

```typescript
// Emit
socket.emit('leave_conversation', payload);

// Payload
interface LeaveConversationPayload {
  conversationId: string;
}
```

**Server behavior:**
1. Removes client from `conversation:{conversationId}`

---

### 4.4 `request_chart_data`

Request candle + overlay data for a specific timeframe (when user clicks a timeframe tab).

```typescript
// Emit
socket.emit('request_chart_data', payload);

// Payload
interface RequestChartDataPayload {
  instrument: string;           // e.g., "XAUUSD"
  timeframe: string;            // e.g., "H2", "M30"
  lookback: number;             // Number of candles, default 300
}
```

**Server behavior:**
1. Queries PostgreSQL for candle data + trendlines for the requested timeframe
2. Emits `chart_data_update` to the requesting client only (not the room)

---

### 4.5 `request_card_data`

Request card panel data refresh.

```typescript
// Emit
socket.emit('request_card_data', payload);

// Payload
interface RequestCardDataPayload {
  instrument: string;
  tfConfig: string;             // "A" or "B"
}
```

**Server behavior:**
1. Assembles card data for all timeframes in the config
2. Emits `card_data_update` to the requesting client only

---

## 5. WebSocket Events — Server to Client

### 5.1 `instrument_context`

Full instrument data bundle. Sent when the conversation's active instrument changes.

```typescript
// Listen
socket.on('instrument_context', (payload: InstrumentContextPayload) => { ... });

// Payload
interface InstrumentContextPayload {
  instrument: string;             // "XAUUSD"
  tfConfig: string;               // "A" or "B"
  chart: ChartData;
  cards: CardPanelData;
}

interface ChartData {
  instrument: string;
  timeframe: string;              // Primary decision TF (e.g., "H1" for Config A)
  candles: CandleData[];
  trendlines: TrendlineOverlay[];
  srZones: SRZoneOverlay[];
}

interface CandleData {
  time: number;                   // Unix timestamp (seconds, UTC)
  open: number;
  high: number;
  low: number;
  close: number;
  momentum: {
    zScore: number;
    classification: 'normal' | 'large' | 'extreme';
    direction: 'bullish' | 'bearish';
  } | null;
}

interface TrendlineOverlay {
  id: string;                     // Unique identifier for this trendline
  type: 'resistance' | 'support';
  status: 'intact' | 'broken' | 'role_reversed';
  points: Array<{
    time: number;                 // Unix timestamp
    value: number;                // Price at that time
  }>;                             // Exactly 2 points: start and end
  touchCount: number;
  slopeDegrees: number;
  sourceTimeframe: string;        // "H1", "H2", etc.
  rank: number;                   // 1 = highest scored
  distanceToPricePct: number;
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
    trendlineType: string;        // "resistance_broken", "support_intact", etc.
  }>;
}

interface CardPanelData {
  navigation: NavigationCardData;
  decisionResistance: DecisionCardData;
  decisionSupport: DecisionCardData;
  lowerDecision: DecisionCardData;
}

interface NavigationCardData {
  instrument: string;
  timeframe: string;
  price: number;
  priceType: 'resistance' | 'support';
  upperTfKcZone: number;
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
```

**When sent:**
- User sends a message that references a different instrument
- User joins a conversation that has a persisted instrument
- Client reconnects and re-joins a conversation

**Frontend action:**
- Update `activeInstrument` and `activeTfConfig` in Zustand store
- Update chart data → TradingView re-renders with new candles + overlays
- Update card data → all four cards re-render

---

### 5.2 `agent_response`

Response to a user's chat message, containing the agent's analysis.

```typescript
// Listen
socket.on('agent_response', (payload: AgentResponsePayload) => { ... });

// Payload
interface AgentResponsePayload {
  message: string;                          // Markdown-formatted analysis text
  agentState: AgentStateSnapshot | null;    // Current state snapshot (optional)
  convergence: ConvergenceBreakdown | null; // Score breakdown (optional)
  alerts: StateChangeAlertData[];           // Any alerts generated during this response
}

interface AgentStateSnapshot {
  instrument: string;
  tfConfig: string;
  currentState: string;
  previousState: string | null;
  barsInState: number;
  tradeDirection: 'long' | 'short' | null;
  regimeClassification: string | null;
  counterTrendFlag: boolean;
  counterTrendModifier: number;
  convergence: ConvergenceBreakdown | null;
  srZone: SRZoneSnapshot | null;
  pricePattern: PricePatternSnapshot | null;
}

interface ConvergenceBreakdown {
  trendline: number;
  momentum: number;
  temaHrma: number;
  navigation: number;
  pricePattern: number;
  rawTotal: number;
  counterTrendModifier: number;
  adjustedTotal: number;
  llmAdjustment: number;
  finalScore: number;
}

interface SRZoneSnapshot {
  upperBoundary: number;
  lowerBoundary: number;
  midpoint: number;
  densityScore: number;
  levelCount: number;
  widthPct: number;
}

interface PricePatternSnapshot {
  patternType: string | null;
  developmentStatus: 'none' | 'forming' | 'completed';
  evidenceNotes: string;
}
```

**When sent:**
- In response to every `chat_message` from the client
- Sent to the `conversation:{conversationId}` room

**Frontend action:**
- Append `AgentAnalysis` message to chat panel
- Update agent state snapshot in Zustand store
- Set `chatLoading = false`

---

### 5.3 `state_change_alert`

Pushed automatically when an agent evaluation cycle produces a state transition.

```typescript
// Listen
socket.on('state_change_alert', (payload: StateChangeAlertPayload) => { ... });

// Payload
interface StateChangeAlertPayload {
  type: 'state_change';
  id: string;                       // UUID
  previousState: string;
  newState: string;
  instrument: string;
  timeframe: string;                // Primary decision TF
  message: string;                  // Human-readable description
  urgency: 'low' | 'medium' | 'high';
  convergenceScore: number | null;  // Current score if applicable
  timestamp: string;                // ISO 8601
}
```

**Urgency mapping:**

| New State | Urgency | Rationale |
|---|---|---|
| `BREAKOUT_DETECTED` | `high` | Actionable: breakout just occurred |
| `PULLBACK_TESTING` | `high` | Actionable: zone being tested |
| `AWAITING_PULLBACK` | `medium` | Setup developing, monitor |
| `INVALIDATED` | `medium` | Setup failed, notable event |
| `MISSED` | `medium` | Entry window expired |
| `SCANNING` | `low` | Watching for setups |
| `IDLE` | `low` | No active setup |

**When sent:**
- After every cron-triggered evaluation that produces a state transition
- Sent to the `user:{userId}` room (crosses conversation boundaries)

**Frontend action:**
- Append `AlertMessage` to the chat panel if the instrument matches the active conversation
- Show notification badge in the sidebar for the relevant conversation
- Play audio notification for `high` urgency (if user has notifications enabled)

---

### 5.4 `chart_data_update`

Chart data for a specific timeframe, in response to `request_chart_data`.

```typescript
// Listen
socket.on('chart_data_update', (payload: ChartData) => { ... });

// Payload: Same ChartData interface as in instrument_context
```

**When sent:**
- In response to `request_chart_data` (timeframe tab switch)
- Sent to the requesting client only (not the room)

**Frontend action:**
- Update `chartData` in Zustand store
- TradingView chart re-renders with new timeframe's data

---

### 5.5 `card_data_update`

Card panel data refresh.

```typescript
// Listen
socket.on('card_data_update', (payload: CardPanelData) => { ... });

// Payload: Same CardPanelData interface as in instrument_context
```

**When sent:**
- In response to `request_card_data`
- After a cron evaluation updates indicator data
- Sent to the requesting client only

---

### 5.6 `bar_close`

Notification that a new bar has closed, for live chart updates.

```typescript
// Listen
socket.on('bar_close', (payload: BarClosePayload) => { ... });

// Payload
interface BarClosePayload {
  instrument: string;
  timeframe: string;
  candle: CandleData;             // The newly closed candle
  updatedTrendlines: TrendlineOverlay[] | null;  // Updated trendlines (if any changed)
}
```

**When sent:**
- After the data pipeline writes a new bar's data to PostgreSQL
- Sent to all clients (filtered client-side by active instrument + timeframe)

**Frontend action:**
- If `instrument` and `timeframe` match the active chart → append candle to chart
- If `updatedTrendlines` is present → update trendline overlays

---

### 5.7 `error`

Server-side error notification.

```typescript
// Listen
socket.on('error', (payload: WSErrorPayload) => { ... });

// Payload
interface WSErrorPayload {
  code: string;                   // Error code (see Section 8)
  message: string;                // Human-readable error message
  details?: any;                  // Optional additional context
}
```

---

## 6. REST API Endpoints

### 6.1 Authentication

**POST `/auth/login`**

```typescript
// Request
{ email: string; password: string }

// Response 200
{ accessToken: string; refreshToken: string; user: { id: string; email: string; name: string } }

// Response 401
{ error: 'Invalid credentials' }
```

**POST `/auth/register`**

```typescript
// Request
{ email: string; password: string; name: string }

// Response 201
{ accessToken: string; refreshToken: string; user: { id: string; email: string; name: string } }

// Response 409
{ error: 'Email already exists' }
```

**POST `/auth/refresh`**

```typescript
// Request
{ refreshToken: string }

// Response 200
{ accessToken: string; refreshToken: string }

// Response 401
{ error: 'Invalid refresh token' }
```

---

### 6.2 Conversations

**GET `/conversations`**

List user's conversations (for sidebar).

```typescript
// Query params: ?limit=20&offset=0&pinned=true&archived=false

// Response 200
{
  conversations: Array<{
    id: string;
    instrument: string | null;
    tfConfig: string | null;
    title: string | null;
    isPinned: boolean;
    lastMessageAt: string;
    lastMessagePreview: string;
  }>;
  total: number;
}
```

**POST `/conversations`**

Create a new conversation.

```typescript
// Request
{ instrument?: string; tfConfig?: string }

// Response 201
{ id: string; instrument: string | null; tfConfig: string | null; createdAt: string }
```

**GET `/conversations/:id/messages`**

Get message history for a conversation.

```typescript
// Query params: ?limit=50&before={messageId}

// Response 200
{
  messages: Array<{
    id: string;
    role: 'user' | 'agent' | 'system' | 'alert';
    content: string;
    metadata: {
      agentState?: AgentStateSnapshot;
      convergence?: ConvergenceBreakdown;
      urgency?: string;
    } | null;
    createdAt: string;
  }>;
  hasMore: boolean;
}
```

**PATCH `/conversations/:id`**

Update conversation properties (pin, archive, title).

```typescript
// Request
{ isPinned?: boolean; isArchived?: boolean; title?: string }

// Response 200
{ id: string; isPinned: boolean; isArchived: boolean; title: string | null }
```

**DELETE `/conversations/:id`**

Delete a conversation and all its messages.

```typescript
// Response 204 (no content)
```

---

### 6.3 Instruments

**GET `/instruments`**

List supported instruments with their default configurations.

```typescript
// Response 200
{
  instruments: Array<{
    symbol: string;               // "XAUUSD"
    name: string;                 // "Gold"
    category: string;             // "commodity", "forex_major", "crypto"
    defaultTfConfig: string;      // "A" or "B"
    isActive: boolean;            // Whether data pipeline is running for this instrument
  }>;
}
```

---

### 6.4 Agent State (Read-Only)

**GET `/agent-state/:instrument/:tfConfig`**

Get the current agent state for an instrument.

```typescript
// Response 200
AgentStateSnapshot

// Response 404
{ error: 'No agent state for this instrument/config' }
```

---

### 6.5 Health Check

**GET `/health`**

```typescript
// Response 200
{
  status: 'ok';
  version: string;
  uptime: number;
  database: 'connected' | 'disconnected';
  vectorStore: 'connected' | 'disconnected';
}
```

---

## 7. Shared TypeScript Types

These types should be published as a shared package or copied identically between frontend and backend codebases. They represent the integration contract and must stay in sync.

```typescript
// shared/types/trading.ts

// === Enums ===
export type TfConfig = 'A' | 'B';
export type AgentStateName =
  | 'IDLE' | 'NAVIGATING' | 'SCANNING' | 'BREAKOUT_DETECTED'
  | 'AWAITING_PULLBACK' | 'PULLBACK_TESTING' | 'MISSED' | 'INVALIDATED';
export type TradeDirection = 'long' | 'short';
export type TrendlineType = 'resistance' | 'support';
export type TrendlineStatus = 'intact' | 'broken' | 'role_reversed';
export type MomentumClassification = 'normal' | 'large' | 'extreme';
export type MomentumDirection = 'bullish' | 'bearish';
export type TrendLabel = 'Uptrend' | 'Downtrend' | 'Ranging';
export type PatternType = 'double_bottom' | 'double_top' | 'higher_low' | 'lower_high' | 'hammer' | 'engulfing';
export type PatternStatus = 'none' | 'forming' | 'completed';
export type Urgency = 'low' | 'medium' | 'high';
export type MessageRole = 'user' | 'agent' | 'system' | 'alert';
export type BreakoutType = 'Continuation' | 'Reversal';

// === Data Structures ===
// (All interfaces defined in Sections 5.1–5.7 above)

// === TF Config Mapping ===
export interface TfConfigMapping {
  navigation: [string, string];
  decision: [string, string, string];
  execution: [string, string];
}

export const TF_CONFIGS: Record<TfConfig, TfConfigMapping> = {
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
```

---

## 8. Error Codes and Handling

### 8.1 WebSocket Error Codes

| Code | Description | Client Action |
|---|---|---|
| `AUTH_INVALID` | JWT token is invalid or expired | Refresh token, reconnect |
| `AUTH_EXPIRED` | JWT token expired during session | Refresh token, reconnect |
| `CONVERSATION_NOT_FOUND` | Requested conversation does not exist | Show error, redirect to new chat |
| `INSTRUMENT_NOT_SUPPORTED` | Requested instrument is not in the system | Show toast notification |
| `INSTRUMENT_NO_DATA` | Instrument exists but no data available | Show warning in chat |
| `AGENT_EVALUATION_FAILED` | Agent evaluation cycle threw an error | Show error message in chat with retry |
| `LLM_API_ERROR` | Claude API call failed | Show error, suggest retry |
| `LLM_RATE_LIMITED` | Claude API rate limit hit | Show message: "Please wait a moment" |
| `RATE_LIMITED` | Client is sending messages too frequently | Show throttle message |
| `INTERNAL_ERROR` | Unexpected server error | Show generic error |

### 8.2 REST HTTP Status Codes

| Status | Usage |
|---|---|
| 200 | Successful GET/PATCH |
| 201 | Successful POST (resource created) |
| 204 | Successful DELETE (no content) |
| 400 | Bad request (invalid payload, missing fields) |
| 401 | Authentication required or token invalid |
| 403 | Forbidden (not authorized for this resource) |
| 404 | Resource not found |
| 409 | Conflict (e.g., duplicate email) |
| 429 | Rate limited |
| 500 | Internal server error |

### 8.3 Error Response Format (REST)

```typescript
interface ErrorResponse {
  error: string;          // Machine-readable error code
  message: string;        // Human-readable message
  details?: any;          // Optional additional context
}
```

---

## 9. Data Flow Sequences

### 9.1 Sequence: User Opens Dashboard (Initial Load)

```
Frontend                            Backend
   │                                   │
   ├── GET /conversations              │
   │   ←── 200: conversation list      │
   │                                   │
   ├── Connect WebSocket               │
   │   (auth: { token })               │
   │   ←── connect                     │
   │   (auto-join user:{userId})       │
   │                                   │
   ├── emit join_conversation          │
   │   { conversationId: last_used }   │
   │   ←── instrument_context          │
   │       { instrument, chart, cards }│
   │                                   │
   ├── GET /conversations/:id/messages │
   │   ←── 200: message history        │
   │                                   │
   ▼ Render dashboard with data        │
```

### 9.2 Sequence: User Sends Chat Message (Same Instrument)

```
Frontend                            Backend
   │                                   │
   ├── emit chat_message               │
   │   { conversationId,               │
   │     message: "Show convergence",  │
   │     instrument: "XAUUSD",         │
   │     tfConfig: "A" }               │
   │                                   │
   │   [Backend processes...]           │
   │   - Save user message             │
   │   - Parse intent                  │
   │   - Read agent state              │
   │   - Generate response             │
   │   - Save agent message            │
   │                                   │
   │   ←── agent_response              │
   │       { message, agentState,      │
   │         convergence }             │
   │                                   │
   ▼ Append message to chat            │
```

### 9.3 Sequence: User Sends Chat Message (Different Instrument)

```
Frontend                            Backend
   │                                   │
   ├── emit chat_message               │
   │   { conversationId,               │
   │     message: "Analyze EURUSD",    │
   │     instrument: "XAUUSD",         │  ← was XAUUSD
   │     tfConfig: "A" }               │
   │                                   │
   │   [Backend detects EURUSD in msg] │
   │   - Extract instrument: EURUSD    │
   │   - Update conversation record    │
   │   - Assemble EURUSD chart + cards │
   │   - Run evaluation for EURUSD     │
   │                                   │
   │   ←── instrument_context          │  ← FIRST: new instrument data
   │       { instrument: "EURUSD",     │
   │         tfConfig: "A",            │
   │         chart: {...}, cards: {...}}│
   │                                   │
   │   ←── agent_response              │  ← THEN: analysis response
   │       { message: "EURUSD H1:..." }│
   │                                   │
   ▼ Update chart + cards + chat       │
```

### 9.4 Sequence: User Switches Conversation (Sidebar Click)

```
Frontend                            Backend
   │                                   │
   ├── emit leave_conversation         │
   │   { conversationId: old_conv }    │
   │                                   │
   ├── emit join_conversation          │
   │   { conversationId: new_conv }    │
   │                                   │
   │   [Backend loads conversation]    │
   │   - Find conversation record      │
   │   - Assemble instrument context   │
   │                                   │
   │   ←── instrument_context          │
   │       { instrument, chart, cards }│
   │                                   │
   ├── GET /conversations/:id/messages │
   │   ←── 200: message history        │
   │                                   │
   ▼ Render new conversation           │
```

### 9.5 Sequence: Cron-Triggered Evaluation (Auto Alert)

```
Backend (Cron)                      Frontend
   │                                   │
   ├── Cron fires: @Cron('0 * * * *') │
   │                                   │
   ├── Load all active agent states    │
   │                                   │
   ├── For each active instrument:     │
   │   ├── Run evaluation cycle        │
   │   ├── State transitions?          │
   │   │   YES:                        │
   │   │   ├── emit state_change_alert │──►│
   │   │   │   to user:{userId} room   │   │
   │   │   │                           │   ├── Show alert in chat
   │   │   │                           │   ├── Show badge in sidebar
   │   │   │                           │   └── Play notification sound
   │   │   │                           │   │
   │   │   NO:                         │   │
   │   │   └── (no event emitted)      │   │
   │   │                               │   │
   │   └── Persist updated state       │   │
   │                                   │   │
   ▼ Cycle complete                    ▼   │
```

### 9.6 Sequence: Timeframe Tab Switch

```
Frontend                            Backend
   │                                   │
   ├── User clicks "H2" tab           │
   │                                   │
   ├── emit request_chart_data         │
   │   { instrument: "XAUUSD",        │
   │     timeframe: "H2",             │
   │     lookback: 300 }              │
   │                                   │
   │   [Backend queries PostgreSQL]    │
   │   - Fetch H2 candles             │
   │   - Fetch H2 trendlines          │
   │                                   │
   │   ←── chart_data_update           │
   │       { instrument: "XAUUSD",     │
   │         timeframe: "H2",          │
   │         candles: [...],           │
   │         trendlines: [...] }       │
   │                                   │
   ▼ Chart re-renders with H2 data    │
   │                                   │
   │ (Cards do NOT change —            │
   │  cards always show the 2-3-2      │
   │  multi-TF overview)               │
```

---

## 10. Rate Limits and Throttling

### 10.1 WebSocket Rate Limits

| Event | Limit | Window | Behavior on Exceed |
|---|---|---|---|
| `chat_message` | 10 messages | 60 seconds | Emit `error` with code `RATE_LIMITED` |
| `request_chart_data` | 20 requests | 60 seconds | Silently drop |
| `request_card_data` | 10 requests | 60 seconds | Silently drop |
| `join_conversation` | 30 joins | 60 seconds | Silently drop |

### 10.2 REST Rate Limits

| Endpoint Group | Limit | Window |
|---|---|---|
| `/auth/*` | 10 requests | 60 seconds |
| `/conversations` (GET) | 60 requests | 60 seconds |
| `/conversations` (POST/PATCH/DELETE) | 20 requests | 60 seconds |
| `/agent-state/*` | 30 requests | 60 seconds |

### 10.3 Claude API Throttling

The backend should implement a queue for Claude API calls to avoid hitting Anthropic rate limits:

- Max concurrent evaluations: 5
- Evaluation queue max depth: 20
- If queue is full, return `LLM_RATE_LIMITED` error to the client

---

_End of Integration Contract — Version 1.0_

# Frontend UI for Trading Strategy Mode — Architecture Design

## Document Information

**Document Version**: 1.0
**Date**: February 10, 2026
**Purpose**: Complete specification for implementing the Strategy Mode UI dropdown and session isolation architecture (Option 3) that integrates correctly and reliably with `State_Machine_Modification_for_txtai_Framework.md`.
**Scope**: Frontend UI, API layer, session management, txtai Agent lifecycle, and conversation history storage. Excludes backend state machine internals (covered in `State_Machine_Modification_for_txtai_Framework.md`).

---

## Table of Contents

1. [Option 3 Design Rationale](#1-option-3-design-rationale)
2. [Core Design Principles](#2-core-design-principles)
3. [Session Model — The Critical Isolation Layer](#3-session-model--the-critical-isolation-layer)
4. [Frontend Architecture (Next.js / React)](#4-frontend-architecture-nextjs--react)
5. [API Layer Architecture](#5-api-layer-architecture)
6. [txtai Agent Lifecycle Management](#6-txtai-agent-lifecycle-management)
7. [Conversation History Storage](#7-conversation-history-storage)
8. [Database Schema Additions](#8-database-schema-additions)
9. [End-to-End Flow Diagrams](#9-end-to-end-flow-diagrams)
10. [Error Handling and Edge Cases](#10-error-handling-and-edge-cases)
11. [Implementation Order](#11-implementation-order)

---

## 1. Option 3 Design Rationale

### 1.1 Why Option 3 Was Chosen

Option 3 was selected over simpler approaches for the following reasons:

| Option       | Approach                                    | Problem                                         |
| ------------ | ------------------------------------------- | ----------------------------------------------- |
| Option 1     | Reset LLM memory on config switch           | Disruptive UX, loses conversation context       |
| Option 2     | Inject config guard into every prompt       | LLM still has cross-config history — unreliable |
| **Option 3** | **Separate conversation thread per config** | **Complete isolation at all layers**            |

The backend database is already designed around `(instrument, tf_config)` composite keys, making Option 3 the natural architectural fit.

### 1.2 Agreed Workflow Specification

The following rules govern every chat session:

```
RULE 1: Strategy mode is selected ONCE — at session creation.
        It is LOCKED for the entire session lifetime.

RULE 2: Within a session, the user may freely discuss any instrument
        (EURUSD, XAUUSD, BTCUSD, etc.) — all using the locked tf_config.

RULE 3: Switching strategy mode requires starting a NEW chat session.
        No mid-session mode switching is permitted.

RULE 4: Each session has its own isolated txtai Agent instance
        with its own conversation memory.
        No LLM memory leaks between sessions.

RULE 5: The backend agent_state persists per (instrument, tf_config)
        across sessions. A session resuming config_a for EURUSD
        picks up exactly where the previous config_a session left off.
```

### 1.3 Three Strategy Modes

| Mode Label (UI)           | tf_config  | Primary TF | Sentiment TF | Market Condition    |
| ------------------------- | ---------- | ---------- | ------------ | ------------------- |
| H1 Trading Strategy Mode  | `config_a` | H1         | H4 (H1 × 4)  | Moderate volatility |
| H2 Trading Strategy Mode  | `config_b` | H2         | H8 (H2 × 4)  | High volatility     |
| M30 Trading Strategy Mode | `config_c` | M30        | H2 (M30 × 4) | Low volatility      |

---

## 2. Core Design Principles

### 2.1 Isolation at Every Layer

```
┌─────────────────────────────────────────────────────────────────┐
│  ISOLATION REQUIREMENTS                                         │
├──────────────────────┬──────────────────────────────────────────┤
│  Layer               │  Isolation Unit                          │
├──────────────────────┼──────────────────────────────────────────┤
│  LLM Memory          │  Per session_id (txtai Agent instance)   │
│  Conversation History│  Per session_id (chat_sessions DB table) │
│  State Machine       │  Per (instrument, tf_config) — existing  │
│  UI Context          │  Per session_id (React session context)  │
│  API Routing         │  session_id → tf_config binding          │
└──────────────────────┴──────────────────────────────────────────┘
```

### 2.2 tf_config Is Immutable After Session Creation

Once a session is created with a `tf_config`, that value:

- Is stored in the database (`chat_sessions` table)
- Is returned with every API response for UI display
- Is enforced server-side — the API rejects any message that carries a mismatched `tf_config`
- Cannot be updated via any endpoint

### 2.3 Multi-Symbol, Single Config

Within one session, instruments change freely but `tf_config` never changes:

```
session_id: abc123   tf_config: config_a   (locked)

Message 1:  instrument=EURUSD  → loads agent_state(EURUSD,  config_a)
Message 2:  instrument=XAUUSD  → loads agent_state(XAUUSD,  config_a)
Message 3:  instrument=BTCUSD  → loads agent_state(BTCUSD,  config_a)
Message 4:  instrument=EURUSD  → loads agent_state(EURUSD,  config_a)  ← same state as message 1
```

All market data, trendline references, Keltner readings, and convergence scores in the LLM context window share the same timeframe structure throughout.

---

## 3. Session Model — The Critical Isolation Layer

### 3.1 What a Session Is

A **chat session** is the binding unit that ties together:

```
chat_session {
    session_id   : UUID               ← unique identifier
    user_id      : UUID               ← owner
    tf_config    : config_a/b/c       ← LOCKED at creation
    label        : "H1 Strategy Mode" ← display name
    created_at   : timestamp
    last_active  : timestamp
    is_active    : boolean
    agent_handle : in-memory ref      ← live txtai Agent (one per session)
}
```

### 3.2 Session Lifecycle

```
CREATE SESSION
    │
    ├─ User selects tf_config from dropdown
    ├─ POST /api/sessions  {tf_config: "config_a"}
    ├─ session_id generated, tf_config stored immutably
    ├─ txtai Agent instance created for this session
    │
    ▼
ACTIVE SESSION
    │
    ├─ User sends messages (any instrument)
    ├─ POST /api/sessions/{session_id}/messages
    │   {user_query, instrument}       ← tf_config NOT in body — read from session
    ├─ Agent responds using locked tf_config
    │
    ▼
SESSION END
    │
    ├─ User closes chat OR session times out after inactivity
    ├─ txtai Agent instance destroyed (memory released)
    ├─ Conversation transcript saved to DB
    ├─ agent_state per (instrument, tf_config) persists in DB → survives session end
    │
    ▼
SESSION RESUME (future session, same config)
    │
    ├─ New session created with same tf_config
    ├─ New txtai Agent instance (fresh LLM memory)
    ├─ agent_state loaded from DB → picks up previous state machine progress
    └─ Previous conversation transcript available as read-only history
```

### 3.3 Why a New txtai Agent Instance Per Session

The backend `handle_user_chat()` uses:

```python
response = app.agent("trading_agent", augmented_query)
```

`app.agent` maintains conversation memory internally (txtai Agent memory). If a **single global `app` instance** is shared across all sessions, all sessions share the same LLM memory — this breaks isolation entirely.

**Solution**: each session gets its own `Application` instance (or isolated agent context), so LLM memory is scoped to `session_id`.

---

## 4. Frontend Architecture (Next.js / React)

### 4.1 Strategy Mode Dropdown Component

#### Component: `StrategyModeSelector`

```
Location: components/chat/StrategyModeSelector.tsx

Props:
  onSelect: (tf_config: TfConfig) => void
  disabled: boolean        ← true once session is created

States:
  TfConfig = "config_a" | "config_b" | "config_c"
```

**Rendered UI:**

```
┌─────────────────────────────────────────┐
│  Select Trading Strategy Mode           │
│  ┌───────────────────────────────────┐  │
│  │  H1 Trading Strategy Mode    ▼   │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Dropdown options:                      │
│  ○ H1 Trading Strategy Mode             │
│    Moderate volatility · H1 primary     │
│  ○ H2 Trading Strategy Mode             │
│    High volatility · H2 primary         │
│  ○ M30 Trading Strategy Mode            │
│    Low volatility · M30 primary         │
│                                         │
│  [ Start Chat ]                         │
└─────────────────────────────────────────┘
```

**Mode Lock Behaviour:**

- Dropdown is **enabled** only on the "New Chat" screen (before session creation)
- Once `POST /api/sessions` succeeds, dropdown is **disabled and visually locked**
- A mode badge replaces the dropdown in the active chat header:

```
┌─────────────────────────────────────────────────────┐
│  XAUUSD  ▼   │   H1 Trading Strategy Mode  🔒      │
└─────────────────────────────────────────────────────┘
```

#### Mode Option Specification

| Display Label             | tf_config  | Subtitle            | Badge Colour |
| ------------------------- | ---------- | ------------------- | ------------ |
| H1 Trading Strategy Mode  | `config_a` | Moderate volatility | Blue         |
| H2 Trading Strategy Mode  | `config_b` | High volatility     | Orange       |
| M30 Trading Strategy Mode | `config_c` | Low volatility      | Green        |

---

### 4.2 Session Context (React)

#### Context: `SessionContext`

```typescript
// context/SessionContext.tsx

interface SessionContext {
  session_id: string | null;
  tf_config: 'config_a' | 'config_b' | 'config_c' | null;
  mode_label: string | null; // "H1 Trading Strategy Mode"
  is_locked: boolean; // true once session created
  instrument: string | null; // currently active symbol
  setInstrument: (symbol: string) => void;
}
```

This context is the **single source of truth** for the active session. Every component that needs `tf_config` reads it from here — never from local state or URL params alone — ensuring no component can accidentally send a mismatched config.

---

### 4.3 Instrument Selector

Within an active session, the user may switch symbols freely. The instrument selector is always visible in the chat header:

```
┌───────────────────────────────────────────────────────────────┐
│  [ XAUUSD  ▼ ]   │   H1 Trading Strategy Mode  🔒           │
│                                                               │
│  Available symbols: EURUSD, XAUUSD, BTCUSD, GBPUSD, ...      │
│  (configured via INSTRUMENTS env var)                         │
└───────────────────────────────────────────────────────────────┘
```

**Behaviour:**

- Changing symbol does NOT change `tf_config`
- Each symbol switch loads the corresponding `agent_state(instrument, tf_config)` for display in the state panel
- The LLM conversation history carries forward — the agent naturally understands multi-symbol discussion within the same config

---

### 4.4 Chat Session List (Sidebar)

Each past and active session is shown in the sidebar with its mode label:

```
┌────────────────────────────────┐
│  PINNED CHATS                  │
│  ○ Strategy Analysis XAUUSD    │
│                                │
│  RECENT                        │
│  ● XAUUSD H1 BUY  · 10 min ago │  ← config_a (H1 mode) indicator
│    I'll help with that analysi │
│                                │
│  ○ EURUSD H1 BUY  · 17 min ago │  ← config_a (H1 mode)
│                                │
│  ○ XAUUSD M30    · 1 hr ago    │  ← config_c (M30 mode) indicator
│                                │
│  [ + New Chat ]                │
└────────────────────────────────┘
```

**Session list item data:**

- Session title (instrument + direction + state)
- Mode indicator badge (H1 / H2 / M30)
- Last active timestamp
- Current state machine phase (SCANNING, AWAITING_PULLBACK, etc.)

---

### 4.5 State Panel (Right Sidebar)

Displays the live `agent_state` for the currently selected `(instrument, tf_config)` pair:

```
┌──────────────────────────────────┐
│  XAUUSD  H2   [ R : 2673.93 ]   │  ← Navigation TF (config_a: H4/H2)
│  H4 KC Zone : 6                  │
│  H4 S&R Zone : 2                 │
├──────────────────────────────────┤
│  XAUUSD  H1   [ Resistant ]      │  ← Decision TF (config_a: H2/H1/M30)
│  Keltner Zone : 5                │
│  S & R Zone  : 2                 │
│  Slope       : 26                │
│  Trend       : Uptrend           │
├──────────────────────────────────┤
│  XAUUSD  M30  [ Support ]        │  ← Granular TF
│  Keltner Zone : 4                │
│  Slope       : 36.5              │
│  Trend       : Downtrend         │
│  % Breakout  : 32% (Reversal)    │
└──────────────────────────────────┘
```

**Important:** The timeframes displayed in the state panel are determined by `tf_config`:

| tf_config | Navigation panel TFs | Decision panel TFs |
| --------- | -------------------- | ------------------ |
| config_a  | H4, H2               | H2, H1, M30        |
| config_b  | H8, H4               | H4, H2, H1         |
| config_c  | H2, H1               | H1, M30, M15       |

The state panel component reads `tf_config` from `SessionContext` and renders accordingly.

---

## 5. API Layer Architecture

### 5.1 Endpoint Overview

```
POST   /api/sessions                        ← Create session (locks tf_config)
GET    /api/sessions                        ← List user's sessions
GET    /api/sessions/{session_id}           ← Get session metadata
POST   /api/sessions/{session_id}/messages  ← Send a message
GET    /api/sessions/{session_id}/messages  ← Get conversation history
DELETE /api/sessions/{session_id}           ← End / archive session
GET    /api/sessions/{session_id}/state     ← Get current agent_state for (instrument, tf_config)
```

---

### 5.2 POST /api/sessions — Create Session

**Request:**

```json
{
  "tf_config": "config_a",
  "title": "XAUUSD H1 Analysis" // optional, auto-generated if omitted
}
```

**Response:**

```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "tf_config": "config_a",
  "mode_label": "H1 Trading Strategy Mode",
  "created_at": "2026-02-10T09:00:00Z",
  "is_active": true
}
```

**Server-side actions:**

1. Validate `tf_config` ∈ `{"config_a", "config_b", "config_c"}`
2. Insert row into `chat_sessions` table
3. Instantiate a new txtai `Application` / Agent for this `session_id`
4. Store the agent handle in the session registry (in-memory map: `session_id → agent`)
5. Return session metadata

---

### 5.3 POST /api/sessions/{session_id}/messages — Send Message

**Request:**

```json
{
  "user_query": "What is the current setup on XAUUSD?",
  "instrument": "XAUUSD"
}
```

**Note:** `tf_config` is NOT in the request body. It is read server-side from the session record. This is the enforcement mechanism that prevents any client-side manipulation.

**Response:**

```json
{
  "message_id": "msg_001",
  "session_id": "550e8400-...",
  "tf_config": "config_a",
  "instrument": "XAUUSD",
  "user_query": "What is the current setup on XAUUSD?",
  "agent_response": "XAUUSD H1 uptrend in SCANNING state. Monitoring for breakout...",
  "agent_state_snapshot": {
    "current_state": "SCANNING",
    "regime_classification": "Moderate Bullish",
    "convergence_score": 3.2
  },
  "timestamp": "2026-02-10T09:05:00Z"
}
```

**Server-side actions:**

1. Look up `session_id` → retrieve `tf_config` from DB (never trust client)
2. Retrieve the agent handle from the session registry
3. Call `handle_user_chat(app=session_agent, user_query, instrument, tf_config)`
4. Append message + response to `chat_messages` table
5. Return response with `tf_config` echoed for UI confirmation

---

### 5.4 GET /api/sessions/{session_id}/state — Agent State Query

Allows the frontend state panel to poll or refresh the current `agent_state` for a given `(instrument, tf_config)` pair without sending a chat message:

**Request query params:** `?instrument=XAUUSD`

**Response:**

```json
{
  "instrument": "XAUUSD",
  "tf_config": "config_a",
  "current_state": "AWAITING_PULLBACK",
  "regime_classification": "Moderate Bullish",
  "convergence_score": 6.8,
  "keltner_band_position": 5,
  "keltner_sentiment_zone": "NORMAL_PULLBACK",
  "bars_in_state": 3,
  "last_evaluation_time": "2026-02-10T09:00:00Z"
}
```

---

### 5.5 API Validation — tf_config Enforcement

Every message endpoint performs server-side validation:

```python
# File: api/routes/sessions.py

@router.post("/sessions/{session_id}/messages")
async def send_message(session_id: str, body: MessageRequest):

    # 1. Load session — get immutable tf_config
    session = db.get_session(session_id)
    if not session or not session.is_active:
        raise HTTPException(404, "Session not found or inactive")

    tf_config = session.tf_config   # ← server-side only, never from body

    # 2. Validate instrument
    if body.instrument not in ALLOWED_INSTRUMENTS:
        raise HTTPException(400, f"Unknown instrument: {body.instrument}")

    # 3. Get isolated agent for this session
    agent = session_registry.get(session_id)
    if not agent:
        raise HTTPException(503, "Agent not available — session may have expired")

    # 4. Run chat handler with locked tf_config
    result = handle_user_chat(
        app=agent,
        user_query=body.user_query,
        instrument=body.instrument,
        tf_config=tf_config          # from DB, never from request body
    )

    return MessageResponse(tf_config=tf_config, **result)
```

---

## 6. txtai Agent Lifecycle Management

### 6.1 The Problem

`handle_user_chat()` calls `app.agent("trading_agent", augmented_query)`. The txtai `Application` object maintains agent memory internally. If one global `app` instance is shared, all users and all sessions share the same LLM memory — a fundamental isolation failure.

### 6.2 Session Registry

A server-side in-memory registry maps `session_id` to a dedicated agent instance:

```python
# File: services/session_registry.py

from txtai import Application
from typing import Dict
from datetime import datetime, timedelta

class SessionRegistry:
    """Manages one txtai Application instance per active chat session."""

    def __init__(self, config_path: str, inactivity_timeout_minutes: int = 60):
        self._registry: Dict[str, dict] = {}
        self._config_path = config_path
        self._timeout = timedelta(minutes=inactivity_timeout_minutes)

    def create(self, session_id: str, tf_config: str) -> Application:
        """Create a new isolated txtai Agent for a session."""
        app = Application(self._config_path)
        self._registry[session_id] = {
            "agent": app,
            "tf_config": tf_config,
            "last_active": datetime.utcnow(),
        }
        return app

    def get(self, session_id: str) -> Application | None:
        """Retrieve the agent for an active session. Updates last_active."""
        entry = self._registry.get(session_id)
        if not entry:
            return None
        entry["last_active"] = datetime.utcnow()
        return entry["agent"]

    def destroy(self, session_id: str) -> None:
        """Destroy the agent and release its memory."""
        if session_id in self._registry:
            del self._registry[session_id]

    def evict_inactive(self) -> None:
        """Evict sessions that have been inactive beyond the timeout."""
        cutoff = datetime.utcnow() - self._timeout
        stale = [sid for sid, e in self._registry.items()
                 if e["last_active"] < cutoff]
        for sid in stale:
            self.destroy(sid)

# Global singleton — initialised once at application startup
session_registry = SessionRegistry(config_path="config/txtai_app.yml")
```

**Eviction:** A background task calls `session_registry.evict_inactive()` periodically (e.g. every 15 minutes) to release memory from idle sessions.

### 6.3 Agent Instance Properties

Each `Application` instance created by `SessionRegistry.create()` has:

- Its own `LLM` pipeline → its own conversation memory
- Its own `Embeddings` reference (shared read-only VectorDB is fine — no writes)
- Its own `Workflow` schedule is NOT created per session (cron evaluation runs at server level, not per session)
- Its own tool-call state

```
Session A (config_a):  app_a → agent memory contains only config_a analysis
Session B (config_b):  app_b → agent memory contains only config_b analysis
Session C (config_c):  app_c → agent memory contains only config_c analysis

Zero memory leak between sessions. ✅
```

---

## 7. Conversation History Storage

### 7.1 Separation of Concerns

The backend document (`State_Machine_Modification_for_txtai_Framework.md`) stores `chat_history` inside txtai Agent memory (in-process, RAM). This is appropriate for the live session but does not persist across session restarts.

A separate persistent store is needed for:

- Displaying past conversations when the user reopens a session
- Audit log
- Session list preview (last message snippet in sidebar)

### 7.2 Chat Messages Table

```sql
-- Migration: chat_messages table
CREATE TABLE chat_messages (
    id             BIGSERIAL PRIMARY KEY,
    session_id     UUID NOT NULL REFERENCES chat_sessions(session_id) ON DELETE CASCADE,
    message_index  INT NOT NULL,              -- ordering within session

    -- Message content
    role           VARCHAR(10) NOT NULL,      -- 'user' or 'assistant'
    content        TEXT NOT NULL,

    -- Context at time of message
    instrument     VARCHAR(20),               -- instrument discussed in this message
    tf_config      VARCHAR(10) NOT NULL,      -- always matches session's tf_config

    -- Agent state snapshot (for display in state panel history)
    state_snapshot JSONB,                     -- {current_state, convergence_score, regime, ...}

    -- Audit
    created_at     TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE (session_id, message_index)
);

CREATE INDEX idx_chat_messages_session ON chat_messages (session_id, message_index);
```

### 7.3 Relationship Between Chat History and Agent State

```
chat_messages table                  agent_state table
─────────────────────────────        ──────────────────────────────────────
Per session_id                       Per (instrument, tf_config)
Stores conversation transcript       Stores state machine evaluation data
Persists for user review             Persists for trading continuity
Grows indefinitely (append-only)     Updated in-place (upsert)
Scoped to ONE tf_config              Shared across sessions of same tf_config
```

---

## 8. Database Schema Additions

### 8.1 chat_sessions Table

```sql
-- Migration: chat_sessions table
CREATE TABLE chat_sessions (
    session_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,

    -- Strategy mode — IMMUTABLE after creation
    tf_config       VARCHAR(10) NOT NULL
                    CHECK (tf_config IN ('config_a', 'config_b', 'config_c')),
    mode_label      VARCHAR(50) NOT NULL,   -- "H1 Trading Strategy Mode"

    -- Display
    title           VARCHAR(200),           -- user-visible session title

    -- Lifecycle
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    last_active_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    ended_at        TIMESTAMP,

    -- Stats
    message_count   INT NOT NULL DEFAULT 0
);

-- No UPDATE of tf_config permitted — enforced by application layer.
-- The column has no trigger because the enforcement is in the API layer.

CREATE INDEX idx_chat_sessions_user ON chat_sessions (user_id, last_active_at DESC);
CREATE INDEX idx_chat_sessions_config ON chat_sessions (user_id, tf_config);
```

### 8.2 Schema Relationship Diagram

```
users
  │
  └── chat_sessions (session_id, tf_config ← IMMUTABLE)
          │
          └── chat_messages (session_id, instrument, tf_config, content)


agent_state (instrument, tf_config) ← INDEPENDENT of sessions
  │
  └── Shared by all sessions with the same tf_config for the same instrument
      e.g. all config_a sessions for EURUSD read/affect the same agent_state row
```

### 8.3 Key Relationship: Sessions vs. Agent State

```
Two different users both start config_a sessions for EURUSD:

  User A, Session 1 (config_a):  reads/writes agent_state(EURUSD, config_a)
  User B, Session 2 (config_a):  reads/writes agent_state(EURUSD, config_a)  ← SAME ROW

Decision required: Is agent_state per-user or shared?

Recommendation: Per-user.
Add user_id to agent_state composite key: (user_id, instrument, tf_config)

This prevents User A's state machine progress from being overwritten
by User B's evaluation cycle on the same instrument.
```

**Update to agent_state schema:**

```sql
-- Add user_id to existing agent_state table
ALTER TABLE agent_state ADD COLUMN user_id UUID;
ALTER TABLE agent_state DROP CONSTRAINT unique_instrument_config;
ALTER TABLE agent_state ADD CONSTRAINT unique_user_instrument_config
    UNIQUE (user_id, instrument, tf_config);
```

---

## 9. End-to-End Flow Diagrams

### 9.1 New Session Creation Flow

```
USER                    FRONTEND              API LAYER              DATABASE
 │                          │                     │                      │
 │  Opens "New Chat"        │                     │                      │
 │─────────────────────────>│                     │                      │
 │                          │ Show mode dropdown  │                      │
 │                          │<────────────────────│                      │
 │  Selects "H1 Strategy"   │                     │                      │
 │─────────────────────────>│                     │                      │
 │                          │ POST /api/sessions  │                      │
 │                          │ {tf_config:config_a}│                      │
 │                          │────────────────────>│                      │
 │                          │                     │ INSERT chat_sessions │
 │                          │                     │─────────────────────>│
 │                          │                     │ Create agent instance│
 │                          │                     │ Register in registry │
 │                          │                     │<─────────────────────│
 │                          │ {session_id, config}│                      │
 │                          │<────────────────────│                      │
 │                          │ Lock dropdown       │                      │
 │                          │ Show mode badge 🔒  │                      │
 │  Chat ready              │                     │                      │
 │<─────────────────────────│                     │                      │
```

### 9.2 Message Flow Within Active Session

```
USER                    FRONTEND              API LAYER              BACKEND SERVICES
 │                          │                     │                         │
 │  Types: "Analyse XAUUSD" │                     │                         │
 │─────────────────────────>│                     │                         │
 │                          │ POST /sessions/     │                         │
 │                          │  {session_id}/      │                         │
 │                          │  messages           │                         │
 │                          │ {user_query,        │                         │
 │                          │  instrument:XAUUSD} │                         │
 │                          │ (NO tf_config)      │                         │
 │                          │────────────────────>│                         │
 │                          │                     │ Load session → config_a │
 │                          │                     │ Get agent from registry │
 │                          │                     │─────────────────────────>
 │                          │                     │  handle_user_chat(      │
 │                          │                     │    app=session_agent,   │
 │                          │                     │    query, XAUUSD,       │
 │                          │                     │    tf_config=config_a)  │
 │                          │                     │<─────────────────────────
 │                          │                     │ Save to chat_messages   │
 │                          │ {response,          │                         │
 │                          │  state_snapshot}    │                         │
 │                          │<────────────────────│                         │
 │  AI response displayed   │                     │                         │
 │<─────────────────────────│                     │                         │
```

### 9.3 Strategy Mode Switch — Requires New Session

```
USER                    FRONTEND
 │                          │
 │  Wants H2 mode           │
 │  (currently in H1 session)
 │                          │
 │  Tries to change dropdown│  ← Dropdown is DISABLED (🔒)
 │─────────────────────────>│
 │                          │ Show tooltip:
 │                          │ "Strategy mode is locked for this session.
 │<─────────────────────────│  Start a new chat to use H2 mode."
 │                          │
 │  Clicks "New Chat"       │
 │─────────────────────────>│
 │                          │ Opens new session screen
 │                          │ Dropdown ENABLED again
 │  Selects "H2 Strategy"   │
 │─────────────────────────>│
 │                          │ POST /api/sessions {tf_config: "config_b"}
 │                          │ New session, new agent instance
 │                          │ LLM memory = EMPTY (no H1 contamination) ✅
```

---

## 10. Error Handling and Edge Cases

### 10.1 Session Not Found

```
Client sends message to expired/deleted session_id:
→ API returns 404 {"error": "Session not found or inactive"}
→ Frontend redirects user to session list
→ User creates new session
```

### 10.2 Agent Evicted from Registry (Session Timeout)

```
User was inactive for >60 min. Agent was evicted from registry.
User sends a new message:

→ API: session exists in DB but no agent in registry
→ API: re-instantiates agent for session_id
→ API: agent memory is EMPTY (fresh start)
→ API: agent_state loaded from DB → trading state machine context preserved
→ Response: agent responds without conversation memory but with
            full state machine context (no data loss for trading evaluation)

Frontend display: Show subtle notice:
"Session resumed. Previous conversation context was cleared due to inactivity."
```

### 10.3 Client-Side tf_config Tampering (Security)

```
Malicious client sends:
POST /sessions/{session_id}/messages
Body: {user_query: "...", instrument: "EURUSD", tf_config: "config_b"}  ← injected

→ API IGNORES tf_config in request body entirely
→ tf_config is ALWAYS read from chat_sessions table in DB
→ No way to override session's locked tf_config from client side ✅
```

### 10.4 Invalid Instrument

```
Client sends instrument not in INSTRUMENTS config:
→ API returns 400 {"error": "Unknown instrument: FOOBAR"}
→ Frontend shows inline validation error in instrument selector
```

### 10.5 Concurrent Sessions — Same Config, Same Instrument

```
User has two browser tabs open:
  Tab A: Session 1, config_a, EURUSD
  Tab B: Session 2, config_a, EURUSD

Both sessions read/write agent_state(user_id, EURUSD, config_a) — same row.
The evaluation cycle (cron) also writes this row.

Risk: Concurrent writes causing state corruption.

Mitigation: The existing optimistic locking in the evaluation pipeline
            (PostgreSQL JSONB upsert) handles this.
            For chat queries: handle_user_chat() is READ-ONLY on agent_state
            (only the evaluation cycle modifies it — by design per Section 9.1
            of State_Machine_Modification_for_txtai_Framework.md).
            No write conflict from concurrent chat sessions. ✅
```

---

## 11. Implementation Order

| Step | Component           | File                                       | What to Build                                                        | Depends On                     |
| ---- | ------------------- | ------------------------------------------ | -------------------------------------------------------------------- | ------------------------------ |
| 1    | DB Migration        | `migrations/003_chat_sessions.sql`         | `chat_sessions` + `chat_messages` tables, `user_id` on `agent_state` | —                              |
| 2    | Session Registry    | `services/session_registry.py`             | Per-session agent instantiation, eviction                            | txtai Application              |
| 3    | Session API         | `api/routes/sessions.py`                   | POST/GET sessions, POST messages, GET state                          | Session Registry, DB           |
| 4    | chat_handler update | `services/agent/chat_handler.py`           | Accept per-session agent, save messages to DB                        | Session API                    |
| 5    | Mode Selector       | `components/chat/StrategyModeSelector.tsx` | Dropdown + lock behaviour                                            | —                              |
| 6    | Session Context     | `context/SessionContext.tsx`               | React context with tf_config + instrument                            | Mode Selector                  |
| 7    | Instrument Selector | `components/chat/InstrumentSelector.tsx`   | Symbol switcher within session                                       | Session Context                |
| 8    | State Panel         | `components/chat/StatePanel.tsx`           | Config-aware TF display                                              | Session Context, GET state API |
| 9    | Chat UI             | `components/chat/ChatWindow.tsx`           | Message thread, session history                                      | Session Context, Messages API  |
| 10   | Session List        | `components/chat/SessionList.tsx`          | Sidebar with mode badges                                             | Sessions API                   |
| 11   | Eviction Task       | `services/session_registry.py`             | Background eviction of inactive agents                               | Session Registry               |

---

## Appendix A: Mode Configuration Reference

```python
# services/agent/config.py

STRATEGY_MODES = {
    "config_a": {
        "label":        "H1 Trading Strategy Mode",
        "primary_tf":   "H1",
        "sentiment_tf": "H4",
        "volatility":   "Moderate",
        "cron":         "0 * * * *",         # every hour
        "badge_colour": "blue",
        "navigation":   ["H4", "H2"],
        "decision":     ["H2", "H1", "M30"],
    },
    "config_b": {
        "label":        "H2 Trading Strategy Mode",
        "primary_tf":   "H2",
        "sentiment_tf": "H8",
        "volatility":   "High",
        "cron":         "0 */2 * * *",       # every 2 hours
        "badge_colour": "orange",
        "navigation":   ["H8", "H4"],
        "decision":     ["H4", "H2", "H1"],
    },
    "config_c": {
        "label":        "M30 Trading Strategy Mode",
        "primary_tf":   "M30",
        "sentiment_tf": "H2",
        "volatility":   "Low",
        "cron":         "*/30 * * * *",      # every 30 minutes
        "badge_colour": "green",
        "navigation":   ["H2", "H1"],
        "decision":     ["H1", "M30", "M15"],
    },
}
```

---

## Appendix B: Frontend State Panel TF Mapping

```typescript
// lib/strategyModeConfig.ts

export const STRATEGY_MODE_CONFIG = {
  config_a: {
    label: 'H1 Trading Strategy Mode',
    navTfs: ['H4', 'H2'],
    decisionTfs: ['H2', 'H1', 'M30'],
    sentimentTf: 'H4',
    badgeColour: 'blue',
  },
  config_b: {
    label: 'H2 Trading Strategy Mode',
    navTfs: ['H8', 'H4'],
    decisionTfs: ['H4', 'H2', 'H1'],
    sentimentTf: 'H8',
    badgeColour: 'orange',
  },
  config_c: {
    label: 'M30 Trading Strategy Mode',
    navTfs: ['H2', 'H1'],
    decisionTfs: ['H1', 'M30', 'M15'],
    sentimentTf: 'H2',
    badgeColour: 'green',
  },
} as const;

export type TfConfig = keyof typeof STRATEGY_MODE_CONFIG;
```

---

_This document specifies the complete frontend and session management architecture required to implement Option 3 (Separate conversation threads per config) reliably and coherently with `State_Machine_Modification_for_txtai_Framework.md`._

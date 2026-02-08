# Trading Instrument Chat Management — Architecture Design Document

**Document Version**: 1.0
**Date**: February 8, 2026
**Purpose**: Specification for how chats are flagged, grouped, and managed by trading instrument — ensuring 1 instrument = 1 chat, with permanent instrument badges, flag migration on new chat creation, and incoming alert message routing to existing threads.
**UI Reference**: DavinTrade screenshot — permanent "XAUUSD H4" / "EURUSD H1" badges on both sidebar chat entries and chat panel header.
**Related Documents**:
- `Incoming_Chat_Alert_Notifications_Architecture.md` (incoming chat delivery pipeline)
- `State_Machine_Modification_for_txtai_Framework.md` (State Machine states and transitions)

---

## Table of Contents

1. [Core Concept: 1 Instrument = 1 Chat](#1-core-concept-1-instrument--1-chat)
2. [Trading Instrument Badge](#2-trading-instrument-badge)
3. [How a Chat Gets Flagged](#3-how-a-chat-gets-flagged)
4. [Incoming Alert → Existing Chat Routing](#4-incoming-alert--existing-chat-routing)
5. [User Creates New Chat with Same Instrument (Flag Migration)](#5-user-creates-new-chat-with-same-instrument-flag-migration)
6. [User Queries Other Instruments in a Flagged Chat](#6-user-queries-other-instruments-in-a-flagged-chat)
7. [Chat Lifecycle: From Creation to Archival](#7-chat-lifecycle-from-creation-to-archival)
8. [Database Schema](#8-database-schema)
9. [Backend Logic: Instrument Flag Resolution](#9-backend-logic-instrument-flag-resolution)
10. [Backend Logic: Incoming Alert Thread Routing](#10-backend-logic-incoming-alert-thread-routing)
11. [Backend Logic: Flag Migration](#11-backend-logic-flag-migration)
12. [API Design](#12-api-design)
13. [Frontend UI: Chat Sidebar](#13-frontend-ui-chat-sidebar)
14. [Frontend UI: Chat Panel Header](#14-frontend-ui-chat-panel-header)
15. [Frontend UI: Badge Rendering Rules](#15-frontend-ui-badge-rendering-rules)
16. [Edge Cases](#16-edge-cases)
17. [Implementation Order](#17-implementation-order)

---

## 1. Core Concept: 1 Instrument = 1 Chat

### The Rule

Each trading instrument (symbol + timeframe pair) has **at most one active chat** per user at any time. All messages related to that instrument — both AI-generated incoming alerts and user-initiated conversations — live in the **same chat thread**.

```
1 Trading Instrument = 1 Chat

  XAUUSD H4  →  One chat thread  →  All breakout alerts + all user conversations
  EURUSD H1  →  One chat thread  →  All breakout alerts + all user conversations
  USDJPY H1  →  One chat thread  →  All breakout alerts + all user conversations
```

### Why This Rule Exists

Without this rule, each breakout event would create a new chat. A user subscribed to 3 instruments experiencing multiple breakouts over a month would end up with dozens of chats:

```
BAD (without the rule):
  XAUUSD H4 (breakout Jan 15)
  XAUUSD H4 (breakout Jan 22)     ← duplicate
  XAUUSD H4 (breakout Feb 1)      ← duplicate
  EURUSD H1 (breakout Jan 18)
  EURUSD H1 (breakout Jan 25)     ← duplicate
  ... 15+ chats for 3 instruments ← overwhelming sidebar

GOOD (with the rule):
  XAUUSD H4  (all breakouts + conversations in one thread)
  EURUSD H1  (all breakouts + conversations in one thread)
  USDJPY H1  (all breakouts + conversations in one thread)
  ... 3 chats for 3 instruments ← clean sidebar
```

---

## 2. Trading Instrument Badge

### What It Is

Every chat flagged with a trading instrument displays a **permanent, non-editable badge** showing the instrument's symbol and timeframe. This badge appears in two places:

1. **Chat Sidebar** — next to the chat entry in the sidebar list
2. **Chat Panel Header** — at the top of the conversation area when the chat is open

### UI Specification (From Screenshot)

```
┌──────────────────────────────────────────────────────────────────────┐
│  DavinTrade               New Chat                                    │
│                   ┌──────────────────────────────┐                   │
│                   │  Flagged as EURUSD H1         │ ◄── Permanent    │
│                   │  (cannot be renamed/removed)  │     Instrument   │
│                   └──────────────────────────────┘     Badge         │
│                   Start a conversation to begin trading analysis.    │
│                                                                      │
│ RECENT                                                               │
│ ┌────────────────────────────────────────────────────┐               │
│ │ → XAUUSD H4  SELL     10 Min Ago          (2)     │ ◄── Badge in  │
│ │   ┌──────────┐                                     │     sidebar   │
│ │   │XAUUSD H4 │  I'll help you with that analysis..│               │
│ │   └──────────┘                                     │               │
│ ├────────────────────────────────────────────────────┤               │
│ │ → EURUSD H1  BUY      17 Min Ago          (3)     │ ◄── Badge in  │
│ │   ┌──────────┐                                     │     sidebar   │
│ │   │EURUSD H1 │  I'll help you with that analysis..│               │
│ │   └──────────┘                                     │               │
│ └────────────────────────────────────────────────────┘               │
│                                                                      │
│ New Chat                                                             │
│   Start a conversation...  (no badge — unflagged)                   │
│                                                                      │
│ hi                                                                   │
│   I'll help you with...    (no badge — unflagged)                   │
└──────────────────────────────────────────────────────────────────────┘
```

### Badge Properties

| Property | Value |
|---|---|
| **Content** | `{SYMBOL} {TIMEFRAME}` (e.g., "XAUUSD H4", "EURUSD H1") |
| **Editable** | No — permanent, cannot be renamed or removed by user |
| **Removable** | No — badge persists for the lifetime of the chat |
| **Visual style** | Pill/tag shape, distinct background color, monospace font for symbol |
| **Placement: Sidebar** | Below the chat title line, left-aligned |
| **Placement: Header** | Right of the chat title in the conversation panel header |

### Chats WITHOUT a Badge

Not every chat has an instrument badge. Regular user-initiated chats that never discuss a specific instrument remain **unflagged**:

```
Flagged chats (have badge):
  → XAUUSD H4 SELL  [XAUUSD H4]   10 Min Ago  (2)
  → EURUSD H1 BUY   [EURUSD H1]   17 Min Ago  (3)

Unflagged chats (no badge):
  New Chat — Start a conversation...
  hi — I'll help you with...
```

---

## 3. How a Chat Gets Flagged

### Flag Assignment Rule

A chat is flagged with a trading instrument based on the **first** symbol+timeframe pair detected in the conversation. Once assigned, the flag **never changes** (except via flag migration — see Section 5).

### Two Ways a Chat Gets Flagged

#### Way 1: AI-Initiated (Incoming Breakout Alert)

When the State Machine detects a breakout, the ChatDispatcher creates or routes to a chat thread for that instrument. The chat is automatically flagged.

```
State Machine: BREAKOUT_DETECTED for (XAUUSD, H4, short)
       │
       ▼
ChatDispatcher finds or creates chat thread:
  ─ Flag: XAUUSD H4 (automatically assigned)
  ─ Badge: "XAUUSD H4" (permanent)
  ─ First message: Breakout advisory
```

#### Way 2: User-Initiated (User Starts Chat About an Instrument)

When a user creates a new chat and their first message references a specific instrument, the chat is flagged with that instrument.

```
User: "Analyze EURUSD H1 for me"
       │
       ▼
System detects instrument in message:
  ─ Symbol: EURUSD
  ─ Timeframe: H1
  ─ Flag: EURUSD H1 (assigned on first message)
  ─ Badge: "EURUSD H1" (permanent)
```

**Detection logic** (backend):
```python
# Extract instrument from user's first message in a new (unflagged) chat
SUPPORTED_SYMBOLS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "AUDUSD",
                     "BTCUSD", "ETHUSD", "XAGUSD", "NDX100", "US30",
                     "AUDJPY", "GBPJPY", "NZDUSD", "USDCAD", "USDCHF"]
SUPPORTED_TIMEFRAMES = ["M5", "M15", "M30", "H1", "H2", "H4", "H8", "H12", "D1"]

def detect_instrument(message: str) -> tuple[str, str] | None:
    """Detect instrument (symbol + timeframe) from user message.

    Returns (symbol, timeframe) if found, None otherwise.
    Only called for UNFLAGGED chats (chats that don't yet have an instrument).
    """
    message_upper = message.upper()
    found_symbol = None
    found_timeframe = None

    for symbol in SUPPORTED_SYMBOLS:
        if symbol in message_upper:
            found_symbol = symbol
            break

    for tf in SUPPORTED_TIMEFRAMES:
        if tf in message_upper:
            found_timeframe = tf
            break

    if found_symbol and found_timeframe:
        return (found_symbol, found_timeframe)
    return None
```

### What If No Instrument Is Detected?

If the user's first message doesn't reference a specific instrument (e.g., "hi", "what's trending?"), the chat remains **unflagged**. It can still be flagged later if the user mentions a specific instrument in a subsequent message — but only if the chat is still unflagged.

```
Once flagged → never changes (permanent)
If unflagged → can be flagged by a later message
```

---

## 4. Incoming Alert → Existing Chat Routing

### The Problem

When a new breakout is detected for XAUUSD H1, and the user already has an existing "XAUUSD H1" chat from a previous breakout, the system must route the new alert to the **existing chat** — not create a new one.

### Routing Logic

```
ChatDispatcher receives breakout alert for (XAUUSD, H1, user_id)
       │
       ▼
Query: Does this user have an active chat flagged as XAUUSD H1?
       │
       ├── YES → Route message to EXISTING chat
       │         ├── INSERT new chat_message into existing thread
       │         ├── UPDATE thread metadata (last_message_at, unread_count += 1)
       │         ├── Thread bumps to top of sidebar RECENT
       │         └── Unread badge increments
       │
       └── NO  → Create NEW chat
                 ├── Create chat_thread with flag = (XAUUSD, H1)
                 ├── INSERT first chat_message (breakout alert)
                 ├── Assign permanent badge: "XAUUSD H1"
                 └── Thread appears at top of sidebar RECENT
```

### What "Active Chat" Means

A chat is **active** if it has not been deleted by the user. Archived chats are still active (just hidden from the main view). Only hard-deleted chats are not active.

```
Chat states:
  VISIBLE   → in sidebar RECENT/PINNED → routes incoming alerts here
  ARCHIVED  → in Archive section       → routes incoming alerts here (chat un-archives on new message)
  DELETED   → permanently removed      → creates NEW chat for incoming alerts
```

If an archived chat receives a new incoming alert, it **automatically un-archives** and appears at the top of the sidebar.

---

## 5. User Creates New Chat with Same Instrument (Flag Migration)

### The Scenario

The user already has a chat flagged as "XAUUSD H1" (from a previous breakout or conversation). They now create a **new chat** and start talking about XAUUSD H1 again.

### Why This Happens

- The previous chat has old, stale conversation data
- The user wants a "fresh start" with updated market context
- The user pays more attention to the newest chat they created

### Flag Migration Rule

When a user creates a new chat that gets flagged with the **same instrument** as an existing chat:

1. The instrument flag **migrates** from the old chat to the new chat
2. The old chat loses its instrument badge (becomes unflagged)
3. Future incoming alerts for that instrument route to the **new** chat
4. The old chat's conversation history is preserved (not deleted)

```
BEFORE migration:
  Old chat: [XAUUSD H1] "Breakout detected..." (Jan 15)  ← has badge
  New chat: "Analyze XAUUSD H1 for me" (Feb 8)            ← no badge yet

DURING migration (triggered when new chat is flagged):
  Old chat: "Breakout detected..." (Jan 15)                ← badge REMOVED
  New chat: [XAUUSD H1] "Analyze XAUUSD H1 for me"       ← badge ASSIGNED

AFTER migration:
  Future incoming alerts for XAUUSD H1 → routed to NEW chat
  Old chat → still visible, still readable, just no longer flagged
```

### Migration Sequence

```
1. User sends first message in new chat: "What's happening with XAUUSD H1?"
       │
2. detect_instrument() → (XAUUSD, H1)
       │
3. Query: Does this user have another chat flagged as (XAUUSD, H1)?
       │
       ├── YES → MIGRATE flag
       │   ├── UPDATE old_chat: SET instrument_symbol = NULL, instrument_timeframe = NULL
       │   ├── UPDATE new_chat: SET instrument_symbol = 'XAUUSD', instrument_timeframe = 'H1'
       │   └── Future alerts → new_chat
       │
       └── NO → Simply flag the new chat
           └── UPDATE new_chat: SET instrument_symbol = 'XAUUSD', instrument_timeframe = 'H1'
```

### What Happens to the Old Chat After Migration

| Aspect | Old Chat (After Migration) |
|---|---|
| Badge | Removed — no longer shows "XAUUSD H1" |
| Conversation history | Preserved — user can still read old messages |
| Incoming alerts | No longer routed here — go to new chat instead |
| Visibility | Stays in sidebar at its current position (no change) |
| Deletable | Yes — user can delete it if they want |

---

## 6. User Queries Other Instruments in a Flagged Chat

### The Rule

A user can ask about **any** instrument within any chat. The AI will answer. But the chat's instrument flag **does not change**.

```
Chat flagged as: [EURUSD H1]

User: "What's the momentum on XAUUSD H4?"
AI: "XAUUSD H4 momentum Z-score is -1.4 (Bearish)..."

Chat flag: Still [EURUSD H1] — unchanged
```

### Why This Rule

The instrument flag represents the **primary context** of the chat — the instrument that incoming alerts will be routed to. Changing it on every cross-instrument query would make alert routing unpredictable.

### What the AI Knows About the Chat's Flag

The AI is aware of the chat's instrument flag and uses it as the default context for ambiguous queries:

```
Chat flagged as: [XAUUSD H4]

User: "What's the current price?"
AI: "XAUUSD is currently at 2672.08." (uses flagged instrument as default)

User: "What about EURUSD?"
AI: "EURUSD is at 1.0892." (explicit instrument overrides default)
```

---

## 7. Chat Lifecycle: From Creation to Archival

```
┌──────────────────────────────────────────────────────────────────┐
│                     CHAT LIFECYCLE                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. CREATION                                                     │
│     ├── AI-initiated: Breakout alert creates flagged chat        │
│     └── User-initiated: User creates new chat                   │
│                                                                  │
│  2. FLAGGING                                                     │
│     ├── AI-initiated: Auto-flagged with breakout instrument     │
│     └── User-initiated: Flagged on first instrument mention     │
│         └── If same instrument exists → FLAG MIGRATION           │
│                                                                  │
│  3. ACTIVE USE                                                   │
│     ├── User opens chat, reads messages, asks questions          │
│     ├── AI responds using flagged instrument as default context  │
│     ├── New incoming alerts for this instrument → added here     │
│     └── Chat stays in sidebar RECENT, ordered by last_message_at│
│                                                                  │
│  4. ARCHIVE (optional)                                           │
│     ├── User moves chat to Archive                               │
│     ├── Chat hidden from sidebar but still active                │
│     └── New incoming alert → auto-UN-archives the chat           │
│                                                                  │
│  5. DELETE (optional)                                             │
│     ├── User permanently deletes chat                            │
│     ├── Conversation history removed                             │
│     ├── Instrument flag released                                 │
│     └── Next incoming alert for this instrument → creates NEW    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 8. Database Schema

### chat_thread Table (Updated)

```sql
CREATE TABLE chat_thread (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id VARCHAR(255) NOT NULL,

    -- Instrument flag (nullable — unflagged chats have NULL)
    instrument_symbol VARCHAR(20),           -- e.g., 'XAUUSD' (NULL if unflagged)
    instrument_timeframe VARCHAR(10),        -- e.g., 'H4' (NULL if unflagged)

    -- Chat metadata
    title VARCHAR(200),                      -- User-visible title (can be renamed)
    last_message_at TIMESTAMP,
    last_message_preview VARCHAR(200),
    unread_count INT NOT NULL DEFAULT 0,
    message_count INT NOT NULL DEFAULT 0,

    -- State Machine status (only meaningful for flagged chats)
    current_state VARCHAR(30) DEFAULT 'IDLE',
    trade_direction VARCHAR(10),             -- 'long' (BUY) or 'short' (SELL)
    convergence_score DECIMAL(6,2),

    -- Chat status
    status VARCHAR(20) NOT NULL DEFAULT 'active',  -- 'active', 'archived', 'deleted'
    is_ai_initiated BOOLEAN NOT NULL DEFAULT false, -- true if created by incoming alert

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT fk_thread_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT valid_status CHECK(status IN ('active', 'archived', 'deleted')),
    -- NOTE: No unique constraint on (user_id, instrument_symbol, instrument_timeframe)
    -- because after flag migration, old chats become unflagged (NULL, NULL).
    -- The application layer enforces "at most one flagged chat per instrument per user."
    CONSTRAINT valid_direction CHECK(trade_direction IS NULL OR trade_direction IN ('long', 'short'))
);

-- Find the user's active flagged chat for an instrument (for alert routing)
CREATE INDEX idx_thread_instrument_flag ON chat_thread(user_id, instrument_symbol, instrument_timeframe)
    WHERE instrument_symbol IS NOT NULL AND status != 'deleted';

-- Thread list ordering
CREATE INDEX idx_thread_user_recent ON chat_thread(user_id, last_message_at DESC)
    WHERE status != 'deleted';
```

### Prisma Schema

```prisma
model ChatThread {
  id                  String    @id @default(cuid())
  userId              String

  // Instrument flag (nullable)
  instrumentSymbol    String?
  instrumentTimeframe String?

  // Chat metadata
  title               String?
  lastMessageAt       DateTime?
  lastMessagePreview  String?
  unreadCount         Int       @default(0)
  messageCount        Int       @default(0)

  // State Machine status
  currentState        String    @default("IDLE")
  tradeDirection      String?
  convergenceScore    Float?

  // Chat status
  status              String    @default("active")
  isAiInitiated       Boolean   @default(false)

  // Timestamps
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  // Relations
  user                User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages            ChatMessage[]

  @@index([userId, instrumentSymbol, instrumentTimeframe])
  @@index([userId, lastMessageAt(sort: Desc)])
}
```

---

## 9. Backend Logic: Instrument Flag Resolution

### Service: InstrumentFlagService

```typescript
// File: src/chat/instrument-flag.service.ts (NestJS v11 on Railway)

@Injectable()
export class InstrumentFlagService {

  /**
   * Attempt to flag a chat with an instrument detected from a user message.
   * Only applies to UNFLAGGED chats. Once flagged, the flag never changes
   * (except via migration).
   *
   * Returns the detected instrument, or null if none found.
   */
  async detectAndFlag(
    chatThreadId: string,
    userId: string,
    messageContent: string,
  ): Promise<{ symbol: string; timeframe: string } | null> {

    // 1. Check if this chat is already flagged
    const thread = await this.prisma.chatThread.findUnique({
      where: { id: chatThreadId },
    });
    if (thread.instrumentSymbol !== null) {
      return null; // Already flagged — do nothing
    }

    // 2. Detect instrument from message
    const instrument = this.detectInstrument(messageContent);
    if (!instrument) {
      return null; // No instrument found — chat remains unflagged
    }

    // 3. Check for existing flagged chat with same instrument (flag migration)
    const existingFlagged = await this.prisma.chatThread.findFirst({
      where: {
        userId: userId,
        instrumentSymbol: instrument.symbol,
        instrumentTimeframe: instrument.timeframe,
        status: { not: 'deleted' },
        id: { not: chatThreadId }, // Exclude current chat
      },
    });

    if (existingFlagged) {
      // MIGRATE: Remove flag from old chat, assign to new chat
      await this.prisma.$transaction([
        // Remove flag from old chat
        this.prisma.chatThread.update({
          where: { id: existingFlagged.id },
          data: {
            instrumentSymbol: null,
            instrumentTimeframe: null,
            currentState: null,
            tradeDirection: null,
            convergenceScore: null,
          },
        }),
        // Assign flag to new chat
        this.prisma.chatThread.update({
          where: { id: chatThreadId },
          data: {
            instrumentSymbol: instrument.symbol,
            instrumentTimeframe: instrument.timeframe,
          },
        }),
      ]);
    } else {
      // No existing flagged chat — simply flag the new chat
      await this.prisma.chatThread.update({
        where: { id: chatThreadId },
        data: {
          instrumentSymbol: instrument.symbol,
          instrumentTimeframe: instrument.timeframe,
        },
      });
    }

    return instrument;
  }

  private detectInstrument(message: string): { symbol: string; timeframe: string } | null {
    const upperMessage = message.toUpperCase();

    const SYMBOLS = [
      'XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD',
      'BTCUSD', 'ETHUSD', 'XAGUSD', 'NDX100', 'US30',
      'AUDJPY', 'GBPJPY', 'NZDUSD', 'USDCAD', 'USDCHF',
    ];
    const TIMEFRAMES = ['D1', 'H12', 'H8', 'H4', 'H2', 'H1', 'M30', 'M15', 'M5'];

    let foundSymbol: string | null = null;
    let foundTimeframe: string | null = null;

    for (const symbol of SYMBOLS) {
      if (upperMessage.includes(symbol)) {
        foundSymbol = symbol;
        break;
      }
    }

    for (const tf of TIMEFRAMES) {
      if (upperMessage.includes(tf)) {
        foundTimeframe = tf;
        break;
      }
    }

    if (foundSymbol && foundTimeframe) {
      return { symbol: foundSymbol, timeframe: foundTimeframe };
    }
    return null;
  }
}
```

---

## 10. Backend Logic: Incoming Alert Thread Routing

### Service: AlertThreadRouter

```typescript
// File: src/chat/alert-thread-router.service.ts (NestJS v11 on Railway)

@Injectable()
export class AlertThreadRouterService {

  /**
   * Find or create the chat thread for an incoming breakout alert.
   *
   * Resolution order:
   * 1. Find ACTIVE chat flagged with this instrument → route there
   * 2. Find ARCHIVED chat flagged with this instrument → un-archive and route there
   * 3. No existing chat → create new chat with instrument flag
   */
  async resolveThread(
    userId: string,
    symbol: string,
    timeframe: string,
  ): Promise<ChatThread> {

    // 1. Look for active flagged chat
    const active = await this.prisma.chatThread.findFirst({
      where: {
        userId,
        instrumentSymbol: symbol,
        instrumentTimeframe: timeframe,
        status: 'active',
      },
    });
    if (active) return active;

    // 2. Look for archived flagged chat → un-archive
    const archived = await this.prisma.chatThread.findFirst({
      where: {
        userId,
        instrumentSymbol: symbol,
        instrumentTimeframe: timeframe,
        status: 'archived',
      },
    });
    if (archived) {
      return this.prisma.chatThread.update({
        where: { id: archived.id },
        data: { status: 'active' },
      });
    }

    // 3. No existing chat → create new
    return this.prisma.chatThread.create({
      data: {
        userId,
        instrumentSymbol: symbol,
        instrumentTimeframe: timeframe,
        title: `${symbol} ${timeframe}`,
        isAiInitiated: true,
        status: 'active',
      },
    });
  }
}
```

---

## 11. Backend Logic: Flag Migration

### Migration Flow Diagram

```
User creates new chat → sends message → instrument detected
       │
       ▼
Is this instrument flagged on another chat?
       │
       ├── NO → Flag this chat. Done.
       │
       └── YES → MIGRATE
           │
           ├── 1. Remove flag from OLD chat:
           │      instrumentSymbol = NULL
           │      instrumentTimeframe = NULL
           │      (chat still exists, history preserved)
           │
           ├── 2. Assign flag to NEW chat:
           │      instrumentSymbol = detected symbol
           │      instrumentTimeframe = detected timeframe
           │
           ├── 3. WebSocket notification to frontend:
           │      Event: 'instrument_flag_migrated'
           │      Data: { oldThreadId, newThreadId, symbol, timeframe }
           │      → Frontend removes badge from old chat
           │      → Frontend adds badge to new chat
           │
           └── 4. Future incoming alerts → routed to NEW chat
```

### Important: Transaction Safety

Flag migration MUST be atomic (database transaction). If the migration fails mid-way, the old chat must keep its flag.

```typescript
await this.prisma.$transaction([
  // These two operations happen atomically
  this.prisma.chatThread.update({ where: { id: oldThread.id }, data: { instrumentSymbol: null, instrumentTimeframe: null } }),
  this.prisma.chatThread.update({ where: { id: newThread.id }, data: { instrumentSymbol: symbol, instrumentTimeframe: timeframe } }),
]);
```

---

## 12. API Design

### Thread Endpoints

```
GET    /api/chat/threads                    → List user's chat threads
GET    /api/chat/threads/:id                → Get thread with instrument badge info
POST   /api/chat/threads                    → Create new chat thread
PATCH  /api/chat/threads/:id                → Update thread (archive, etc.)
DELETE /api/chat/threads/:id                → Hard delete thread (releases flag)

GET    /api/chat/threads/:id/messages       → Get messages (paginated)
POST   /api/chat/threads/:id/messages       → Send message (triggers flag detection)
```

### Thread Response Shape

```json
{
  "id": "clx...",
  "title": "XAUUSD H4",
  "instrumentBadge": {
    "symbol": "XAUUSD",
    "timeframe": "H4",
    "displayLabel": "XAUUSD H4"
  },
  "lastMessageAt": "2026-02-08T10:05:00Z",
  "lastMessagePreview": "Breakout detected on XAUUSD H4...",
  "unreadCount": 2,
  "currentState": "BREAKOUT_DETECTED",
  "tradeDirection": "short",
  "directionLabel": "SELL",
  "convergenceScore": 4.2,
  "isAiInitiated": true,
  "status": "active",
  "createdAt": "2026-02-08T10:00:00Z"
}
```

For unflagged chats, `instrumentBadge` is `null`.

### Send Message Response (With Flag Detection)

```
POST /api/chat/threads/:id/messages
{ "content": "Analyze XAUUSD H1 for me" }

Response 201:
{
  "message": { ... },
  "flagDetected": {
    "symbol": "XAUUSD",
    "timeframe": "H1",
    "action": "flagged"           // or "migrated" if migration occurred
  },
  "migration": {                   // Only present if flag migration happened
    "fromThreadId": "clx_old...",
    "toThreadId": "clx_new..."
  }
}
```

---

## 13. Frontend UI: Chat Sidebar

### Sidebar Entry — Flagged Chat

```
┌────────────────────────────────────────────────────────────┐
│ → XAUUSD H4   SELL                 10 Min Ago         (2) │
│   ┌────────────┐                                          │
│   │ XAUUSD H4  │  Breakout detected on XAUUSD H4...     │
│   └────────────┘                                          │
│   ▲ permanent instrument badge (pill shape, non-editable) │
└────────────────────────────────────────────────────────────┘
```

### Sidebar Entry — Unflagged Chat

```
┌────────────────────────────────────────────────────────────┐
│ hi                                  2 hours ago            │
│ I'll help you with that analysis for XAU...                │
│ (no badge — unflagged chat)                                │
└────────────────────────────────────────────────────────────┘
```

### Component

```typescript
interface ChatSidebarEntryProps {
  threadId: string;
  title: string;
  instrumentBadge: {              // null for unflagged chats
    symbol: string;
    timeframe: string;
    displayLabel: string;         // "XAUUSD H4"
  } | null;
  tradeDirection: 'long' | 'short' | null;
  directionLabel: 'BUY' | 'SELL' | null;
  directionColor: 'green' | 'red' | null;
  unreadCount: number;
  lastMessageAt: string;
  lastMessagePreview: string;
  isAiInitiated: boolean;         // Shows → arrow icon
  currentState: string | null;
}
```

---

## 14. Frontend UI: Chat Panel Header

### Header — Flagged Chat

When the user opens a flagged chat, the chat panel header shows the instrument badge:

```
┌──────────────────────────────────────────────────────────────────┐
│  New Chat    ┌────────────┐                                      │
│              │ EURUSD H1  │  Flagged as EURUSD H1                │
│              └────────────┘                                      │
│  Start a conversation to begin trading analysis.                │
└──────────────────────────────────────────────────────────────────┘
```

### Header — Unflagged Chat

```
┌──────────────────────────────────────────────────────────────────┐
│  New Chat                                                        │
│                                                                  │
│  Start a conversation to begin trading analysis.                │
└──────────────────────────────────────────────────────────────────┘
```

### Badge Rendering in Header

```typescript
// Badge appears after the chat title, non-editable
function ChatPanelHeader({ thread }: { thread: ChatThread }) {
  return (
    <div className="chat-header">
      <h2>{thread.title || 'New Chat'}</h2>
      {thread.instrumentBadge && (
        <span className="instrument-badge">
          {thread.instrumentBadge.displayLabel}
        </span>
      )}
    </div>
  );
}
```

### CSS for Instrument Badge

```css
.instrument-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 12px;
  background-color: var(--badge-bg);     /* Light gray in light mode, dark gray in dark mode */
  color: var(--badge-text);
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
  user-select: none;                     /* Cannot be selected/copied */
  pointer-events: none;                  /* Cannot be clicked/interacted with */
  white-space: nowrap;
}
```

---

## 15. Frontend UI: Badge Rendering Rules

| Scenario | Sidebar Badge | Header Badge | Direction Label |
|---|---|---|---|
| AI-initiated chat (breakout alert) | "XAUUSD H4" (permanent) | "XAUUSD H4" (permanent) | "SELL" (red) or "BUY" (green) |
| User-initiated chat with instrument | "EURUSD H1" (permanent) | "EURUSD H1" (permanent) | None until breakout detected |
| Unflagged chat | None | None | None |
| Chat after flag migration (lost flag) | None (badge removed) | None (badge removed) | None |
| Archived chat (still flagged) | "XAUUSD H4" (in Archive section) | "XAUUSD H4" (if opened from Archive) | Last known direction |

---

## 16. Edge Cases

### Edge Case 1: User Deletes the Only Flagged Chat, Then Breakout Fires

- Chat is deleted → `status = 'deleted'`, flag released
- Breakout fires → AlertThreadRouter finds no active/archived chat
- System creates **new** chat with instrument flag
- New chat appears in sidebar with badge

### Edge Case 2: User Archives Chat, Then Breakout Fires

- Chat is archived → hidden from sidebar but still active
- Breakout fires → AlertThreadRouter finds the archived chat
- Chat **un-archives** automatically → appears at top of sidebar with new unread badge
- User sees the chat reappear with new breakout message

### Edge Case 3: User Has Two Chats About Same Instrument (Before Flag Migration)

- This is transient — only exists for the duration of one message send
- As soon as the new chat's first message is processed and instrument detected:
  - Flag migrates from old → new
  - Old chat becomes unflagged
- At no point do two chats have the same instrument flag simultaneously (transaction ensures this)

### Edge Case 4: User Mentions Instrument in Chat That Is Already Flagged With Different Instrument

- Chat is flagged as [EURUSD H1]
- User asks: "What about XAUUSD H4?"
- Flag does NOT change — still [EURUSD H1]
- AI answers about XAUUSD H4, but default context remains EURUSD H1

### Edge Case 5: Multiple Breakouts for Same Instrument in Short Time

- First breakout → message added to flagged chat, unread = 1
- Second breakout (e.g., after invalidation + new breakout) → message added to **same** chat, unread = 2
- All breakout messages are chronologically ordered in the same thread
- User sees one chat with multiple breakout discussions

---

## 17. Implementation Order

| Phase | Task | Stack | Effort |
|---|---|---|---|
| **Phase 1: Database** ||||
| 1.1 | Add `instrument_symbol`, `instrument_timeframe` columns to `chat_thread` | Railway PostgreSQL | 0.5 day |
| 1.2 | Add `is_ai_initiated`, `status` columns to `chat_thread` | Railway PostgreSQL | 0.5 day |
| 1.3 | Create indexes for instrument flag lookup | Railway PostgreSQL | 0.5 day |
| **Phase 2: Backend Services** ||||
| 2.1 | InstrumentFlagService: detect + flag + migrate | Railway NestJS v11 | 2 days |
| 2.2 | AlertThreadRouterService: find-or-create for incoming alerts | Railway NestJS v11 | 1 day |
| 2.3 | Wire flag detection into message send API | Railway NestJS v11 | 1 day |
| 2.4 | Wire AlertThreadRouter into ChatDispatcher (Python) | Railway txtai | 1 day |
| **Phase 3: Frontend** ||||
| 3.1 | InstrumentBadge component (pill shape, non-editable) | Vercel Next.js v16 | 1 day |
| 3.2 | Update ChatSidebarEntry to show badge | Vercel Next.js v16 | 1 day |
| 3.3 | Update ChatPanelHeader to show badge | Vercel Next.js v16 | 0.5 day |
| 3.4 | Handle `instrument_flag_migrated` WebSocket event (move badge in UI) | Vercel Next.js v16 | 1 day |
| 3.5 | Handle archived chat un-archiving on incoming alert | Vercel Next.js v16 | 0.5 day |
| **Phase 4: Testing** ||||
| 4.1 | Test flag migration (atomic transaction, concurrent access) | All | 1 day |
| 4.2 | Test alert routing (active/archived/deleted scenarios) | All | 1 day |
| 4.3 | Test badge rendering (flagged, unflagged, direction labels) | Vercel | 0.5 day |

**Total estimated effort: ~13 days**

---

**Document Version**: 1.0
**Date**: February 8, 2026
**Author**: Architecture Design — Trading Instrument Chat Management
**UI Reference**: DavinTrade screenshot — permanent instrument badges in sidebar and chat panel header
**Status**: Design Specification — Ready for Review

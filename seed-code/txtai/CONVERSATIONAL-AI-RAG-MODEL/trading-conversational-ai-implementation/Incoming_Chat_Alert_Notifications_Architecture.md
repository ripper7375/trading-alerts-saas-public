# Incoming Chat as Alert Notifications — Architecture Design Document

## Trading Advisory Conversational AI — Incoming Chat Notifications

**Document Version**: 1.1
**Date**: February 8, 2026
**Purpose**: Architecture specification for replacing the traditional alert notification system with AI-driven Incoming Chat messages triggered by State Machine transitions, delivering trade advisories as conversational messages that appear directly in the chat sidebar.
**UI Reference**: See `Incoming_Chat_UI_Reference.png` — the DavinTrade chat interface showing incoming chat entries in the sidebar RECENT section with instrument+direction labels, unread badges, and coexistence with TradingView charts and indicator panels.
**Prerequisite Documents**:
- `State_Machine_Modification_for_txtai_Framework.md` (State Machine engine, transitions, AgentState)
- `docs/files-completion-list/files-inventory/part-11-files-completion.md` (Current alert system)
- `docs/open-api-documents/part-11-alerts-openapi.yaml` (Current alert API)
- `docs/files-completion-list/files-inventory/part-15-files-completion.md` (Current notification & WebSocket system)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement: Why Replace Current Alerts?](#2-problem-statement-why-replace-current-alerts)
3. [Incoming Chat Concept](#3-incoming-chat-concept)
4. [Can the Current Alert System Be Fully Replaced?](#4-can-the-current-alert-system-be-fully-replaced)
5. [Architecture Overview](#5-architecture-overview)
6. [Instrument Subscription Model](#6-instrument-subscription-model)
7. [State Machine → Incoming Chat Integration](#7-state-machine--incoming-chat-integration)
8. [Chat Message Types by State](#8-chat-message-types-by-state)
9. [Database Schema](#9-database-schema)
10. [WebSocket Real-Time Delivery](#10-websocket-real-time-delivery)
11. [Chat Thread Model](#11-chat-thread-model)
12. [Unread Badge & Notification Indicators](#12-unread-badge--notification-indicators)
13. [User Interaction Flow](#13-user-interaction-flow)
14. [Tier-Based Access Control](#14-tier-based-access-control)
15. [Migration Strategy: From Alerts to Incoming Chat](#15-migration-strategy-from-alerts-to-incoming-chat)
16. [What Gets Removed (Part 11 Deprecation)](#16-what-gets-removed-part-11-deprecation)
17. [What Gets Kept and Adapted (Part 15)](#17-what-gets-kept-and-adapted-part-15)
18. [API Design](#18-api-design)
19. [Frontend Architecture](#19-frontend-architecture)
20. [Error Handling & Edge Cases](#20-error-handling--edge-cases)
21. [Implementation Order](#21-implementation-order)

---

## 1. Executive Summary

This document specifies an architecture where **the AI State Machine itself becomes the notification engine**. Instead of users manually creating price alerts (Part 11's current model), the system delivers trade advisories as **Incoming Chat messages** — conversational AI messages that appear in the user's chat interface exactly like receiving a message on WhatsApp or Telegram.

Each instrument+timeframe pair the user subscribes to (e.g., EURUSD H1, XAUUSD H2) runs its own independent State Machine evaluation cycle. When the State Machine transitions through significant states (BREAKOUT_DETECTED, AWAITING_PULLBACK, bounce confirmed, etc.), it generates a natural-language advisory message and delivers it as an Incoming Chat to the user in real-time.

**Key insight**: The current Part 11 alert system is a *dumb* price-threshold monitor ("notify me when XAUUSD > 2000"). The Incoming Chat replaces this with an *intelligent* AI-driven system that proactively tells the user **what matters and why**, using the full convergence scoring engine and LLM evaluation.

---

## 2. Problem Statement: Why Replace Current Alerts?

### Current Alert System (Part 11) — Limitations

| Aspect | Current System | Problem |
|---|---|---|
| **Trigger logic** | Simple price threshold (above/below/equals) | No intelligence — user must know what price to watch |
| **Notification content** | "XAUUSD crossed above 2000.50" | No context, no reasoning, no actionable advice |
| **User effort** | User must manually create each alert, choose condition type, set target value | High friction — requires user to already know what to watch |
| **AI involvement** | None | Completely disconnected from the Conversational AI system |
| **Engagement** | One-shot notification (alert triggers, sets `isActive=false`, done) | No conversation flow — dead end |
| **Delivery** | Notification bell + toast (Part 15) | Static, non-conversational — doesn't encourage interaction |
| **State awareness** | None — checks raw price against threshold | Doesn't understand breakouts, pullbacks, convergence, or market regime |

### Incoming Chat System — What It Solves

| Aspect | Incoming Chat | Improvement |
|---|---|---|
| **Trigger logic** | State Machine transitions (breakout detected, pullback testing, etc.) | AI decides what's worth alerting — user doesn't need to guess |
| **Notification content** | Rich conversational message with reasoning, score breakdown, confidence | User understands *why* this matters |
| **User effort** | Subscribe to instruments — AI handles the rest | Zero-configuration alerting |
| **AI involvement** | Full LLM evaluation + convergence scoring + knowledge retrieval | Every message is an AI advisory |
| **Engagement** | Incoming message in chat thread — user can reply, ask follow-up questions | Natural conversation flow — users *want* to engage |
| **Delivery** | Chat message with unread badge (like WhatsApp) | Familiar UX pattern — high open rates |
| **State awareness** | Full State Machine context (regime, momentum, trendlines, zones) | Messages are contextually rich and methodologically sound |

---

## 3. Incoming Chat Concept

### UI Reference — DavinTrade Sidebar

The screenshot below shows the actual DavinTrade interface with Incoming Chat entries in the sidebar:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  DavinTrade                                          ◄ Sidebar          │
├──────────────────────┬───────────────────────────────────────────────────┤
│                      │                                                   │
│  ○ New Chat          │  New Chat                                         │
│  ≡ Indicators        │  Start a conversation...                         │
│  → Incoming Chat     │                                                   │
│  Q Chat Search       │  ┌──────────────────────────────────────────┐    │
│  ⊞ Archive           │  │  [XAUUSD ▼]  M5 M15 M30 H1 H2 H4 ...  │    │
│                      │  │         H1 Based Timeframe                │    │
│ ☆ PINNED CHATS       │  │                                          │    │
│   Refactor prompt te.│  │     ┌────────────────────────────┐       │    │
│   Marketing plan fo..│  │     │  TradingView Chart         │       │    │
│                      │  │     │  (XAUUSD with trendlines)  │       │    │
│ RECENT               │  │     │                            │       │    │
│ ┌──────────────────┐ │  │     └────────────────────────────┘       │    │
│ │→ XAUUSD H4 SELL  │ │  │                                          │    │
│ │  10 Min Ago   (2)│ │  └──────────────────────────────────────────┘    │
│ │  I'll help you...│ │                                                   │
│ ├──────────────────┤ │  Indicator Panels (right side):                   │
│ │→ EURUSD H1 BUY   │ │  ┌──────────────────────────┐                    │
│ │  17 Min Ago   (3)│ │  │ XAUUSD H2  R: 2673.93    │                    │
│ │  I'll help you...│ │  │ H4 KC Zone: 6, S&R: 2     │                    │
│ └──────────────────┘ │  ├──────────────────────────┤                    │
│                      │  │ XAUUSD H1  Resistant      │                    │
│  New Chat            │  │ 2672.08  Slope: 26        │                    │
│  Start a convers...  │  │ Trend: Uptrend            │                    │
│                      │  ├──────────────────────────┤                    │
│  hi                  │  │ XAUUSD H1  Support        │                    │
│  I'll help you...    │  │ 2662.36  Slope: 19.6      │                    │
│                      │  ├──────────────────────────┤                    │
│  ⚙ Settings  ☽ Dark │  │ XAUUSD M30  Support       │                    │
│  JD John Doe         │  │ 2652.55  % Breakout: 32%  │                    │
│                      │  └──────────────────────────┘                    │
├──────────────────────┴───────────────────────────────────────────────────┤
│  + Ask Claude...                              Claude 3.5 Sonnet ▼  ➤    │
└──────────────────────────────────────────────────────────────────────────┘
```

### Key UI Elements from the Screenshot

1. **Sidebar Navigation**: "Incoming Chat" is a **dedicated nav item** (→ icon) alongside New Chat, Indicators, Chat Search, and Archive. This filters the sidebar to show only AI-initiated breakout threads.

2. **RECENT Section — Incoming Chat Entries**: When a breakout is detected, a new chat entry automatically appears under RECENT with:
   - **Arrow icon** (→) — distinguishes incoming AI chats from user-initiated chats
   - **Instrument + Timeframe + Direction**: `XAUUSD H4 SELL` (red) or `EURUSD H1 BUY` (green)
   - **Time since arrival**: "10 Min Ago", "17 Min Ago"
   - **Unread badge**: Circled count (2), (3) — number of unread messages in thread
   - **Preview text**: "I'll help you with that analysis..." (first line of AI message)

3. **Direction Labels (BUY/SELL)**: The State Machine's `trade_direction` field (long → BUY, short → SELL) is displayed as a colored label next to the instrument — green for BUY, red for SELL. This gives instant visual signal of the trade direction without opening the thread.

4. **Coexistence with Chart + Indicators**: The main area shows a TradingView chart with trendlines, and the right panel shows indicator data (Keltner Zone, S&R Zone, Slope, Trend, Touches, % Breakout) across multiple timeframes. The incoming chat lives in the sidebar — it doesn't disrupt the chart workflow.

5. **Regular Chats Below**: Standard user-initiated chats ("New Chat", "hi") appear below the incoming chats in the same sidebar, maintaining a unified conversation list.

### How Incoming Chat Entries Are Created

```
State Machine detects BREAKOUT_DETECTED for (XAUUSD, H4, direction=short)
       │
       ▼
ChatDispatcher creates a new chat thread entry:
  - Title: "XAUUSD H4 SELL"    ← instrument + TF + direction
  - Arrow icon (→)              ← marks it as AI-initiated (incoming)
  - First message: AI advisory with analysis
  - Appears at top of RECENT section
  - Unread badge starts at (1)
       │
       ▼
As State Machine progresses (AWAITING_PULLBACK, PULLBACK_TESTING, etc.):
  - Additional messages are added to the same thread
  - Unread badge increments: (2), (3), ...
  - Preview text updates to latest message
  - Time updates to latest message time
```

### How It Differs From a Notification

| Aspect | Notification (Current Part 15) | Incoming Chat (Proposed) |
|---|---|---|
| Appears in | Bell dropdown / notification list | **Sidebar RECENT section** (primary navigation) |
| Visual format | Text-only notification card | Chat entry with direction label (BUY/SELL), unread badge, preview |
| User action | Read → dismiss | Click → **open thread → reply / ask questions** |
| History | Flat list, no grouping | Grouped by instrument thread with full conversation history |
| Context | Isolated message | Full conversation + chart + indicator panels visible simultaneously |
| Engagement | Low (read-and-forget) | High (conversation continues, user asks follow-ups) |
| Direction signal | None | BUY (green) / SELL (red) label — instant visual cue |

---

## 4. Can the Current Alert System Be Fully Replaced?

### Short Answer: Yes — with one consideration.

The Incoming Chat system **completely subsumes** the current Part 11 alert system. Here's the detailed analysis:

### What Part 11 Does vs. What Incoming Chat Covers

| Part 11 Feature | Incoming Chat Replacement | Status |
|---|---|---|
| Price-above alerts | State Machine detects breakouts above trendlines — far more intelligent than raw price threshold | **Fully replaced** |
| Price-below alerts | State Machine detects breakdowns below trendlines | **Fully replaced** |
| Price-equals alerts | Not directly replaced (edge case — rarely useful in practice) | **Deprecated** — convergence scoring is superior |
| Alert creation form | Replaced by instrument subscription (simpler UX) | **Fully replaced** |
| Alert management (pause/resume/delete) | Replaced by subscribe/unsubscribe per instrument | **Fully replaced** |
| Background checker job (`alert-checker.ts`) | Replaced by State Machine cron-triggered evaluation cycle | **Fully replaced** |
| Tier-based limits (5 FREE / 20 PRO alerts) | Replaced by instrument subscription limits (see Section 14) | **Fully replaced** |
| Trigger history | Replaced by chat message history (richer, with full context) | **Fully replaced** |

### The One Consideration: Simple Price Alerts as a Convenience Feature

Some users may want a simple "notify me when price hits X" without the full AI evaluation. This is a **convenience feature**, not a core need. Two options:

**Option A: Full replacement (Recommended)**
Remove Part 11 entirely. Users who want price-level awareness can ask the AI in their chat thread: *"Let me know when EURUSD reaches 1.1000"* — the AI can handle this conversationally within the chat thread context, no separate alert system needed.

**Option B: Keep as lightweight add-on**
Keep a minimal price-alert feature embedded within the chat thread (user types "Watch 2000.50" in the XAUUSD thread). This is a chat command, not a separate system.

### Recommendation: Full Replacement (Option A)

**Reasons:**
1. **Eliminates system duplication** — no need to maintain two notification paths
2. **Unified UX** — everything happens in the chat, reducing cognitive load
3. **Stronger engagement** — users interact with AI instead of configuring forms
4. **Simpler codebase** — remove 23 files from Part 11
5. **AI handles the intent** — "watch this price" becomes a natural language request in chat, not a form submission

### What Gets Removed

The following Part 11 components can be **completely removed**:

```
REMOVE:
├── prisma/schema.prisma          → Remove Alert model (keep Notification model for Part 15)
├── types/alert.ts                → Remove entirely
├── lib/validations/alert.ts      → Remove entirely
├── app/api/alerts/route.ts       → Remove entirely
├── app/api/alerts/[id]/route.ts  → Remove entirely
├── components/alerts/alert-card.tsx    → Remove entirely
├── components/alerts/alert-form.tsx    → Remove entirely
├── components/alerts/alert-list.tsx    → Remove entirely
├── components/dashboard/recent-alerts.tsx → Replace with recent-chats widget
├── hooks/use-alerts.ts           → Remove entirely
├── app/(dashboard)/alerts/page.tsx     → Replace with chat threads page
├── app/(dashboard)/alerts/alerts-client.tsx → Remove entirely
├── app/(dashboard)/alerts/new/page.tsx     → Replace with instrument subscription
├── app/(dashboard)/alerts/new/create-alert-client.tsx → Remove entirely
├── lib/jobs/alert-checker.ts     → Replace with State Machine evaluation cycle
├── lib/jobs/queue.ts             → Repurpose for State Machine cron scheduling
└── frontend/* mirrors            → Remove entirely
```

**Files: 23 removed, 3 replaced with new equivalents.**

---

## 5. Architecture Overview

### System Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                        txtai Application                              │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Per-Instrument State Machine Instances                        │  │
│  │                                                                │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │  │
│  │  │ EURUSD H1    │  │ XAUUSD H2    │  │ USDJPY H1    │  ...   │  │
│  │  │ StateMachine │  │ StateMachine │  │ StateMachine │        │  │
│  │  │ AgentState   │  │ AgentState   │  │ AgentState   │        │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │  │
│  │         │                 │                 │                  │  │
│  │         ▼                 ▼                 ▼                  │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │  Incoming Chat Dispatcher                                │  │  │
│  │  │  ─ Receives state transition events                      │  │  │
│  │  │  ─ Determines which users subscribe to this instrument   │  │  │
│  │  │  ─ Generates chat message from AgentState                │  │  │
│  │  │  ─ Persists message to chat_messages table               │  │  │
│  │  │  ─ Pushes via WebSocket to connected users               │  │  │
│  │  └──────────────────────┬──────────────────────────────────┘  │  │
│  └─────────────────────────┼─────────────────────────────────────┘  │
│                            │                                        │
│  ┌─────────────────────────▼──────────────────────────────────────┐ │
│  │                     Delivery Layer                              │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐ │ │
│  │  │ PostgreSQL  │  │ WebSocket    │  │ Push Notifications    │ │ │
│  │  │ (persist)   │  │ (real-time)  │  │ (mobile/browser PWA) │ │ │
│  │  └─────────────┘  └──────────────┘  └───────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                            │                                        │
│  ┌─────────────────────────▼──────────────────────────────────────┐ │
│  │                   Frontend (Next.js)                            │ │
│  │  ┌──────────────┐  ┌────────────────┐  ┌───────────────────┐  │ │
│  │  │ Chat Thread  │  │ Thread List    │  │ Unread Badge      │  │ │
│  │  │ (per instr.) │  │ (all instrs.) │  │ (nav indicator)   │  │ │
│  │  └──────────────┘  └────────────────┘  └───────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### Data Flow — Incoming Chat Message

```
1. Cron trigger (new bar close for primary Decision TF)
       │
2. State Machine evaluation cycle runs for (instrument, tf_config)
       │
3. State transition occurs (e.g., SCANNING → BREAKOUT_DETECTED)
       │
4. EvaluationPipeline generates `pending_response` text in AgentState
       │
5. Incoming Chat Dispatcher receives transition event:
   ├── Queries: which users subscribe to this (instrument, timeframe)?
   ├── For each subscriber:
   │   ├── Creates chat_message record (role: 'assistant', type: state-derived)
   │   ├── Updates chat_thread.last_message_at and unread_count
   │   └── Emits WebSocket event: 'incoming_chat' to user room
       │
6. Frontend receives WebSocket event:
   ├── Updates thread list (bumps instrument to top, shows preview)
   ├── Increments unread badge on nav
   ├── If user is IN the thread: auto-scrolls to new message
   └── If user is NOT in the thread: shows unread indicator
       │
7. User opens thread → reads message → can reply to ask AI questions
```

---

## 6. Instrument Subscription Model

### Concept

Instead of creating individual price alerts, users **subscribe to instruments**. Each subscription activates a State Machine instance for that (symbol, timeframe) pair.

### Subscription vs. Alert — Comparison

| Aspect | Part 11 Alert | Instrument Subscription |
|---|---|---|
| What user configures | Symbol + Timeframe + Condition type + Target value + Name | Symbol + Timeframe (that's it) |
| Number of decisions | 5 fields | 2 fields |
| What triggers | Raw price crossing a threshold | AI State Machine detecting significant market events |
| What user receives | One notification, then alert deactivates | Ongoing stream of AI messages as market evolves |
| Lifetime | Single-use (deactivates after trigger) | Continuous until user unsubscribes |

### Subscription Data Model

```
User subscribes to: EURUSD H1
                    ────── ──
                    symbol timeframe

This creates:
1. An instrument_subscription record (user → instrument link)
2. Ensures an agent_state row exists for (EURUSD, config_a)  ← from State Machine
3. Opens a chat_thread for this user + instrument
```

### Tier Limits (Replaces Alert Limits)

| Tier | Max Subscriptions | Symbols | Timeframes | Rationale |
|---|---|---|---|---|
| **FREE** | 3 instruments | 5 symbols | 3 TFs | Lower than Part 11's 5 alerts because each subscription is far more valuable (continuous AI monitoring vs. one-shot price check) |
| **PRO** | 15 instruments | 15 symbols | 9 TFs | Higher value — each subscription is a dedicated AI analyst for that instrument |

---

## 7. State Machine → Incoming Chat Integration

### Which State Transitions Generate Incoming Chat Messages?

Not every transition produces a user-facing message. The routing logic:

```python
# File: services/agent/chat_dispatcher.py

# Transitions that generate Incoming Chat messages
CHAT_TRIGGERS = {
    # HIGH PRIORITY — immediate delivery, prominent styling
    State.BREAKOUT_DETECTED: {
        "priority": "high",
        "message_type": "breakout_alert",
        "sound": True,          # Play notification sound
        "badge_style": "urgent", # Red badge indicator
    },
    State.PULLBACK_TESTING: {
        "conditions": {
            "bounce_confirmed": {
                "priority": "high",
                "message_type": "trade_recommendation",
                "sound": True,
                "badge_style": "urgent",
            },
            "level_broken": {
                "priority": "medium",
                "message_type": "invalidation_report",
                "sound": False,
                "badge_style": "standard",
            },
        }
    },

    # MEDIUM PRIORITY — standard delivery
    State.AWAITING_PULLBACK: {
        "priority": "medium",
        "message_type": "pullback_watch",
        "sound": False,
        "badge_style": "standard",
    },

    # LOW PRIORITY — background updates (delivered but not intrusive)
    State.SCANNING: {
        "priority": "low",
        "message_type": "market_scan",
        "sound": False,
        "badge_style": "subtle",
    },
    State.MISSED: {
        "priority": "low",
        "message_type": "missed_opportunity",
        "sound": False,
        "badge_style": "subtle",
    },
    State.INVALIDATED: {
        "priority": "medium",
        "message_type": "setup_invalidated",
        "sound": False,
        "badge_style": "standard",
    },

    # NO MESSAGE — internal transitions
    # State.IDLE: no message (nothing to report)
    # State.NAVIGATING: no message (internal regime assessment)
}
```

### Transition → Message Pipeline

```
StateMachine.transition(agent_state, condition)
       │
       ▼
EvaluationPipeline.generate_response(agent_state)
       │ ← Uses LLM (Claude) to generate natural-language advisory
       │ ← Includes: convergence score, reasoning, confidence, regime context
       │
       ▼
agent_state["pending_response"] = "Breakout detected on EURUSD H1..."
       │
       ▼
ChatDispatcher.dispatch(agent_state)
       │
       ├── 1. Look up CHAT_TRIGGERS for current state
       │      → Determines priority, message_type, delivery options
       │
       ├── 2. Query instrument_subscriptions for this (symbol, timeframe)
       │      → Returns list of user_ids
       │
       ├── 3. For each subscribed user:
       │      ├── Find or create chat_thread for (user_id, symbol, timeframe)
       │      ├── INSERT into chat_messages:
       │      │     role: 'assistant'
       │      │     content: agent_state["pending_response"]
       │      │     message_type: from CHAT_TRIGGERS
       │      │     metadata: {convergence_score, state, confidence, ...}
       │      ├── UPDATE chat_thread:
       │      │     last_message_at = now()
       │      │     last_message_preview = first 100 chars
       │      │     unread_count += 1
       │      │     current_state = agent_state["current_state"]
       │      │     trade_direction = agent_state["trade_direction"]  ← for BUY/SELL sidebar label
       │      │     convergence_score = agent_state["convergence_score"]
       │      └── EMIT WebSocket: 'incoming_chat' → user's room
       │
       └── 4. Log to audit table
```

---

## 8. Chat Message Types by State

### Message Content by State Machine Position

| State & Condition | Message Type | Priority | Example Message |
|---|---|---|---|
| **BREAKOUT_DETECTED** (quality_sufficient) | `breakout_alert` | HIGH | "Breakout detected on EURUSD H1. Price has closed above the descending trendline at 1.0892. Convergence score: 4.2/10. Momentum is confirming with Z-score +1.8. Watching for pullback entry..." |
| **AWAITING_PULLBACK** (update) | `pullback_watch` | MEDIUM | "Breakout holding on EURUSD H1 (3 bars confirmed). Waiting for pullback to the 1.0875–1.0862 zone. 7 bars remaining in window. Will alert when pullback arrives." |
| **PULLBACK_TESTING** (bounce_confirmed, score >= 5.0) | `trade_recommendation` | HIGH | "Trade recommendation: LONG EURUSD H1. Convergence score: 6.8/10. Entry zone: 1.0862–1.0875 (3 lots staggered). Factors: Regime +1.4, Momentum +1.6, Trendline +1.2, Zone +1.4, Pattern +1.2. Confidence: 78%. Counter-trend modifier: 1.0 (aligned)." |
| **PULLBACK_TESTING** (score < 5.0) | `caution_update` | MEDIUM | "Pullback at zone on EURUSD H1, but convergence is insufficient (3.8/10). Momentum weakening. Monitoring for improvement or invalidation." |
| **MISSED** | `missed_opportunity` | LOW | "The EURUSD H1 breakout moved without a pullback entry. Window expired after 10 bars. Cooldown: 4 bars before next scan." |
| **INVALIDATED** (level_broken) | `setup_invalidated` | MEDIUM | "EURUSD H1 setup invalidated: price broke back below the breakout trendline at 1.0845. Fakeout confirmed. Cooldown: 4 bars." |
| **INVALIDATED** (instant_fakeout) | `setup_invalidated` | MEDIUM | "Instant fakeout on EURUSD H1. Breakout bar reversed immediately. Setup invalidated." |
| **SCANNING** (periodic) | `market_scan` | LOW | "EURUSD H1: Strong Bullish regime. Aggregate slope: +2.4. No breakout setup detected. Key trendline at 1.0892. Monitoring." |

### Message Metadata (Stored with Each Chat Message)

```json
{
  "state": "BREAKOUT_DETECTED",
  "previous_state": "SCANNING",
  "condition": "breakout_found",
  "convergence_score": 4.2,
  "convergence_breakdown": {
    "regime": 1.4,
    "momentum": 1.6,
    "trendline": 0.4,
    "zone": 0.0,
    "pattern": 0.8
  },
  "llm_confidence": 0.72,
  "trade_direction": "long",
  "current_price": 1.0892,
  "regime_classification": "Strong Bullish"
}
```

This metadata enables rich UI rendering (score gauges, confidence bars, regime badges) without re-parsing the message text.

---

## 9. Database Schema

### New Tables

```sql
-- ============================================================
-- Table: instrument_subscription
-- Links users to instruments they want to monitor.
-- Replaces the Part 11 Alert model entirely.
-- ============================================================
CREATE TABLE instrument_subscription (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id VARCHAR(255) NOT NULL,          -- References User.id
    symbol VARCHAR(20) NOT NULL,            -- e.g., 'EURUSD'
    timeframe VARCHAR(10) NOT NULL,         -- e.g., 'H1'

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_user_instrument UNIQUE(user_id, symbol, timeframe),
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_subscription_user ON instrument_subscription(user_id);
CREATE INDEX idx_subscription_instrument ON instrument_subscription(symbol, timeframe)
    WHERE is_active = true;


-- ============================================================
-- Table: chat_thread
-- One thread per (user, symbol, timeframe) combination.
-- The "conversation" container — like a WhatsApp contact chat.
-- ============================================================
CREATE TABLE chat_thread (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id VARCHAR(255) NOT NULL,          -- References User.id
    symbol VARCHAR(20) NOT NULL,            -- e.g., 'EURUSD'
    timeframe VARCHAR(10) NOT NULL,         -- e.g., 'H1'

    -- Thread metadata
    display_name VARCHAR(100),              -- e.g., 'EURUSD H1' (auto-generated)
    last_message_at TIMESTAMP,              -- For sorting thread list
    last_message_preview VARCHAR(200),      -- Preview text for thread list
    unread_count INT NOT NULL DEFAULT 0,    -- Unread message counter

    -- State Machine status (denormalized for UI display)
    current_state VARCHAR(30) DEFAULT 'IDLE',
    trade_direction VARCHAR(10),             -- 'long' (BUY green) or 'short' (SELL red) — shown in sidebar
    convergence_score DECIMAL(6,2),

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_thread UNIQUE(user_id, symbol, timeframe),
    CONSTRAINT fk_thread_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_thread_user_recent ON chat_thread(user_id, last_message_at DESC);
CREATE INDEX idx_thread_unread ON chat_thread(user_id, unread_count)
    WHERE unread_count > 0;


-- ============================================================
-- Table: chat_message
-- Individual messages within a thread.
-- Both AI-generated (incoming) and user-sent (outgoing).
-- ============================================================
CREATE TABLE chat_message (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    thread_id UUID NOT NULL,                -- References chat_thread.id
    user_id VARCHAR(255) NOT NULL,          -- References User.id (for efficient queries)

    -- Message content
    role VARCHAR(20) NOT NULL,              -- 'assistant' (AI incoming) or 'user' (human outgoing)
    content TEXT NOT NULL,                  -- The message text (natural language)
    message_type VARCHAR(50),               -- e.g., 'breakout_alert', 'trade_recommendation', 'user_question'

    -- AI metadata (only for role='assistant')
    metadata JSONB,                         -- Convergence score, state info, confidence, etc.
    priority VARCHAR(10) DEFAULT 'low',     -- 'high', 'medium', 'low'

    -- Read status
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMP,

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT fk_message_thread FOREIGN KEY (thread_id) REFERENCES chat_thread(id) ON DELETE CASCADE,
    CONSTRAINT valid_role CHECK(role IN ('assistant', 'user')),
    CONSTRAINT valid_priority CHECK(priority IN ('high', 'medium', 'low'))
);

CREATE INDEX idx_message_thread_time ON chat_message(thread_id, created_at DESC);
CREATE INDEX idx_message_user_unread ON chat_message(user_id, is_read)
    WHERE is_read = false;
```

### Prisma Schema Equivalent

```prisma
model InstrumentSubscription {
  id        String   @id @default(cuid())
  userId    String
  symbol    String
  timeframe String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, symbol, timeframe])
  @@index([userId])
  @@index([symbol, timeframe])
}

model ChatThread {
  id                 String    @id @default(cuid())
  userId             String
  symbol             String
  timeframe          String
  displayName        String?
  lastMessageAt      DateTime?
  lastMessagePreview String?
  unreadCount        Int       @default(0)
  currentState       String    @default("IDLE")
  tradeDirection     String?                       // 'long' (BUY) or 'short' (SELL) — for sidebar label
  convergenceScore   Float?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  user               User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages           ChatMessage[]

  @@unique([userId, symbol, timeframe])
  @@index([userId, lastMessageAt(sort: Desc)])
}

model ChatMessage {
  id          String    @id @default(cuid())
  threadId    String
  userId      String
  role        String                        // 'assistant' or 'user'
  content     String
  messageType String?
  metadata    Json?
  priority    String    @default("low")
  isRead      Boolean   @default(false)
  readAt      DateTime?
  createdAt   DateTime  @default(now())

  thread      ChatThread @relation(fields: [threadId], references: [id], onDelete: Cascade)

  @@index([threadId, createdAt(sort: Desc)])
  @@index([userId, isRead])
}
```

---

## 10. WebSocket Real-Time Delivery

### Reusing Part 15 WebSocket Infrastructure

The existing Part 15 WebSocket system (`lib/websocket/server.ts`, `websocket-provider.tsx`, `use-websocket.ts`) is **kept and extended** with new event types:

```typescript
// New WebSocket event types (added to existing infrastructure)

// Server → Client: New incoming chat message
interface IncomingChatEvent {
  type: 'incoming_chat';
  data: {
    threadId: string;
    message: {
      id: string;
      role: 'assistant';
      content: string;
      messageType: string;       // 'breakout_alert', 'trade_recommendation', etc.
      priority: 'high' | 'medium' | 'low';
      metadata: Record<string, unknown>;
      createdAt: string;
    };
    thread: {
      symbol: string;
      timeframe: string;
      displayName: string;       // "XAUUSD H4"
      currentState: string;
      tradeDirection: 'long' | 'short' | null;  // Maps to BUY (green) / SELL (red) label
      unreadCount: number;       // Updated count — shown as badge (2), (3)
    };
  };
}

// Server → Client: Thread state updated (no new message, just state sync)
interface ThreadStateUpdateEvent {
  type: 'thread_state_update';
  data: {
    threadId: string;
    currentState: string;
    convergenceScore: number | null;
  };
}

// Client → Server: Mark thread as read
interface MarkThreadReadEvent {
  type: 'mark_thread_read';
  data: {
    threadId: string;
  };
}
```

### Delivery Priority Behavior

| Priority | WebSocket Behavior | UI Behavior |
|---|---|---|
| **HIGH** | Immediate emit + optional push notification | Play sound, prominent badge, auto-expand preview if on thread list |
| **MEDIUM** | Immediate emit | Silent badge increment, standard thread list update |
| **LOW** | Batch (deliver on next poll or delayed emit) | Badge increment only, no sound, no preview expansion |

---

## 11. Chat Thread Model

### Thread Lifecycle

```
User subscribes to EURUSD H1
       │
       ▼
System creates:
  ├── instrument_subscription (user_id, EURUSD, H1)
  ├── chat_thread (user_id, EURUSD, H1, display_name="EURUSD H1")
  └── Ensures agent_state exists for (EURUSD, config_a)
       │
       ▼
State Machine evaluation cycles begin running
       │
       ▼
Each significant transition → chat_message inserted into thread
       │
       ▼
User opens thread → sees message history → can reply
       │
       ▼
User reply → processed by txtai Agent (knowledge retrieval + LLM)
       │
       ▼
AI responds in-thread (conversational follow-up)
       │
       ▼
User unsubscribes → instrument_subscription.is_active = false
       │
       ▼
Thread remains (with history) but stops receiving new AI messages
```

### Thread List Sorting

Threads are sorted by `last_message_at DESC` (most recent activity at top), exactly like a messaging app. Threads with unread messages show an unread badge.

### Thread States (Visual Indicators)

The thread list shows the State Machine status as a visual indicator:

| State Machine State | Thread Indicator | Color |
|---|---|---|
| IDLE | Idle | Gray |
| NAVIGATING | Analyzing | Blue |
| SCANNING | Scanning | Blue |
| BREAKOUT_DETECTED | Breakout! | Orange-red |
| AWAITING_PULLBACK | Pullback Watch | Yellow |
| PULLBACK_TESTING | Testing Zone | Orange |
| MISSED | Missed | Gray |
| INVALIDATED | Invalidated | Red-muted |

---

## 12. Unread Badge & Notification Indicators

### Badge Hierarchy

```
┌─────────────────────────────────────────┐
│  Navigation Bar                         │
│                                         │
│  Dashboard  |  Chat (3)  |  Settings   │
│                    ▲                    │
│                    │                    │
│             Total unread across         │
│             all threads                 │
└─────────────────────────────────────────┘

Within Chat page:
┌─────────────────────────────────────────┐
│  EURUSD H1     ●2        10:05 AM      │  ← 2 unread messages
│  XAUUSD H2               9:00 AM       │  ← All read
│  USDJPY H1     ●1        8:00 AM       │  ← 1 unread message
└─────────────────────────────────────────┘
```

### Unread Count Management

```
Increment:
  - ChatDispatcher inserts a new assistant message
  - chat_thread.unread_count += 1
  - Total badge = SUM(unread_count) across all user's threads

Decrement:
  - User opens a thread → all messages marked as read
  - chat_thread.unread_count = 0
  - WebSocket emits 'mark_thread_read' to sync across tabs
```

---

## 13. User Interaction Flow

### Flow 1: Breakout Alert → User Conversation

```
1. [AI INCOMING] "Breakout detected on EURUSD H1! Price closed above
   descending trendline at 1.0892. Convergence: 4.2/10. Momentum
   confirming. Watching for pullback to 1.0862-1.0875 zone."

2. [USER REPLY] "What's the momentum look like on H4?"

3. [AI RESPONSE] "On H4, momentum Z-score is +1.2 (Bullish).
   TEMA is above HRMA with a growing gap. The higher timeframe
   supports the H1 breakout direction."

4. [USER REPLY] "What about counter-trend risk?"

5. [AI RESPONSE] "Counter-trend modifier is 1.0 — this breakout
   is aligned with the dominant trend. No counter-trend penalty
   applied. The aggregate Navigation slope is +2.4 (Strong Bullish)."

   ... (time passes — pullback arrives) ...

6. [AI INCOMING] "Trade recommendation: LONG EURUSD H1.
   Convergence score: 6.8/10.
   Entry zone: 1.0862–1.0875 (3 lots staggered).
   Confidence: 78%."

7. [USER REPLY] "Break down the 5 factors for me"

8. [AI RESPONSE] "Score breakdown:
   • Regime: +1.4 (Strong Bullish, aligned)
   • Momentum: +1.6 (Z-score +1.8 on Decision TF)
   • Trendline: +1.2 (Clean break, 2.3 ATR distance)
   • Zone: +1.4 (Dense S/R cluster, 4 touches)
   • Pattern: +1.2 (Hammer forming at zone)
   Total: 6.8/10 → Meets ENTER threshold (5.0)"
```

### Flow 2: Setup Invalidation

```
1. [AI INCOMING - earlier] "Breakout detected on XAUUSD H2..."

   ... (price reverses) ...

2. [AI INCOMING] "Setup invalidated on XAUUSD H2. Price closed back
   below the breakout trendline at 2012.40. This is a confirmed
   fakeout. Cooldown: 4 bars before next scan."

3. [USER REPLY] "Why did it fail?"

4. [AI RESPONSE] "The breakout lacked momentum confirmation.
   Z-score dropped from +1.1 to -0.3 within 2 bars of the
   breakout. Additionally, there was no pullback — price moved
   straight up and reversed, a classic fakeout pattern.
   The convergence score peaked at 3.8/10 (below the 5.0 threshold)."
```

---

## 14. Tier-Based Access Control

### Instrument Subscription Limits

| Feature | FREE | PRO |
|---|---|---|
| **Max instrument subscriptions** | 3 | 15 |
| **Available symbols** | 5 (BTCUSD, EURUSD, USDJPY, US30, XAUUSD) | 15 (all) |
| **Available timeframes** | 3 (H1, H4, D1) | 9 (all) |
| **Max possible combinations** | 15 (5 x 3) | 135 (15 x 9) |
| **Message history retention** | 7 days | Unlimited |
| **AI conversation replies** | 10/day | Unlimited |
| **High-priority sound alerts** | Yes | Yes |

### Tier Validation Logic

```typescript
// Replaces lib/validations/alert.ts

function validateSubscription(
  userId: string,
  symbol: string,
  timeframe: string,
  userTier: 'FREE' | 'PRO'
): ValidationResult {
  const config = getTierConfig(userTier);

  // 1. Check symbol access
  if (!config.symbols.includes(symbol)) {
    return { valid: false, error: 'SYMBOL_NOT_ALLOWED', ... };
  }

  // 2. Check timeframe access
  if (!config.timeframes.includes(timeframe)) {
    return { valid: false, error: 'TIMEFRAME_NOT_ALLOWED', ... };
  }

  // 3. Check subscription limit
  const currentCount = await getActiveSubscriptionCount(userId);
  if (currentCount >= config.maxSubscriptions) {
    return { valid: false, error: 'SUBSCRIPTION_LIMIT_EXCEEDED', ... };
  }

  return { valid: true };
}
```

---

## 15. Migration Strategy: From Alerts to Incoming Chat

### Phase 1: Build Incoming Chat System (New)
- Implement database schema (instrument_subscription, chat_thread, chat_message)
- Build ChatDispatcher service
- Build frontend chat thread list and thread view
- Extend WebSocket with new event types
- Build instrument subscription management UI

### Phase 2: Integrate State Machine → Chat
- Wire EvaluationPipeline.generate_response → ChatDispatcher.dispatch
- Implement message type routing (CHAT_TRIGGERS map)
- Implement user reply → txtai Agent processing
- Test end-to-end: cron trigger → state transition → incoming chat → user reply

### Phase 3: Deprecate Part 11
- Add migration notice to existing alerts page: "Alerts have been upgraded to AI Chat"
- Auto-convert existing alerts to instrument subscriptions where possible:
  - Alert for EURUSD H1 → instrument_subscription for (EURUSD, H1)
  - Deduplicate (user may have multiple alerts for same instrument)
- Redirect /alerts routes to /chat
- Remove Part 11 code (23 files)

### Phase 4: Adapt Part 15
- Keep WebSocket infrastructure (reused by Incoming Chat)
- Keep Notification model for system/billing notifications (non-trading)
- Remove ALERT notification type from Part 15 (replaced by chat messages)
- Notification bell now shows: System + Billing + Payment (not trading alerts)

---

## 16. What Gets Removed (Part 11 Deprecation)

### Complete Part 11 Removal List

| # | File | Replacement |
|---|---|---|
| 1 | `prisma/schema.prisma` (Alert model) | InstrumentSubscription + ChatThread + ChatMessage models |
| 2 | `types/alert.ts` | `types/chat.ts` (new) |
| 3 | `lib/validations/alert.ts` | `lib/validations/subscription.ts` (new, simpler) |
| 4 | `app/api/alerts/route.ts` | `app/api/subscriptions/route.ts` + `app/api/chat/threads/route.ts` |
| 5 | `app/api/alerts/[id]/route.ts` | `app/api/subscriptions/[id]/route.ts` |
| 6 | `components/alerts/alert-card.tsx` | `components/chat/thread-card.tsx` (new) |
| 7 | `components/alerts/alert-form.tsx` | `components/chat/subscribe-form.tsx` (simpler — just symbol + TF) |
| 8 | `components/alerts/alert-list.tsx` | `components/chat/thread-list.tsx` (new) |
| 9 | `components/dashboard/recent-alerts.tsx` | `components/dashboard/recent-chats.tsx` (new) |
| 10 | `hooks/use-alerts.ts` | `hooks/use-chat-threads.ts` + `hooks/use-chat-messages.ts` |
| 11 | `app/(dashboard)/alerts/page.tsx` | `app/(dashboard)/chat/page.tsx` |
| 12 | `app/(dashboard)/alerts/alerts-client.tsx` | `app/(dashboard)/chat/chat-client.tsx` |
| 13 | `app/(dashboard)/alerts/new/page.tsx` | `app/(dashboard)/chat/subscribe/page.tsx` |
| 14 | `app/(dashboard)/alerts/new/create-alert-client.tsx` | `app/(dashboard)/chat/subscribe/subscribe-client.tsx` |
| 15 | `lib/jobs/alert-checker.ts` | State Machine evaluation cycle (already exists in txtai) |
| 16 | `lib/jobs/queue.ts` | Repurpose for State Machine cron scheduling |
| 17-23 | `frontend/*` mirrors | New frontend mirrors for chat components |

---

## 17. What Gets Kept and Adapted (Part 15)

| Part 15 Component | Action | Reason |
|---|---|---|
| `lib/websocket/server.ts` | **Keep + Extend** | Add `incoming_chat`, `thread_state_update`, `mark_thread_read` events |
| `components/providers/websocket-provider.tsx` | **Keep + Extend** | Add chat message subscription handlers |
| `hooks/use-websocket.ts` | **Keep** | Reused as-is for WebSocket connection management |
| `app/api/notifications/route.ts` | **Keep** | Still needed for System/Billing/Payment notifications |
| `components/notifications/notification-bell.tsx` | **Keep + Modify** | Remove "Alerts" tab, keep System/Billing/Payment |
| `lib/email/email.ts` | **Keep** | Email notifications for high-priority trade recommendations (optional) |
| `hooks/use-toast.ts` | **Keep** | Toast for inline feedback (not for chat messages) |
| Notification model (Prisma) | **Keep + Modify** | Remove `ALERT` type from enum, keep other types |

---

## 18. API Design

### Subscription Endpoints (Replace Part 11 Alert CRUD)

```
POST   /api/subscriptions              → Subscribe to instrument
GET    /api/subscriptions              → List user's subscriptions
DELETE /api/subscriptions/[id]         → Unsubscribe from instrument
PATCH  /api/subscriptions/[id]         → Pause/resume subscription
```

### Chat Thread Endpoints (New)

```
GET    /api/chat/threads               → List user's chat threads (sorted by last_message_at)
GET    /api/chat/threads/[id]          → Get thread details
GET    /api/chat/threads/[id]/messages → Get messages in thread (paginated, newest first)
POST   /api/chat/threads/[id]/messages → User sends a message (reply to AI)
POST   /api/chat/threads/[id]/read     → Mark all messages in thread as read
GET    /api/chat/unread-count          → Get total unread count across all threads
```

### Example: Subscribe to Instrument

```
POST /api/subscriptions
{
  "symbol": "EURUSD",
  "timeframe": "H1"
}

Response 201:
{
  "subscription": {
    "id": "clx...",
    "symbol": "EURUSD",
    "timeframe": "H1",
    "isActive": true,
    "createdAt": "2026-02-08T10:00:00Z"
  },
  "thread": {
    "id": "clx...",
    "displayName": "EURUSD H1",
    "unreadCount": 0,
    "currentState": "IDLE"
  },
  "message": "Subscribed to EURUSD H1. AI monitoring is now active."
}
```

### Example: Get Chat Threads

```
GET /api/chat/threads

Response 200:
{
  "threads": [
    {
      "id": "clx...",
      "symbol": "EURUSD",
      "timeframe": "H1",
      "displayName": "EURUSD H1",
      "lastMessageAt": "2026-02-08T10:05:00Z",
      "lastMessagePreview": "Breakout detected on descending trendline...",
      "unreadCount": 2,
      "currentState": "BREAKOUT_DETECTED",
      "tradeDirection": "long",
      "directionLabel": "BUY",
      "convergenceScore": 4.2
    },
    {
      "id": "clx...",
      "symbol": "XAUUSD",
      "timeframe": "H2",
      "displayName": "XAUUSD H2",
      "lastMessageAt": "2026-02-08T09:00:00Z",
      "lastMessagePreview": "Strong Bullish regime. Scanning for breakout...",
      "unreadCount": 0,
      "currentState": "SCANNING",
      "tradeDirection": null,
      "directionLabel": null,
      "convergenceScore": null
    }
  ],
  "totalUnread": 2
}
```

---

## 19. Frontend Architecture

### UI Layout (Matching DavinTrade Screenshot)

The frontend follows a **three-panel layout** where the sidebar contains both regular chats and incoming AI chats, the main area shows the TradingView chart, and the right panel shows indicator data:

```
┌──────────────────┬───────────────────────────────┬──────────────────────┐
│  SIDEBAR         │  MAIN AREA                     │  INDICATOR PANEL     │
│                  │                                 │                      │
│  ○ New Chat      │  [XAUUSD ▼] M5 M15 M30 H1 ..│  XAUUSD H2           │
│  ≡ Indicators    │  H1 Based Timeframe            │  R: 2673.93          │
│  → Incoming Chat │                                 │  KC Zone: 6          │
│  Q Chat Search   │  ┌─────────────────────────┐   │                      │
│  ⊞ Archive       │  │                         │   │  XAUUSD H1           │
│                  │  │   TradingView Chart     │   │  Resistant: 2672.08  │
│ ☆ PINNED CHATS   │  │   (with trendlines)     │   │  Slope: 26           │
│   Refactor pr... │  │                         │   │  Trend: Uptrend      │
│   Marketing p... │  │                         │   │                      │
│                  │  │                         │   │  XAUUSD H1           │
│ RECENT           │  │                         │   │  Support: 2662.36    │
│ ┌──────────────┐ │  └─────────────────────────┘   │  Slope: 19.6         │
│ │→ XAUUSD H4   │ │                                 │                      │
│ │  SELL    (2) │ │                                 │  XAUUSD M30          │
│ │  10 Min Ago  │ │                                 │  Support: 2652.55    │
│ │  I'll help...│ │                                 │  % Breakout: 32%     │
│ ├──────────────┤ │                                 │                      │
│ │→ EURUSD H1   │ │                                 │                      │
│ │  BUY     (3) │ │                                 │                      │
│ │  17 Min Ago  │ │                                 │                      │
│ │  I'll help...│ │                                 │                      │
│ └──────────────┘ │                                 │                      │
│                  │                                 │                      │
│  New Chat        │                                 │                      │
│  hi              │                                 │                      │
│                  │                                 │                      │
│ ⚙ Settings ☽    │  + Ask Claude...       Sonnet ▼ │                      │
│ JD John Doe      │                                 │                      │
└──────────────────┴───────────────────────────────┴──────────────────────┘
```

### Sidebar Component Hierarchy

The sidebar is the **primary home for Incoming Chat entries**. They appear inline with regular chats under the RECENT section:

```
Sidebar/
├── nav-item: New Chat
├── nav-item: Indicators
├── nav-item: Incoming Chat          ← Filter view: shows ONLY incoming AI threads
├── nav-item: Chat Search
├── nav-item: Archive
│
├── section: PINNED CHATS
│   └── [user-pinned conversations]
│
├── section: RECENT                  ← Incoming chats appear HERE
│   ├── IncomingChatEntry            ← "→ XAUUSD H4 SELL (2) 10 Min Ago"
│   ├── IncomingChatEntry            ← "→ EURUSD H1 BUY (3) 17 Min Ago"
│   ├── RegularChatEntry             ← "New Chat — Start a conversation..."
│   └── RegularChatEntry             ← "hi — I'll help you with..."
│
└── footer: Settings | Dark | User
```

### New Component Tree

```
components/chat/
├── sidebar/
│   ├── incoming-chat-entry.tsx      → Incoming chat card in sidebar RECENT section
│   │                                  Shows: → icon, instrument+TF, BUY/SELL label,
│   │                                  unread badge, time ago, preview text
│   ├── incoming-chat-filter.tsx     → "Incoming Chat" nav item — filters to AI threads only
│   └── chat-sidebar-section.tsx     → RECENT section with mixed regular + incoming entries
│
├── thread/
│   ├── thread-view.tsx              → Full chat conversation view (replaces main area on click)
│   ├── chat-message.tsx             → Single message bubble (assistant incoming or user reply)
│   ├── chat-input.tsx               → "Ask Claude..." input at bottom
│   ├── message-metadata.tsx         → Convergence score, confidence bar, direction badge
│   └── direction-label.tsx          → BUY (green) / SELL (red) label component
│
├── subscribe/
│   └── subscribe-form.tsx           → Instrument subscription (symbol + TF picker)
│
└── indicators/
    └── indicator-panel.tsx          → Right-side indicator cards (Keltner, S&R, Slope, etc.)

components/dashboard/
├── recent-chats.tsx                 → Dashboard widget: latest incoming chat messages

hooks/
├── use-chat-threads.ts              → Fetch and manage sidebar thread list
├── use-chat-messages.ts             → Fetch messages within an opened thread
├── use-subscriptions.ts             → Manage instrument subscriptions
├── use-incoming-chat-filter.ts      → Filter sidebar to incoming-only vs all
└── use-chat-unread.ts               → Track total unread count for sidebar badges

app/(dashboard)/chat/
├── page.tsx                         → Server component: fetch threads
├── chat-client.tsx                  → Client component: sidebar + main area + indicators
├── subscribe/
│   ├── page.tsx                     → Server component: subscription form
│   └── subscribe-client.tsx         → Client component: symbol + timeframe picker
```

### Incoming Chat Entry Component — Detailed Spec

Based on the UI screenshot, each incoming chat entry in the sidebar shows:

```typescript
interface IncomingChatEntryProps {
  threadId: string;
  symbol: string;                    // "XAUUSD"
  timeframe: string;                 // "H4"
  direction: 'BUY' | 'SELL';        // From State Machine trade_direction
  directionColor: 'green' | 'red';  // BUY=green, SELL=red
  unreadCount: number;               // Badge: (2), (3)
  timeAgo: string;                   // "10 Min Ago"
  previewText: string;               // "I'll help you with that analysis..."
  isIncoming: true;                  // Always true (→ arrow icon)
}
```

**Visual layout of a single entry:**

```
┌──────────────────────────────────────────┐
│ → XAUUSD H4  SELL        10 Min Ago  (2)│
│   I'll help you with that analysis...    │
└──────────────────────────────────────────┘
  │      │       │              │        │
  │      │       │              │        └── Unread badge (circled count)
  │      │       │              └── Time since latest message
  │      │       └── Direction label (red for SELL, green for BUY)
  │      └── Instrument + Timeframe
  └── Arrow icon (→) = incoming/AI-initiated
```

### When User Clicks an Incoming Chat Entry

The main area transitions from the TradingView chart to the **thread conversation view**:

```
┌──────────────────┬───────────────────────────────┬──────────────────────┐
│  SIDEBAR         │  Thread: XAUUSD H4 SELL       │  INDICATOR PANEL     │
│                  │                                 │                      │
│ RECENT           │  ┌─────────────────────────┐   │  XAUUSD H2           │
│ ┌──────────────┐ │  │ [AI] 10 Min Ago          │   │  R: 2673.93          │
│ │→ XAUUSD H4   │ │  │ Breakout detected on    │   │                      │
│ │  SELL ← open │ │  │ XAUUSD H4. Trendline    │   │  XAUUSD H1           │
│ │  10 Min Ago  │ │  │ break at 2672.08.        │   │  Resistant: 2672.08  │
│ ├──────────────┤ │  │ Direction: SHORT (SELL)  │   │                      │
│ │→ EURUSD H1   │ │  │ Score: 4.2/10           │   │  ...                 │
│ │  BUY     (3) │ │  │ ┌─────────────────────┐ │   │                      │
│ └──────────────┘ │  │ │ Convergence: ████░░  │ │   │                      │
│                  │  │ │ Confidence:  ███░░░  │ │   │                      │
│                  │  │ └─────────────────────┘ │   │                      │
│                  │  └─────────────────────────┘   │                      │
│                  │                                 │                      │
│                  │  ┌─────────────────────────┐   │                      │
│                  │  │ [You]                    │   │                      │
│                  │  │ What's the momentum      │   │                      │
│                  │  │ look like?               │   │                      │
│                  │  └─────────────────────────┘   │                      │
│                  │                                 │                      │
│                  │  ┌─────────────────────────┐   │                      │
│                  │  │ [AI]                     │   │                      │
│                  │  │ Momentum Z-score is -1.4 │   │                      │
│                  │  │ (Bearish) on H4...       │   │                      │
│                  │  └─────────────────────────┘   │                      │
│                  │                                 │                      │
│ ⚙ Settings ☽    │  + Ask Claude...       Sonnet ▼ │                      │
└──────────────────┴─────────────────────────────────┴─────────────────────┘
```

The indicator panel on the right **stays visible** — the user can see the chart indicators while reading the AI's analysis in the thread. This is a key UX advantage over a separate alerts page.

---

## 20. Error Handling & Edge Cases

### Edge Case 1: User Not Connected via WebSocket

- Chat message is **always persisted to PostgreSQL first**
- WebSocket delivery is best-effort
- When user reconnects, frontend fetches latest messages via REST API
- Unread count is accurate because it's database-driven, not WebSocket-driven

### Edge Case 2: Multiple Tabs Open

- Existing Part 15 cross-tab sync mechanism handles this
- `mark_thread_read` event propagates across all tabs via WebSocket

### Edge Case 3: State Machine Runs But No Subscribers

- State Machine evaluation cycles run regardless of subscribers (they're global per instrument)
- ChatDispatcher queries subscribers and skips delivery if none found
- No wasted LLM calls — response generation only happens if there are subscribers

### Edge Case 4: User Replies While State Machine Is Mid-Cycle

- User replies are processed asynchronously by the txtai Agent
- The Agent has access to the current AgentState (read-only snapshot)
- User conversation doesn't interfere with the State Machine's evaluation cycle
- Clear separation: State Machine writes to `pending_response`, ChatDispatcher delivers it, User replies go through a separate txtai Agent invocation

### Edge Case 5: High-Volume Delivery (Many Subscribers)

- ChatDispatcher uses batch INSERT for messages (one query per instrument transition, not per user)
- WebSocket emit uses Socket.IO rooms (broadcast to all subscribers in one emit)
- Thread metadata updates batched via single UPDATE...WHERE user_id IN (...) query

---

## 21. Implementation Order

| Phase | Task | Depends On | Effort |
|---|---|---|---|
| 1.1 | Database schema: `instrument_subscription`, `chat_thread`, `chat_message` | — | 1 day |
| 1.2 | API: Subscription CRUD (`/api/subscriptions`) | 1.1 | 1 day |
| 1.3 | API: Chat threads and messages (`/api/chat/threads`, `/api/chat/threads/[id]/messages`) | 1.1 | 2 days |
| 1.4 | ChatDispatcher service (State Machine → chat message pipeline) | 1.1 | 2 days |
| 1.5 | WebSocket extension (new event types) | Part 15 existing | 1 day |
| 2.1 | Frontend: Thread list component | 1.3 | 2 days |
| 2.2 | Frontend: Thread view (message history + input) | 1.3 | 2 days |
| 2.3 | Frontend: Subscribe form | 1.2 | 1 day |
| 2.4 | Frontend: Unread badge integration | 1.5, 2.1 | 1 day |
| 2.5 | Frontend: Dashboard recent-chats widget | 2.1 | 1 day |
| 3.1 | Integration: Wire EvaluationPipeline → ChatDispatcher | 1.4, State Machine doc | 2 days |
| 3.2 | Integration: User reply → txtai Agent processing | 1.3, txtai Agent | 2 days |
| 3.3 | End-to-end testing | All above | 2 days |
| 4.1 | Migration: Auto-convert existing alerts to subscriptions | 3.3 | 1 day |
| 4.2 | Remove Part 11 code (23 files) | 4.1 | 1 day |
| 4.3 | Adapt Part 15 (remove ALERT notification type) | 4.2 | 0.5 day |

**Total estimated effort: ~20 days**

---

## Summary

The Incoming Chat system transforms the trading advisory SaaS from a passive alert platform into an **active conversational AI experience**. By replacing Part 11's manual price-threshold alerts with State Machine-driven Incoming Chat messages:

1. **Users subscribe to instruments** instead of configuring individual alerts
2. **The AI proactively messages users** when significant market events occur
3. **Messages are conversational** — users can reply, ask questions, get deeper analysis
4. **The State Machine is the notification engine** — no separate alert-checking background job
5. **Part 11 is fully replaced** — 23 files removed, replaced by a more capable system
6. **Part 15 WebSocket infrastructure is reused** — extended with new chat-specific event types
7. **The UX follows familiar messaging patterns** (WhatsApp-like) — high engagement, low learning curve

The current Part 11 alert system can be **completely abandoned** in favor of Incoming Chat. The AI-driven approach is strictly superior: it requires less user configuration, delivers richer content, enables follow-up conversation, and creates the engagement loop that turns notifications into active AI-assisted trading analysis sessions.

---

**Document Version**: 1.1
**Date**: February 8, 2026
**Author**: Architecture Design — Incoming Chat Alert Notifications
**UI Reference**: DavinTrade screenshot — sidebar with incoming chat entries showing instrument+direction+unread badges
**Status**: Design Specification — Ready for Review

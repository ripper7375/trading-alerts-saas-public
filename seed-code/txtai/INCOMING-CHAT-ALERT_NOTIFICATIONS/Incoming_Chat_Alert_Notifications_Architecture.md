# Incoming Chat as Alert Notifications — Architecture Design Document

## Trading Advisory Conversational AI — Incoming Chat Notifications

**Document Version**: 1.2
**Date**: February 8, 2026
**Purpose**: Architecture specification for replacing the traditional alert notification system with AI-driven Incoming Chat messages triggered by State Machine transitions, delivered via Redis Pub/Sub message broker (NestJS v11 on Railway) to Next.js v16 frontend on Vercel.
**UI Reference**: See `Incoming_Chat_UI_Reference.png` — the DavinTrade chat interface showing incoming chat entries in the sidebar RECENT section with instrument+direction labels, unread badges, and coexistence with TradingView Lightweight Charts and indicator panels.
**Infrastructure**: Vercel (Next.js v16 — UI) + Railway (NestJS v11 — message broker + WebSocket Gateway + BullMQ workers) + Railway Redis (Pub/Sub + BullMQ queues) + Railway PostgreSQL
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
19. [Deployment Topology: Vercel + Railway Two-Stack Split](#19-deployment-topology-vercel--railway-two-stack-split)
20. [Redis Pub/Sub Message Broker via NestJS v11 on Railway](#20-redis-pubsub-message-broker-via-nestjs-v11-on-railway)
21. [BullMQ Job Queue for Chat Message Processing](#21-bullmq-job-queue-for-chat-message-processing)
22. [End-to-End Data Flow: State Machine → Redis Pub/Sub → NestJS → WebSocket → Next.js](#22-end-to-end-data-flow-state-machine--redis-pubsub--nestjs--websocket--nextjs)
23. [Frontend Architecture (Next.js v16 on Vercel)](#23-frontend-architecture-nextjs-v16-on-vercel)
24. [Error Handling & Edge Cases](#24-error-handling--edge-cases)
25. [Implementation Order](#25-implementation-order)

---

## 1. Executive Summary

This document specifies an architecture where **the AI State Machine itself becomes the notification engine**. Instead of users manually creating price alerts (Part 11's current model), the system delivers trade advisories as **Incoming Chat messages** — conversational AI messages that appear in the user's chat interface exactly like receiving a message on WhatsApp or Telegram.

Each instrument+timeframe pair the user subscribes to (e.g., EURUSD H1, XAUUSD H2) runs its own independent State Machine evaluation cycle. When the State Machine transitions through significant states (BREAKOUT_DETECTED, AWAITING_PULLBACK, bounce confirmed, etc.), it generates a natural-language advisory message and delivers it as an Incoming Chat to the user in real-time.

**Key insight**: The current Part 11 alert system is a _dumb_ price-threshold monitor ("notify me when XAUUSD > 2000"). The Incoming Chat replaces this with an _intelligent_ AI-driven system that proactively tells the user **what matters and why**, using the full convergence scoring engine and LLM evaluation.

---

## 2. Problem Statement: Why Replace Current Alerts?

### Current Alert System (Part 11) — Limitations

| Aspect                   | Current System                                                                | Problem                                                                |
| ------------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Trigger logic**        | Simple price threshold (above/below/equals)                                   | No intelligence — user must know what price to watch                   |
| **Notification content** | "XAUUSD crossed above 2000.50"                                                | No context, no reasoning, no actionable advice                         |
| **User effort**          | User must manually create each alert, choose condition type, set target value | High friction — requires user to already know what to watch            |
| **AI involvement**       | None                                                                          | Completely disconnected from the Conversational AI system              |
| **Engagement**           | One-shot notification (alert triggers, sets `isActive=false`, done)           | No conversation flow — dead end                                        |
| **Delivery**             | Notification bell + toast (Part 15)                                           | Static, non-conversational — doesn't encourage interaction             |
| **State awareness**      | None — checks raw price against threshold                                     | Doesn't understand breakouts, pullbacks, convergence, or market regime |

### Incoming Chat System — What It Solves

| Aspect                   | Incoming Chat                                                             | Improvement                                                   |
| ------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Trigger logic**        | State Machine transitions (breakout detected, pullback testing, etc.)     | AI decides what's worth alerting — user doesn't need to guess |
| **Notification content** | Rich conversational message with reasoning, score breakdown, confidence   | User understands _why_ this matters                           |
| **User effort**          | Subscribe to instruments — AI handles the rest                            | Zero-configuration alerting                                   |
| **AI involvement**       | Full LLM evaluation + convergence scoring + knowledge retrieval           | Every message is an AI advisory                               |
| **Engagement**           | Incoming message in chat thread — user can reply, ask follow-up questions | Natural conversation flow — users _want_ to engage            |
| **Delivery**             | Chat message with unread badge (like WhatsApp)                            | Familiar UX pattern — high open rates                         |
| **State awareness**      | Full State Machine context (regime, momentum, trendlines, zones)          | Messages are contextually rich and methodologically sound     |

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

| Aspect           | Notification (Current Part 15)    | Incoming Chat (Proposed)                                            |
| ---------------- | --------------------------------- | ------------------------------------------------------------------- |
| Appears in       | Bell dropdown / notification list | **Sidebar RECENT section** (primary navigation)                     |
| Visual format    | Text-only notification card       | Chat entry with direction label (BUY/SELL), unread badge, preview   |
| User action      | Read → dismiss                    | Click → **open thread → reply / ask questions**                     |
| History          | Flat list, no grouping            | Grouped by instrument thread with full conversation history         |
| Context          | Isolated message                  | Full conversation + chart + indicator panels visible simultaneously |
| Engagement       | Low (read-and-forget)             | High (conversation continues, user asks follow-ups)                 |
| Direction signal | None                              | BUY (green) / SELL (red) label — instant visual cue                 |

---

## 4. Can the Current Alert System Be Fully Replaced?

### Short Answer: Yes — with one consideration.

The Incoming Chat system **completely subsumes** the current Part 11 alert system. Here's the detailed analysis:

### What Part 11 Does vs. What Incoming Chat Covers

| Part 11 Feature                             | Incoming Chat Replacement                                                                        | Status                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| Price-above alerts                          | State Machine detects breakouts above trendlines — far more intelligent than raw price threshold | **Fully replaced**                               |
| Price-below alerts                          | State Machine detects breakdowns below trendlines                                                | **Fully replaced**                               |
| Price-equals alerts                         | Not directly replaced (edge case — rarely useful in practice)                                    | **Deprecated** — convergence scoring is superior |
| Alert creation form                         | Replaced by instrument subscription (simpler UX)                                                 | **Fully replaced**                               |
| Alert management (pause/resume/delete)      | Replaced by subscribe/unsubscribe per instrument                                                 | **Fully replaced**                               |
| Background checker job (`alert-checker.ts`) | Replaced by State Machine cron-triggered evaluation cycle                                        | **Fully replaced**                               |
| Tier-based limits (5 FREE / 20 PRO alerts)  | Replaced by instrument subscription limits (see Section 14)                                      | **Fully replaced**                               |
| Trigger history                             | Replaced by chat message history (richer, with full context)                                     | **Fully replaced**                               |

### The One Consideration: Simple Price Alerts as a Convenience Feature

Some users may want a simple "notify me when price hits X" without the full AI evaluation. This is a **convenience feature**, not a core need. Two options:

**Option A: Full replacement (Recommended)**
Remove Part 11 entirely. Users who want price-level awareness can ask the AI in their chat thread: _"Let me know when EURUSD reaches 1.1000"_ — the AI can handle this conversationally within the chat thread context, no separate alert system needed.

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

### Deployment Topology

The system spans **two deployment stacks** with Redis as the message bridge:

- **Vercel**: Next.js v16 frontend (TradingView Lightweight Charts, chat UI, sidebar)
- **Railway**: NestJS v11 API (WebSocket Gateway, message broker, BullMQ workers) + Redis + PostgreSQL + txtai State Machine (Python)

### System Diagram (Two-Stack with Redis Pub/Sub)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  RAILWAY (Backend Stack)                                                     │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  txtai Application (Python)                                           │  │
│  │                                                                       │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │  │
│  │  │ EURUSD H1    │  │ XAUUSD H2    │  │ USDJPY H1    │  ...          │  │
│  │  │ StateMachine │  │ StateMachine │  │ StateMachine │               │  │
│  │  │ AgentState   │  │ AgentState   │  │ AgentState   │               │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │  │
│  │         │                 │                 │                         │  │
│  │         ▼                 ▼                 ▼                         │  │
│  │  ┌─────────────────────────────────────────────────────────────┐     │  │
│  │  │  Chat Dispatcher (Python)                                    │     │  │
│  │  │  ─ Generates advisory text from AgentState via LLM           │     │  │
│  │  │  ─ Persists chat_message to PostgreSQL                       │     │  │
│  │  │  ─ PUBLISHES to Redis channel: 'incoming_chat:{instrument}' │     │  │
│  │  └──────────────────────┬──────────────────────────────────────┘     │  │
│  └─────────────────────────┼─────────────────────────────────────────────┘  │
│                            │ Redis PUBLISH                                   │
│                            ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Railway Redis (Message Broker)                                       │  │
│  │  ┌─────────────────────────────────────────────────────────────┐     │  │
│  │  │  Pub/Sub Channels:                                          │     │  │
│  │  │    'incoming_chat:{instrument}'  → real-time fan-out        │     │  │
│  │  │                                                              │     │  │
│  │  │  BullMQ Queues:                                             │     │  │
│  │  │    'chat-message-processing'     → reliable delivery        │     │  │
│  │  │    'chat-notification-delivery'  → push/email notifications │     │  │
│  │  └─────────────────────────────────────────────────────────────┘     │  │
│  └──────────────────────┬────────────────┬───────────────────────────────┘  │
│                         │ SUBSCRIBE      │ BullMQ consume                    │
│                         ▼                ▼                                    │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  NestJS v11 API (Component B — Chat Gateway)                          │  │
│  │                                                                       │  │
│  │  ┌─────────────────────────┐  ┌─────────────────────────────────┐    │  │
│  │  │  Redis Subscriber       │  │  BullMQ Worker                   │    │  │
│  │  │  (IncomingChatListener) │  │  (ChatMessageProcessor)          │    │  │
│  │  │                         │  │                                   │    │  │
│  │  │  Receives Pub/Sub msg → │  │  Processes jobs:                 │    │  │
│  │  │  Routes to WebSocket    │  │  - Fan-out to subscribers        │    │  │
│  │  │  Gateway for real-time  │  │  - Update chat_thread metadata   │    │  │
│  │  │  delivery               │  │  - Send push/email notifications │    │  │
│  │  └────────────┬────────────┘  └──────────────────────────────────┘    │  │
│  │               │                                                       │  │
│  │  ┌────────────▼──────────────────────────────────────────────────┐    │  │
│  │  │  WebSocket Gateway (Socket.IO)                                 │    │  │
│  │  │  ─ JWT authenticated connections                               │    │  │
│  │  │  ─ User rooms: 'user:{userId}'                                │    │  │
│  │  │  ─ Emits: 'incoming_chat', 'thread_state_update'              │    │  │
│  │  │  ─ Receives: 'mark_thread_read', user replies                 │    │  │
│  │  └────────────┬──────────────────────────────────────────────────┘    │  │
│  └───────────────┼───────────────────────────────────────────────────────┘  │
│                  │ WebSocket (Socket.IO over wss://)                         │
└──────────────────┼──────────────────────────────────────────────────────────┘
                   │
         ┌─────────▼─────────┐
         │    INTERNET        │
         └─────────┬─────────┘
                   │
┌──────────────────┼──────────────────────────────────────────────────────────┐
│  VERCEL (Frontend Stack)                                                     │
│                  │ WebSocket client (Socket.IO)                              │
│  ┌───────────────▼───────────────────────────────────────────────────────┐  │
│  │  Next.js v16 Frontend                                                 │  │
│  │                                                                       │  │
│  │  ┌──────────────┐  ┌────────────────────┐  ┌──────────────────────┐  │  │
│  │  │ Chat Sidebar │  │ TradingView LW     │  │ Indicator Panels     │  │  │
│  │  │ (threads,    │  │ Charts (OHLCV,     │  │ (Keltner, S&R,      │  │  │
│  │  │  incoming)   │  │  trendlines)       │  │  Slope, Trend)      │  │  │
│  │  └──────────────┘  └────────────────────┘  └──────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow — Incoming Chat Message (Cross-Stack)

```
1. Cron trigger (new bar close for primary Decision TF)
       │
       │  ┌─────────────── RAILWAY ───────────────────────────────────┐
       ▼  │                                                            │
2. txtai State Machine evaluation cycle runs for (instrument, tf_config)
       │  │                                                            │
3. State transition occurs (e.g., SCANNING → BREAKOUT_DETECTED)       │
       │  │                                                            │
4. EvaluationPipeline generates `pending_response` via Claude LLM     │
       │  │                                                            │
5. Chat Dispatcher (Python):                                           │
   ├── Persists chat_message to PostgreSQL (durable record)           │
   ├── PUBLISH to Redis channel: 'incoming_chat:EURUSD_H1'           │
   │   Payload: {threadId, message, subscribers[], priority}          │
   └── Enqueue BullMQ job: 'chat-message-processing'                 │
       │   (for fan-out, thread metadata update, push notifications)  │
       │  │                                                            │
       │  └────────────────────────────────────────────────────────────┘
       │
       ▼  ┌─────────────── RAILWAY (NestJS v11) ─────────────────────┐
6. NestJS IncomingChatListener (Redis SUBSCRIBE):                      │
   ├── Receives Pub/Sub message in <1ms (Railway internal network)    │
   ├── Resolves subscriber user_ids for this instrument               │
   └── Emits WebSocket: 'incoming_chat' → each user's room           │
       │  │                                                            │
       │  └────────────────────────────────────────────────────────────┘
       │
       ▼  ┌─────────────── VERCEL (Next.js v16) ─────────────────────┐
7. Frontend receives WebSocket event:                                   │
   ├── Updates sidebar thread list (bumps instrument to top)          │
   ├── Shows BUY/SELL label + unread badge in RECENT section          │
   ├── If user is IN the thread: auto-scrolls to new message         │
   └── If user is NOT in the thread: shows unread indicator           │
       │  │                                                            │
       │  └────────────────────────────────────────────────────────────┘
       │
8. User opens thread → reads message → can reply to ask AI questions
```

---

## 6. Instrument Subscription Model

### Concept

Instead of creating individual price alerts, users **subscribe to instruments**. Each subscription activates a State Machine instance for that (symbol, timeframe) pair.

### Subscription vs. Alert — Comparison

| Aspect               | Part 11 Alert                                             | Instrument Subscription                              |
| -------------------- | --------------------------------------------------------- | ---------------------------------------------------- |
| What user configures | Symbol + Timeframe + Condition type + Target value + Name | Symbol + Timeframe (that's it)                       |
| Number of decisions  | 5 fields                                                  | 2 fields                                             |
| What triggers        | Raw price crossing a threshold                            | AI State Machine detecting significant market events |
| What user receives   | One notification, then alert deactivates                  | Ongoing stream of AI messages as market evolves      |
| Lifetime             | Single-use (deactivates after trigger)                    | Continuous until user unsubscribes                   |

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

| Tier     | Max Subscriptions | Symbols    | Timeframes | Rationale                                                                                                                        |
| -------- | ----------------- | ---------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **FREE** | 3 instruments     | 5 symbols  | 3 TFs      | Lower than Part 11's 5 alerts because each subscription is far more valuable (continuous AI monitoring vs. one-shot price check) |
| **PRO**  | 15 instruments    | 15 symbols | 9 TFs      | Higher value — each subscription is a dedicated AI analyst for that instrument                                                   |

---

## 7. State Machine → Incoming Chat Integration

### Design Principle: Notify Once, Let the User Lead

The State Machine runs an evaluation cycle on **every bar close**. But the user should **not** receive a message on every cycle. The incoming chat is an invitation to start a conversation — not a stream of automated status updates.

**Rule: Only `BREAKOUT_DETECTED` generates an incoming chat message.**

All subsequent states (AWAITING_PULLBACK, PULLBACK_TESTING, etc.) are **silent**. The user has already been notified. The breakout message sits in their sidebar with an unread badge and a time-ago label. When the user is ready, they open the thread and chat with the AI to get the latest status — on their own terms.

**Why this works:**

1. BREAKOUT_DETECTED is the **first actionable event** — it's the only state worth interrupting the user for
2. The user has **time** between breakout detection and the eventual pullback/recommendation — time to open the chat, ask questions, and make decisions
3. All subsequent state data is **available on demand** when the user opens the thread and asks the AI
4. The thread stays in the sidebar with `unread badge + "X Min Ago"` — visible but not intrusive
5. Zero notification spam — the user is in control of when they engage

### Which States Generate Messages

```python
# File: services/agent/chat_dispatcher.py

# ONLY breakout detection triggers an incoming chat.
# Everything else is available on-demand when the user opens the thread.
CHAT_TRIGGER = {
    State.BREAKOUT_DETECTED: {
        "priority": "high",
        "message_type": "breakout_alert",
        "sound": True,
        "badge_style": "urgent",
    },
}

# These states do NOT send incoming chat messages:
#   IDLE              → Nothing to report
#   NAVIGATING        → Internal regime assessment
#   SCANNING          → Background monitoring (silent)
#   AWAITING_PULLBACK → User already notified at breakout
#   PULLBACK_TESTING  → User already notified at breakout
#   MISSED            → User can see status when they open thread
#   INVALIDATED       → User can see status when they open thread
```

### What Happens After the Breakout Message

```
State Machine detects BREAKOUT_DETECTED for (XAUUSD, H4, direction=short)
       │
       ▼
ChatDispatcher sends ONE incoming chat message:
  ─ "Breakout detected on XAUUSD H4. Price closed below ascending
     trendline at 2672.08. Direction: SHORT (SELL). Convergence
     score: 4.2/10. Momentum confirming with Z-score -1.4."
  ─ Appears in sidebar: "→ XAUUSD H4 SELL  10 Min Ago  (1)"
       │
       ▼
State Machine progresses silently through subsequent states:
  AWAITING_PULLBACK (8-12 bars) → no message
  PULLBACK_TESTING (3-8 bars)   → no message
       │
       ▼
User opens the thread whenever they're ready:
  ─ Sees the breakout message
  ─ Asks: "What's the current status?"
  ─ AI responds with LIVE state: "Pullback arrived at zone 2662-2669.
     Testing bounce. Score now 6.2/10. Bounce pattern forming."
  ─ Asks: "Break down the 5 factors"
  ─ AI responds with full convergence breakdown
  ─ User makes their own trade decision
```

### Why Not Notify on AWAITING_PULLBACK or PULLBACK_TESTING?

| Reason                            | Explanation                                                                                                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No new actionable information** | "Still waiting for pullback" is not actionable. The user already knows a breakout happened.                                                                       |
| **User has time**                 | Pullback windows are 8-12 bars (8-48 hours depending on TF). No urgency to send updates every bar.                                                                |
| **On-demand is better**           | When the user opens the thread, the AI gives the LIVE state — always current, always accurate. A cached notification from 3 bars ago is stale.                    |
| **Prevents spam**                 | A user with 3 subscriptions would get 18+ messages per setup lifecycle without throttling. With breakout-only: 3 messages total.                                  |
| **Chat UI already shows status**  | The thread's `currentState` and `tradeDirection` are visible in the sidebar without opening. The permanent instrument badge shows which instrument this is about. |

### Messages Per Setup Lifecycle

```
Entire lifecycle (breakout → recommendation or invalidation):

  BREAKOUT_DETECTED:   1 message  (the ONLY incoming chat)
  AWAITING_PULLBACK:   0 messages (silent)
  PULLBACK_TESTING:    0 messages (silent)
  MISSED/INVALIDATED:  0 messages (silent)
  ─────────────────────────────
  Total:               1 message per setup

User with 3 subscriptions, all active setups:
  Total incoming chats: 3 messages (one per breakout)
  Compare to previous design: 15-21 messages ← spam
```

### Thread State Sync (Without Sending Messages)

Even though no new messages are sent after BREAKOUT_DETECTED, the thread metadata is still updated on each evaluation cycle so the sidebar shows current state:

```python
# On every evaluation cycle (even when no message is sent):
# Update thread metadata via BullMQ worker (silent — no WebSocket push)

chat_thread.current_state = agent_state["current_state"]      # e.g., "AWAITING_PULLBACK"
chat_thread.trade_direction = agent_state["trade_direction"]   # e.g., "short"
chat_thread.convergence_score = agent_state["convergence_score"]

# The sidebar can optionally reflect the current state via periodic REST poll
# or a lightweight WebSocket 'thread_state_update' event (no sound, no badge increment)
```

### Dispatch Logic (Simplified)

```python
def should_send(self, agent_state: dict) -> bool:
    """Only send an incoming chat when entering BREAKOUT_DETECTED."""
    current = State(agent_state["current_state"])
    previous = agent_state.get("previous_state")

    # Only send on state TRANSITION into BREAKOUT_DETECTED
    if current == State.BREAKOUT_DETECTED and previous != "BREAKOUT_DETECTED":
        return True

    return False
```

### Transition → Message Pipeline

```
StateMachine.transition(agent_state, condition)
       │
       ▼
ChatDispatcher.should_send(agent_state)?
       │
       ├── current_state == BREAKOUT_DETECTED AND is new transition?
       │   ├── YES → Continue to dispatch
       │   └── NO  → STOP (no message)
       │
       ▼ (only for BREAKOUT_DETECTED)
EvaluationPipeline.generate_response(agent_state)
       │ ← LLM generates breakout advisory text
       │
       ▼
ChatDispatcher.dispatch(agent_state)
       │
       ├── 1. Find the user's EXISTING chat thread for this instrument
       │      (instrument badge lookup — see Trading Instrument Chat
       │       Management document for thread resolution logic)
       │
       ├── 2. INSERT into chat_messages:
       │         role: 'assistant'
       │         content: breakout advisory text
       │         message_type: 'breakout_alert'
       │         metadata: {convergence_score, state, confidence, ...}
       │
       ├── 3. UPDATE chat_thread:
       │         last_message_at = now()
       │         last_message_preview = first 100 chars
       │         unread_count += 1
       │         current_state = 'BREAKOUT_DETECTED'
       │         trade_direction = agent_state["trade_direction"]
       │
       ├── 4. PUBLISH to Redis Pub/Sub → NestJS → WebSocket → User
       │
       └── 5. Log to audit table
```

---

## 8. Chat Message Types by State

### Message Content by State Machine Position

| State & Condition                                     | Message Type           | Priority | Example Message                                                                                                                                                                                                                                        |
| ----------------------------------------------------- | ---------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **BREAKOUT_DETECTED** (quality_sufficient)            | `breakout_alert`       | HIGH     | "Breakout detected on EURUSD H1. Price has closed above the descending trendline at 1.0892. Convergence score: 4.2/10. Momentum is confirming with Z-score +1.8. Watching for pullback entry..."                                                       |
| **AWAITING_PULLBACK** (update)                        | `pullback_watch`       | MEDIUM   | "Breakout holding on EURUSD H1 (3 bars confirmed). Waiting for pullback to the 1.0875–1.0862 zone. 7 bars remaining in window. Will alert when pullback arrives."                                                                                      |
| **PULLBACK_TESTING** (bounce_confirmed, score >= 5.0) | `trade_recommendation` | HIGH     | "Trade recommendation: LONG EURUSD H1. Convergence score: 6.8/10. Entry zone: 1.0862–1.0875 (3 lots staggered). Factors: Regime +1.4, Momentum +1.6, Trendline +1.2, Zone +1.4, Pattern +1.2. Confidence: 78%. Counter-trend modifier: 1.0 (aligned)." |
| **PULLBACK_TESTING** (score < 5.0)                    | `caution_update`       | MEDIUM   | "Pullback at zone on EURUSD H1, but convergence is insufficient (3.8/10). Momentum weakening. Monitoring for improvement or invalidation."                                                                                                             |
| **MISSED**                                            | `missed_opportunity`   | LOW      | "The EURUSD H1 breakout moved without a pullback entry. Window expired after 10 bars. Cooldown: 4 bars before next scan."                                                                                                                              |
| **INVALIDATED** (level_broken)                        | `setup_invalidated`    | MEDIUM   | "EURUSD H1 setup invalidated: price broke back below the breakout trendline at 1.0845. Fakeout confirmed. Cooldown: 4 bars."                                                                                                                           |
| **INVALIDATED** (instant_fakeout)                     | `setup_invalidated`    | MEDIUM   | "Instant fakeout on EURUSD H1. Breakout bar reversed immediately. Setup invalidated."                                                                                                                                                                  |
| **SCANNING** (periodic)                               | `market_scan`          | LOW      | "EURUSD H1: Strong Bullish regime. Aggregate slope: +2.4. No breakout setup detected. Key trendline at 1.0892. Monitoring."                                                                                                                            |

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
      messageType: string; // 'breakout_alert', 'trade_recommendation', etc.
      priority: 'high' | 'medium' | 'low';
      metadata: Record<string, unknown>;
      createdAt: string;
    };
    thread: {
      symbol: string;
      timeframe: string;
      displayName: string; // "XAUUSD H4"
      currentState: string;
      tradeDirection: 'long' | 'short' | null; // Maps to BUY (green) / SELL (red) label
      unreadCount: number; // Updated count — shown as badge (2), (3)
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

| Priority   | WebSocket Behavior                           | UI Behavior                                                        |
| ---------- | -------------------------------------------- | ------------------------------------------------------------------ |
| **HIGH**   | Immediate emit + optional push notification  | Play sound, prominent badge, auto-expand preview if on thread list |
| **MEDIUM** | Immediate emit                               | Silent badge increment, standard thread list update                |
| **LOW**    | Batch (deliver on next poll or delayed emit) | Badge increment only, no sound, no preview expansion               |

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

| State Machine State | Thread Indicator | Color      |
| ------------------- | ---------------- | ---------- |
| IDLE                | Idle             | Gray       |
| NAVIGATING          | Analyzing        | Blue       |
| SCANNING            | Scanning         | Blue       |
| BREAKOUT_DETECTED   | Breakout!        | Orange-red |
| AWAITING_PULLBACK   | Pullback Watch   | Yellow     |
| PULLBACK_TESTING    | Testing Zone     | Orange     |
| MISSED              | Missed           | Gray       |
| INVALIDATED         | Invalidated      | Red-muted  |

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

| Feature                          | FREE                                     | PRO          |
| -------------------------------- | ---------------------------------------- | ------------ |
| **Max instrument subscriptions** | 3                                        | 15           |
| **Available symbols**            | 5 (BTCUSD, EURUSD, USDJPY, US30, XAUUSD) | 15 (all)     |
| **Available timeframes**         | 3 (H1, H4, D1)                           | 9 (all)      |
| **Max possible combinations**    | 15 (5 x 3)                               | 135 (15 x 9) |
| **Message history retention**    | 7 days                                   | Unlimited    |
| **AI conversation replies**      | 10/day                                   | Unlimited    |
| **High-priority sound alerts**   | Yes                                      | Yes          |

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

| #     | File                                                 | Replacement                                                        |
| ----- | ---------------------------------------------------- | ------------------------------------------------------------------ |
| 1     | `prisma/schema.prisma` (Alert model)                 | InstrumentSubscription + ChatThread + ChatMessage models           |
| 2     | `types/alert.ts`                                     | `types/chat.ts` (new)                                              |
| 3     | `lib/validations/alert.ts`                           | `lib/validations/subscription.ts` (new, simpler)                   |
| 4     | `app/api/alerts/route.ts`                            | `app/api/subscriptions/route.ts` + `app/api/chat/threads/route.ts` |
| 5     | `app/api/alerts/[id]/route.ts`                       | `app/api/subscriptions/[id]/route.ts`                              |
| 6     | `components/alerts/alert-card.tsx`                   | `components/chat/thread-card.tsx` (new)                            |
| 7     | `components/alerts/alert-form.tsx`                   | `components/chat/subscribe-form.tsx` (simpler — just symbol + TF)  |
| 8     | `components/alerts/alert-list.tsx`                   | `components/chat/thread-list.tsx` (new)                            |
| 9     | `components/dashboard/recent-alerts.tsx`             | `components/dashboard/recent-chats.tsx` (new)                      |
| 10    | `hooks/use-alerts.ts`                                | `hooks/use-chat-threads.ts` + `hooks/use-chat-messages.ts`         |
| 11    | `app/(dashboard)/alerts/page.tsx`                    | `app/(dashboard)/chat/page.tsx`                                    |
| 12    | `app/(dashboard)/alerts/alerts-client.tsx`           | `app/(dashboard)/chat/chat-client.tsx`                             |
| 13    | `app/(dashboard)/alerts/new/page.tsx`                | `app/(dashboard)/chat/subscribe/page.tsx`                          |
| 14    | `app/(dashboard)/alerts/new/create-alert-client.tsx` | `app/(dashboard)/chat/subscribe/subscribe-client.tsx`              |
| 15    | `lib/jobs/alert-checker.ts`                          | State Machine evaluation cycle (already exists in txtai)           |
| 16    | `lib/jobs/queue.ts`                                  | Repurpose for State Machine cron scheduling                        |
| 17-23 | `frontend/*` mirrors                                 | New frontend mirrors for chat components                           |

---

## 17. What Gets Kept and Adapted (Part 15)

| Part 15 Component                                | Action            | Reason                                                                 |
| ------------------------------------------------ | ----------------- | ---------------------------------------------------------------------- |
| `lib/websocket/server.ts`                        | **Keep + Extend** | Add `incoming_chat`, `thread_state_update`, `mark_thread_read` events  |
| `components/providers/websocket-provider.tsx`    | **Keep + Extend** | Add chat message subscription handlers                                 |
| `hooks/use-websocket.ts`                         | **Keep**          | Reused as-is for WebSocket connection management                       |
| `app/api/notifications/route.ts`                 | **Keep**          | Still needed for System/Billing/Payment notifications                  |
| `components/notifications/notification-bell.tsx` | **Keep + Modify** | Remove "Alerts" tab, keep System/Billing/Payment                       |
| `lib/email/email.ts`                             | **Keep**          | Email notifications for high-priority trade recommendations (optional) |
| `hooks/use-toast.ts`                             | **Keep**          | Toast for inline feedback (not for chat messages)                      |
| Notification model (Prisma)                      | **Keep + Modify** | Remove `ALERT` type from enum, keep other types                        |

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

## 19. Deployment Topology: Vercel + Railway Two-Stack Split

### Why Two Stacks?

The trading platform is split across two hosting providers, each optimized for its role:

| Stack                  | Host        | Technology                  | Role                                                                                             |
| ---------------------- | ----------- | --------------------------- | ------------------------------------------------------------------------------------------------ |
| **Stack A** (Frontend) | **Vercel**  | Next.js v16                 | UI rendering, TradingView Lightweight Charts, chat sidebar, SSR, API routes for user-facing CRUD |
| **Stack B** (Backend)  | **Railway** | NestJS v11 + txtai (Python) | WebSocket Gateway, Redis message broker, BullMQ workers, State Machine, PostgreSQL, TimescaleDB  |

### Why This Split Matters for Incoming Chat

The State Machine (Python/txtai) runs on **Railway**. The chat UI runs on **Vercel**. They cannot communicate directly. Redis Pub/Sub on Railway is the **real-time bridge** between them:

```
┌──────────────┐     Redis Pub/Sub      ┌───────────────┐    WebSocket     ┌──────────────┐
│ txtai State  │  ──────────────────►  │ NestJS v11    │  ───────────►  │ Next.js v16  │
│ Machine      │   PUBLISH to channel   │ (Railway)     │   Socket.IO     │ (Vercel)     │
│ (Python)     │   'incoming_chat:...'  │ Subscriber →  │   wss://        │ Chat Sidebar │
│ (Railway)    │                        │ WS Gateway    │                 │ TradingView  │
└──────────────┘                        └───────────────┘                 └──────────────┘
```

Without Redis Pub/Sub, the txtai Python process would have to directly call the NestJS WebSocket Gateway — tight coupling, no buffering, no retry, and fragile cross-service dependency.

### Service Map on Railway

```
Railway Private Network (redis.railway.internal)
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │ txtai Service    │    │ NestJS v11 API   │                   │
│  │ (Python)         │    │ (Component B)    │                   │
│  │ - State Machine  │    │ - WebSocket GW   │                   │
│  │ - Agent + LLM    │    │ - Chat Listener  │                   │
│  │ - Evaluation     │    │ - BullMQ Workers │                   │
│  │ - ChatDispatcher │    │ - REST endpoints │                   │
│  └────────┬─────────┘    └──────┬───────────┘                   │
│           │                     │                                │
│           │ PUBLISH             │ SUBSCRIBE + BullMQ consume     │
│           ▼                     ▼                                │
│  ┌──────────────────────────────────────────┐                   │
│  │ Redis 7 (Railway Internal)               │                   │
│  │ - Pub/Sub channels (incoming chat)       │                   │
│  │ - BullMQ queues (chat processing)        │                   │
│  │ - Cache (hot data, 500 bars)             │                   │
│  │ - Rate limiting (sorted sets)            │                   │
│  │ redis.railway.internal:6379              │                   │
│  └──────────────────────────────────────────┘                   │
│           │                                                      │
│           ▼                                                      │
│  ┌──────────────────────────────────────────┐                   │
│  │ PostgreSQL / TimescaleDB (Railway)       │                   │
│  │ - agent_state (State Machine)            │                   │
│  │ - instrument_subscription                │                   │
│  │ - chat_thread, chat_message              │                   │
│  │ - OHLCV data (15 symbol tables)          │                   │
│  └──────────────────────────────────────────┘                   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
         │
         │ WebSocket (wss:// to internet)
         ▼
┌──────────────────────────────────────────────────────────────────┐
│  Vercel Edge Network                                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Next.js v16                                               │   │
│  │ - Chat sidebar + thread view                              │   │
│  │ - TradingView Lightweight Charts                          │   │
│  │ - Socket.IO client → NestJS WebSocket Gateway             │   │
│  │ - REST calls → NestJS API (subscriptions, messages)       │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### Latency Profile

| Hop       | Path                                        | Expected Latency |
| --------- | ------------------------------------------- | ---------------- |
| 1         | txtai → Redis PUBLISH (Railway internal)    | <1ms             |
| 2         | Redis → NestJS SUBSCRIBE (Railway internal) | <1ms             |
| 3         | NestJS WebSocket → Vercel (internet)        | 20-80ms          |
| **Total** | State Machine transition → UI update        | **~25-85ms**     |

This is fast enough for "incoming message" UX — WhatsApp messages typically take 100-300ms.

---

## 20. Redis Pub/Sub Message Broker via NestJS v11 on Railway

### Why Redis Pub/Sub (Not Just BullMQ)

The system uses **both** Redis Pub/Sub and BullMQ, for different purposes:

| Mechanism         | Purpose                      | Delivery                           | Latency  | Durability                                                         |
| ----------------- | ---------------------------- | ---------------------------------- | -------- | ------------------------------------------------------------------ |
| **Redis Pub/Sub** | Real-time WebSocket delivery | Fire-and-forget to connected users | <2ms     | No persistence — if user is offline, message is missed via Pub/Sub |
| **BullMQ Queue**  | Reliable message processing  | Guaranteed at-least-once delivery  | 10-100ms | Persisted in Redis — survives restarts, retries on failure         |

**Both are needed** because:

- Pub/Sub gives **instant** delivery to connected users (the "WhatsApp feel")
- BullMQ gives **reliable** processing for database writes, thread metadata updates, push notifications, and email delivery

### Redis Pub/Sub Channel Design

```
Channel naming convention:
  incoming_chat:{symbol}_{timeframe}

Examples:
  incoming_chat:EURUSD_H1
  incoming_chat:XAUUSD_H2
  incoming_chat:USDJPY_H1
```

### Publisher: txtai ChatDispatcher (Python)

```python
# File: services/agent/chat_dispatcher.py

import redis
import json
from datetime import datetime


class ChatDispatcher:
    """Dispatches incoming chat messages from State Machine to Redis Pub/Sub.

    Runs within the txtai Python process on Railway.
    Publishes to Redis on the Railway internal network for <1ms latency.
    """

    def __init__(self, redis_url: str, db_engine):
        self.redis = redis.Redis.from_url(redis_url)
        self.db = db_engine

    def dispatch(self, agent_state: dict, message_type: str, priority: str) -> None:
        """Dispatch a chat message after State Machine transition.

        1. Persist to PostgreSQL (durable record)
        2. PUBLISH to Redis Pub/Sub (real-time delivery)
        3. Enqueue BullMQ job (reliable fan-out + notifications)
        """
        symbol = agent_state["instrument"]
        timeframe = agent_state["tf_config"]   # Mapped: config_a → H1, config_b → H2
        content = agent_state["pending_response"]
        direction = agent_state.get("trade_direction")  # 'long' or 'short'

        # 1. Query subscribers
        subscribers = self._get_subscribers(symbol, timeframe)
        if not subscribers:
            return  # No subscribers — skip

        # 2. Persist chat messages to PostgreSQL (batch insert)
        message_records = self._persist_messages(
            subscribers, symbol, timeframe, content,
            message_type, priority, direction, agent_state
        )

        # 3. PUBLISH to Redis Pub/Sub channel (real-time)
        channel = f"incoming_chat:{symbol}_{timeframe}"
        payload = json.dumps({
            "symbol": symbol,
            "timeframe": timeframe,
            "direction": direction,
            "content": content,
            "message_type": message_type,
            "priority": priority,
            "current_state": agent_state["current_state"],
            "convergence_score": agent_state.get("convergence_score"),
            "subscriber_thread_map": {
                sub["user_id"]: {
                    "thread_id": sub["thread_id"],
                    "message_id": msg["id"],
                }
                for sub, msg in zip(subscribers, message_records)
            },
            "timestamp": datetime.utcnow().isoformat(),
        })
        self.redis.publish(channel, payload)

        # 4. Enqueue BullMQ job for reliable processing
        #    (thread metadata update, push notifications, email)
        bullmq_payload = json.dumps({
            "type": "chat_message_fanout",
            "symbol": symbol,
            "timeframe": timeframe,
            "message_type": message_type,
            "priority": priority,
            "subscriber_thread_map": payload,  # Same data
        })
        self.redis.lpush("bull:chat-message-processing:wait", bullmq_payload)
```

### Subscriber: NestJS v11 IncomingChatListener

```typescript
// File: src/chat/incoming-chat.listener.ts (NestJS v11 on Railway)

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { ChatGateway } from './chat.gateway';

@Injectable()
export class IncomingChatListener implements OnModuleInit, OnModuleDestroy {
  private subscriber: Redis;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly chatGateway: ChatGateway
  ) {}

  async onModuleInit(): Promise<void> {
    // Create a dedicated subscriber connection
    // (Redis requires separate connections for Pub/Sub)
    this.subscriber = this.redis.duplicate();

    // Subscribe to all incoming chat channels via pattern
    await this.subscriber.psubscribe('incoming_chat:*');

    this.subscriber.on('pmessage', (pattern, channel, message) => {
      this.handleIncomingChat(channel, JSON.parse(message));
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber.punsubscribe('incoming_chat:*');
    await this.subscriber.quit();
  }

  private handleIncomingChat(
    channel: string,
    payload: IncomingChatPayload
  ): void {
    const { subscriber_thread_map, ...messageData } = payload;

    // Fan-out to each subscriber's WebSocket room
    for (const [userId, threadInfo] of Object.entries(subscriber_thread_map)) {
      this.chatGateway.emitToUser(userId, 'incoming_chat', {
        threadId: threadInfo.thread_id,
        message: {
          id: threadInfo.message_id,
          role: 'assistant',
          content: messageData.content,
          messageType: messageData.message_type,
          priority: messageData.priority,
          metadata: {
            state: messageData.current_state,
            convergenceScore: messageData.convergence_score,
          },
          createdAt: messageData.timestamp,
        },
        thread: {
          symbol: messageData.symbol,
          timeframe: messageData.timeframe,
          displayName: `${messageData.symbol} ${messageData.timeframe}`,
          currentState: messageData.current_state,
          tradeDirection: messageData.direction,
          unreadCount: -1, // Client increments locally; actual count from REST
        },
      });
    }
  }
}

interface IncomingChatPayload {
  symbol: string;
  timeframe: string;
  direction: 'long' | 'short' | null;
  content: string;
  message_type: string;
  priority: 'high' | 'medium' | 'low';
  current_state: string;
  convergence_score: number | null;
  subscriber_thread_map: Record<
    string,
    { thread_id: string; message_id: string }
  >;
  timestamp: string;
}
```

### NestJS WebSocket Gateway (Chat Extension)

```typescript
// File: src/chat/chat.gateway.ts (NestJS v11 on Railway)

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL, // Vercel URL
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  async handleConnection(client: Socket): Promise<void> {
    // JWT authentication (reuses existing Component B auth)
    const userId = await this.authenticateClient(client);
    if (!userId) {
      client.disconnect();
      return;
    }
    // Join user-specific room
    client.join(`user:${userId}`);
    client.data.userId = userId;
  }

  handleDisconnect(client: Socket): void {
    // Cleanup handled by Socket.IO room auto-leave
  }

  /**
   * Emit an incoming chat message to a specific user.
   * Called by IncomingChatListener when Redis Pub/Sub message arrives.
   */
  emitToUser(userId: string, event: string, data: unknown): void {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  /**
   * Client marks a thread as read.
   */
  @SubscribeMessage('mark_thread_read')
  async handleMarkThreadRead(
    client: Socket,
    payload: { threadId: string }
  ): Promise<void> {
    // Update DB, then broadcast to all user's tabs
    this.server
      .to(`user:${client.data.userId}`)
      .emit('thread_read', { threadId: payload.threadId });
  }

  private async authenticateClient(client: Socket): Promise<string | null> {
    // Verify JWT from handshake auth header
    // Returns userId or null
    // (Reuses existing Component B JWT verification)
    return null; // Implementation per existing auth module
  }
}
```

### NestJS Chat Module Registration

```typescript
// File: src/chat/chat.module.ts (NestJS v11)

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ChatGateway } from './chat.gateway';
import { IncomingChatListener } from './incoming-chat.listener';
import { ChatMessageProcessor } from './chat-message.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'chat-message-processing',
    }),
    BullModule.registerQueue({
      name: 'chat-notification-delivery',
    }),
  ],
  providers: [ChatGateway, IncomingChatListener, ChatMessageProcessor],
  exports: [ChatGateway],
})
export class ChatModule {}
```

---

## 21. BullMQ Job Queue for Chat Message Processing

### Why BullMQ in Addition to Pub/Sub

Redis Pub/Sub is fire-and-forget — if the NestJS subscriber crashes mid-processing, the message is lost. BullMQ provides:

- **At-least-once delivery**: Jobs persist in Redis until acknowledged
- **Retry with backoff**: Failed jobs retry automatically
- **Priority queues**: HIGH priority breakout alerts processed before LOW market scans
- **Rate limiting**: Prevent email/push notification flooding
- **Dead letter queue**: Failed jobs captured for debugging

### Queue Design

```
Queue: 'chat-message-processing'
├── Job: chat_message_fanout
│   ├── Update chat_thread metadata (last_message_at, unread_count, etc.)
│   ├── Update chat_thread.current_state and trade_direction
│   └── Trigger downstream notification jobs
│
Queue: 'chat-notification-delivery'
├── Job: push_notification
│   ├── Send browser push notification (for HIGH priority)
│   └── Send mobile PWA push (if registered)
│
├── Job: email_notification
│   ├── Send email for trade_recommendation messages (HIGH priority)
│   └── Rate limited: max 1 email per instrument per hour
```

### BullMQ Worker (NestJS v11)

```typescript
// File: src/chat/chat-message.processor.ts

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

@Processor('chat-message-processing')
export class ChatMessageProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { symbol, timeframe, message_type, priority, subscriber_thread_map } =
      job.data;

    const threadMap = JSON.parse(subscriber_thread_map).subscriber_thread_map;

    // 1. Batch update chat_thread metadata for all subscribers
    for (const [userId, threadInfo] of Object.entries(threadMap)) {
      await this.prisma.chatThread.update({
        where: { id: (threadInfo as any).thread_id },
        data: {
          lastMessageAt: new Date(),
          lastMessagePreview: job.data.content?.substring(0, 200),
          unreadCount: { increment: 1 },
          currentState: job.data.current_state,
          tradeDirection: job.data.direction,
          convergenceScore: job.data.convergence_score,
        },
      });
    }

    // 2. For HIGH priority: enqueue push notification jobs
    if (priority === 'high') {
      // Add to notification delivery queue
      // (push notifications, email for trade recommendations)
    }
  }
}
```

### Dual-Write Pattern: Pub/Sub + BullMQ

The ChatDispatcher in txtai (Python) performs a **dual write** to Redis:

```
ChatDispatcher.dispatch()
    │
    ├── 1. INSERT chat_message → PostgreSQL  (durable record)
    │
    ├── 2. PUBLISH → Redis Pub/Sub           (instant WebSocket delivery)
    │      Channel: 'incoming_chat:EURUSD_H1'
    │      → NestJS subscriber picks up in <1ms
    │      → Emits to WebSocket instantly
    │      → User sees message in sidebar
    │
    └── 3. LPUSH → BullMQ queue              (reliable processing)
           Queue: 'chat-message-processing'
           → NestJS worker picks up in 10-50ms
           → Updates thread metadata (unread count, state, direction)
           → Sends push/email notifications if HIGH priority
```

**Why dual write?** If Pub/Sub message is lost (NestJS restart, network blip), the BullMQ job still processes the message and updates metadata. The WebSocket delivery is best-effort (optimistic), while database consistency is guaranteed by BullMQ.

---

## 22. End-to-End Data Flow: State Machine → Redis Pub/Sub → NestJS → WebSocket → Next.js

### Complete Sequence Diagram

```
   txtai (Railway)     Redis (Railway)     NestJS v11 (Railway)     Next.js v16 (Vercel)
        │                    │                     │                       │
   [Bar close]               │                     │                       │
        │                    │                     │                       │
   State Machine             │                     │                       │
   evaluates...              │                     │                       │
        │                    │                     │                       │
   BREAKOUT_DETECTED         │                     │                       │
        │                    │                     │                       │
   LLM generates             │                     │                       │
   advisory text             │                     │                       │
        │                    │                     │                       │
   ─── INSERT chat_message ──┼──────────── PostgreSQL (Railway) ───────────│
        │                    │                     │                       │
   ─── PUBLISH ──────────────►                     │                       │
        │          'incoming_chat:EURUSD_H1'       │                       │
        │                    │                     │                       │
        │                    ├── pmessage ─────────►                       │
        │                    │                     │                       │
        │                    │              IncomingChatListener            │
        │                    │              resolves subscribers            │
        │                    │                     │                       │
        │                    │              WebSocket Gateway               │
        │                    │              emitToUser()                    │
        │                    │                     │                       │
        │                    │                     ├── 'incoming_chat' ────►
        │                    │                     │      (wss://)          │
        │                    │                     │                       │
        │                    │                     │                Socket.IO client
        │                    │                     │                receives event
        │                    │                     │                       │
        │                    │                     │                Sidebar updates:
        │                    │                     │                → EURUSD H1 BUY (1)
        │                    │                     │                → 'Breakout detected...'
        │                    │                     │                       │
   ─── LPUSH ────────────────►                     │                       │
        │          bull:chat-message-processing     │                       │
        │                    │                     │                       │
        │                    ├── BullMQ consume ───►                       │
        │                    │                     │                       │
        │                    │              ChatMessageProcessor            │
        │                    │              updates thread metadata         │
        │                    │              (unread_count, state, etc.)     │
        │                    │                     │                       │
        │                    │              [If HIGH priority]              │
        │                    │              → Push notification             │
        │                    │              → Email (trade recommendation) │
        │                    │                     │                       │
```

### Timing Breakdown

| Step                             | Operation                                     | Latency                             |
| -------------------------------- | --------------------------------------------- | ----------------------------------- |
| 1                                | State Machine evaluation + LLM call           | 2-8 seconds (Claude API)            |
| 2                                | PostgreSQL INSERT (chat_message)              | 5-15ms                              |
| 3                                | Redis PUBLISH (internal network)              | <1ms                                |
| 4                                | NestJS receives Pub/Sub message               | <1ms                                |
| 5                                | NestJS resolves subscribers + emits WebSocket | 1-5ms                               |
| 6                                | WebSocket transit (Railway → Vercel)          | 20-80ms                             |
| 7                                | Next.js renders sidebar update                | 5-15ms                              |
| **Total (from PUBLISH to UI)**   |                                               | **~30-100ms**                       |
| **Total (from bar close to UI)** |                                               | **~2-9 seconds** (dominated by LLM) |

---

## 23. Frontend Architecture (Next.js v16 on Vercel)

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
  symbol: string; // "XAUUSD"
  timeframe: string; // "H4"
  direction: 'BUY' | 'SELL'; // From State Machine trade_direction
  directionColor: 'green' | 'red'; // BUY=green, SELL=red
  unreadCount: number; // Badge: (2), (3)
  timeAgo: string; // "10 Min Ago"
  previewText: string; // "I'll help you with that analysis..."
  isIncoming: true; // Always true (→ arrow icon)
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

## 24. Error Handling & Edge Cases

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

## 25. Implementation Order

| Phase                                         | Task                                                                                    | Stack              | Depends On         | Effort  |
| --------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------ | ------------------ | ------- |
| **Phase 1: Database + Core Services**         |                                                                                         |                    |                    |         |
| 1.1                                           | Database schema: `instrument_subscription`, `chat_thread`, `chat_message`               | Railway PostgreSQL | —                  | 1 day   |
| 1.2                                           | ChatDispatcher service (Python, txtai → Redis PUBLISH + BullMQ)                         | Railway txtai      | 1.1                | 2 days  |
| 1.3                                           | NestJS ChatModule: IncomingChatListener (Redis SUBSCRIBE)                               | Railway NestJS v11 | 1.1                | 2 days  |
| 1.4                                           | NestJS ChatGateway: WebSocket namespace `/chat`                                         | Railway NestJS v11 | 1.3                | 1 day   |
| 1.5                                           | NestJS ChatMessageProcessor (BullMQ worker)                                             | Railway NestJS v11 | 1.3                | 2 days  |
| **Phase 2: API Endpoints**                    |                                                                                         |                    |                    |         |
| 2.1                                           | API: Subscription CRUD (`/api/subscriptions`)                                           | Railway NestJS v11 | 1.1                | 1 day   |
| 2.2                                           | API: Chat threads and messages (`/api/chat/threads`, `/api/chat/threads/[id]/messages`) | Railway NestJS v11 | 1.1                | 2 days  |
| **Phase 3: Frontend (Next.js v16 on Vercel)** |                                                                                         |                    |                    |         |
| 3.1                                           | Socket.IO client connection to NestJS `/chat` namespace                                 | Vercel Next.js v16 | 1.4                | 1 day   |
| 3.2                                           | Sidebar: IncomingChatEntry component (→ icon, BUY/SELL, badge)                          | Vercel Next.js v16 | 3.1                | 2 days  |
| 3.3                                           | Thread view: message history + chat input                                               | Vercel Next.js v16 | 2.2                | 2 days  |
| 3.4                                           | Subscribe form: instrument subscription picker                                          | Vercel Next.js v16 | 2.1                | 1 day   |
| 3.5                                           | Unread badge integration in sidebar nav                                                 | Vercel Next.js v16 | 3.1, 3.2           | 1 day   |
| 3.6                                           | Dashboard recent-chats widget                                                           | Vercel Next.js v16 | 3.2                | 1 day   |
| **Phase 4: Integration + Testing**            |                                                                                         |                    |                    |         |
| 4.1                                           | Wire EvaluationPipeline → ChatDispatcher → Redis → NestJS → WebSocket                   | All stacks         | 1.2, 1.3, 1.4, 3.1 | 2 days  |
| 4.2                                           | User reply → NestJS → txtai Agent processing                                            | Railway            | 2.2, txtai Agent   | 2 days  |
| 4.3                                           | End-to-end testing (cross-stack)                                                        | All                | All above          | 3 days  |
| **Phase 5: Migration**                        |                                                                                         |                    |                    |         |
| 5.1                                           | Auto-convert existing Part 11 alerts to subscriptions                                   | Railway            | 4.3                | 1 day   |
| 5.2                                           | Remove Part 11 code (23 files from Next.js)                                             | Vercel             | 5.1                | 1 day   |
| 5.3                                           | Adapt Part 15 (remove ALERT notification type)                                          | Both               | 5.2                | 0.5 day |

**Total estimated effort: ~26 days** (increased from 20 due to cross-stack Redis Pub/Sub + NestJS broker layer)

---

## Summary

The Incoming Chat system transforms the trading advisory SaaS from a passive alert platform into an **active conversational AI experience**, built on a **two-stack architecture** with Redis Pub/Sub as the real-time bridge:

### Architecture Stack

| Component                     | Technology                  | Deployment                 |
| ----------------------------- | --------------------------- | -------------------------- |
| State Machine + AI Evaluation | txtai (Python) + Claude API | Railway                    |
| Message Broker                | Redis Pub/Sub + BullMQ      | Railway (internal network) |
| WebSocket Gateway + Workers   | NestJS v11                  | Railway                    |
| Chat UI + TradingView Charts  | Next.js v16                 | Vercel                     |
| Database                      | PostgreSQL / TimescaleDB    | Railway                    |

### Key Design Decisions

1. **Redis Pub/Sub** for <2ms real-time delivery from State Machine → NestJS WebSocket Gateway (Railway internal network)
2. **BullMQ queues** for guaranteed-delivery processing (thread metadata updates, push/email notifications)
3. **Dual-write pattern**: PostgreSQL (durable) + Redis PUBLISH (instant) + BullMQ (reliable) — each serves a different durability/latency need
4. **NestJS v11 ChatModule** as the central broker: subscribes to Redis channels, fans out to WebSocket rooms, processes BullMQ jobs
5. **Next.js v16 on Vercel** connects to NestJS WebSocket via Socket.IO over `wss://` — no direct Redis or PostgreSQL access from frontend

### What Gets Replaced

- **Part 11 alert system**: 23 files completely removed — replaced by instrument subscriptions + AI-driven incoming chat
- **Part 11 background checker** (`alert-checker.ts`): Replaced by State Machine evaluation cycle + ChatDispatcher + Redis Pub/Sub pipeline
- **Part 15 ALERT notification type**: Removed — trading alerts now live in chat threads, not the notification bell

### The Result

Users subscribe to instruments (EURUSD H1, XAUUSD H4). The AI State Machine monitors them continuously. When a breakout is detected, the advisory arrives as an **incoming chat message** in the sidebar — with BUY/SELL direction, unread badge, and the ability to reply and ask the AI follow-up questions. The full pipeline (State Machine → Redis Pub/Sub → NestJS → WebSocket → Next.js sidebar) delivers in under 100ms from PUBLISH to UI render.

---

**Document Version**: 1.2
**Date**: February 8, 2026
**Author**: Architecture Design — Incoming Chat Alert Notifications
**UI Reference**: DavinTrade screenshot — sidebar with incoming chat entries showing instrument+direction+unread badges
**Infrastructure**: Vercel (Next.js v16) + Railway (NestJS v11 + Redis + PostgreSQL + txtai)
**Status**: Design Specification — Ready for Review

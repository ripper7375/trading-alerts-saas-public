# Technical Specification: Client-Side Resilience & UX Hardening

**Target Milestone:** Post-Session 8-5 (UI/UX Polish & Hardening Phase)  
**Execution Target:** Claude Code (Executor)  
**Scope:** Conversational AI (`ChatPanel`), Drawing Line Alerts (`AlertDialog`), and Support Chat Widget

---

## 📌 1. Executive Summary & Problem Statement

In mission-critical trading platforms, unstable network connectivity, cellular dropouts, background tab throttling, or accidental page reloads must never cause data loss or jarring UX failures.

### Current Vulnerabilities:

1. **Volatile Input Drafts:** If a user types a multi-step analytical prompt in the AI Analyst box or configures complex parameters in the Line Alert modal, a tab switch, reload, or brief network disconnect wipes their input.
2. **Brittle Message Dispatch:** When the user clicks "Send" while offline, requests fail immediately without automatic retry or pending state.
3. **Stream Disconnection Pitfalls:** Server-Sent Events (SSE) and WebSocket streams can silently hang on network switches (e.g., Wi-Fi to 5G) without automatic state recovery or event replay.

### Target Objectives:

- **Zero-Draft Loss:** All active inputs and unsubmitted forms are persisted in real time.
- **Offline-Aware Optimistic UI:** Outgoing messages and alert mutations enter a durable local Outbox queue with visual state feedback (`Pending`, `Syncing`, `Delivered`, `Failed`).
- **Resilient Network Client:** Automatic retry with exponential backoff and full jitter.
- **Seamless Reconnection:** Automatic stream recovery using resumable tokens and last-event ID tracking.

---

## 🏗️ 2. Architectural Blueprint

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                 BROWSER CLIENT (REACT / NEXT.JS)                        │
│                                                                                         │
│  [ UI Components ]                                                                      │
│    ├─ AI Analyst Panel (Part B) ──► useDraftPersistence('chat:draft:XAUUSD:M5')        │
│    ├─ Line Alert Dialog (Part C) ──► useDraftPersistence('alert:draft:active')          │
│    └─ Support Chat Modal (Part D) ──► useDraftPersistence('support:draft')              │
│                                                                                         │
│  [ Local Storage Engine ] (Namespace: `davintrade:*`)                                    │
│    ├─ Active Input Buffer (Debounced 300ms ➔ localStorage)                              │
│    └─ Durable Outbox Queue (IndexedDB / idb-keyval / localStorage fallback)              │
│                                                                                         │
│  [ Resilient Network Manager (`ResilientNetworkManager`) ]                              │
│    ├─ Connectivity Monitor (`navigator.onLine` + `window.ononline/onoffline`)          │
│    ├─ Outbox Dispatcher (Sequential FIFO execution + Invariant Checks)                  │
│    ├─ Exponential Backoff + Full Jitter Scheduler                                      │
│    └─ SSE / WebSocket Heartbeat Monitor (Ping/Pong Watchdog 15s)                        │
└────────────────────────────────────────────┬────────────────────────────────────────────┘
                                             │
                                             │ HTTPS (SSE / REST) & WSS (Socket.io)
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                             BACKEND MICROSERVICES CLUSTER                               │
│    ├─ `operation-service` (NestJS: AI Router, SSE Stream, Line Alerts CRUD)             │
│    └─ `Contabo Web Chat Stack` (Node.js Socket.io Support Server)                       │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚙️ 3. Core Modules Specification

### 3.1 Module 1: Debounced Local Input Persistence (`useDraftPersistence`)

**Target File:** `hooks/use-draft-persistence.ts`

#### Technical Requirements:

- **Debounced Write:** Debounce input changes by **300ms** before writing to `localStorage` to eliminate main-thread I/O bottlenecks.
- **Namespace Isolation:** Key structure `davintrade:draft:{context}:{subKey}` (e.g., `davintrade:draft:ai:XAUUSD`, `davintrade:draft:alert:line`).
- **Mount Hydration:** On component mount, automatically restore the cached draft if present.
- **Auto-Purge on Success:** Clear the storage key strictly upon verified dispatch/submission.

```typescript
// Proposed Hook Interface
export function useDraftPersistence<T>(
  storageKey: string,
  initialValue: T,
  options?: { debounceMs?: number }
): [T, (value: T) => void, () => void];
```

---

### 3.2 Module 2: Durable Client Outbox Queue (`useOfflineOutbox`)

**Target File:** `lib/resilience/outbox-manager.ts` & `hooks/use-offline-outbox.ts`

Instead of firing raw `fetch` calls directly from button handlers, all outgoing mutations route through the Outbox Queue:

#### Item Lifecycle:

1. **`QUEUED` (Optimistic):** Generated locally with client UUID, appended immediately to UI with a syncing spinner.
2. **`SENDING`:** Picked up by the network manager and dispatched.
3. **`ACKNOWLEDGED`:** Server responds `200/201 OK`. Item is removed from Outbox; UI status flips to delivered.
4. **`RETRYING`:** Network failure or 5xx error. Item remains in Outbox; exponential backoff scheduled.
5. **`FAILED`:** Unrecoverable error (e.g., 400 Bad Request, tier validation rejection). Item flagged; user presented with inline "Retry" / "Edit" button.

```typescript
export interface OutboxItem<T = unknown> {
  id: string; // UUID v4
  type: 'AI_CHAT_MESSAGE' | 'CREATE_LINE_ALERT' | 'SUPPORT_MESSAGE';
  payload: T;
  createdAt: number; // Unix timestamp
  retryCount: number;
  maxRetries: number;
  status: 'QUEUED' | 'SENDING' | 'RETRYING' | 'FAILED';
  lastError?: string;
}
```

---

### 3.3 Module 3: Offline-Aware Network Manager (`ResilientNetworkManager`)

**Target File:** `lib/resilience/network-manager.ts`

#### Network Resilience Logic:

- **Event Listeners:** Subscribe to `window.addEventListener('online')` and `window.addEventListener('offline')`.
- **Proactive Flush:** When transition to `online` is detected, trigger `flushOutbox()` immediately.
- **Exponential Backoff with Full Jitter Algorithm:**
  `Delay = random(0, min(M, B * 2^attempt))`
  - Base delay ($B$): `1000ms`
  - Max delay ($M$): `30000ms`
  - Jitter prevents the **Thundering Herd Problem** against Railway / Contabo backends when thousands of mobile/web clients reconnect simultaneously after an outage.

```typescript
export class ResilientNetworkManager {
  private static instance: ResilientNetworkManager;
  private outbox: OutboxItem[] = [];
  private isProcessing = false;

  public static getInstance(): ResilientNetworkManager {
    if (!ResilientNetworkManager.instance) {
      ResilientNetworkManager.instance = new ResilientNetworkManager();
    }
    return ResilientNetworkManager.instance;
  }

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.flushOutbox());
      this.loadOutboxFromStorage();
    }
  }

  public async enqueue<T>(
    type: OutboxItem['type'],
    payload: T
  ): Promise<string> {
    const item: OutboxItem<T> = {
      id: crypto.randomUUID(),
      type,
      payload,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: 5,
      status: 'QUEUED',
    };
    this.outbox.push(item as OutboxItem);
    this.persistOutbox();
    this.flushOutbox();
    return item.id;
  }

  public async flushOutbox(): Promise<void> {
    if (this.isProcessing || this.outbox.length === 0 || !navigator.onLine)
      return;
    this.isProcessing = true;

    while (this.outbox.length > 0 && navigator.onLine) {
      const item = this.outbox[0];
      if (!item) break;

      try {
        item.status = 'SENDING';
        await this.dispatchItem(item);
        this.outbox.shift(); // Remove on success
        this.persistOutbox();
        this.emitStatus(item.id, 'ACKNOWLEDGED');
      } catch (error) {
        item.retryCount++;
        item.status =
          item.retryCount >= item.maxRetries ? 'FAILED' : 'RETRYING';
        item.lastError =
          error instanceof Error ? error.message : 'Network error';
        this.persistOutbox();
        this.emitStatus(item.id, item.status);

        if (item.status === 'FAILED') {
          this.outbox.shift(); // Remove permanently failed items to unblock queue
          break;
        }

        const backoffMs = this.calculateBackoff(item.retryCount);
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }

    this.isProcessing = false;
  }

  private calculateBackoff(attempt: number): number {
    const base = 1000;
    const max = 30000;
    const exp = Math.min(max, base * Math.pow(2, attempt));
    return Math.floor(Math.random() * exp); // Full jitter
  }

  private async dispatchItem(item: OutboxItem): Promise<void> {
    // Route dispatch according to item.type (AI Chat SSE / Alert API / Support Socket)
  }
}
```

---

### 3.4 Module 4: SSE & WebSocket Stream Resilience

**Target File:** `lib/resilience/stream-watchdog.ts`

#### Streaming Watchdog Protocol:

1. **Heartbeat Verification:** Expect keepalive comments/pings every **15 seconds** from `/api/ai/chat/stream` or Socket.io.
2. **Watchdog Timeout:** If no bytes or pings are received for **30 seconds**, mark stream as `stalled`, terminate socket, and trigger reconnect.
3. **Resumable Stream Handshake:** Include header `Last-Event-ID` or query param `lastMessageId` on reconnect. Backend stream router emits only missing delta tokens rather than regenerating the complete completion.

---

## 🎯 4. Target Integration Points

| Surface / Component              | Target Files                                                                           | Specific Resilience Feature                                                                                                                                                                       |
| :------------------------------- | :------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **AI Analyst Panel (Part B)**    | `components/chat-panel.tsx`<br>`components/chat-input.tsx`                             | • Debounced autosave for active query text per instrument thread (`davintrade:draft:ai:{symbol}`)<br>• Optimistic user message rendering with `OutboxItem.status`<br>• Auto-retry on network drop |
| **Line Alert Modal (Part C)**    | `components/charts/drawing/AlertDialog.tsx`<br>`components/charts/drawing/Toolbar.tsx` | • Form state preservation (Tolerance, Direction, Cooldown, Target Level)<br>• Unsaved drawing mark protection if modal is abruptly closed                                                         |
| **Support Chat Widget (Part D)** | `components/web-chat/support-modal.tsx`<br>`lib/socket-client.ts`                      | • Unsent inquiry draft recovery<br>• Message delivery state icons (Clock = Pending, Single Check = Sent, Double Check = Read)                                                                     |

---

## 📋 5. Implementation & Verification Checklist for Claude Code

When implementing this specification post-Session 8-5, execute the following steps in sequence:

### Phase 1: Core Utilities Build

- [ ] Create `lib/resilience/types.ts` with all state, queue, and payload interfaces.
- [ ] Implement `lib/resilience/network-manager.ts` with Outbox queue, exponential backoff, and full jitter.
- [ ] Implement `hooks/use-draft-persistence.ts` with 300ms debounce and localStorage storage engine.
- [ ] Implement `hooks/use-offline-outbox.ts` React wrapper for component consumption.

### Phase 2: UI Component Integration

- [ ] Connect `ChatPanel` input box to `useDraftPersistence('chat:draft:' + activeThreadId)`.
- [ ] Connect `AlertDialog` form fields to `useDraftPersistence('alert:draft')`.
- [ ] Render pending / retrying status indicators on optimistic messages in chat feed.
- [ ] Add manual "Retry Now" button for permanently failed outbox items.

### Phase 3: Automated Verification Scenarios

- [ ] **Offline Draft Survival Test:** Type 50 characters in `ChatPanel` ➔ Hard reload page (`location.reload()`) ➔ Assert input field retains all 50 characters.
- [ ] **Airplane Mode Outbox Test:** Disable network in Playwright (`page.context().setOffline(true)`) ➔ Submit message ➔ Assert message appears with `Pending` badge ➔ Re-enable network (`page.context().setOffline(false)`) ➔ Assert message automatically transitions to `Delivered` and appears in chat history.
- [ ] **Backoff Jitter Test:** Unit test backoff calculation verifying exponential delay bounded by `[0, min(30000, 1000 * 2^n)]`.
- [ ] **CI Regression Check:** Run `npm run test:ci` ensuring all 259+ test suites remain 100% green.

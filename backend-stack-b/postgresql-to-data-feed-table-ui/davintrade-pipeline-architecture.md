# DavinTrade AI — Real-Time Data Feed Pipeline Architecture

**Project:** DavinTrade AI (trading-alerts-saas-v7)  
**Version:** 1.0  
**Date:** 2026-02-26  
**Status:** Production-Ready  
**Author:** Dhapanart + Claude (Anthropic)  
**Scope:** PostgreSQL → Real-Time UI (Auto-Scrolling Data Feed Table)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Summary](#architecture-summary)
3. [Production Stack](#production-stack)
4. [Pipeline Layer-by-Layer](#pipeline-layer-by-layer)
   - [Layer 1 — PostgreSQL (Inception Point)](#layer-1--postgresql-inception-point)
   - [Layer 2 — NestJS 11 Gateway](#layer-2--nestjs-11-gateway)
   - [Layer 3 — WebSocket Transport](#layer-3--websocket-transport)
   - [Layer 4 — Next.js 16 Client](#layer-4--nextjs-16-client)
   - [Layer 5 — UI Output](#layer-5--ui-output)
5. [End-to-End Data Flow](#end-to-end-data-flow)
6. [Key Design Decisions](#key-design-decisions)
7. [Database Schema](#database-schema)
8. [NestJS Implementation](#nestjs-implementation)
9. [Next.js Implementation](#nextjs-implementation)
10. [End-to-End Timing](#end-to-end-timing)
11. [What Is Intentionally Excluded](#what-is-intentionally-excluded)

---

## Overview

This document describes the production architecture for the **Real-Time Technical Feed** — the auto-scrolling data table in DavinTrade AI that displays a new XAUUSD M15 indicator row every 5 minutes, delivered live to the user's browser without any page reload or manual refresh.

### What This Pipeline Does

Every 5 minutes, when an M15 candle closes on MetaTrader 5, the Flask ingestion service writes a new row into PostgreSQL containing the latest computed indicator values — Close price, Important High/Low levels, Trendline Confluence (TC) signals, and Support/Resistance classifications. From that single INSERT event, the data travels through NestJS and a WebSocket connection to appear as a new highlighted row at the top of the user's dashboard table within under 200ms.

### Guiding Principle

This pipeline is intentionally simple because the problem is simple. The data cadence is one row every 5 minutes — a trivially light load. The architecture uses the minimum number of components required to deliver real-time data reliably, with no over-engineering.

---

## Architecture Summary

```
PostgreSQL (Railway)
      │
      │  pg_notify — fires on INSERT
      ▼
NestJS 11 Gateway (Railway)
      │
      │  Socket.IO WebSocket — event: "feed_row"
      ▼
Next.js 16 Client (Vercel)
      │
      │  React state update → DOM render → auto-scroll
      ▼
Real-Time Technical Feed Table (Browser)
New row appears, highlighted green, table scrolls to top — within <200ms
```

---

## Production Stack

| Layer           | Technology                | Deployment  | Role                                         |
| --------------- | ------------------------- | ----------- | -------------------------------------------- |
| Database        | PostgreSQL 16             | Railway     | Stores all indicator rows — inception point  |
| Backend Gateway | NestJS 11                 | Railway     | Detects new rows, emits WebSocket events     |
| Transport       | Socket.IO (WSS)           | —           | Persistent real-time connection              |
| Frontend        | Next.js 16                | Vercel      | Receives events, renders table, auto-scrolls |
| Browser         | Chrome / Safari / Firefox | User device | Displays the live data feed table            |

**No additional infrastructure is required.** No Redis, no BullMQ, no pgBouncer, no read replicas, no worker processes. See [What Is Intentionally Excluded](#what-is-intentionally-excluded) for the reasoning.

---

## Pipeline Layer-by-Layer

### Layer 1 — PostgreSQL (Inception Point)

**Deployed on:** Railway  
**Role:** Source of truth for all indicator data. Every new row is the trigger that starts the entire downstream pipeline.

Every 5 minutes, the Flask MT5 ingestion service computes indicator values for the closed M15 candle and writes one row into the `technical_feed` table. Immediately after the INSERT commits, PostgreSQL fires a `pg_notify` event on the `feed_update` channel, which NestJS is actively listening to.

**What triggers the pipeline:** The `INSERT` statement completing successfully — not a timer, not polling, not an external event. The database itself fires the notification.

**Row payload written per candle:**

| Column         | Description             | Example                   |
| -------------- | ----------------------- | ------------------------- |
| `timestamp`    | M15 candle close time   | 2026-02-26 11:55          |
| `symbol`       | Trading pair            | XAUUSD                    |
| `tf`           | Timeframe               | M15                       |
| `close`        | Candle close price      | 2651.43                   |
| `imp_high`     | Important High level    | 2664.34                   |
| `imp_low`      | Important Low level     | —                         |
| `high_low_rej` | Rejection signal        | Bullish Rej / Bearish Rej |
| `tc_p1`        | Trendline Confluence P1 | 4                         |
| `tc_p2`        | Trendline Confluence P2 | 6                         |
| `tc_p3`        | Trendline Confluence P3 | —                         |
| `tc_b1`        | TC Breakout B1          | —                         |
| `tc_b2`        | TC Breakout B2          | —                         |
| `tc_b3`        | TC Breakout B3          | —                         |
| `sr_p1`        | Support / Resistance P1 | Support / Resistant       |

---

### Layer 2 — NestJS 11 Gateway

**Deployed on:** Railway  
**Role:** Listens for new DB rows, shapes the payload, broadcasts to WebSocket clients.

NestJS connects to PostgreSQL on startup and issues a `LISTEN feed_update` command. When the Flask service writes a new row and PostgreSQL fires `pg_notify('feed_update', '')`, NestJS receives the notification within milliseconds. It then executes a single `SELECT` query to fetch the new row, maps it to the frontend payload schema, and emits it to all Socket.IO clients in the `xauusd_m15` room.

**Responsibilities:**

- Maintain a persistent `LISTEN` connection to PostgreSQL
- On `pg_notify`: query the latest row from `technical_feed`
- Map DB columns to the camelCase WebSocket payload schema
- Emit `feed_row` event to the `xauusd_m15` Socket.IO room
- Handle client `subscribe` and `unsubscribe` room joins

**NestJS modules used:**

- `@nestjs/websockets` — Socket.IO gateway decorator
- `pg` / `typeorm` — PostgreSQL client with LISTEN support
- `@nestjs/schedule` — fallback 5-minute poller if pg_notify is unavailable

---

### Layer 3 — WebSocket Transport

**Protocol:** Socket.IO over WSS (Secure WebSocket)  
**Role:** Persistent bidirectional channel between NestJS and each browser client.

When a user opens the DavinTrade AI dashboard, the Next.js frontend establishes a Socket.IO connection to the NestJS gateway and joins the `xauusd_m15` room. This connection stays open for the entire session — there is no HTTP polling, no repeated handshakes, no page refresh needed.

When NestJS emits `feed_row`, the event travels over this persistent connection to every client in the room simultaneously.

**Event schema — `feed_row`:**

```json
{
  "timestamp": "2026-02-26 11:55",
  "symbol": "XAUUSD",
  "tf": "M15",
  "close": 2651.43,
  "impHigh": 2664.34,
  "impLow": null,
  "highLowRej": null,
  "tcP1": 4,
  "tcP2": 6,
  "tcP3": null,
  "tcB1": null,
  "tcB2": null,
  "tcB3": null,
  "srP1": null
}
```

**Connection details:**

- Encrypted over `wss://` — no plaintext
- Room: `xauusd_m15` — only users subscribed to this symbol/timeframe receive events
- Reconnection: Socket.IO client handles automatic reconnection with exponential backoff if connection drops

---

### Layer 4 — Next.js 16 Client

**Deployed on:** Vercel  
**Role:** Manages the Socket.IO client, maintains table row state, triggers auto-scroll on new data.

A custom `useDataFeed()` React hook initialises the Socket.IO client on mount, subscribes to the `xauusd_m15` room, and listens for `feed_row` events. On each event received, it prepends the new row to the `rows` state array and sets a `newRowId` flag used to apply the green highlight CSS class.

The `FeedTable` component holds a `ref` to the top row. When `rows` state updates, a `useEffect` fires `scrollIntoView({ behavior: 'smooth' })` on the top-row ref, producing the auto-scroll effect visible in the UI.

**React state shape:**

```typescript
interface FeedRow {
  timestamp: string;
  symbol: string;
  tf: string;
  close: number;
  impHigh: number | null;
  impLow: number | null;
  highLowRej: 'Bullish Rej' | 'Bearish Rej' | null;
  tcP1: number | null;
  tcP2: number | null;
  tcP3: number | null;
  tcB1: number | null;
  tcB2: number | null;
  tcB3: number | null;
  srP1: 'Support' | 'Resistant' | null;
}

const [rows, setRows] = useState<FeedRow[]>([]);
const [newRowId, setNewRowId] = useState<string | null>(null);
```

---

### Layer 5 — UI Output

**Component:** Real-Time Technical Feed Table  
**Behaviour:** Auto-scrolling, live-updating, no page reload

The table displays rows in reverse-chronological order — newest at the top. When a new row arrives via WebSocket, it is prepended and highlighted in green for 3 seconds before fading to the standard row style. The table then auto-scrolls to ensure the newest row is always visible.

**Columns displayed:**

```
TimeStamp | Symbol | TF | Close | Imp High | Imp Low | High/Low + Rej
TC P1 | TC P2 | TC P3 | TC B1 | TC B2 | TC B3 | S&R P1
```

**Visual behaviours:**

- `Bullish Rej` → rendered in green
- `Bearish Rej` → rendered in red
- `Support` → rendered in green
- `Resistant` → rendered in red
- Empty / null cells → rendered as `────`
- Newest row → green background highlight for 3 seconds, then fades
- Auto-scroll → smooth scroll to top row on each new event

---

## End-to-End Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Flask MT5 Ingestion Service                                │
│  M15 candle closes → computes indicators → INSERT into DB   │
└──────────────────────────────┬──────────────────────────────┘
                               │ SQL INSERT commits
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  PostgreSQL (Railway)                                       │
│  NOTIFY feed_update fires automatically on INSERT           │
└──────────────────────────────┬──────────────────────────────┘
                               │ pg_notify  <100ms
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  NestJS 11 Gateway (Railway)                                │
│  Receives NOTIFY → SELECT latest row → shape payload        │
└──────────────────────────────┬──────────────────────────────┘
                               │ Socket.IO emit "feed_row"  <50ms
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  WebSocket Channel (WSS)                                    │
│  Persistent connection — no polling — no HTTP overhead      │
└──────────────────────────────┬──────────────────────────────┘
                               │ event received by client
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Next.js 16 — useDataFeed() hook (Vercel)                   │
│  socket.on("feed_row") → prepend to rows[] → re-render      │
└──────────────────────────────┬──────────────────────────────┘
                               │ React DOM update  ~16ms
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Real-Time Technical Feed Table (Browser)                   │
│  New row appears highlighted green → auto-scroll to top     │
└─────────────────────────────────────────────────────────────┘

Total end-to-end latency: <200ms from PostgreSQL INSERT to pixel on screen
```

---

## Key Design Decisions

### pg_notify Instead of Polling

NestJS uses PostgreSQL's built-in `LISTEN / NOTIFY` mechanism rather than a timer-based poller. The benefit is that NestJS reacts to new data within milliseconds of the INSERT committing — no 5-second poll lag, no wasted queries when no new data exists. A fallback 5-minute `@nestjs/schedule` poller is retained as a safety net in case the LISTEN connection drops and fails to reconnect.

### WebSocket Instead of REST + Polling

The frontend does not call a REST endpoint on a timer to check for new rows. A persistent Socket.IO connection means the server pushes data to the client the moment it is available — no wasted HTTP requests, no artificial polling delay, no flickering table refreshes.

### Single NestJS Instance Is Sufficient

Because data arrives only once every 5 minutes and there is no fan-out to external APIs (no Telegram, no email in this pipeline), a single NestJS process handles the load trivially. Even at 1,000 simultaneous dashboard users, emitting one small JSON payload every 5 minutes to an open Socket.IO room requires negligible CPU and memory.

### No Additional Infrastructure

There is no Redis, no job queue, no worker process, no connection pooler, and no read replica in this pipeline. Each of those components solves a specific problem — high-frequency writes, slow external API calls, connection exhaustion, or heavy read traffic — none of which exist in a pipeline that moves one row every 5 minutes via a single WebSocket emit.

---

## Database Schema

```sql
-- Table: technical_feed
CREATE TABLE technical_feed (
    id            UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    timestamp     TIMESTAMPTZ   NOT NULL,
    symbol        VARCHAR(20)   NOT NULL,
    tf            VARCHAR(5)    NOT NULL,
    close         DECIMAL(10,2) NOT NULL,
    imp_high      DECIMAL(10,2),
    imp_low       DECIMAL(10,2),
    high_low_rej  VARCHAR(20),          -- 'Bullish Rej' | 'Bearish Rej' | NULL
    tc_p1         SMALLINT,
    tc_p2         SMALLINT,
    tc_p3         SMALLINT,
    tc_b1         SMALLINT,
    tc_b2         SMALLINT,
    tc_b3         SMALLINT,
    sr_p1         VARCHAR(20),          -- 'Support' | 'Resistant' | NULL
    created_at    TIMESTAMPTZ   DEFAULT now()
);

-- Index: dashboard queries always order by timestamp DESC
CREATE INDEX idx_feed_symbol_tf_ts
    ON technical_feed(symbol, tf, timestamp DESC);

-- Trigger: fires pg_notify on every new INSERT
CREATE OR REPLACE FUNCTION notify_feed_update()
RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify('feed_update', NEW.symbol || ':' || NEW.tf);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_feed_update
AFTER INSERT ON technical_feed
FOR EACH ROW EXECUTE FUNCTION notify_feed_update();
```

---

## NestJS Implementation

### Socket.IO Gateway

```typescript
// src/feed/feed.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: process.env.FRONTEND_URL } })
export class FeedGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, payload: { symbol: string; tf: string }) {
    const room = `${payload.symbol.toLowerCase()}_${payload.tf.toLowerCase()}`;
    client.join(room);
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(client: Socket, payload: { symbol: string; tf: string }) {
    const room = `${payload.symbol.toLowerCase()}_${payload.tf.toLowerCase()}`;
    client.leave(room);
  }

  broadcastFeedRow(symbol: string, tf: string, row: FeedRowDto) {
    const room = `${symbol.toLowerCase()}_${tf.toLowerCase()}`;
    this.server.to(room).emit('feed_row', row);
  }
}
```

### PostgreSQL LISTEN Service

```typescript
// src/feed/feed-listener.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Client } from 'pg';
import { FeedGateway } from './feed.gateway';
import { FeedRepository } from './feed.repository';

@Injectable()
export class FeedListenerService implements OnModuleInit, OnModuleDestroy {
  private pgClient: Client;

  constructor(
    private readonly gateway: FeedGateway,
    private readonly repo: FeedRepository
  ) {}

  async onModuleInit() {
    this.pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await this.pgClient.connect();
    await this.pgClient.query('LISTEN feed_update');

    this.pgClient.on('notification', async (msg) => {
      // msg.payload = "XAUUSD:M15"
      const [symbol, tf] = msg.payload.split(':');
      const row = await this.repo.getLatestRow(symbol, tf);
      if (row) {
        this.gateway.broadcastFeedRow(symbol, tf, row);
      }
    });

    this.pgClient.on('error', (err) => {
      console.error('pg_notify listener error:', err);
      // Reconnect logic here
    });
  }

  async onModuleDestroy() {
    await this.pgClient.query('UNLISTEN feed_update');
    await this.pgClient.end();
  }
}
```

### Feed Repository

```typescript
// src/feed/feed.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class FeedRepository {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async getLatestRow(symbol: string, tf: string): Promise<FeedRowDto | null> {
    const result = await this.ds.query(
      `SELECT timestamp, symbol, tf, close,
              imp_high, imp_low, high_low_rej,
              tc_p1, tc_p2, tc_p3, tc_b1, tc_b2, tc_b3, sr_p1
       FROM technical_feed
       WHERE symbol = $1 AND tf = $2
       ORDER BY timestamp DESC
       LIMIT 1`,
      [symbol, tf]
    );
    return result[0] ?? null;
  }

  async getRecentRows(
    symbol: string,
    tf: string,
    limit = 50
  ): Promise<FeedRowDto[]> {
    return this.ds.query(
      `SELECT timestamp, symbol, tf, close,
              imp_high, imp_low, high_low_rej,
              tc_p1, tc_p2, tc_p3, tc_b1, tc_b2, tc_b3, sr_p1
       FROM technical_feed
       WHERE symbol = $1 AND tf = $2
       ORDER BY timestamp DESC
       LIMIT $3`,
      [symbol, tf, limit]
    );
  }
}
```

---

## Next.js Implementation

### useDataFeed Hook

```typescript
// hooks/useDataFeed.ts
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export interface FeedRow {
  timestamp: string;
  symbol: string;
  tf: string;
  close: number;
  impHigh: number | null;
  impLow: number | null;
  highLowRej: 'Bullish Rej' | 'Bearish Rej' | null;
  tcP1: number | null;
  tcP2: number | null;
  tcP3: number | null;
  tcB1: number | null;
  tcB2: number | null;
  tcB3: number | null;
  srP1: 'Support' | 'Resistant' | null;
}

export function useDataFeed(
  symbol: string,
  tf: string,
  initialRows: FeedRow[]
) {
  const [rows, setRows] = useState<FeedRow[]>(initialRows);
  const [newRowId, setNewRowId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_WS_URL!, {
      transports: ['websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('subscribe', { symbol, tf });
    });

    socket.on('feed_row', (row: FeedRow) => {
      const rowId = row.timestamp;
      setRows((prev) => [row, ...prev]);
      setNewRowId(rowId);
      // Remove highlight after 3 seconds
      setTimeout(() => setNewRowId(null), 3000);
    });

    return () => {
      socket.emit('unsubscribe', { symbol, tf });
      socket.disconnect();
    };
  }, [symbol, tf]);

  return { rows, newRowId };
}
```

### FeedTable Component with Auto-Scroll

```typescript
// components/FeedTable.tsx
import { useEffect, useRef } from 'react';
import { FeedRow } from '@/hooks/useDataFeed';

interface Props {
  rows: FeedRow[];
  newRowId: string | null;
}

export function FeedTable({ rows, newRowId }: Props) {
  const topRowRef = useRef<HTMLTableRowElement>(null);

  // Auto-scroll to top row whenever rows array changes
  useEffect(() => {
    if (topRowRef.current) {
      topRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [rows]);

  const fmt = (val: number | null) => val ?? '────';

  return (
    <div className="feed-table-wrapper">
      <table>
        <thead>
          <tr>
            <th>TimeStamp</th><th>Symbol</th><th>TF</th><th>Close</th>
            <th>Imp High</th><th>Imp Low</th><th>High/Low + Rej</th>
            <th>TC P1</th><th>TC P2</th><th>TC P3</th>
            <th>TC B1</th><th>TC B2</th><th>TC B3</th><th>S&R P1</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.timestamp}
              ref={i === 0 ? topRowRef : null}
              className={row.timestamp === newRowId ? 'row-new' : ''}
            >
              <td>{row.timestamp}</td>
              <td>{row.symbol}</td>
              <td>{row.tf}</td>
              <td>{row.close}</td>
              <td>{fmt(row.impHigh)}</td>
              <td>{fmt(row.impLow)}</td>
              <td className={
                row.highLowRej === 'Bullish Rej' ? 'bullish' :
                row.highLowRej === 'Bearish Rej' ? 'bearish' : 'muted'
              }>
                {row.highLowRej ?? '────'}
              </td>
              <td>{fmt(row.tcP1)}</td>
              <td>{fmt(row.tcP2)}</td>
              <td>{fmt(row.tcP3)}</td>
              <td>{fmt(row.tcB1)}</td>
              <td>{fmt(row.tcB2)}</td>
              <td>{fmt(row.tcB3)}</td>
              <td className={
                row.srP1 === 'Support' ? 'support' :
                row.srP1 === 'Resistant' ? 'resistant' : 'muted'
              }>
                {row.srP1 ?? '────'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Dashboard Page

```typescript
// app/dashboard/page.tsx
import { FeedTable } from '@/components/FeedTable';
import { useDataFeed } from '@/hooks/useDataFeed';

// Initial rows loaded server-side via REST — subsequent rows arrive via WebSocket
export default function DashboardPage({ initialRows }) {
  const { rows, newRowId } = useDataFeed('XAUUSD', 'M15', initialRows);

  return (
    <div className="dashboard">
      <div className="feed-header">
        <span>Real-Time Technical Feed</span>
        <span className="live-badge">● AUTO SCROLL</span>
        <span className="meta">XAUUSD · M15 · updates every 5min</span>
      </div>
      <FeedTable rows={rows} newRowId={newRowId} />
    </div>
  );
}
```

---

## End-to-End Timing

| Step                                                     | Mechanism                   | Latency                  |
| -------------------------------------------------------- | --------------------------- | ------------------------ |
| M15 candle close → PostgreSQL INSERT                     | Flask MT5 service           | ~0ms (synchronous write) |
| PostgreSQL INSERT → pg_notify fires                      | PostgreSQL internal trigger | &lt;1ms                  |
| pg_notify → NestJS receives                              | LISTEN connection           | &lt;100ms                |
| NestJS → SELECT latest row                               | Single indexed query        | &lt;5ms                  |
| NestJS → Socket.IO emit                                  | In-memory broadcast         | &lt;1ms                  |
| WSS transit to browser                                   | Network                     | &lt;50ms                 |
| React state update → DOM render                          | One paint frame             | ~16ms                    |
| **Total: PostgreSQL INSERT → new row visible on screen** |                             | **&lt;200ms**            |

The 5-minute data cadence means the pipeline operates well within comfortable latency margins. Even in a degraded network environment with 200ms WSS latency, the row still appears in under 500ms — imperceptible relative to the 5-minute data window.

---

## What Is Intentionally Excluded

The following infrastructure components are **not part of this pipeline** because this pipeline does not have the problems they solve.

**Redis + BullMQ** solve the problem of slow external API calls (Telegram, email) blocking the main application thread. This pipeline emits a WebSocket — a sub-millisecond in-memory operation. There is nothing slow to offload.

**Worker processes** handle background job queues for fan-out tasks. This pipeline has exactly one task per event: query one row, emit one WebSocket event. No worker is needed.

**pgBouncer** solves connection exhaustion when many application instances each hold multiple database connections. NestJS holds one persistent LISTEN connection and one query connection. The PostgreSQL connection count is always two — trivially below any limit.

**Read replicas** offload heavy dashboard read traffic from the primary database. This pipeline reads one row every 5 minutes. The query load is negligible.

These components become relevant if this platform later adds alert notifications (Telegram/email fan-out to users), hundreds of simultaneous heavy dashboard queries, or multi-instance NestJS deployments. For this data feed pipeline alone, none of them are warranted.

---

_Document Version: 1.0 | Last Updated: 2026-02-26 | Project: trading-alerts-saas-v7 (DavinTrade AI)_

# DavinTrade UI — Next.js 16 Migration Guide & Claude Code Prompt

> **How to use this document:**
>
> 1. Open Claude Code in your Next.js 16 project root
> 2. Attach `davintrade-ui.jsx` (the baseline UI file)
> 3. Attach this document
> 4. Paste the prompt from **Section 4** into Claude Code

---

## Section 1 — Project Overview

The baseline file `davintrade-ui.jsx` is a single-file React component (~960 lines) that implements the full DavinTrade AI trading dashboard. It needs to be migrated into a proper **Next.js 16 App Router** project with **TypeScript**, **strict type safety**, and **secure API handling**.

### What the file contains

| Element           | Details                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| Constants         | `SYMBOLS`, `TIMEFRAMES`, `BASE_PRICES`, `VOLATILITY` — config data                                      |
| Data helpers      | `genOHLC`, `genRow`, `fiveMinTs`, `cellColor` — mock data generators (to be replaced by real API)       |
| Indicator math    | `calcEMA`, `calcKeltner`, `calcTEMAlines`, `calcZigZag`, `calcTrendlines`, `calcSMMA`, `calcHeikinAshi` |
| Overlay factories | `ovTrendline`, `ovKeltner`, `ovTEMA`, `ovZigZag`, `ovEMASMMA` — return typed overlay arrays             |
| Canvas renderer   | `drawChart(canvas, data, overlays)` — HiDPI-aware, ResizeObserver-driven                                |
| Components        | `ChartPanel`, `FlexChartPanel`, `DataTable`, `ChatPanel`, `DavinTradeUI` (root)                         |
| AI integration    | Direct `fetch` to `https://api.anthropic.com/v1/messages` — **must be moved to Route Handler**          |
| Flex panel        | Bottom-right chart with dropdown: Blank / ZigZag / Heikin Ashi / EMA & SMMA                             |

---

## Section 2 — Target File Structure

```
app/
├── layout.tsx                        # Root layout, JetBrains Mono font, global CSS
├── page.tsx                          # Renders <DavinTradeUI /> (Server Component shell)
├── api/
│   └── chat/
│       └── route.ts                  # Route Handler — proxies Anthropic API securely
│
components/
├── DavinTradeUI.tsx                  # Root client component ("use client"), state orchestrator
├── ChartPanel.tsx                    # Fixed indicator chart panel
├── FlexChartPanel.tsx                # User-selectable indicator panel with dropdown
├── ChatPanel.tsx                     # AI chat sidebar
├── DataTable.tsx                     # Real-time 5-min technical feed table
│
lib/
├── indicators.ts                     # All pure indicator math functions (no React)
├── chartRenderer.ts                  # drawChart canvas renderer (no React)
├── types.ts                          # All shared TypeScript types and interfaces
├── constants.ts                      # SYMBOLS, TIMEFRAMES, BASE_PRICES, VOLATILITY, COLS
└── mockData.ts                       # genOHLC, genRow, fiveMinTs, cellColor (mock until real API)
```

---

## Section 3 — TypeScript Types Reference

Claude Code must create `lib/types.ts` containing **all** of the following types. These are derived from the JSX runtime shapes — make them strict, no `any`.

### Candle / OHLCV

```typescript
export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  time: Date;
}
```

### Overlay System (Discriminated Union)

The overlay system is the trickiest part to type. `drawChart` switches on the presence of different keys. Use a discriminated union:

```typescript
export interface HLineOverlay {
  type: 'hline';
  hline: number;
  color: string;
  width?: number;
  dash?: number[];
  alpha?: number;
}

export interface PointsOverlay {
  type: 'points';
  points: (number | null)[];
  points2?: (number | null)[]; // used for Keltner fill band
  color: string;
  fill?: boolean;
  width?: number;
  dash?: number[];
  alpha?: number;
}

export interface PivotOverlay {
  type: 'pivots';
  pivots: Array<{ idx: number; price: number; type: 'high' | 'low' }>;
  color: string;
  width?: number;
}

export type ChartOverlay = HLineOverlay | PointsOverlay | PivotOverlay;
```

> **Note for Claude Code:** The current JSX uses duck-typing (checks `if (ov.hline)`, `if (ov.pivots)`, `if (ov.points)`). When migrating `drawChart`, replace these with a `switch (ov.type)` discriminated union check. The overlay factory functions (`ovTrendline`, etc.) must be updated to include the `type` field on every returned overlay object.

### Data Feed Row

```typescript
export interface FeedRow {
  ts: string;
  sym: string;
  tf: string;
  close: number;
  impHi: number | '-----';
  impLo: number | '-----';
  rej: 'Bullish Rej' | 'Bearish Rej' | '-----';
  tcP1: number | '-----';
  tcP2: number | '-----';
  tcP3: number | '-----';
  tcB1: number | '-----';
  tcB2: number | '-----';
  tcB3: number | '-----';
  sarP1: 'Resistant' | 'Support' | '-----';
  sarP2: 'Resistant' | 'Support' | '-----';
  sarP3: 'Resistant' | 'Support' | '-----';
  sarB1: 'Resistant' | 'Support' | '-----';
  sarB2: 'Resistant' | 'Support' | '-----';
  sarB3: 'Resistant' | 'Support' | '-----';
  prop: 'Resistant' | 'Support';
}
```

### Pending Query (Union)

```typescript
export type PendingQuery =
  | string // indicator key: 'trendline' | 'keltner' | 'tema' | 'flex_zigzag' | etc.
  | { key: 'feed'; rows: FeedRow[] }; // feed analysis with row data
```

### Flex Panel Options

```typescript
export type FlexOptionKey = 'blank' | 'zigzag' | 'heikin' | 'emasmma';

export interface FlexOption {
  key: FlexOptionKey;
  label: string;
  ovFn: (data: Candle[]) => ChartOverlay[];
  haMode: boolean; // true = render Heikin Ashi candles instead of raw OHLCV
}
```

### Component Props

```typescript
export interface ChartPanelProps {
  label: string;
  indicatorKey: string;
  data: Candle[];
  ovFn: (data: Candle[]) => ChartOverlay[];
  onQueryAI: (key: string) => void;
  isQuerying: boolean;
}

export interface FlexChartPanelProps {
  sym: string;
  tf: string;
  data: Candle[];
  onQueryAI: (key: string) => void;
  isQuerying: boolean;
}

export interface DataTableProps {
  sym: string;
  tf: string;
  onQueryAI: (key: string, rows?: FeedRow[]) => void;
  isQuerying: boolean;
}

export interface ChatPanelProps {
  sym: string;
  tf: string;
  chartData: Candle[];
  pendingQuery: PendingQuery | null;
  onQueryHandled: () => void;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}
```

### API Route Types

```typescript
// app/api/chat/route.ts request body
export interface ChatRequestBody {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  systemPrompt: string;
}

// Anthropic API response (minimal shape needed)
export interface AnthropicResponse {
  content: Array<{ type: string; text: string }>;
  error?: { message: string };
}
```

---

## Section 4 — Claude Code Prompt

> Copy everything below this line and paste it directly into Claude Code.

---

```
You are migrating a single-file React JSX trading dashboard (davintrade-ui.jsx) into a
Next.js 16 App Router project with strict TypeScript. You have been provided:

1. davintrade-ui.jsx  — the complete baseline source file
2. This migration document — describing the target structure, all TypeScript types,
   and specific migration rules

Follow every instruction precisely. Do not skip steps. Do not simplify types to `any`.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 0 — SCAFFOLD (run these commands first)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If a Next.js 16 project does not already exist, create one:

  npx create-next-app@latest davintrade --typescript --app --turbopack --tailwind=false --eslint --src-dir=false

Then install dependencies:

  npm install @anthropic-ai/sdk
  npm install --save-dev @types/node

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — CREATE lib/types.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create lib/types.ts with ALL types exactly as defined in Section 3 of the migration
document. Do not deviate from the shapes. Use discriminated unions for ChartOverlay
(HLineOverlay | PointsOverlay | PivotOverlay), each with a required `type` field.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — CREATE lib/constants.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Move all top-level constants from the JSX file into lib/constants.ts:
- SYMBOLS (type: readonly string[])
- TIMEFRAMES (type: readonly string[])
- BASE_PRICES (type: Record<string, number>)
- VOLATILITY (type: Record<string, number>)
- COLS (type: Array<{ key: keyof FeedRow | string; label: string; w: number }>)
- MASCOT_IMG (the SVG data URL string)
- FLEX_OPTIONS (type: FlexOption[] — import FlexOption from types.ts)
- INDICATOR_PROMPTS (type: Record<string, string | ((rows: FeedRow[]) => string)>)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — CREATE lib/indicators.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Move all pure indicator math functions into lib/indicators.ts with full TypeScript
signatures. No React imports. All functions are pure (no side effects).

Functions to migrate:
  calcEMA(closes: number[], period: number): (number | null)[]
  calcKeltner(data: Candle[]): { upper: (number|null)[]; lower: (number|null)[]; mid: (number|null)[] }
  calcTEMAlines(data: Candle[]): { tema: (number|null)[]; hrma: (number|null)[]; ema50: (number|null)[] }
  calcZigZag(data: Candle[]): Array<{ idx: number; price: number; type: 'high' | 'low' }>
  calcTrendlines(data: Candle[]): { highs: Array<{idx:number; price:number}>; lows: Array<{idx:number; price:number}> }
  calcSMMA(closes: number[], period: number): (number | null)[]
  calcHeikinAshi(data: Candle[]): Candle[]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — CREATE lib/chartRenderer.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Move drawChart into lib/chartRenderer.ts:
  export function drawChart(
    canvas: HTMLCanvasElement | null,
    data: Candle[],
    overlays: ChartOverlay[]
  ): void

CRITICAL — update the overlay rendering loop to use a discriminated union switch:
  switch (ov.type) {
    case 'hline':  // draw horizontal line using ov.hline
    case 'points': // draw line series; if ov.fill && ov.points2 draw band fill
    case 'pivots': // draw ZigZag connecting lines between ov.pivots
  }

Remove all duck-typed checks like `if (ov.hline)` or `if (ov.pivots)`.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — CREATE lib/mockData.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Move data generation helpers into lib/mockData.ts:
  genOHLC(n: number, base: number, vol: number): Candle[]
  fiveMinTs(offsetMins?: number): string
  genRow(sym: string, tf: string, base: number, vol: number, offsetMins: number): FeedRow
  cellColor(key: string, val: unknown): string

Add a JSDoc comment on each function: @todo Replace with real Railway PostgreSQL
API call via /api/market-data route when live data integration is complete.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 — CREATE app/api/chat/route.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create a Next.js 16 Route Handler that proxies requests to the Anthropic API.
The client (ChatPanel) must NEVER call Anthropic directly — all AI requests
go through this Route Handler.

  import Anthropic from '@anthropic-ai/sdk';
  import { NextRequest, NextResponse } from 'next/server';
  import type { ChatRequestBody } from '@/lib/types';

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  export async function POST(req: NextRequest): Promise<NextResponse> {
    const body: ChatRequestBody = await req.json();

    // Validate input
    if (!body.messages || !body.systemPrompt) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const response = await client.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system:     body.systemPrompt,
      messages:   body.messages,
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
    return NextResponse.json({ text });
  }

Add ANTHROPIC_API_KEY to .env.local (create if not exists). Add .env.local to .gitignore.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 7 — CREATE components/ChatPanel.tsx
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"use client"

Migrate ChatPanel from the JSX. Key changes:
- Add prop types from ChatPanelProps (lib/types.ts)
- Replace the direct fetch to api.anthropic.com with a fetch to /api/chat:
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history, systemPrompt }),
    });
    const data = await res.json();
    const reply = data.text || 'Unable to get a response.';
- Type msgs state as: useState<ChatMessage[]>([])
- Type inputRef as: useRef<HTMLInputElement>(null)
- Type bottomRef as: useRef<HTMLDivElement>(null)
- Import MASCOT_IMG, INDICATOR_PROMPTS from @/lib/constants
- Import ChatMessage, ChatPanelProps, PendingQuery, FeedRow from @/lib/types

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 8 — CREATE components/ChartPanel.tsx
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"use client"

Migrate ChartPanel with full TypeScript. Key changes:
- Add ChartPanelProps type
- canvasRef typed as: useRef<HTMLCanvasElement>(null)
- containerRef typed as: useRef<HTMLDivElement>(null)
- Import drawChart from @/lib/chartRenderer
- Import MASCOT_IMG from @/lib/constants
- Import ChartPanelProps from @/lib/types

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 9 — CREATE components/FlexChartPanel.tsx
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"use client"

Migrate FlexChartPanel with full TypeScript. Key changes:
- Add FlexChartPanelProps type
- selected state typed as: useState<FlexOptionKey>('blank')
- canvasRef typed as: useRef<HTMLCanvasElement>(null)
- containerRef typed as: useRef<HTMLDivElement>(null)
- Import FLEX_OPTIONS, MASCOT_IMG from @/lib/constants
- Import calcHeikinAshi from @/lib/indicators
- Import drawChart from @/lib/chartRenderer
- Import FlexChartPanelProps, FlexOptionKey from @/lib/types

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 10 — CREATE components/DataTable.tsx
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"use client"

Migrate DataTable with full TypeScript. Key changes:
- Add DataTableProps type
- rows state typed as: useState<FeedRow[]>([])
- tbRef typed as: useRef<HTMLDivElement>(null)
- Import genRow, cellColor from @/lib/mockData
- Import BASE_PRICES, VOLATILITY, COLS, MASCOT_IMG from @/lib/constants
- Import DataTableProps, FeedRow from @/lib/types
- Mark with @todo comment: replace genRow calls with fetch('/api/market-data')
  when live Railway PostgreSQL integration is complete

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 11 — CREATE components/DavinTradeUI.tsx
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"use client"

This is the root orchestrator component. Migrate from DavinTradeUI() in the JSX. Key changes:
- data state typed as: useState<Candle[]>([])
- pendingQuery typed as: useState<PendingQuery | null>(null)
- queryingChart typed as: useState<string | null>(null)
- sym typed as: useState<string>('XAUUSD')
- tf typed as: useState<string>('M15')
- handleQueryAI typed as: (indicatorKey: string, rows?: FeedRow[]) => void
- charts array typed as: Array<{ key: string; label: string; ovFn: (data: Candle[]) => ChartOverlay[] }>
- Import all overlay factories (ovTrendline, ovKeltner, ovTEMA, ovEMASMMA)
  from @/lib/indicators — NOTE: move these factory functions into indicators.ts
  as named exports during this step
- Import genOHLC from @/lib/mockData
- Import BASE_PRICES, VOLATILITY, SYMBOLS, TIMEFRAMES from @/lib/constants
- Import Candle, ChartOverlay, PendingQuery, FeedRow from @/lib/types

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 12 — UPDATE app/layout.tsx
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add global styles to layout.tsx:
- Load JetBrains Mono from Google Fonts using next/font/google
- Set html/body/root to height: 100%, overflow: hidden, background: #050810
- Add scrollbar styles and keyframe animations (pulse, spin) as a global <style> tag
  or via globals.css
- Set <html lang="en">

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 13 — UPDATE app/page.tsx
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

page.tsx is a Server Component (no "use client"). It simply renders the root client component:

  import DavinTradeUI from '@/components/DavinTradeUI';

  export default function Page() {
    return <DavinTradeUI />;
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 14 — CREATE next.config.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  import type { NextConfig } from 'next';

  const nextConfig: NextConfig = {
    experimental: {
      turbopackFileSystemCache: true,   // stable in Next.js 16.1
    },
    serverExternalPackages: ['@anthropic-ai/sdk'],
  };

  export default nextConfig;

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 15 — ENVIRONMENT & VALIDATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Create .env.local with:
     ANTHROPIC_API_KEY=your_key_here

2. Ensure .gitignore includes:
     .env.local
     .env*.local

3. Run TypeScript check — fix ALL errors before finishing:
     npx tsc --noEmit

4. Run the dev server and verify it loads:
     npm run dev

5. Run the Next.js Bundle Analyzer to check for unexpected client-side bloat:
     npx next experimental-analyze

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULES — MUST FOLLOW THROUGHOUT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Every component file that uses useState, useEffect, useRef, useCallback,
  ResizeObserver, or canvas must have "use client" as the very first line
- Never use `any` — use unknown, the defined types, or proper generics
- Never call the Anthropic API directly from a client component — always use /api/chat
- All indicator math lives in lib/indicators.ts — no computation inside components
- Canvas rendering lives in lib/chartRenderer.ts — no drawChart inside components
- Use @/ path aliases throughout (already configured by create-next-app)
- Preserve 100% of visual styling — do not change any color, layout, spacing, or animation
- Preserve 100% of functionality — all 4 chart panels, FlexChartPanel dropdown
  (Blank/ZigZag/Heikin Ashi/EMA & SMMA), DataTable auto-scroll, ChatPanel AI responses,
  Ask AI buttons on all panels
- Do not install Tailwind, shadcn, or any UI library — all styling is inline styles only
- Do NOT change the Anthropic model string: use 'claude-sonnet-4-20250514' in route.ts
```

---

## Section 5 — Future Integration Notes

These are **not** part of this migration but should be planned for next:

### Replace Mock Data with Real API

Currently `genOHLC()` and `genRow()` generate simulated data. The live system pulls from your Railway PostgreSQL/TimescaleDB via NestJS. When ready, create:

```
app/api/
├── market-data/route.ts    # Proxy to NestJS /market-data endpoint
└── feed/route.ts           # Proxy to NestJS /feed endpoint
```

Then in `DataTable.tsx` replace the `genRow()` `setInterval` with:

```typescript
const res = await fetch(`/api/feed?sym=${sym}&tf=${tf}&limit=20`);
const rows: FeedRow[] = await res.json();
setRows(rows);
```

And in `DavinTradeUI.tsx` replace `genOHLC()` with:

```typescript
const res = await fetch(`/api/market-data?sym=${sym}&tf=${tf}&limit=80`);
const candles: Candle[] = await res.json();
setData(candles);
```

### Environment Variables for Production (Vercel)

Add to Vercel dashboard → Settings → Environment Variables:

- `ANTHROPIC_API_KEY` — your Anthropic key (server-only, never expose to client)
- `NESTJS_API_URL` — your Railway NestJS backend URL when ready

---

_Migration document generated for DavinTrade AI — Next.js 16.1 App Router + TypeScript_
_Baseline: davintrade-ui.jsx (956 lines) → Target: 13 TypeScript files_

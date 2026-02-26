\## Section 4 — Claude Code Prompt

> Copy everything below this line and paste it directly into Claude Code.

---

```

You are migrating a single-file React JSX trading dashboard (davintrade-ui.jsx) into a

Next.js 16 App Router project with strict TypeScript. You have been provided:



1\. davintrade-ui.jsx  — the complete baseline source file

2\. This migration document — describing the target structure, all TypeScript types,

&nbsp;  and specific migration rules



Follow every instruction precisely. Do not skip steps. Do not simplify types to `any`.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 0 — SCAFFOLD (run these commands first)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



If a Next.js 16 project does not already exist, create one:



&nbsp; npx create-next-app@latest davintrade --typescript --app --turbopack --tailwind=false --eslint --src-dir=false



Then install dependencies:



&nbsp; npm install @anthropic-ai/sdk

&nbsp; npm install --save-dev @types/node



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

\- SYMBOLS (type: readonly string\[])

\- TIMEFRAMES (type: readonly string\[])

\- BASE\_PRICES (type: Record<string, number>)

\- VOLATILITY (type: Record<string, number>)

\- COLS (type: Array<{ key: keyof FeedRow | string; label: string; w: number }>)

\- MASCOT\_IMG (the SVG data URL string)

\- FLEX\_OPTIONS (type: FlexOption\[] — import FlexOption from types.ts)

\- INDICATOR\_PROMPTS (type: Record<string, string | ((rows: FeedRow\[]) => string)>)



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 3 — CREATE lib/indicators.ts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



Move all pure indicator math functions into lib/indicators.ts with full TypeScript

signatures. No React imports. All functions are pure (no side effects).



Functions to migrate:

&nbsp; calcEMA(closes: number\[], period: number): (number | null)\[]

&nbsp; calcKeltner(data: Candle\[]): { upper: (number|null)\[]; lower: (number|null)\[]; mid: (number|null)\[] }

&nbsp; calcTEMAlines(data: Candle\[]): { tema: (number|null)\[]; hrma: (number|null)\[]; ema50: (number|null)\[] }

&nbsp; calcZigZag(data: Candle\[]): Array<{ idx: number; price: number; type: 'high' | 'low' }>

&nbsp; calcTrendlines(data: Candle\[]): { highs: Array<{idx:number; price:number}>; lows: Array<{idx:number; price:number}> }

&nbsp; calcSMMA(closes: number\[], period: number): (number | null)\[]

&nbsp; calcHeikinAshi(data: Candle\[]): Candle\[]



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 4 — CREATE lib/chartRenderer.ts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



Move drawChart into lib/chartRenderer.ts:

&nbsp; export function drawChart(

&nbsp;   canvas: HTMLCanvasElement | null,

&nbsp;   data: Candle\[],

&nbsp;   overlays: ChartOverlay\[]

&nbsp; ): void



CRITICAL — update the overlay rendering loop to use a discriminated union switch:

&nbsp; switch (ov.type) {

&nbsp;   case 'hline':  // draw horizontal line using ov.hline

&nbsp;   case 'points': // draw line series; if ov.fill \&\& ov.points2 draw band fill

&nbsp;   case 'pivots': // draw ZigZag connecting lines between ov.pivots

&nbsp; }



Remove all duck-typed checks like `if (ov.hline)` or `if (ov.pivots)`.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 5 — CREATE lib/mockData.ts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



Move data generation helpers into lib/mockData.ts:

&nbsp; genOHLC(n: number, base: number, vol: number): Candle\[]

&nbsp; fiveMinTs(offsetMins?: number): string

&nbsp; genRow(sym: string, tf: string, base: number, vol: number, offsetMins: number): FeedRow

&nbsp; cellColor(key: string, val: unknown): string



Add a JSDoc comment on each function: @todo Replace with real Railway PostgreSQL

API call via /api/market-data route when live data integration is complete.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 6 — CREATE app/api/chat/route.ts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



Create a Next.js 16 Route Handler that proxies requests to the Anthropic API.

The client (ChatPanel) must NEVER call Anthropic directly — all AI requests

go through this Route Handler.



&nbsp; import Anthropic from '@anthropic-ai/sdk';

&nbsp; import { NextRequest, NextResponse } from 'next/server';

&nbsp; import type { ChatRequestBody } from '@/lib/types';



&nbsp; const client = new Anthropic({ apiKey: process.env.ANTHROPIC\_API\_KEY });



&nbsp; export async function POST(req: NextRequest): Promise<NextResponse> {

&nbsp;   const body: ChatRequestBody = await req.json();

&nbsp;

&nbsp;   // Validate input

&nbsp;   if (!body.messages || !body.systemPrompt) {

&nbsp;     return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });

&nbsp;   }

&nbsp;

&nbsp;   const response = await client.messages.create({

&nbsp;     model:      'claude-sonnet-4-20250514',

&nbsp;     max\_tokens: 1000,

&nbsp;     system:     body.systemPrompt,

&nbsp;     messages:   body.messages,

&nbsp;   });

&nbsp;

&nbsp;   const text = response.content\[0]?.type === 'text' ? response.content\[0].text : '';

&nbsp;   return NextResponse.json({ text });

&nbsp; }



Add ANTHROPIC\_API\_KEY to .env.local (create if not exists). Add .env.local to .gitignore.



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 7 — CREATE components/ChatPanel.tsx

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



"use client"



Migrate ChatPanel from the JSX. Key changes:

\- Add prop types from ChatPanelProps (lib/types.ts)

\- Replace the direct fetch to api.anthropic.com with a fetch to /api/chat:

&nbsp;   const res = await fetch('/api/chat', {

&nbsp;     method: 'POST',

&nbsp;     headers: { 'Content-Type': 'application/json' },

&nbsp;     body: JSON.stringify({ messages: history, systemPrompt }),

&nbsp;   });

&nbsp;   const data = await res.json();

&nbsp;   const reply = data.text || 'Unable to get a response.';

\- Type msgs state as: useState<ChatMessage\[]>(\[])

\- Type inputRef as: useRef<HTMLInputElement>(null)

\- Type bottomRef as: useRef<HTMLDivElement>(null)

\- Import MASCOT\_IMG, INDICATOR\_PROMPTS from @/lib/constants

\- Import ChatMessage, ChatPanelProps, PendingQuery, FeedRow from @/lib/types



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 8 — CREATE components/ChartPanel.tsx

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



"use client"



Migrate ChartPanel with full TypeScript. Key changes:

\- Add ChartPanelProps type

\- canvasRef typed as: useRef<HTMLCanvasElement>(null)

\- containerRef typed as: useRef<HTMLDivElement>(null)

\- Import drawChart from @/lib/chartRenderer

\- Import MASCOT\_IMG from @/lib/constants

\- Import ChartPanelProps from @/lib/types



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 9 — CREATE components/FlexChartPanel.tsx

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



"use client"



Migrate FlexChartPanel with full TypeScript. Key changes:

\- Add FlexChartPanelProps type

\- selected state typed as: useState<FlexOptionKey>('blank')

\- canvasRef typed as: useRef<HTMLCanvasElement>(null)

\- containerRef typed as: useRef<HTMLDivElement>(null)

\- Import FLEX\_OPTIONS, MASCOT\_IMG from @/lib/constants

\- Import calcHeikinAshi from @/lib/indicators

\- Import drawChart from @/lib/chartRenderer

\- Import FlexChartPanelProps, FlexOptionKey from @/lib/types



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 10 — CREATE components/DataTable.tsx

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



"use client"



Migrate DataTable with full TypeScript. Key changes:

\- Add DataTableProps type

\- rows state typed as: useState<FeedRow\[]>(\[])

\- tbRef typed as: useRef<HTMLDivElement>(null)

\- Import genRow, cellColor from @/lib/mockData

\- Import BASE\_PRICES, VOLATILITY, COLS, MASCOT\_IMG from @/lib/constants

\- Import DataTableProps, FeedRow from @/lib/types

\- Mark with @todo comment: replace genRow calls with fetch('/api/market-data')

&nbsp; when live Railway PostgreSQL integration is complete



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 11 — CREATE components/DavinTradeUI.tsx

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



"use client"



This is the root orchestrator component. Migrate from DavinTradeUI() in the JSX. Key changes:

\- data state typed as: useState<Candle\[]>(\[])

\- pendingQuery typed as: useState<PendingQuery | null>(null)

\- queryingChart typed as: useState<string | null>(null)

\- sym typed as: useState<string>('XAUUSD')

\- tf typed as: useState<string>('M15')

\- handleQueryAI typed as: (indicatorKey: string, rows?: FeedRow\[]) => void

\- charts array typed as: Array<{ key: string; label: string; ovFn: (data: Candle\[]) => ChartOverlay\[] }>

\- Import all overlay factories (ovTrendline, ovKeltner, ovTEMA, ovEMASMMA)

&nbsp; from @/lib/indicators — NOTE: move these factory functions into indicators.ts

&nbsp; as named exports during this step

\- Import genOHLC from @/lib/mockData

\- Import BASE\_PRICES, VOLATILITY, SYMBOLS, TIMEFRAMES from @/lib/constants

\- Import Candle, ChartOverlay, PendingQuery, FeedRow from @/lib/types



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 12 — UPDATE app/layout.tsx

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



Add global styles to layout.tsx:

\- Load JetBrains Mono from Google Fonts using next/font/google

\- Set html/body/root to height: 100%, overflow: hidden, background: #050810

\- Add scrollbar styles and keyframe animations (pulse, spin) as a global <style> tag

&nbsp; or via globals.css

\- Set <html lang="en">



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 13 — UPDATE app/page.tsx

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



page.tsx is a Server Component (no "use client"). It simply renders the root client component:



&nbsp; import DavinTradeUI from '@/components/DavinTradeUI';



&nbsp; export default function Page() {

&nbsp;   return <DavinTradeUI />;

&nbsp; }



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 14 — CREATE next.config.ts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



&nbsp; import type { NextConfig } from 'next';



&nbsp; const nextConfig: NextConfig = {

&nbsp;   experimental: {

&nbsp;     turbopackFileSystemCache: true,   // stable in Next.js 16.1

&nbsp;   },

&nbsp;   serverExternalPackages: \['@anthropic-ai/sdk'],

&nbsp; };



&nbsp; export default nextConfig;



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 15 — ENVIRONMENT \& VALIDATION

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



1\. Create .env.local with:

&nbsp;    ANTHROPIC\_API\_KEY=your\_key\_here



2\. Ensure .gitignore includes:

&nbsp;    .env.local

&nbsp;    .env\*.local



3\. Run TypeScript check — fix ALL errors before finishing:

&nbsp;    npx tsc --noEmit



4\. Run the dev server and verify it loads:

&nbsp;    npm run dev



5\. Run the Next.js Bundle Analyzer to check for unexpected client-side bloat:

&nbsp;    npx next experimental-analyze



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RULES — MUST FOLLOW THROUGHOUT

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



\- Every component file that uses useState, useEffect, useRef, useCallback,

&nbsp; ResizeObserver, or canvas must have "use client" as the very first line

\- Never use `any` — use unknown, the defined types, or proper generics

\- Never call the Anthropic API directly from a client component — always use /api/chat

\- All indicator math lives in lib/indicators.ts — no computation inside components

\- Canvas rendering lives in lib/chartRenderer.ts — no drawChart inside components

\- Use @/ path aliases throughout (already configured by create-next-app)

\- Preserve 100% of visual styling — do not change any color, layout, spacing, or animation

\- Preserve 100% of functionality — all 4 chart panels, FlexChartPanel dropdown

&nbsp; (Blank/ZigZag/Heikin Ashi/EMA \& SMMA), DataTable auto-scroll, ChatPanel AI responses,

&nbsp; Ask AI buttons on all panels

\- Do not install Tailwind, shadcn, or any UI library — all styling is inline styles only

\- Do NOT change the Anthropic model string: use 'claude-sonnet-4-20250514' in route.ts

```

---

# DavinTrade AI - Hybrid Terminal Appearance & Chart Color Scheme Hand-Off Specification

> **Document Purpose**: Technical hand-off documentation summarizing the completed client-side implementation of the Hybrid Appearance System, known client-side UI issues requiring deep refactoring, and server-side database persistence tasks for **Claude Code** to evaluate and execute.

---

## 1. Executive Summary & Context

- **Subfolder Workspace Scope**: `seed-code/trading-conversational-ai-ui-pages-increment`
- **Target Production Vercel App**: `https://trading-conversational-ai-ui-pages.vercel.app`
- **Settings Page Route**: `/settings/appearance`
- **Objective**: Provide a seamless, zero-FOUC (Flash of Unstyled Content), 60 FPS reactive appearance configuration system supporting Theme Modes, Accent Schemes, and Candlestick/Grid customizations across DavinTrade AI.

---

## 2. Completed Implementation Summary

### A. Data Models & Type Definitions

Located at [`lib/appearance/types.ts`](file:///d:/SaaS%20Project/trading-alerts-saas-public/seed-code/trading-conversational-ai-ui-pages-increment/lib/appearance/types.ts):

```typescript
export type ThemeMode = 'dark' | 'light' | 'system';
export type AccentScheme = 'amber' | 'emerald' | 'blue' | 'purple';

export interface AppearanceSettings {
  theme: ThemeMode;
  accent: AccentScheme;
  chartUpColor: string;
  chartDownColor: string;
  gridOpacity: number; // 0 - 100
}

export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  theme: 'dark',
  accent: 'amber',
  chartUpColor: '#10b981',
  chartDownColor: '#ef4444',
  gridOpacity: 25,
};

export const APPEARANCE_COOKIE_NAME = 'davintrade-appearance';
```

### B. CSS Accent Token Engine

Located at [`app/globals.css`](file:///d:/SaaS%20Project/trading-alerts-saas-public/seed-code/trading-conversational-ai-ui-pages-increment/app/globals.css):

- Dynamic CSS custom properties bound via `html[data-accent]`:
  - `html[data-accent="amber"]` $\rightarrow$ `--primary: #f59e0b; --ring: #f59e0b;`
  - `html[data-accent="emerald"]` $\rightarrow$ `--primary: #10b981; --ring: #10b981;`
  - `html[data-accent="blue"]` / `html[data-accent="sapphire"]` $\rightarrow$ `--primary: #3b82f6; --ring: #3b82f6;`
  - `html[data-accent="purple"]` / `html[data-accent="amethyst"]` $\rightarrow$ `--primary: #8b5cf6; --ring: #8b5cf6;`
- Key UI components ([`chat-sidebar.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/seed-code/trading-conversational-ai-ui-pages-increment/components/chat-sidebar.tsx), [`app-header.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/seed-code/trading-conversational-ai-ui-pages-increment/components/layout/app-header.tsx), active tabs, session items, PNG Download button) consume `var(--primary)` and `border-[var(--primary)]/40 bg-[var(--primary)]/15` for live accent reactive feedback without re-rendering component trees.

### C. Server-Side Zero-FOUC Attribute Injection

Located at [`app/layout.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/seed-code/trading-conversational-ai-ui-pages-increment/app/layout.tsx) & [`lib/appearance/server-appearance.ts`](file:///d:/SaaS%20Project/trading-alerts-saas-public/seed-code/trading-conversational-ai-ui-pages-increment/lib/appearance/server-appearance.ts):

- Server Component parses HTTP cookies on initial request and injects `data-accent`, `--chart-candle-up`, `--chart-candle-down`, and `--chart-grid-opacity` directly into `<html>` attributes before HTML streaming.

### D. Client Provider & Reactive State

Located at [`components/providers/appearance-provider.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/seed-code/trading-conversational-ai-ui-pages-increment/components/providers/appearance-provider.tsx):

- Manages client-side appearance state and updates `document.documentElement` attributes (`data-accent`, `--chart-candle-up`, `--chart-candle-down`, `--chart-grid-opacity`) instantly on change.

### E. Appearance Settings Form Component

Located at [`app/(dashboard)/settings/appearance/_components/appearance-form.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/seed-code/trading-conversational-ai-ui-pages-increment/app/%28dashboard%29/settings/appearance/_components/appearance-form.tsx):

- Theme Mode Selector: _Dark Trading Terminal_, _Light Clean Mode_, _System Sync_.
- Accent Color Scheme Selector: _Gold Amber_, _Emerald Green_, _Sapphire Blue_, _Amethyst Purple_.
- Candlestick & Grid Controls: Color Pickers, Opacity Slider, **Reset Defaults** button (`t('Reset Defaults')` returning `#10b981`, `#ef4444`, `25%`).
- Live Preview Canvas box with dynamic candle samples and grid pattern opacity overlay.

### F. Lightweight Charts Reactive Repainting

Located at [`components/trading-chart.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/seed-code/trading-conversational-ai-ui-pages-increment/components/trading-chart.tsx):

- Observes appearance settings and repaints candlestick up/down colors, grid line opacities, and canvas background colors reactively.

---

## 3. Outstanding Issues to Address (Client-Side Refactoring)

### ⚠️ Platform-Wide Light Clean Mode Implementation

- **Current Behavior**: Selecting **Light Clean Mode** currently turns the TradingView Lightweight Charts canvas background light (`#f8fafc`), but the surrounding layout containers (Sidebar, App Header, AI Analyst Panel B, Market Comments Panel D, Settings Cards) remain dark black because of hardcoded utility classes (`bg-[#06070a]`, `bg-[#090b11]`, `bg-[#0b0d14]`, `bg-[#080d0a]`, `bg-[#121622]`).
- **Required Task for Claude Code**:
  1. Audit layout components:
     - [`app/page.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/seed-code/trading-conversational-ai-ui-pages-increment/app/page.tsx)
     - [`components/chat-sidebar.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/seed-code/trading-conversational-ai-ui-pages-increment/components/chat-sidebar.tsx)
     - [`components/layout/app-header.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/seed-code/trading-conversational-ai-ui-pages-increment/components/layout/app-header.tsx)
     - [`components/chat-panel.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/seed-code/trading-conversational-ai-ui-pages-increment/components/chat-panel.tsx)
     - [`components/market-comments-panel.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/seed-code/trading-conversational-ai-ui-pages-increment/components/market-comments-panel.tsx)
     - Settings pages layout [`app/(dashboard)/settings/layout.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/seed-code/trading-conversational-ai-ui-pages-increment/app/%28dashboard%29/settings/layout.tsx)
  2. Implement a unified light/dark design token system in Tailwind/CSS so that when `html.light` or `html:not(.dark)` is active:
     - Outer Page Background: Light slate `#f8fafc` / `#f1f5f9`
     - Sidebar & Cards: Crisp White `#ffffff` with light borders `#e2e8f0`
     - Text & Headers: Dark slate `#0f172a` / `#1e293b`
     - Badges & Icons: High-contrast daylight variants
  3. Ensure that when `html.dark` is active, the app retains its exact dark trading terminal appearance (`#06070a`, `#090b11`, `#0b0d14`).

### 🛡️ Contrast & Hover Safety Guidelines

- In [`app/globals.css`](file:///d:/SaaS%20Project/trading-alerts-saas-public/seed-code/trading-conversational-ai-ui-pages-increment/app/globals.css), `--accent-foreground` must remain high-contrast (`#ffffff` or slate light) so default shadcn `hover:bg-accent hover:text-accent-foreground` button rules never turn button text near-black `#000000` on mouseover.

---

## 4. Required Server-Side & Backend Tasks

### A. Database Schema Persistence (Prisma)

Update the Prisma schema (e.g. `prisma/non-market-data/schema.prisma`):

```prisma
model UserAppearance {
  id             String   @id @default(cuid())
  userId         String   @unique
  theme          String   @default("dark")
  accent         String   @default("amber")
  chartUpColor   String   @default("#10b981")
  chartDownColor String   @default("#ef4444")
  gridOpacity    Int      @default(25)
  updatedAt      DateTime @updatedAt
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### B. Server Action Persistence Handler

Extend [`app/actions/appearance.ts`](file:///d:/SaaS%20Project/trading-alerts-saas-public/seed-code/trading-conversational-ai-ui-pages-increment/app/actions/appearance.ts):

```typescript
'use server';

import { cookies } from 'next/headers';
import {
  APPEARANCE_COOKIE_NAME,
  AppearanceSettings,
} from '@/lib/appearance/types';
// Import Prisma client or auth session resolver as needed

export async function saveAppearanceAction(settings: AppearanceSettings) {
  try {
    const cookieStore = await cookies();
    cookieStore.set(APPEARANCE_COOKIE_NAME, JSON.stringify(settings), {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: 'lax',
      httpOnly: false,
    });

    // TODO (Backend): If user is authenticated, persist settings to UserAppearance database model.

    return { success: true };
  } catch (error) {
    console.error('Failed to save appearance settings:', error);
    return { success: false };
  }
}
```

### C. Server-Side Preference Resolution Hierarchy

Update [`lib/appearance/server-appearance.ts`](file:///d:/SaaS%20Project/trading-alerts-saas-public/seed-code/trading-conversational-ai-ui-pages-increment/lib/appearance/server-appearance.ts):

1. **Authenticated User Database Record** (Highest priority if logged in)
2. **HTTP Cookie (`davintrade-appearance`)**
3. **`DEFAULT_APPEARANCE_SETTINGS`** (Fallback)

### D. System Sync Media Listener

Ensure client-side listener for OS theme preference changes (`window.matchMedia('(prefers-color-scheme: dark)')`) dynamically updates `document.documentElement` classes when `theme === 'system'`.

---

## 5. Verification Checkpoints

When testing changes, run:

```bash
cd "seed-code/trading-conversational-ai-ui-pages-increment"
npm run build
```

Check that:

1. `✓ Compiled successfully` with zero TypeScript or Turbo build errors.
2. `31/31` static pages generate cleanly.
3. Light Mode and Dark Mode switch cleanly across all pages without visual glitches.

'use client';

import { TradingWorkspace } from '@/components/workspace/trading-workspace';

/**
 * `/terminal` -- Protected Page #2, PRO 4-panel quantitative workspace.
 *
 * Panel A (ChatSidebar) and Panel C (real charts -- M5 stacked above M15 via
 * components/charts/mtf-stacked-charts.tsx, each a TradingChart with live
 * Socket.IO OHLCV, drawing toolbar and fired-alert markers; the PRO
 * multi-timeframe overlay toggle sits on the M15 chart) are real.
 * Panels B and D (ChatPanel, MarketCommentsPanel) are genuine empty states
 * per this session's Decision 2 -- Stack D/E aren't built until Phases
 * 12/13.
 *
 * The panel layout and its collapse behaviour live in
 * components/workspace/trading-workspace.tsx, shared with `/free`.
 */
export function TerminalWorkspace(): React.JSX.Element {
  return <TradingWorkspace tier="PRO" />;
}

'use client';

import { useState } from 'react';

import { TradingWorkspace } from '@/components/workspace/trading-workspace';
import { ProUpgradeModal } from '@/components/ui/pro-upgrade-modal';

/**
 * `/free` -- Protected Page #3, FREE-tier quantitative workspace.
 *
 * Same real charts as `/terminal` (components/charts/mtf-stacked-charts.tsx --
 * M5 above M15) -- FREE tier gets the same live XAUUSD data (real per this
 * platform's own FREE/PRO model, see components/alerts/alerts-pro-upgrade.tsx:
 * "Full market data and every indicator overlay — same data as PRO"). The
 * PRO-only M5-on-M15 overlay toggle (MtfToggle) sits on the lower chart and is
 * already real-gated -- it routes a FREE user straight to /pricing on click.
 * Panels B/D are the same genuine empty states as /terminal (Decision 2),
 * with an additional "Get priority access on PRO" nudge that opens
 * ProUpgradeModal -- this page's own feature-gate/upgrade-modal surface.
 *
 * The panel layout and its collapse behaviour live in
 * components/workspace/trading-workspace.tsx, shared with `/terminal`.
 */
export function FreeWorkspace(): React.JSX.Element {
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  return (
    <>
      <TradingWorkspace
        tier="FREE"
        onOpenUpgradeModal={() => setIsUpgradeModalOpen(true)}
      />
      <ProUpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        featureName="early access to AI Copilot & Market Comments"
      />
    </>
  );
}

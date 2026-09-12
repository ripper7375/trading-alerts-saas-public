'use client';

/**
 * PairChartModal — "🔍 View Chart" quick action (spec Sections 6.3/9).
 *
 * This app has no OHLCV data for arbitrary FX pairs at all -- the only
 * live candlestick pipeline is XAUUSD (Lane 1's own alert pipeline), and
 * Lane 4's own Phase 1 entry already flagged `forex_ohlcv_m5` (raw per-pair
 * storage) as deliberately not built, reserved for a future 32-pair
 * screener. Rather than fabricate data or build that pipeline for a
 * "view chart" button, this reuses `components/landing/ticker-tape.tsx`'s
 * own proven technique: a plain `<iframe src="https://www.tradingview-
 * widget.com/embed-widget/...">`, not a loader-script injection (that
 * file's own header comment documents real bugs with re-initializing this
 * embed mid-session). CSP already allows `tradingview-widget.com` in
 * `frame-src` (next.config.js), so no config change was needed.
 *
 * Unlike ticker-tape's dual light/dark iframe trick (built specifically so
 * a NEVER-UNMOUNTING landing-page strip survives a theme change without
 * re-initializing), this modal remounts fresh every open by nature (same
 * Dialog-portal lifecycle as HrmaSmmaDetailModal) -- "a fresh embed on a
 * fresh page load is reliable" (ticker-tape's own conclusion) is satisfied
 * trivially, so one iframe with the theme baked in at mount time is enough.
 *
 * @module components/currency-index-pro/chart/pair-chart-modal
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLocale } from '@/lib/context/locale-context';
import { useChartAppearance } from '@/components/providers/appearance-provider';
import { resolveTradingViewLocale } from '@/lib/utils/tradingview-locale';

interface PairChartModalProps {
  open: boolean;
  pair: string | null;
  onOpenChange: (open: boolean) => void;
}

function buildEmbedSrc(
  locale: string,
  config: Record<string, unknown>
): string {
  return `https://www.tradingview-widget.com/embed-widget/advanced-chart/?locale=${encodeURIComponent(locale)}#${encodeURIComponent(JSON.stringify(config))}`;
}

// ICMARKETS -- same broker prefix as ticker-tape.tsx's own FX symbols, so a
// pair's identity here matches what's already shown on the landing page.
function tradingViewSymbolFor(pair: string): string {
  return `ICMARKETS:${pair}`;
}

export function PairChartModal({
  open,
  pair,
  onOpenChange,
}: PairChartModalProps): React.JSX.Element {
  const { language } = useLocale();
  const { resolvedTheme } = useChartAppearance();

  const locale = resolveTradingViewLocale(language);
  const src = pair
    ? buildEmbedSrc(locale, {
        symbol: tradingViewSymbolFor(pair),
        interval: '15', // matches this plan's own M15 analysis timeframe
        theme: resolvedTheme,
        style: '1', // candles
        locale,
        toolbar_bg: resolvedTheme === 'dark' ? '#0a0e17' : '#ffffff',
        enable_publishing: false,
        allow_symbol_change: false,
        save_image: false,
        withdateranges: true,
      })
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{pair ? `${pair} — Live Chart` : 'Chart'}</DialogTitle>
        </DialogHeader>
        {pair && (
          <div className="h-[480px] w-full overflow-hidden rounded-lg border border-border">
            <iframe
              key={pair} // a fresh iframe per pair -- never re-point an existing one's src
              src={src}
              title={`${pair} TradingView chart`}
              className="h-full w-full"
              style={{ border: 'none' }}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

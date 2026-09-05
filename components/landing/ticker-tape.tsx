'use client';

import { useEffect, useState } from 'react';
import { useChartAppearance } from '@/components/providers/appearance-provider';
import { useLocale } from '@/lib/context/locale-context';
import { resolveTradingViewLocale } from '@/lib/utils/tradingview-locale';

export interface TickerTapeSymbol {
  proName: string;
  title: string;
}

export interface TickerTapeProps {
  symbols?: TickerTapeSymbol[];
  showSymbolLogo?: boolean;
  isTransparent?: boolean;
  displayMode?: 'adaptive' | 'regular' | 'compact';
  className?: string;
}

// Alphabetized by display `title` (not `proName`) -- matches this repo's own
// convention of sorting locale-facing lists by their display label, not the
// internal code (see LanguageSelectorModal's localeCompare-on-name sort).
export const DEFAULT_TICKER_SYMBOLS: TickerTapeSymbol[] = [
  { proName: 'ICMARKETS:AUDUSD', title: 'AUD/USD' },
  { proName: 'ICMARKETS:BTCUSD', title: 'BTC/USD' },
  { proName: 'ICMARKETS:ETHUSD', title: 'ETH/USD' },
  { proName: 'ICMARKETS:EURUSD', title: 'EUR/USD' },
  { proName: 'ICMARKETS:GBPJPY', title: 'GBP/JPY' },
  { proName: 'ICMARKETS:GBPUSD', title: 'GBP/USD' },
  { proName: 'ICMARKETS:USTEC', title: 'NAS100' },
  { proName: 'ICMARKETS:NZDUSD', title: 'NZD/USD' },
  { proName: 'ICMARKETS:US30', title: 'US30' },
  { proName: 'ICMARKETS:USDCAD', title: 'USD/CAD' },
  { proName: 'ICMARKETS:USDCHF', title: 'USD/CHF' },
  { proName: 'ICMARKETS:USDJPY', title: 'USD/JPY' },
  { proName: 'ICMARKETS:XAGUSD', title: 'XAG/USD' },
  { proName: 'ICMARKETS:XAUUSD', title: 'XAU/USD' },
  { proName: 'ICMARKETS:XTIUSD', title: 'XTI/USD' },
];

const TICKER_TAPE_HEIGHT = 72;

/**
 * Renders TradingView's ticker-tape widget as a plain <iframe> pointed
 * directly at the URL its own embed-widget-ticker-tape.js loader script
 * generates, instead of injecting that loader script into the page.
 *
 * A prior version injected the loader script (a <script> whose innerHTML is
 * the JSON config; the script builds its own iframe). That reliably
 * rendered on a fresh page load but silently went blank on every SPA
 * runtime re-init -- reproduced repeatedly on production, in both theme
 * directions, even after switching from an in-place innerHTML clear to a
 * full React-driven DOM node replacement (a brand new container/script/
 * iframe each time, confirmed via a direct node-identity check). The
 * replacement iframe always carried the correct colorTheme in its own src
 * and had correct non-zero dimensions, yet never painted -- pointing at
 * internal state the loader script keeps across its own re-executions
 * (window-level listener/singleton bookkeeping is a known failure class for
 * "insert a script, it builds its own iframe" embeds reused across an SPA
 * session), not at anything in this component's own DOM lifecycle.
 *
 * A plain iframe sidesteps that whole class of bug: updating `src` on an
 * already-mounted <iframe> is a normal browser navigation with no
 * involvement from any third-party script's own internal state -- the same
 * mechanism the theme-aware hero <Image> swap already relies on.
 */
export function TickerTape({
  symbols = DEFAULT_TICKER_SYMBOLS,
  showSymbolLogo = true,
  isTransparent = true,
  // 'adaptive' silently swaps between two visually distinct renderers based
  // on container width: a continuously-scrolling single-line strip on wide
  // (desktop) viewports vs a static, larger-font, periodically-rotating card
  // grid on narrow (mobile) ones -- confirmed live by loading the same
  // TradingView widget config at both widths. 'compact' forces the card
  // format at every width, so the ticker looks the same on every visit
  // regardless of device.
  displayMode = 'compact',
  className = '',
}: TickerTapeProps): React.ReactElement {
  const { resolvedTheme } = useChartAppearance();
  const { language } = useLocale();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={`border-border/40 bg-muted/20 h-[46px] w-full animate-pulse border-y ${className}`}
        aria-hidden="true"
      />
    );
  }

  const locale = resolveTradingViewLocale(language);
  const config = {
    symbols,
    showSymbolLogo,
    isTransparent,
    displayMode,
    colorTheme: resolvedTheme,
    width: '100%',
    height: TICKER_TAPE_HEIGHT,
  };
  const iframeSrc = `https://www.tradingview-widget.com/embed-widget/ticker-tape/?locale=${encodeURIComponent(locale)}#${encodeURIComponent(JSON.stringify(config))}`;

  return (
    <div
      className={`tradingview-widget-container border-border/40 bg-background/95 supports-[backdrop-filter]:bg-background/60 w-full border-y backdrop-blur ${className}`}
      style={{ width: '100%', height: TICKER_TAPE_HEIGHT }}
    >
      <iframe
        src={iframeSrc}
        title="ticker tape TradingView widget"
        scrolling="no"
        allowTransparency={true}
        frameBorder={0}
        style={{
          userSelect: 'none',
          boxSizing: 'border-box',
          display: 'block',
          height: TICKER_TAPE_HEIGHT,
          width: '100%',
        }}
      />
    </div>
  );
}

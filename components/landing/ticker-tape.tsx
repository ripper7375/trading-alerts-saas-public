'use client';

import { useEffect, useRef, useState } from 'react';
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

interface TickerTapeWidgetProps {
  symbols: TickerTapeSymbol[];
  showSymbolLogo: boolean;
  isTransparent: boolean;
  displayMode: 'adaptive' | 'regular' | 'compact';
  colorTheme: 'light' | 'dark';
  locale: string;
  className: string;
}

/**
 * Renders one fixed TradingView ticker-tape config. Mounted fresh (via a
 * `key` on the config in the parent) whenever theme/locale/etc change,
 * rather than clearing and re-populating a persistent container in place.
 * Manually clearing innerHTML on a live node and inserting a new
 * cross-origin iframe into it is what used to happen here, and it silently
 * broke on a real runtime theme toggle in production: the freshly-inserted
 * iframe carried the correct colorTheme in its own src (confirmed by
 * inspecting it directly) and had correct non-zero dimensions, but never
 * painted anything -- reproducible every time, on every toggle direction,
 * while a full page reload with the same dark/light cookie always rendered
 * correctly. A `key` change makes React itself unmount the old DOM node and
 * mount a brand new one, which avoids whatever state the just-removed
 * TradingView iframe was leaving behind for its replacement.
 */
function TickerTapeWidget({
  symbols,
  showSymbolLogo,
  isTransparent,
  displayMode,
  colorTheme,
  locale,
  className,
}: TickerTapeWidgetProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    container.appendChild(widgetDiv);

    const config = {
      symbols,
      showSymbolLogo,
      isTransparent,
      displayMode,
      colorTheme,
      locale,
    };

    const script = document.createElement('script');
    script.src =
      'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify(config);

    container.appendChild(script);
    // A fresh instance (new `key` in the parent) is mounted for every config
    // change, so this only ever needs to run once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`tradingview-widget-container border-border/40 bg-background/95 supports-[backdrop-filter]:bg-background/60 w-full border-y backdrop-blur ${className}`}
      ref={containerRef}
    />
  );
}

/**
 * Reads resolvedTheme from AppearanceProvider (useChartAppearance), not
 * next-themes' useTheme() -- AppearanceProvider owns the app's actual
 * light/dark state directly and next-themes' own theme/resolvedTheme is no
 * longer kept in sync with it (see the 2026-09-04 Theme Mode fix session,
 * Root cause 2, in CLAUDE.md). Same pattern as EconomicCalendarWidget.
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
  const widgetKey = JSON.stringify({
    symbols,
    showSymbolLogo,
    isTransparent,
    displayMode,
    resolvedTheme,
    locale,
  });

  return (
    <TickerTapeWidget
      key={widgetKey}
      symbols={symbols}
      showSymbolLogo={showSymbolLogo}
      isTransparent={isTransparent}
      displayMode={displayMode}
      colorTheme={resolvedTheme}
      locale={locale}
      className={className}
    />
  );
}

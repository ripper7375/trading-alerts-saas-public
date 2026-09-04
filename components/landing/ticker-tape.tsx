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

export const DEFAULT_TICKER_SYMBOLS: TickerTapeSymbol[] = [
  { proName: 'ICMARKETS:XAUUSD', title: 'XAU/USD' },
  { proName: 'ICMARKETS:BTCUSD', title: 'BTC/USD' },
  { proName: 'ICMARKETS:EURUSD', title: 'EUR/USD' },
  { proName: 'ICMARKETS:USDJPY', title: 'USD/JPY' },
  { proName: 'ICMARKETS:GBPUSD', title: 'GBP/USD' },
  { proName: 'ICMARKETS:AUDUSD', title: 'AUD/USD' },
  { proName: 'ICMARKETS:ETHUSD', title: 'ETH/USD' },
  { proName: 'ICMARKETS:XAGUSD', title: 'XAG/USD' },
  { proName: 'ICMARKETS:GBPJPY', title: 'GBP/JPY' },
  { proName: 'ICMARKETS:US30', title: 'US30' },
  { proName: 'ICMARKETS:USTEC', title: 'NAS100' },
  { proName: 'ICMARKETS:USDCAD', title: 'USD/CAD' },
  { proName: 'ICMARKETS:USDCHF', title: 'USD/CHF' },
  { proName: 'ICMARKETS:NZDUSD', title: 'NZD/USD' },
  { proName: 'ICMARKETS:XTIUSD', title: 'XTI/USD' },
];

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
  displayMode = 'adaptive',
  className = '',
}: TickerTapeProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useChartAppearance();
  const { language } = useLocale();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!mounted || !container) return;

    // Reset container to avoid duplicate widgets on re-render / theme change / React Strict Mode
    container.innerHTML = '';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    container.appendChild(widgetDiv);

    const config = {
      symbols,
      showSymbolLogo,
      isTransparent,
      displayMode,
      colorTheme: resolvedTheme,
      locale: resolveTradingViewLocale(language),
    };

    const script = document.createElement('script');
    script.src =
      'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify(config);

    container.appendChild(script);

    return () => {
      container.innerHTML = '';
    };
  }, [
    mounted,
    resolvedTheme,
    language,
    symbols,
    showSymbolLogo,
    isTransparent,
    displayMode,
  ]);

  if (!mounted) {
    return (
      <div
        className={`border-border/40 bg-muted/20 h-[46px] w-full animate-pulse border-y ${className}`}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className={`tradingview-widget-container border-border/40 bg-background/95 supports-[backdrop-filter]:bg-background/60 w-full border-y backdrop-blur ${className}`}
      ref={containerRef}
    />
  );
}

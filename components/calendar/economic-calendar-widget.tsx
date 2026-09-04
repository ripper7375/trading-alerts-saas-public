'use client';

import { useEffect, useRef, useState } from 'react';
import { useChartAppearance } from '@/components/providers/appearance-provider';
import { useLocale } from '@/lib/context/locale-context';

export interface EconomicCalendarWidgetProps {
  height?: number | string;
  width?: string;
  isTransparent?: boolean;
  importanceFilter?: string; // "-1,0,1" | "0,1" | "1"
  countryFilter?: string; // e.g. "us,eu,gb,jp,ca,au,cn,ch"
  currencyFilter?: string; // e.g. "USD,EUR,GBP,JPY"
  locale?: string;
  className?: string;
}

/**
 * Reads resolvedTheme from AppearanceProvider (useChartAppearance), not
 * next-themes' useTheme() -- AppearanceProvider owns the app's actual
 * light/dark state directly and next-themes' own theme/resolvedTheme is no
 * longer kept in sync with it (see the 2026-09-04 Theme Mode fix session,
 * Root cause 2, in CLAUDE.md).
 */
export function EconomicCalendarWidget({
  height = 750,
  width = '100%',
  isTransparent = false,
  importanceFilter = '-1,0,1',
  countryFilter,
  currencyFilter,
  locale = 'en',
  className = '',
}: EconomicCalendarWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useChartAppearance();
  const { t } = useLocale();
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

    const copyright = document.createElement('div');
    copyright.className = 'tradingview-widget-copyright mt-2 text-center';
    copyright.innerHTML = `
      <a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank" class="text-xs text-muted-foreground hover:text-amber-500 transition-colors">
        ${t('Economic Calendar provided by')} <span class="text-amber-500 font-medium">TradingView</span>
      </a>
    `;
    container.appendChild(copyright);

    const config: Record<string, unknown> = {
      colorTheme: resolvedTheme,
      isTransparent,
      width,
      height: typeof height === 'number' ? height.toString() : height,
      locale,
      importanceFilter,
    };

    if (countryFilter) config['countryFilter'] = countryFilter;
    if (currencyFilter) config['currencyFilter'] = currencyFilter;

    const script = document.createElement('script');
    script.src =
      'https://s3.tradingview.com/external-embedding/embed-widget-events.js';
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
    height,
    width,
    isTransparent,
    importanceFilter,
    countryFilter,
    currencyFilter,
    locale,
    t,
  ]);

  if (!mounted) {
    return (
      <div
        className="flex w-full animate-pulse items-center justify-center rounded-xl border border-border bg-card"
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
      >
        <span className="text-sm text-muted-foreground">
          {t('Loading Economic Calendar...')}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`tradingview-widget-container ${className}`}
      ref={containerRef}
    />
  );
}

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
 * Module-scoped, client-only cache for the computed iframe `src` -- plain JS
 * scope, not React state, so it survives this component being unmounted and
 * remounted within the same browser tab (see the module doc comment below
 * for why that happens and why a component-local useState lazy initializer
 * isn't enough on its own). Guarded to the client only: on the server this
 * module is evaluated once per Node.js process, not once per request, so a
 * server-side cache here would leak one visitor's resolved theme into
 * another's SSR output.
 */
let cachedTickerIframeSrc: string | null = null;

/**
 * Test-only: clears the module-level cache so each test can render a fresh
 * "first ever page load" instead of inheriting whatever an earlier test in
 * the same file already cached. Never called outside tests -- production
 * relies on this cache never being cleared for the lifetime of the tab.
 */
export function __resetTickerTapeCacheForTests(): void {
  cachedTickerIframeSrc = null;
}

/**
 * Renders TradingView's ticker-tape widget as a plain <iframe> pointed
 * directly at the URL its own embed-widget-ticker-tape.js loader script
 * generates (locale in the query string, the rest of the config in the URL
 * hash), rather than injecting that loader script into the page.
 *
 * The `src` is computed ONCE, from whatever theme/locale resolve on this
 * component's first render, and deliberately never recomputed afterward --
 * this widget does not live-follow a later theme or locale change. That's a
 * real, evidence-based decision, not an oversight: every attempt at forcing
 * a runtime re-init (in-place innerHTML clearing, a full React-driven DOM
 * node replacement confirmed via node-identity checks, mirroring the theme
 * into the query string to force a real reload rather than an in-page hash
 * navigation) reliably worked in isolated testing but proved unreliable
 * against the live embed under real, repeated use -- reported live on
 * production as slow to update and, at times, stuck showing the old theme.
 * Isolated the underlying cause to TradingView's own embed rather than
 * anything left to fix on our end: a fresh embed under a given parent site
 * always renders correctly, but the SAME (parent site, tradingview-widget
 * .com) pairing degrades on repeated re-embeds within a session (reload or
 * runtime alike) -- confirmed by loading the identical config directly as
 * its own page (always fine, unlimited retries) and by loading it under a
 * different top-level site in the same browser profile (also always fine),
 * which rules out both our code and any general/global rate limiting.
 *
 * A plain `useState(() => ...)` lazy initializer was tried first for
 * "compute once" and looked correct in isolated re-render tests, but this
 * page wraps TickerTape in a <Suspense> boundary, and saving an appearance
 * setting calls `cookies().set()` inside a Server Action -- which Next.js
 * treats as cause to refresh the route. That refresh re-suspends the
 * boundary, which remounts everything inside it (a fresh component
 * instance, fresh useState) -- confirmed live: the iframe's own `src`
 * carried the *new* theme immediately after a toggle, which a lazy
 * initializer can only do by re-running, i.e. by actually remounting. The
 * module-level cache above survives that remount since it isn't tied to any
 * particular component instance.
 *
 * Net effect: the ticker matches whichever theme was active when the page
 * loaded, and simply keeps that theme for the rest of the tab's session --
 * a real trade-off, chosen deliberately over a widget that unreliably
 * reflects a live toggle at all.
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

  function computeIframeSrc(): string {
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
    return `https://www.tradingview-widget.com/embed-widget/ticker-tape/?locale=${encodeURIComponent(locale)}#${encodeURIComponent(JSON.stringify(config))}`;
  }

  let iframeSrc: string;
  if (typeof window === 'undefined') {
    iframeSrc = computeIframeSrc();
  } else {
    if (cachedTickerIframeSrc === null) {
      cachedTickerIframeSrc = computeIframeSrc();
    }
    iframeSrc = cachedTickerIframeSrc;
  }

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

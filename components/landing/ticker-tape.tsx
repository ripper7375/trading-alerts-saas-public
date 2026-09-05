'use client';

import { useEffect, useState } from 'react';
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
 * Module-scoped, client-only cache for the resolved TradingView locale --
 * plain JS scope, not React state, so both iframe URLs stay byte-identical
 * for the life of the tab even if this component is remounted. Guarded to
 * the client: this module is evaluated once per Node.js process, not once
 * per request, so caching on the server would leak one visitor's locale into
 * another's SSR output.
 */
let cachedTickerLocale: string | null = null;

/**
 * Test-only: clears the module-level cache so each test can render a fresh
 * "first ever page load" instead of inheriting an earlier test's locale.
 */
export function __resetTickerTapeCacheForTests(): void {
  cachedTickerLocale = null;
}

function buildEmbedSrc(
  locale: string,
  config: Record<string, unknown>
): string {
  return `https://www.tradingview-widget.com/embed-widget/ticker-tape/?locale=${encodeURIComponent(locale)}#${encodeURIComponent(JSON.stringify(config))}`;
}

/**
 * Renders TradingView's ticker-tape widget as plain <iframe>s pointed
 * directly at the URL its own embed-widget-ticker-tape.js loader script
 * generates, rather than injecting that loader script into the page.
 *
 * BOTH themes are mounted at once -- a light-configured iframe and a
 * dark-configured one, stacked on top of each other -- and the active one is
 * chosen purely in CSS off the `.dark` class AppearanceProvider already puts
 * on <html>. Nothing re-navigates, re-initializes, or even re-renders when
 * the user flips the theme; only two opacity values change.
 *
 * That indirection exists because re-theming a single iframe at runtime does
 * not work reliably with this widget, which was established the hard way.
 * The loader-script approach went blank on every SPA re-init. Switching to a
 * plain iframe and swapping its `src` did too. Forcing a genuine document
 * reload (rather than an in-page hash navigation) by mirroring colorTheme
 * into the query string made it reload, but real use showed it slow and at
 * times stuck on the old theme. Locking the src at mount avoided the
 * breakage but, by definition, stopped following the theme at all. Every one
 * of those worked in isolated testing and failed in real use, because they
 * all shared the same assumption: that this embed can be re-initialized
 * mid-session. It cannot -- a fresh embed on a fresh page load is reliable,
 * and anything after that is not.
 *
 * So this version never re-initializes anything. Both iframes load once, on
 * the reliable path, and stay put.
 */
export function TickerTape({
  symbols = DEFAULT_TICKER_SYMBOLS,
  showSymbolLogo = true,
  // Deliberately opaque. With isTransparent:true the widget paints no
  // background of its own and depends on showing through to whatever is
  // behind it -- which does not land consistently across browsers: the dark
  // widget rendered its light text over a white canvas (reported live, and
  // reproduced by loading the same config standalone). Letting each widget
  // paint its own theme-matched background makes the strip self-contained,
  // so it can't be washed out by anything in front of or behind it.
  isTransparent = false,
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

  let locale: string;
  if (typeof window === 'undefined') {
    locale = resolveTradingViewLocale(language);
  } else {
    if (cachedTickerLocale === null) {
      cachedTickerLocale = resolveTradingViewLocale(language);
    }
    locale = cachedTickerLocale;
  }

  const sharedConfig = {
    symbols,
    showSymbolLogo,
    isTransparent,
    displayMode,
    width: '100%',
    height: TICKER_TAPE_HEIGHT,
  };

  // Both iframes stay at full size at all times (never display:none), so
  // neither can measure itself at zero width -- a classic way to get a
  // permanently broken third-party widget. Only opacity differs.
  const sharedIframeProps = {
    title: 'ticker tape TradingView widget',
    scrolling: 'no',
    allowTransparency: true,
    frameBorder: 0,
    className: 'absolute inset-0 h-full w-full transition-opacity duration-200',
    style: {
      userSelect: 'none' as const,
      boxSizing: 'border-box' as const,
      display: 'block' as const,
    },
  };

  // `bg-background` carries no opacity modifier on purpose: `bg-background/95`
  // computed to fully transparent here (rgba(0,0,0,0)) rather than a 95%-alpha
  // background, so it painted nothing at all. The iframes are opaque now
  // anyway, but this keeps the strip the right colour in the gap before they
  // finish loading.
  return (
    <div
      className={`tradingview-widget-container border-border/40 relative w-full border-y bg-background ${className}`}
      style={{ width: '100%', height: TICKER_TAPE_HEIGHT }}
    >
      <iframe
        {...sharedIframeProps}
        data-ticker-theme="light"
        src={buildEmbedSrc(locale, { ...sharedConfig, colorTheme: 'light' })}
        className={`${sharedIframeProps.className} opacity-100 dark:opacity-0`}
      />
      <iframe
        {...sharedIframeProps}
        data-ticker-theme="dark"
        src={buildEmbedSrc(locale, { ...sharedConfig, colorTheme: 'dark' })}
        className={`${sharedIframeProps.className} opacity-0 dark:opacity-100`}
      />
    </div>
  );
}

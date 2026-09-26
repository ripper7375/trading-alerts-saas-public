import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { cookies, headers } from 'next/headers';
import { Providers } from './providers';
import './globals.css';
import { LOCALE_COOKIE, LOCALE_STORAGE_KEY } from '@/lib/i18n/locale-resolver';
import { SUPPORTED_LANGUAGE_CODES, textDirection } from '@/lib/i18n/languages';
import { getServerAppearance } from '@/lib/appearance/server-appearance';
import { getDisplayUsdRates } from '@/lib/fx/usd-rates';
import {
  detectedTimezoneFromHeaders,
  resolveRequestPreferences,
} from '@/lib/i18n/server-locale';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  fallback: ['system-ui', 'arial', 'sans-serif'],
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: {
    default: 'DavinTrade AI',
    template: '%s | DavinTrade',
  },
  description:
    'Get real-time AI-powered trading alerts for Gold (XAUUSD), Forex, Crypto, and Indices. Advanced fractal analysis with multiple timeframes.',
  keywords: [
    'trading alerts',
    'forex signals',
    'gold trading',
    'XAUUSD',
    'crypto alerts',
    'trading signals',
    'fractal analysis',
    'AI trading analyst',
  ],
  authors: [{ name: 'DavinTrade Team' }],
  creator: 'DavinTrade',
  publisher: 'DavinTrade',
  metadataBase: new URL(process.env['NEXTAUTH_URL'] || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'DavinTrade',
    title: 'DavinTrade AI - Real-Time Trading Signals',
    description:
      'Get real-time AI-powered trading alerts for Gold, Forex, Crypto, and Indices.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DavinTrade AI - Real-Time Trading Signals',
    description:
      'Get real-time AI-powered trading alerts for Gold, Forex, Crypto, and Indices.',
  },
  manifest: '/manifest.json',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const [initialAppearance, cookieStore, headerStore, initialUsdRates] =
    await Promise.all([
      getServerAppearance(),
      cookies(),
      headers(),
      // Live USD display rates (hourly, shared with dLocal); never blocks on
      // a slow rate API -- see lib/fx/usd-rates.ts.
      getDisplayUsdRates(),
    ]);

  // Resolve the FULL preference set (language + timezone + date/time format +
  // currency) on the server, mirroring getServerAppearance() above -- a Thai
  // user must not be server-rendered with GBP/Europe-London defaults that
  // flip to Baht/Bangkok after hydration. The timezone is IP-detected
  // unless the user picked one.
  const initialPreferences = resolveRequestPreferences(
    cookieStore,
    headerStore
  );
  const detectedTimezone = detectedTimezoneFromHeaders(headerStore);
  const initialLocale = initialPreferences.language;
  // Values interpolated into the inline script below. The resolver only
  // returns known language codes; JSON-encoding (with `<` escaped so nothing
  // can close the <script>) keeps the script safe even if that ever changes.
  const toScript = (value: unknown): string =>
    JSON.stringify(value).replace(/</g, '\\u003c');

  return (
    <html
      lang={initialLocale}
      dir={textDirection(initialLocale)}
      className={inter.variable}
      suppressHydrationWarning
      data-accent={initialAppearance.accent}
      style={{
        ['--chart-candle-up' as string]: initialAppearance.chartUpColor,
        ['--chart-candle-down' as string]: initialAppearance.chartDownColor,
        ['--chart-grid-opacity' as string]: (
          initialAppearance.gridOpacity / 100
        ).toString(),
      }}
    >
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `
            html { background-color: #000; }
            html.light, html:not(.dark) { background-color: #fff; }
            html.dark { background-color: #000; }
          `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var u = new URLSearchParams(window.location.search);
                  // The server-resolved theme (user's DB record, else the
                  // davintrade-appearance cookie, else the default) is the
                  // only source: it is exactly what AppearanceProvider
                  // hydrates with, so the first paint, the page class and
                  // every resolvedTheme consumer (hero image, charts) agree.
                  // An old localStorage value must never win here.
                  var t = u.get('theme');
                  if (t !== 'dark' && t !== 'light') t = ${toScript(initialAppearance.theme)};
                  if (t === 'system') {
                    t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }
                  var d = document.documentElement;
                  d.classList.remove('dark', 'light');
                  d.classList.add(t);
                  d.style.colorScheme = t;

                  // The server already resolved this render's language from the
                  // URL prefix / cookie, so keep <html lang> matching the HTML
                  // that was actually streamed instead of racing localStorage.
                  var lang = ${toScript(initialLocale)};
                  d.lang = lang;

                  // Self-heal a diverged cookie: if localStorage still holds an
                  // explicit choice but the cookie was cleared or expired, the
                  // server had no way to know and rendered the default. Write the
                  // cookie back now so the NEXT request server-renders correctly.
                  var lc = document.cookie.match(/${LOCALE_COOKIE}=([^;]+)/);
                  var ls = localStorage.getItem('${LOCALE_STORAGE_KEY}');
                  if (ls) {
                    try {
                      var saved = JSON.parse(ls).language;
                      var known = ${toScript(SUPPORTED_LANGUAGE_CODES)};
                      if (known.indexOf(saved) !== -1 && (!lc || lc[1] !== saved)) {
                        document.cookie = '${LOCALE_COOKIE}=' + saved + '; path=/; max-age=31536000; SameSite=Lax';
                      }
                    } catch (e) {}
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers
          initialPreferences={initialPreferences}
          detectedTimezone={detectedTimezone}
          initialAppearance={initialAppearance}
          initialUsdRates={initialUsdRates}
        >
          {children}
        </Providers>
      </body>
    </html>
  );
}

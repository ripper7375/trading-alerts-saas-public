import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { cookies, headers } from 'next/headers';
import { Providers } from './providers';
import './globals.css';
import {
  COUNTRY_HEADER,
  LOCALE_COOKIE,
  LOCALE_STORAGE_KEY,
  resolvePreferences,
} from '@/lib/i18n/locale-resolver';
import { getServerAppearance } from '@/lib/appearance/server-appearance';

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
  const [initialAppearance, cookieStore, headerStore] = await Promise.all([
    getServerAppearance(),
    cookies(),
    headers(),
  ]);

  // Resolve the FULL preference set (language + timezone + date/time format +
  // currency) on the server, mirroring getServerAppearance() above -- a Thai
  // user must not be server-rendered with GBP/Europe-London defaults that
  // flip to Baht/Bangkok after hydration.
  const initialPreferences = resolvePreferences({
    countryPrefix: headerStore.get(COUNTRY_HEADER),
    cookieLanguage: cookieStore.get(LOCALE_COOKIE)?.value,
  });
  const initialLocale = initialPreferences.language;

  return (
    <html
      lang={initialLocale}
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
                  var c = document.cookie.match(/davintrade-theme=([^;]+)/);
                  // localStorage before the cookie: next-themes' setTheme()
                  // (called live whenever the user picks a theme) only ever
                  // updates localStorage, not this cookie -- the cookie is
                  // only (re)written by this same script, once per full
                  // page load. Checking the cookie first meant a stale
                  // write-once value could outlive and override a fresher
                  // live theme change on the next hard reload.
                  var t = u.get('theme') || localStorage.getItem('davintrade-theme') || (c && c[1]) || '${initialAppearance.theme}';
                  var d = document.documentElement;
                  d.classList.remove('dark', 'light');
                  d.classList.add(t);
                  d.style.colorScheme = t;
                  document.cookie = 'davintrade-theme=' + t + '; path=/; max-age=31536000; SameSite=Lax';
                  localStorage.setItem('davintrade-theme', t);

                  // The server already resolved this render's language from the
                  // URL prefix / cookie, so keep <html lang> matching the HTML
                  // that was actually streamed instead of racing localStorage.
                  var lang = '${initialLocale}';
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
                      if (saved && (!lc || lc[1] !== saved)) {
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
          initialTheme={initialAppearance.theme}
          initialPreferences={initialPreferences}
          initialAppearance={initialAppearance}
        >
          {children}
        </Providers>
      </body>
    </html>
  );
}

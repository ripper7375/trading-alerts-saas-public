import type React from 'react';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { ThemeProvider } from './providers';
import { ThemeSync } from '@/components/theme-sync';
import ClientProviders from '@/components/providers/client-providers';

import { cookies, headers } from 'next/headers';
import {
  COUNTRY_HEADER,
  LOCALE_COOKIE,
  LOCALE_STORAGE_KEY,
  resolvePreferences,
} from '@/lib/i18n/locale-resolver';

export const metadata: Metadata = {
  title: 'DavinTrade AI',
  description: 'AI-powered trading analysis platform',
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);

  // Resolve the FULL preference set (language + timezone + date/time format +
  // currency) on the server. Previously only `language` and `countryCode` were
  // derived here, so a Thai user was server-rendered with GBP/Europe-London
  // defaults and saw prices flip from "£1,365" to "฿1,365" after hydration.
  const initialPreferences = resolvePreferences({
    countryPrefix: headerStore.get(COUNTRY_HEADER),
    cookieLanguage: cookieStore.get(LOCALE_COOKIE)?.value,
  });
  const initialLocale = initialPreferences.language;

  return (
    <html lang={initialLocale} suppressHydrationWarning>
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
                  var t = u.get('theme') || (c && c[1]) || localStorage.getItem('davintrade-theme') || 'dark';
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
      <body className={`font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          storageKey="davintrade-theme"
          disableTransitionOnChange
        >
          <Suspense fallback={null}>
            <ThemeSync />
          </Suspense>
          <ClientProviders initialPreferences={initialPreferences}>
            {children}
          </ClientProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}

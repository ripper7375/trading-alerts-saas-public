import type React from 'react';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { ThemeProvider } from './providers';
import { ThemeSync } from '@/components/theme-sync';
import ClientProviders from '@/components/providers/client-providers';

import { defaultPreferences } from '@/lib/i18n/locale-resolver';
import { getServerAppearance } from '@/lib/appearance/server-appearance';

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
  const initialAppearance = await getServerAppearance();

  return (
    <html
      lang="en-GB"
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
                  var t = u.get('theme') || (c && c[1]) || localStorage.getItem('davintrade-theme') || '${initialAppearance.theme}';
                  var d = document.documentElement;
                  d.classList.remove('dark', 'light');
                  d.classList.add(t);
                  d.style.colorScheme = t;
                  document.cookie = 'davintrade-theme=' + t + '; path=/; max-age=31536000; SameSite=Lax';
                  localStorage.setItem('davintrade-theme', t);
                  d.lang = 'en-GB';
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme={initialAppearance.theme}
          storageKey="davintrade-theme"
          disableTransitionOnChange
        >
          <Suspense fallback={null}>
            <ThemeSync />
          </Suspense>
          <ClientProviders
            initialPreferences={defaultPreferences}
            initialAppearance={initialAppearance}
          >
            {children}
          </ClientProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}

import type React from 'react';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { ThemeProvider } from './providers';
import { ThemeSync } from '@/components/theme-sync';

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
                  // Also update cookie and localStorage for consistency
                  document.cookie = 'davintrade-theme=' + t + '; path=/; max-age=31536000; SameSite=Lax';
                  localStorage.setItem('davintrade-theme', t);
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
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

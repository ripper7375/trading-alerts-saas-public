import type React from 'react';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import { Doto } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { ThemeSync } from '@/components/theme-sync';

const geistSans = Geist({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
});

const doto = Doto({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-doto',
});

export const metadata: Metadata = {
  title: 'v0 App',
  description: 'Created with v0',
  generator: 'v0.app',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${doto.variable}`}
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
      <body className="flex min-h-screen">
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

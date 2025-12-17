import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: 'Trading Alerts - Real-Time Trading Signals',
    template: '%s | Trading Alerts',
  },
  description:
    'Get real-time trading alerts for Gold (XAUUSD), Forex, Crypto, and Indices. Advanced fractal analysis with multiple timeframes.',
  keywords: [
    'trading alerts',
    'forex signals',
    'gold trading',
    'XAUUSD',
    'crypto alerts',
    'trading signals',
    'fractal analysis',
  ],
  authors: [{ name: 'Trading Alerts Team' }],
  creator: 'Trading Alerts',
  publisher: 'Trading Alerts',
  metadataBase: new URL(process.env['NEXTAUTH_URL'] || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Trading Alerts',
    title: 'Trading Alerts - Real-Time Trading Signals',
    description:
      'Get real-time trading alerts for Gold, Forex, Crypto, and Indices.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Trading Alerts - Real-Time Trading Signals',
    description:
      'Get real-time trading alerts for Gold, Forex, Crypto, and Indices.',
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
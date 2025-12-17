import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trading Alerts SaaS V7',
  description: 'Real-time trading alerts with fractal analysis',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

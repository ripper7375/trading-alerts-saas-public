'use client';

import dynamic from 'next/dynamic';

// Import the entire landing page as a single unit to preserve context
const LandingPage = dynamic(
  () => import('@davintrade/app/page').then((mod) => ({ default: mod.default })),
  { ssr: false }
);

export default function LandingPage() {
  return <LandingPage />;
}

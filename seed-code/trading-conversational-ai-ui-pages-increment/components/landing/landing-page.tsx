'use client';

import { LandingNavbar } from '@/components/landing/landing-navbar';
import { TickerTape } from '@/components/landing/ticker-tape';
import { LandingHero } from '@/components/landing/landing-hero';
import { LandingFeatures } from '@/components/landing/landing-features';
import { LandingTerminalPreview } from '@/components/landing/landing-terminal-preview';
import { LandingPricing } from '@/components/landing/landing-pricing';
import { LandingFooter } from '@/components/landing/landing-footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen w-full bg-[#06070a] font-sans text-slate-100 antialiased selection:bg-amber-500 selection:text-slate-950">
      <LandingNavbar />
      <TickerTape />
      <main>
        <LandingHero />
        <LandingFeatures />
        <LandingTerminalPreview />
        <LandingPricing />
      </main>
      <LandingFooter />
    </div>
  );
}

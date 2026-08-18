'use client';

import { LandingNavbar } from '@/components/landing/landing-navbar';
import { TickerTape } from '@/components/landing/ticker-tape';
import { LandingHero } from '@/components/landing/landing-hero';
import { LandingFeatures } from '@/components/landing/landing-features';
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
        <LandingPricing />
      </main>
      <LandingFooter />
    </div>
  );
}

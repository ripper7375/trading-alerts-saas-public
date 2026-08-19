'use client';

import { LandingNavbar } from '@/components/landing/landing-navbar';
import { TickerTape } from '@/components/landing/ticker-tape';
import { LandingHero } from '@/components/landing/landing-hero';
import { LandingFeatures } from '@/components/landing/landing-features';
import { LandingPricing } from '@/components/landing/landing-pricing';
import { LandingFooter } from '@/components/landing/landing-footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen w-full bg-slate-50 font-sans text-slate-900 antialiased selection:bg-amber-500 selection:text-slate-950 dark:bg-[#06070a] dark:text-slate-100">
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

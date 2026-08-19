'use client';

import TierComparison from '@/components/pricing/tier-comparison';
import { MarketingNavbar } from '@/components/marketing/marketing-navbar';
import { MarketingFooter } from '@/components/marketing/marketing-footer';

export function PricingContent() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 select-none dark:bg-[#050609] dark:text-slate-100">
      <MarketingNavbar />
      <main className="container mx-auto w-full max-w-7xl flex-1 px-4 py-16 md:px-6">
        <TierComparison />
      </main>
      <MarketingFooter />
    </div>
  );
}

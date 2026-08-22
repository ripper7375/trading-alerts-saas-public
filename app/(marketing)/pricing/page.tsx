'use client';

import { TierComparison } from '@/components/pricing/tier-comparison';

export default function PricingPage() {
  return (
    <div className="select-none bg-slate-50 text-slate-900 dark:bg-[#050609] dark:text-slate-100">
      <div className="container mx-auto w-full max-w-7xl px-4 py-16 md:px-6">
        <TierComparison />
      </div>
    </div>
  );
}

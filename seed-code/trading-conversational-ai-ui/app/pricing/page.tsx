'use client';

import AppHeader from '@/components/layout/app-header';
import TierComparison from '@/components/pricing/tier-comparison';

export default function PricingPage() {
  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#06070a] select-none">
      <AppHeader
        title="Tier Pricing & Plans"
        subtitle="Compare FREE vs PRO Tier Capabilities"
      />
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
        <TierComparison />
      </main>
    </div>
  );
}

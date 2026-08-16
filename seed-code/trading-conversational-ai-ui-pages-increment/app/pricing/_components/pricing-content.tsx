'use client';

import AppHeader from '@/components/layout/app-header';
import TierComparison from '@/components/pricing/tier-comparison';
import { useLocale } from '@/lib/context/locale-context';

export function PricingContent() {
  const { t } = useLocale();

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#06070a] select-none">
      <AppHeader
        title={t('Tier Pricing & Plans')}
        subtitle={t('Compare FREE vs PRO Tier Capabilities')}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
        <TierComparison />
      </main>
    </div>
  );
}

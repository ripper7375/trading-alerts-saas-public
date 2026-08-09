'use client';

import AppHeader from '@/components/layout/app-header';
import SubscriptionCard from '@/components/billing/subscription-card';
import { useLocale } from '@/lib/context/locale-context';

export default function BillingSettingsPage() {
  const { t } = useLocale();

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#06070a] select-none">
      <AppHeader
        title={t('nav.billing', 'การชำระเงินและใบเสร็จ')}
        subtitle={t(
          'Manage PRO Subscription, Invoices & Payment Methods',
          'จัดการการสมัครสมาชิก PRO ใบเสร็จ และวิธีการชำระเงิน'
        )}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
        <SubscriptionCard />
      </main>
    </div>
  );
}

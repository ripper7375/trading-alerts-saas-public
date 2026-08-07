'use client';

import AppHeader from '@/components/layout/app-header';
import SubscriptionCard from '@/components/billing/subscription-card';

export default function BillingSettingsPage() {
  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#06070a] select-none">
      <AppHeader
        title="Billing & Subscription Management"
        subtitle="Manage PRO Subscription, Invoices & Payment Methods"
      />
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
        <SubscriptionCard />
      </main>
    </div>
  );
}

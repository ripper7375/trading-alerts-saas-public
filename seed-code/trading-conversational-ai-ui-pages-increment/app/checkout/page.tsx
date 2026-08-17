'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import CheckoutForm from '@/components/payments/checkout-form';
import { useLocale } from '@/lib/context/locale-context';

export default function CheckoutPage() {
  const { t } = useLocale();

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#06070a] select-none">
      <AppHeader
        title={t('Secure Subscription Checkout')}
        subtitle={t('Upgrade to DavinTrade PRO Tier Annual / Monthly Plan')}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
        <Link
          href="/pricing"
          className="mb-4 inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-amber-400"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('Back to Pricing')}
        </Link>
        <CheckoutForm />
      </main>
    </div>
  );
}

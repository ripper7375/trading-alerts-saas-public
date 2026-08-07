'use client';

import AppHeader from '@/components/layout/app-header';
import CheckoutForm from '@/components/payments/checkout-form';

export default function CheckoutPage() {
  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#06070a] select-none">
      <AppHeader
        title="Secure Checkout"
        subtitle="Activate DavinTrade PRO Subscription"
      />
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
        <CheckoutForm />
      </main>
    </div>
  );
}

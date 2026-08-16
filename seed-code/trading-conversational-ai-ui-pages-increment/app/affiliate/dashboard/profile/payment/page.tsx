'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  Landmark,
  ShieldCheck,
  Save,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Building,
} from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import { AffiliateNav } from '@/components/affiliate/affiliate-nav';
import WiseRecipientForm from '@/components/affiliate/wise-recipient-form';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/lib/context/locale-context';

export default function AffiliateProfilePaymentPage() {
  const { t } = useLocale();

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#06070a] text-slate-100 select-none">
      <AppHeader
        title={t('Affiliate Payout & Banking Setup')}
        subtitle={t(
          'Connect Your Wise Recipient or RiseWorks Account for Automated Payouts'
        )}
      />

      <AffiliateNav />

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <Link
            href="/affiliate/dashboard/profile"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-400"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t('Back to Partner Profile')}</span>
          </Link>
        </div>

        {/* Wise Recipient Form Component */}
        <WiseRecipientForm />
      </main>
    </div>
  );
}

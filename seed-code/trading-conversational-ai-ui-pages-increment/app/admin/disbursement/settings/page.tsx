'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import WiseRecipientForm from '@/components/affiliate/wise-recipient-form';
import { useLocale } from '@/lib/context/locale-context';

export default function AdminDisbursementSettingsPage() {
  const { t } = useLocale();
  const [revalidating, setRevalidating] = useState(false);
  const [lastVerified, setLastVerified] = useState('2026-08-01');

  const handleRevalidate = () => {
    setRevalidating(true);
    setTimeout(() => {
      setRevalidating(false);
      setLastVerified(new Date().toISOString().slice(0, 10));
    }, 800);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Verification Status */}
      <Card className="flex flex-wrap items-center justify-between gap-4 border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-[#090c14]/90">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {t('Current Payout Account')}
              </h3>
              <Badge className="border-emerald-500/40 bg-emerald-500/15 text-[10px] text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                {t('ACTIVE')}
              </Badge>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {t('Wise Recipient')} •••• 4912 · USD · {t('Last verified')}{' '}
              {lastVerified}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRevalidate}
            disabled={revalidating}
            className="dark:border-slate-750 border-slate-300 bg-slate-50 text-xs text-slate-700 hover:bg-slate-100 dark:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RefreshCw
              className={`mr-1.5 h-3.5 w-3.5 ${revalidating ? 'animate-spin' : ''}`}
            />
            {revalidating ? t('Re-verifying…') : t('Re-verify with provider')}
          </Button>

          <Link href="/admin/disbursement/transactions">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="dark:border-slate-750 border-slate-300 bg-slate-50 text-xs text-slate-700 hover:bg-slate-100 dark:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {t('View Payout History')}
            </Button>
          </Link>
        </div>
      </Card>

      {/* Main Payout Account Configuration */}
      <WiseRecipientForm />
    </div>
  );
}

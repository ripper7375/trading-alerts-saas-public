'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, RefreshCw } from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import { AffiliateNav } from '@/components/affiliate/affiliate-nav';
import WiseRecipientForm from '@/components/affiliate/wise-recipient-form';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/lib/context/locale-context';

export default function AffiliatePayoutPage() {
  const { t } = useLocale();
  const [revalidating, setRevalidating] = useState(false);
  const [lastVerified, setLastVerified] = useState('2026-08-01');

  const handleRevalidate = () => {
    setRevalidating(true);
    setTimeout(() => {
      setRevalidating(false);
      setLastVerified(new Date().toISOString().slice(0, 10));
    }, 900);
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#06070a] select-none">
      <AppHeader
        title={t('Partner Payout Setup')}
        subtitle={t(
          'Wise Business Bank Account & RiseWorks Crypto Payout Configuration'
        )}
      />

      <AffiliateNav />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        <Card className="flex flex-wrap items-center justify-between gap-4 border-slate-800/80 bg-[#090b14]/90 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100">
                  {t('Current Payout Account')}
                </h3>
                <Badge className="border-emerald-500/40 bg-emerald-500/20 text-[10px] text-emerald-400">
                  {t('ACTIVE')}
                </Badge>
              </div>
              <p className="text-xs text-slate-400">
                Wise Recipient •••• 4912 · USD · {t('Last verified')}{' '}
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
              className="border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
            >
              <RefreshCw
                className={`mr-1.5 h-3.5 w-3.5 ${revalidating ? 'animate-spin' : ''}`}
              />
              {revalidating ? t('Re-verifying…') : t('Re-verify with provider')}
            </Button>
            <Link href="/affiliate/dashboard/payouts">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
              >
                {t('View Payout History')}
              </Button>
            </Link>
          </div>
        </Card>

        <WiseRecipientForm />
      </main>
    </div>
  );
}

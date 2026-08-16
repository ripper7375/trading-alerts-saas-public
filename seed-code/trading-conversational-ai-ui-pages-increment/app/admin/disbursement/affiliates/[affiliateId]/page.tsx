'use client';

import React, { use, useState } from 'react';
import Link from 'next/link';
import {
  Landmark,
  ArrowLeft,
  DollarSign,
  ShieldCheck,
  Send,
  CheckCircle2,
  AlertTriangle,
  History,
} from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import { AdminNav } from '@/components/admin/admin-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/lib/context/locale-context';

interface AdminDisbursementAffiliateDetailProps {
  params: Promise<{ affiliateId: string }>;
}

export default function AdminDisbursementAffiliateDetailPage({
  params,
}: AdminDisbursementAffiliateDetailProps) {
  const resolvedParams = use(params);
  const affiliateId = resolvedParams.affiliateId;
  const { t } = useLocale();

  const [isSending, setIsSending] = useState(false);
  const [success, setSuccess] = useState('');

  const handleTriggerIndividualPayout = () => {
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setSuccess(t('Individual Wise transfer dispatched successfully.'));
      setTimeout(() => setSuccess(''), 4000);
    }, 800);
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
      <AppHeader
        title={t('Admin Disbursement: Affiliate Payout Details')}
        subtitle={t(`Configuring Payout Target for Partner ID: ${affiliateId}`)}
      />

      <AdminNav />

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <Link
            href="/admin/disbursement/affiliates"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-400"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t('Back to Disbursement Affiliates')}</span>
          </Link>

          <Button
            onClick={handleTriggerIndividualPayout}
            disabled={isSending}
            className="bg-amber-500 font-bold text-slate-950 hover:bg-amber-400"
          >
            <Send className="mr-1.5 h-4 w-4" />
            {isSending
              ? t('Sending...')
              : t('Disburse Accrued Balance ($617.40)')}
          </Button>
        </div>

        {success && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3.5 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <Card className="space-y-6 border-slate-800/80 bg-[#090b14]/90 p-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-100">
                Alex Morgan
              </h3>
              <p className="text-xs text-slate-400">
                alex.trader@gmail.com • Partner ID: {affiliateId}
              </p>
            </div>
            <Badge className="border-emerald-500/40 bg-emerald-500/20 text-[10px] text-emerald-400">
              Ready for Payout
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1 rounded-xl border border-slate-800 bg-[#06080e] p-4">
              <div className="text-xs text-slate-400">
                {t('Wise Recipient ID')}
              </div>
              <div className="font-mono text-sm font-bold text-slate-200">
                wise_recp_98421098
              </div>
              <div className="text-[11px] text-slate-500">
                Bank: Bangkok Bank PLC (USD Account)
              </div>
            </div>

            <div className="space-y-1 rounded-xl border border-slate-800 bg-[#06080e] p-4">
              <div className="text-xs text-slate-400">
                {t('Accrued Unpaid Commissions')}
              </div>
              <div className="font-mono text-2xl font-extrabold text-emerald-400">
                $617.40
              </div>
              <div className="text-[11px] text-slate-500">
                Minimum threshold: $50.00 (Exceeded)
              </div>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}

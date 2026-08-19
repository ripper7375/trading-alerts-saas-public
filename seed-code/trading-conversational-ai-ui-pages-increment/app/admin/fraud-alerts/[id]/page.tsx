'use client';

import React, { use, useState } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  ArrowLeft,
  Ban,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Laptop,
  Users,
  CreditCard,
  History,
} from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import { AdminNav } from '@/components/admin/admin-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/lib/context/locale-context';

interface AdminFraudAlertDetailProps {
  params: Promise<{ id: string }>;
}

export default function AdminFraudAlertDetailPage({
  params,
}: AdminFraudAlertDetailProps) {
  const resolvedParams = use(params);
  const alertId = resolvedParams.id;
  const { t } = useLocale();

  const [status, setStatus] = useState<
    'ACTIVE_INVESTIGATION' | 'FROZEN' | 'DISMISSED'
  >('ACTIVE_INVESTIGATION');
  const [success, setSuccess] = useState('');

  const statusLabel: Record<
    'ACTIVE_INVESTIGATION' | 'FROZEN' | 'DISMISSED',
    string
  > = {
    ACTIVE_INVESTIGATION: t('Active Investigation'),
    FROZEN: t('Frozen'),
    DISMISSED: t('Dismissed'),
  };

  const handleFreeze = () => {
    setStatus('FROZEN');
    setSuccess(t('Affiliate account and pending payouts have been frozen.'));
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleDismiss = () => {
    setStatus('DISMISSED');
    setSuccess(t('Fraud alert dismissed as false positive.'));
    setTimeout(() => setSuccess(''), 3000);
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-slate-50 text-slate-900 select-none dark:bg-[#050609] dark:text-slate-100">
      <AppHeader
        title={t('Admin Fraud & Abuse Incident Review')}
        subtitle={`${t('Investigating Incident Alert ID:')} ${alertId}`}
      />

      <AdminNav />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <Link
            href="/admin/fraud-alerts"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t('Back to Fraud Alerts')}</span>
          </Link>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDismiss}
              className="border-slate-300 bg-white text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-[#090b14] dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              {t('Dismiss Alert')}
            </Button>
            <Button
              size="sm"
              onClick={handleFreeze}
              className="bg-rose-500 font-bold text-slate-950 hover:bg-rose-400"
            >
              <Ban className="mr-1.5 h-3.5 w-3.5" />
              {t('Freeze Affiliate Account')}
            </Button>
          </div>
        </div>

        {success && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Incident Summary */}
        <Card className="space-y-5 border-rose-500/30 bg-gradient-to-r from-rose-50 via-white to-slate-50 p-6 shadow-sm dark:border-rose-500/40 dark:from-rose-950/30 dark:via-[#0d0f1c] dark:to-[#090b14]">
          <div className="flex items-center justify-between border-b border-rose-200 pb-4 dark:border-rose-500/20">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/20 dark:text-rose-400">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-rose-900 dark:text-rose-200">
                  {t('Self-Referral & Fingerprint Collision Detected')}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {t('Risk Severity:')}{' '}
                  <strong className="text-rose-600 dark:text-rose-400">
                    {t('CRITICAL (Risk Score 94/100)')}
                  </strong>
                </p>
              </div>
            </div>

            <Badge
              className={
                status === 'FROZEN'
                  ? 'bg-rose-500 text-[10px] font-bold text-slate-950'
                  : status === 'DISMISSED'
                    ? 'bg-emerald-500 text-[10px] font-bold text-slate-950'
                    : 'bg-amber-500 text-[10px] font-bold text-slate-950'
              }
            >
              {statusLabel[status]}
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-3">
            <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-[#06080e]">
              <span className="text-slate-600 dark:text-slate-400">
                {t('Suspect Affiliate')}
              </span>
              <div className="font-bold text-slate-900 dark:text-slate-200">
                Elena Rostova (aff-103)
              </div>
              <div className="font-mono text-[11px] text-amber-700 dark:text-amber-400">
                {t('Code:')} SUMMERTRADER
              </div>
            </div>

            <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-[#06080e]">
              <span className="text-slate-600 dark:text-slate-400">
                {t('Colliding User Accounts')}
              </span>
              <div className="font-bold text-rose-700 dark:text-rose-300">
                usr_481 & usr_912
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400">
                {t('Same Credit Card Fingerprint')}
              </div>
            </div>

            <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-[#06080e]">
              <span className="text-slate-600 dark:text-slate-400">
                {t('Telemetry Anomaly')}
              </span>
              <div className="font-bold text-slate-900 dark:text-slate-200">
                {t('Shared IP')} 185.220.101.5
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400">
                {t('TOR Exit Node / Datacenter ASN')}
              </div>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}

'use client';

import AppHeader from '@/components/layout/app-header';
import { AdminNav } from '@/components/admin/admin-nav';
import AdminStats from '@/components/admin/admin-stats';
import UserTable from '@/components/admin/user-table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ShieldAlert, AlertTriangle, ArrowRight } from 'lucide-react';
import { useLocale } from '@/lib/context/locale-context';

export default function AdminDashboardPage() {
  const { t } = useLocale();

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-slate-50 text-slate-900 select-none dark:bg-[#050609] dark:text-slate-100">
      <AppHeader
        title={t('Admin Platform Control')}
        subtitle={t(
          'Master System Telemetry, Fraud Warnings & Batch Disbursements'
        )}
      />

      <AdminNav />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between rounded-2xl border border-rose-500/30 bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-slate-100 p-4 shadow-sm dark:from-rose-950/40 dark:via-[#0d0f1a] dark:to-[#090b14]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-500/40 bg-rose-500/15 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                {t('Master Admin Operational Terminal')}
              </h2>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                {t(
                  'Wise & Rise Batch Payout Execution + Fraud Anomaly Detection'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/admin/disbursement">
              <Button
                size="sm"
                className="h-8 bg-rose-600 text-xs font-bold text-white hover:bg-rose-500"
              >
                {t('Batch Disbursements')}
              </Button>
            </Link>
          </div>
        </div>

        <AdminStats />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <UserTable />
          </div>

          <div className="space-y-4">
            <Card className="border-rose-500/30 bg-white text-slate-900 shadow-xl dark:bg-[#090c14] dark:text-slate-100">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 dark:border-slate-800">
                  <h3 className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
                    <AlertTriangle className="h-4 w-4" />{' '}
                    {t('Fraud & Anomaly Alerts')}
                  </h3>
                  <Badge className="border-rose-500/40 bg-rose-500/15 font-mono text-[9px] text-rose-700 dark:text-rose-300">
                    {t('3 Flagged')}
                  </Badge>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="space-y-1 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5">
                    <div className="flex justify-between font-bold text-rose-700 dark:text-rose-300">
                      <span>{t('IP Velocity Violation')}</span>
                      <span className="font-mono text-[10px]">
                        {t('Score 92/100')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      {t(
                        'User free-test@... created 15 accounts from same IP subnet.'
                      )}
                    </p>
                  </div>
                </div>

                <Link href="/admin/fraud-alerts">
                  <Button
                    variant="outline"
                    className="mt-2 h-8 w-full justify-between border-rose-500/30 bg-rose-50 text-xs text-rose-700 hover:bg-rose-100 dark:bg-rose-500/5 dark:text-rose-300 dark:hover:bg-rose-500/15"
                  >
                    <span>{t('Inspect Fraud Detection Center')}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

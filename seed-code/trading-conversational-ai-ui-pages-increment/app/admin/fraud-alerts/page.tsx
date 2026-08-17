'use client';

import { useState } from 'react';
import Link from 'next/link';
import AppHeader from '@/components/layout/app-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Ban,
  ChevronRight,
} from 'lucide-react';
import { useLocale } from '@/lib/context/locale-context';

type FraudItemStatus = 'ACTION_REQUIRED' | 'BLOCKED' | 'DISMISSED';

export default function FraudAlertsPage() {
  const { t } = useLocale();

  const [fraudItems, setFraudItems] = useState([
    {
      id: 'FRAUD-101',
      pattern: t('IP Multi-Account Velocity'),
      riskScore: 92,
      user: 'free-test@trading-alerts.test',
      ip: '198.51.100.42',
      details: t(
        '15 trial accounts created in 5 minutes using temporary email domains.'
      ),
      status: 'ACTION_REQUIRED' as FraudItemStatus,
    },
    {
      id: 'FRAUD-102',
      pattern: t('Affiliate Self-Referral'),
      riskScore: 84,
      user: 'affiliate-test@trading-alerts.test',
      ip: '203.0.113.19',
      details: t(
        'Commission code used by account sharing identical payout bank details.'
      ),
      status: 'ACTION_REQUIRED' as FraudItemStatus,
    },
  ]);

  const setItemStatus = (id: string, status: FraudItemStatus) => {
    setFraudItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status } : item))
    );
  };

  const statusLabel: Record<FraudItemStatus, string> = {
    ACTION_REQUIRED: t('Action Required'),
    BLOCKED: t('Blocked'),
    DISMISSED: t('Dismissed'),
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] select-none">
      <AppHeader
        title={t('Fraud Detection & Risk Inspection')}
        subtitle={t(
          'Anomalous IP Login Patterns & Affiliate Code Abuse Monitoring'
        )}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 p-4 md:p-6">
        <div className="space-y-4 rounded-2xl border border-rose-500/40 bg-[#090c14] p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-rose-500/30 pb-3">
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-rose-400">
              <ShieldAlert className="h-5 w-5" />{' '}
              {t('Flagged Security Anomalies')} ({fraudItems.length})
            </h2>
            <Badge className="border-rose-500/40 bg-rose-500/15 font-mono text-[9px] text-rose-300">
              {t('HIGH PRIORITY')}
            </Badge>
          </div>

          <div className="divide-y divide-slate-800/60">
            {fraudItems.map((item) => (
              <div key={item.id} className="space-y-2 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-100">
                      {item.id}
                    </span>
                    <Badge
                      variant="outline"
                      className="border-rose-500/40 bg-rose-500/10 font-mono text-[9px] text-rose-300"
                    >
                      {t('Risk Score:')} {item.riskScore}
                      /100
                    </Badge>
                    <span className="text-xs font-bold text-slate-200">
                      {item.pattern}
                    </span>
                  </div>
                  <Badge
                    className={
                      item.status === 'BLOCKED'
                        ? 'border-rose-500/40 bg-rose-500/15 font-mono text-[9px] text-rose-300'
                        : item.status === 'DISMISSED'
                          ? 'border-emerald-500/40 bg-emerald-500/15 font-mono text-[9px] text-emerald-300'
                          : 'border-amber-500/40 bg-amber-500/10 font-mono text-[9px] text-amber-300'
                    }
                  >
                    {statusLabel[item.status]}
                  </Badge>
                </div>

                <p className="text-xs text-slate-300">{item.details}</p>
                <div className="font-mono text-[11px] text-slate-400">
                  {t('User:')} {item.user} • {t('Target IP:')} {item.ip}
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    size="sm"
                    disabled={item.status !== 'ACTION_REQUIRED'}
                    onClick={() => setItemStatus(item.id, 'BLOCKED')}
                    className="h-7 bg-rose-600 text-[10px] font-bold text-white hover:bg-rose-500 disabled:opacity-40"
                  >
                    <Ban className="mr-1 h-3 w-3" />{' '}
                    {t('Suspend Account & Block IP')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={item.status !== 'ACTION_REQUIRED'}
                    onClick={() => setItemStatus(item.id, 'DISMISSED')}
                    className="border-slate-750 h-7 text-[10px] text-slate-300 disabled:opacity-40"
                  >
                    {t('Dismiss as False Positive')}
                  </Button>
                  <Link href={`/admin/fraud-alerts/${item.id}`}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 border-amber-500/30 bg-amber-500/5 text-[10px] text-amber-300 hover:bg-amber-500/15"
                    >
                      {t('View & Investigate')}
                      <ChevronRight className="ml-1 h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

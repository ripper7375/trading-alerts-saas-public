'use client';

import AppHeader from '@/components/layout/app-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldAlert, AlertTriangle, CheckCircle2, Ban } from 'lucide-react';

export default function FraudAlertsPage() {
  const fraudItems = [
    {
      id: 'FRAUD-101',
      pattern: 'IP Multi-Account Velocity',
      riskScore: 92,
      user: 'free-test@trading-alerts.test',
      ip: '198.51.100.42',
      details:
        '15 trial accounts created in 5 minutes using temporary email domains.',
      status: 'Action Required',
    },
    {
      id: 'FRAUD-102',
      pattern: 'Affiliate Self-Referral',
      riskScore: 84,
      user: 'affiliate-test@trading-alerts.test',
      ip: '203.0.113.19',
      details:
        'Commission code used by account sharing identical payout bank details.',
      status: 'Action Required',
    },
  ];

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] select-none">
      <AppHeader
        title="Fraud Detection & Risk Inspection"
        subtitle="Anomalous IP Login Patterns & Affiliate Code Abuse Monitoring"
      />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 p-4 md:p-6">
        <div className="space-y-4 rounded-2xl border border-rose-500/40 bg-[#090c14] p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-rose-500/30 pb-3">
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-rose-400">
              <ShieldAlert className="h-5 w-5" /> Flagged Security Anomalies (
              {fraudItems.length})
            </h2>
            <Badge className="border-rose-500/40 bg-rose-500/15 font-mono text-[9px] text-rose-300">
              HIGH PRIORITY
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
                      Risk Score: {item.riskScore}/100
                    </Badge>
                    <span className="text-xs font-bold text-slate-200">
                      {item.pattern}
                    </span>
                  </div>
                  <Badge className="border-amber-500/40 bg-amber-500/10 font-mono text-[9px] text-amber-300">
                    {item.status}
                  </Badge>
                </div>

                <p className="text-xs text-slate-300">{item.details}</p>
                <div className="font-mono text-[11px] text-slate-400">
                  User: {item.user} • Target IP: {item.ip}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    className="h-7 bg-rose-600 text-[10px] font-bold text-white hover:bg-rose-500"
                  >
                    <Ban className="mr-1 h-3 w-3" /> Suspend Account & Block IP
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-750 h-7 text-[10px] text-slate-300"
                  >
                    Dismiss as False Positive
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

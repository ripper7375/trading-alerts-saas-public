'use client';

import Link from 'next/link';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/lib/context/locale-context';

export default function SubscriptionCard() {
  const { t, formatCurrency, formatDate } = useLocale();

  const invoices = [
    {
      id: 'INV-2026-008',
      date: formatDate('2026-08-01'),
      amount: formatCurrency(49),
      status: t('Paid', 'ชำระแล้ว'),
      method: t('Visa ending in 8892', 'Visa ลงท้ายด้วย 8892'),
    },
    {
      id: 'INV-2026-007',
      date: formatDate('2026-07-01'),
      amount: formatCurrency(49),
      status: t('Paid', 'ชำระแล้ว'),
      method: t('Visa ending in 8892', 'Visa ลงท้ายด้วย 8892'),
    },
    {
      id: 'INV-2026-006',
      date: formatDate('2026-06-01'),
      amount: formatCurrency(49),
      status: t('Paid', 'ชำระแล้ว'),
      method: t('Visa ending in 8892', 'Visa ลงท้ายด้วย 8892'),
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 select-none">
      {/* Active Subscription Box */}
      <div className="space-y-4 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-[#0c0f18] via-[#121624] to-[#0d0f17] p-6 shadow-xl">
        <div className="flex flex-col items-start justify-between gap-4 border-b border-amber-500/30 pb-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="border-amber-500/50 bg-amber-500/20 font-mono text-[10px] text-amber-300">
                ⚡ {t('PRO PLAN ACTIVE', 'แพ็กเกจ PRO เปิดใช้งานอยู่')}
              </Badge>
              <span className="font-mono text-[11px] text-slate-400">
                {t('Renews', 'ต่ออายุวันที่')} {formatDate('2026-09-01')}
              </span>
            </div>
            <h2 className="mt-1 text-lg font-extrabold text-slate-100">
              {t(
                'DavinTrade PRO Tier Subscription',
                'การสมัครสมาชิก DavinTrade PRO'
              )}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/pricing">
              <Button
                variant="outline"
                className="h-8 border-amber-500/40 bg-amber-500/10 text-xs text-amber-300 hover:bg-amber-500/20"
              >
                {t('Change Plan', 'เปลี่ยนแผนการใช้งาน')}
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-[#06080e] p-3">
            <span className="text-[10px] text-slate-400">
              {t('Current Billing Rate', 'อัตราค่าบริการปัจจุบัน')}
            </span>
            <div className="font-mono text-base font-extrabold text-amber-300">
              {formatCurrency(49)} / {t('mo', 'เดือน')}
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#06080e] p-3">
            <span className="text-[10px] text-slate-400">
              {t('Alert Rule Allocation', 'โควต้ากฎการแจ้งเตือน')}
            </span>
            <div className="font-mono text-base font-extrabold text-slate-100">
              100 {t('Max Rules', 'กฎสูงสุด')}
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#06080e] p-3">
            <span className="text-[10px] text-slate-400">
              {t('Monthly AI Token Quota', 'โควต้าโทเค็นประจำเดือน')}
            </span>
            <div className="font-mono text-base font-extrabold text-slate-100">
              500,000 {t('Tokens', 'โทเค็น')}
            </div>
          </div>
        </div>
      </div>

      {/* Invoice History Table */}
      <div className="space-y-3 overflow-hidden rounded-2xl border border-slate-800 bg-[#090c14] p-4 shadow-xl">
        <h3 className="flex items-center justify-between text-xs font-bold tracking-wider text-slate-200 uppercase">
          <span>
            {t('Billing & Payment History', 'ประวัติการชำระเงินและใบเสร็จ')}
          </span>
          <span className="font-mono text-[10px] text-slate-400">
            3 {t('Invoices', 'ใบเสร็จ')}
          </span>
        </h3>

        <div className="divide-y divide-slate-800/60">
          {invoices.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between py-3 text-xs"
            >
              <div className="space-y-0.5">
                <div className="font-mono font-bold text-slate-200">
                  {inv.id}
                </div>
                <div className="text-[10px] text-slate-400">
                  {inv.date} • {inv.method}
                </div>
              </div>

              <div className="flex items-center gap-4 text-right">
                <span className="font-mono font-bold text-slate-100">
                  {inv.amount}
                </span>
                <Badge className="border-emerald-500/40 bg-emerald-500/15 font-mono text-[9px] text-emerald-400">
                  {inv.status}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-400 hover:text-slate-100"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

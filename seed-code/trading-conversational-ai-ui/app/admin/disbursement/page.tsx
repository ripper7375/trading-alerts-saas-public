'use client';

import { useState } from 'react';
import AppHeader from '@/components/layout/app-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DollarSign,
  CheckCircle2,
  RefreshCw,
  Send,
  ArrowRight,
} from 'lucide-react';
import { useLocale } from '@/lib/context/locale-context';

export default function AdminDisbursementPage() {
  const { t, formatCurrency } = useLocale();
  const [isExecuting, setIsExecuting] = useState(false);
  const [batches, setBatches] = useState([
    {
      id: 'BATCH-2026-08A',
      provider: 'Wise Business',
      totalAmount: 14250.0,
      recipientsCount: 18,
      status: t('Ready for Payout', 'พร้อมสำหรับการสั่งจ่าย'),
    },
    {
      id: 'BATCH-2026-07B',
      provider: 'RiseWorks Crypto',
      totalAmount: 8400.0,
      recipientsCount: 9,
      status: t('Executed', 'ดำเนินการจ่ายแล้ว'),
      date: 'Jul 31, 2026',
    },
  ]);

  const handleExecuteBatch = (id: string) => {
    setIsExecuting(true);
    setTimeout(() => {
      setIsExecuting(false);
      setBatches((prev) =>
        prev.map((b) =>
          b.id === id
            ? {
                ...b,
                status: t('Executed', 'ดำเนินการจ่ายแล้ว'),
                date: 'Today',
              }
            : b
        )
      );
    }, 1200);
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] select-none">
      <AppHeader
        title={t(
          'Wise & Rise Payout Disbursement',
          'การจ่ายเงินค่าคอมมิชชัน Wise & Rise'
        )}
        subtitle={t(
          'Automated Batch Commission Payout Execution & Audit Logs',
          'การสั่งจ่ายเงินแบบแบทช์อัตโนมัติและบันทึกประวัติการตรวจสอบ'
        )}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 p-4 md:p-6">
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-[#090c14] p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-100">
                <DollarSign className="h-4 w-4 text-emerald-400" />{' '}
                {t(
                  'Affiliate Commission Payout Batches',
                  'ชุดแบทช์การจ่ายเงินค่าคอมมิชชันพันธมิตร'
                )}
              </h2>
              <p className="text-[11px] text-slate-400">
                {t(
                  'Review aggregated monthly referral commissions before execution',
                  'ตรวจสอบค่าคอมมิชชันการแนะนำประจำเดือนที่รวบรวมไว้ก่อนดำเนินการจ่ายเงิน'
                )}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-slate-750 h-8 text-xs text-slate-300"
            >
              <RefreshCw className="mr-1 h-3.5 w-3.5" />{' '}
              {t('Sync Wise/Rise Balances', 'ซิงค์ยอดคงเหลือ Wise/Rise')}
            </Button>
          </div>

          <div className="divide-y divide-slate-800/60">
            {batches.map((batch) => (
              <div
                key={batch.id}
                className="flex flex-col items-start justify-between gap-3 py-4 text-xs sm:flex-row sm:items-center"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-100">
                      {batch.id}
                    </span>
                    <Badge className="border-emerald-500/40 bg-emerald-500/15 font-mono text-[9px] text-emerald-300">
                      {batch.provider}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {batch.recipientsCount}{' '}
                    {t('Eligible Affiliates', 'พันธมิตรที่มีสิทธิ์')} •{' '}
                    {t('Total Payout:', 'ยอดจ่ายรวม:')}{' '}
                    <strong className="font-mono text-amber-300">
                      {formatCurrency(batch.totalAmount)}
                    </strong>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge
                    className={
                      batch.status === t('Executed', 'ดำเนินการจ่ายแล้ว')
                        ? 'border-emerald-500/40 bg-emerald-500/15 font-mono text-[9px] text-emerald-300'
                        : 'border-amber-500/40 bg-amber-500/10 font-mono text-[9px] text-amber-300'
                    }
                  >
                    {batch.status}
                  </Badge>

                  {batch.status !== t('Executed', 'ดำเนินการจ่ายแล้ว') && (
                    <Button
                      size="sm"
                      disabled={isExecuting}
                      onClick={() => handleExecuteBatch(batch.id)}
                      className="h-8 bg-gradient-to-r from-emerald-500 to-emerald-600 text-xs font-extrabold text-slate-950 hover:from-emerald-400 hover:to-emerald-500"
                    >
                      <Send className="mr-1 h-3.5 w-3.5" />
                      {isExecuting
                        ? t('Executing...', 'กำลังดำเนินการ...')
                        : t(
                            'Execute Batch Payout',
                            'ดำเนินการจ่ายเงินแบบแบทช์'
                          )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

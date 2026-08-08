'use client';

import AppHeader from '@/components/layout/app-header';
import AffiliateStats from '@/components/affiliate/affiliate-stats';
import CodeTable from '@/components/affiliate/code-table';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Share2, Landmark } from 'lucide-react';
import { useLocale } from '@/lib/context/locale-context';

export default function AffiliateDashboardPage() {
  const { t } = useLocale();

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#06070a] select-none">
      <AppHeader
        title={t('Affiliate Partner Dashboard', 'แดชบอร์ดพันธมิตร')}
        subtitle={t(
          'Track Referral Commissions, Conversion Analytics & Wise/Rise Payouts',
          'ติดตามค่าคอมมิชชันการแนะนำ วิเคราะห์การเปลี่ยนเป็นสมาชิก & การจ่ายเงิน Wise/Rise'
        )}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between rounded-2xl border border-amber-500/30 bg-gradient-to-r from-[#0c0f18] via-[#121624] to-[#0d0f17] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-400">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-100">
                {t('DavinTrade Partner Program')}
              </h2>
              <p className="text-[11px] text-slate-400">
                {t('30% Monthly Recurring Share on all PRO Tier referrals')}
              </p>
            </div>
          </div>

          <Link href="/affiliate/settings/payout">
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-amber-500/40 bg-amber-500/10 text-xs text-amber-300 hover:bg-amber-500/20"
            >
              <Landmark className="mr-1 h-3.5 w-3.5" /> {t('Payout Settings')}
            </Button>
          </Link>
        </div>

        <AffiliateStats />

        <CodeTable />
      </main>
    </div>
  );
}

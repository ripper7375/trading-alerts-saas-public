'use client';

import { DollarSign, Users, Link2, TrendingUp } from 'lucide-react';
import StatsCard from '@/components/dashboard/stats-card';
import { useLocale } from '@/lib/context/locale-context';

export default function AffiliateStats() {
  const { t, formatCurrency, formatDate, language } = useLocale();

  return (
    <div className="grid grid-cols-1 gap-4 select-none sm:grid-cols-2 lg:grid-cols-4">
      <StatsCard
        title={t('Total Commissions Earned')}
        value={formatCurrency(3840)}
        change={`+${formatCurrency(680)} ${t('this month')}`}
        changeType="positive"
        icon={DollarSign}
        description={t('30% Recurring Share')}
      />
      <StatsCard
        title={t('Total Active Referrals')}
        value={`48 ${t('Traders')}`}
        change={t('82% PRO Conversion')}
        changeType="positive"
        icon={Users}
        description={t('42 PRO / 6 FREE')}
      />
      <StatsCard
        title={t('Referral Link Clicks')}
        value={(1240).toLocaleString(language)}
        change={t('3.8% Conv Rate')}
        changeType="neutral"
        icon={Link2}
        description={t('Unique Visitor Clicks')}
      />
      <StatsCard
        title={t('Next Payout (Wise)')}
        value={formatCurrency(680)}
        change={formatDate('2026-08-31')}
        changeType="positive"
        icon={TrendingUp}
        description={t('Auto-Distributed Batch')}
      />
    </div>
  );
}

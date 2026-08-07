'use client';

import { DollarSign, Users, Link2, TrendingUp } from 'lucide-react';
import StatsCard from '@/components/dashboard/stats-card';

export default function AffiliateStats() {
  return (
    <div className="grid grid-cols-1 gap-4 select-none sm:grid-cols-2 lg:grid-cols-4">
      <StatsCard
        title="Total Commissions Earned"
        value="$3,840.00"
        change="+$680 this month"
        changeType="positive"
        icon={DollarSign}
        description="30% Recurring Share"
      />
      <StatsCard
        title="Total Active Referrals"
        value="48 Traders"
        change="82% PRO Conversion"
        changeType="positive"
        icon={Users}
        description="42 PRO / 6 FREE"
      />
      <StatsCard
        title="Referral Link Clicks"
        value="1,240"
        change="3.8% Conv Rate"
        changeType="neutral"
        icon={Link2}
        description="Unique Visitor Clicks"
      />
      <StatsCard
        title="Next Payout (Wise/Rise)"
        value="$680.00"
        change="Aug 31, 2026"
        changeType="positive"
        icon={TrendingUp}
        description="Auto-Distributed Batch"
      />
    </div>
  );
}

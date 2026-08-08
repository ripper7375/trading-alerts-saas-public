'use client';

import { Users, DollarSign, Bell, ShieldAlert } from 'lucide-react';
import StatsCard from '@/components/dashboard/stats-card';
import { useLocale } from '@/lib/context/locale-context';

export default function AdminStats() {
  const { t, formatCurrency } = useLocale();

  return (
    <div className="grid grid-cols-1 gap-4 select-none sm:grid-cols-2 lg:grid-cols-4">
      <StatsCard
        title={t('Total Platform Users')}
        value="4,850"
        change={t('+142 this week')}
        changeType="positive"
        icon={Users}
        description="PRO: 3,120 | FREE: 1,730"
      />
      <StatsCard
        title={t('Monthly Recurring Revenue')}
        value={formatCurrency(152880)}
        change="+12.4% MoM"
        changeType="positive"
        icon={DollarSign}
        description={t('Stripe & dLocal Aggregated')}
      />
      <StatsCard
        title={t('Active Server Alerts')}
        value="28,400"
        change="99.98% Up"
        changeType="positive"
        icon={Bell}
        description={t('Sub-10ms Trigger Evaluation')}
      />
      <StatsCard
        title={t('Pending Fraud Alerts')}
        value="3"
        change="High Risk"
        changeType="negative"
        icon={ShieldAlert}
        description={t('IP Anomaly & Code Abuse')}
      />
    </div>
  );
}

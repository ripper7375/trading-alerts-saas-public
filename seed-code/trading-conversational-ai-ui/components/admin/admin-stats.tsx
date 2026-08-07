'use client';

import { Users, DollarSign, Bell, ShieldAlert } from 'lucide-react';
import StatsCard from '@/components/dashboard/stats-card';

export default function AdminStats() {
  return (
    <div className="grid grid-cols-1 gap-4 select-none sm:grid-cols-2 lg:grid-cols-4">
      <StatsCard
        title="Total Platform Users"
        value="4,850"
        change="+142 this week"
        changeType="positive"
        icon={Users}
        description="PRO: 3,120 | FREE: 1,730"
      />
      <StatsCard
        title="Monthly Recurring Revenue"
        value="$152,880"
        change="+12.4% MoM"
        changeType="positive"
        icon={DollarSign}
        description="Stripe & dLocal Aggregated"
      />
      <StatsCard
        title="Active Server Alerts"
        value="28,400"
        change="99.98% Up"
        changeType="positive"
        icon={Bell}
        description="Sub-10ms Trigger Evaluation"
      />
      <StatsCard
        title="Pending Fraud Alerts"
        value="3"
        change="High Risk"
        changeType="negative"
        icon={ShieldAlert}
        description="IP Anomaly & Code Abuse"
      />
    </div>
  );
}

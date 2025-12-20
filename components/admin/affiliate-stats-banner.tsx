'use client';

/**
 * Affiliate Stats Banner Component
 *
 * Displays key affiliate program statistics in a banner format.
 *
 * @module components/admin/affiliate-stats-banner
 */

import { Card, CardContent } from '@/components/ui/card';

interface AffiliateStatsBannerProps {
  totalAffiliates: number;
  activeAffiliates: number;
  pendingAffiliates: number;
  totalCommissionsPaid: number;
  pendingCommissions: number;
  totalCodesDistributed: number;
  totalCodesUsed: number;
}

export function AffiliateStatsBanner({
  totalAffiliates,
  activeAffiliates,
  pendingAffiliates,
  totalCommissionsPaid,
  pendingCommissions,
  totalCodesDistributed,
  totalCodesUsed,
}: AffiliateStatsBannerProps) {
  const stats = [
    {
      label: 'Total Affiliates',
      value: totalAffiliates,
      subLabel: `${activeAffiliates} active, ${pendingAffiliates} pending`,
    },
    {
      label: 'Commissions Paid',
      value: `$${totalCommissionsPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      subLabel: `$${pendingCommissions.toLocaleString('en-US', { minimumFractionDigits: 2 })} pending`,
    },
    {
      label: 'Codes Distributed',
      value: totalCodesDistributed,
      subLabel: `${totalCodesUsed} used (${totalCodesDistributed > 0 ? Math.round((totalCodesUsed / totalCodesDistributed) * 100) : 0}%)`,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-6">
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{stat.subLabel}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

'use client';

/**
 * Sales Performance Table Component
 *
 * Table showing top affiliate performers by sales.
 *
 * @module components/admin/sales-performance-table
 */

import { Badge } from '@/components/ui/badge';

interface AffiliatePerformance {
  id: string;
  name: string;
  email: string;
  sales: number;
  conversionRate: number;
  commissionsEarned: number;
  rank: number;
}

interface SalesPerformanceTableProps {
  affiliates: AffiliatePerformance[];
}

export function SalesPerformanceTable({
  affiliates,
}: SalesPerformanceTableProps) {
  const formatCurrency = (value: number) =>
    `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getRankBadge = (rank: number) => {
    if (rank === 1)
      return <Badge className="bg-yellow-400 text-yellow-900">🥇 1st</Badge>;
    if (rank === 2)
      return <Badge className="bg-gray-300 text-gray-900">🥈 2nd</Badge>;
    if (rank === 3)
      return <Badge className="bg-orange-400 text-orange-900">🥉 3rd</Badge>;
    return <Badge variant="outline">#{rank}</Badge>;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Rank</th>
            <th className="px-4 py-3 text-left font-medium">Affiliate</th>
            <th className="px-4 py-3 text-right font-medium">Sales</th>
            <th className="px-4 py-3 text-right font-medium">
              Conversion Rate
            </th>
            <th className="px-4 py-3 text-right font-medium">Commissions</th>
          </tr>
        </thead>
        <tbody>
          {affiliates.map((affiliate) => (
            <tr key={affiliate.id} className="border-b hover:bg-muted/25">
              <td className="px-4 py-3">{getRankBadge(affiliate.rank)}</td>
              <td className="px-4 py-3">
                <div>
                  <div className="font-medium">{affiliate.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {affiliate.email}
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-right font-medium">
                {affiliate.sales}
              </td>
              <td className="px-4 py-3 text-right">
                <span
                  className={
                    affiliate.conversionRate >= 10 ? 'text-green-600' : ''
                  }
                >
                  {affiliate.conversionRate.toFixed(1)}%
                </span>
              </td>
              <td className="px-4 py-3 text-right font-medium">
                {formatCurrency(affiliate.commissionsEarned)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {affiliates.length === 0 && (
        <div className="py-8 text-center text-muted-foreground">
          No performance data available
        </div>
      )}
    </div>
  );
}

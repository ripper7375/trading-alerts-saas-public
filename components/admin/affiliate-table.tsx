'use client';

/**
 * Affiliate Table Component
 *
 * Reusable table for displaying affiliate data with sorting and actions.
 *
 * @module components/admin/affiliate-table
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Affiliate {
  id: string;
  fullName: string;
  email: string;
  status: 'ACTIVE' | 'PENDING_VERIFICATION' | 'SUSPENDED' | 'INACTIVE';
  country: string;
  totalEarnings: number;
  pendingCommissions: number;
  totalCodesDistributed: number;
  totalCodesUsed: number;
  createdAt: string;
}

interface AffiliateTableProps {
  affiliates: Affiliate[];
  onDistributeCodes?: (affiliateId: string) => void;
  onSuspend?: (affiliateId: string) => void;
  onPayCommission?: (affiliateId: string) => void;
  onViewDetails?: (affiliateId: string) => void;
}

const statusColors: Record<Affiliate['status'], string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  PENDING_VERIFICATION: 'bg-yellow-100 text-yellow-800',
  SUSPENDED: 'bg-red-100 text-red-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
};

export function AffiliateTable({
  affiliates,
  onDistributeCodes,
  onSuspend,
  onPayCommission,
  onViewDetails,
}: AffiliateTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Affiliate</th>
            <th className="px-4 py-3 text-left font-medium">Status</th>
            <th className="px-4 py-3 text-left font-medium">Country</th>
            <th className="px-4 py-3 text-right font-medium">Earnings</th>
            <th className="px-4 py-3 text-right font-medium">Pending</th>
            <th className="px-4 py-3 text-right font-medium">Codes Used</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {affiliates.map((affiliate) => (
            <tr key={affiliate.id} className="border-b hover:bg-muted/25">
              <td className="px-4 py-3">
                <div>
                  <div className="font-medium">{affiliate.fullName}</div>
                  <div className="text-xs text-muted-foreground">
                    {affiliate.email}
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <Badge
                  className={statusColors[affiliate.status]}
                  variant="secondary"
                >
                  {affiliate.status.replace('_', ' ')}
                </Badge>
              </td>
              <td className="px-4 py-3">{affiliate.country}</td>
              <td className="px-4 py-3 text-right">
                ${affiliate.totalEarnings.toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right">
                ${affiliate.pendingCommissions.toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right">
                {affiliate.totalCodesUsed}/{affiliate.totalCodesDistributed}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-1">
                  {onViewDetails && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onViewDetails(affiliate.id)}
                    >
                      View
                    </Button>
                  )}
                  {onDistributeCodes && affiliate.status === 'ACTIVE' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDistributeCodes(affiliate.id)}
                    >
                      +Codes
                    </Button>
                  )}
                  {onPayCommission && affiliate.pendingCommissions >= 50 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onPayCommission(affiliate.id)}
                    >
                      Pay
                    </Button>
                  )}
                  {onSuspend && affiliate.status === 'ACTIVE' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => onSuspend(affiliate.id)}
                    >
                      Suspend
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {affiliates.length === 0 && (
        <div className="py-8 text-center text-muted-foreground">
          No affiliates found
        </div>
      )}
    </div>
  );
}

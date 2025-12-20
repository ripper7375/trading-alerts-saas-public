'use client';

/**
 * Commission Owings Table Component
 *
 * Table showing affiliates with pending commission payments.
 *
 * @module components/admin/commission-owings-table
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface CommissionOwing {
  affiliateId: string;
  affiliateName: string;
  email: string;
  paymentMethod: string;
  pendingAmount: number;
  approvedAmount: number;
  totalOwing: number;
  lastPaymentDate: string | null;
}

interface CommissionOwingsTableProps {
  owings: CommissionOwing[];
  onPayClick?: (affiliateId: string) => void;
}

export function CommissionOwingsTable({
  owings,
  onPayClick,
}: CommissionOwingsTableProps) {
  const formatCurrency = (value: number) =>
    `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDate = (date: string | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const canPay = (amount: number) => amount >= 50;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Affiliate</th>
            <th className="px-4 py-3 text-left font-medium">Payment Method</th>
            <th className="px-4 py-3 text-right font-medium">Pending</th>
            <th className="px-4 py-3 text-right font-medium">Approved</th>
            <th className="px-4 py-3 text-right font-medium">Total Owing</th>
            <th className="px-4 py-3 text-left font-medium">Last Payment</th>
            <th className="px-4 py-3 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {owings.map((owing) => (
            <tr key={owing.affiliateId} className="border-b hover:bg-muted/25">
              <td className="px-4 py-3">
                <div>
                  <div className="font-medium">{owing.affiliateName}</div>
                  <div className="text-xs text-muted-foreground">{owing.email}</div>
                </div>
              </td>
              <td className="px-4 py-3">
                <Badge variant="outline">{owing.paymentMethod.replace('_', ' ')}</Badge>
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">
                {formatCurrency(owing.pendingAmount)}
              </td>
              <td className="px-4 py-3 text-right">
                {formatCurrency(owing.approvedAmount)}
              </td>
              <td className="px-4 py-3 text-right font-medium">
                {formatCurrency(owing.totalOwing)}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {formatDate(owing.lastPaymentDate)}
              </td>
              <td className="px-4 py-3 text-right">
                {canPay(owing.totalOwing) && onPayClick ? (
                  <Button
                    size="sm"
                    onClick={() => onPayClick(owing.affiliateId)}
                  >
                    Pay
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Min $50
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t bg-muted/50 font-medium">
          <tr>
            <td className="px-4 py-3" colSpan={2}>Total</td>
            <td className="px-4 py-3 text-right text-muted-foreground">
              {formatCurrency(owings.reduce((sum, o) => sum + o.pendingAmount, 0))}
            </td>
            <td className="px-4 py-3 text-right">
              {formatCurrency(owings.reduce((sum, o) => sum + o.approvedAmount, 0))}
            </td>
            <td className="px-4 py-3 text-right">
              {formatCurrency(owings.reduce((sum, o) => sum + o.totalOwing, 0))}
            </td>
            <td colSpan={2}></td>
          </tr>
        </tfoot>
      </table>
      {owings.length === 0 && (
        <div className="py-8 text-center text-muted-foreground">
          No pending commission payments
        </div>
      )}
    </div>
  );
}

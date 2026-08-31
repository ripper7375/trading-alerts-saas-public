/**
 * Affiliate Program (mobile reference)
 *
 * Mobile version of the monolith's app/affiliate/dashboard/commissions
 * page -- referral code, earnings summary, and commission history
 * including the clawback row introduced by the
 * affiliate-commission-issues-fix manifest (refund/dispute on an
 * already-PAID commission nets against the next payout rather than an
 * alert-only manual-recovery path).
 */

import { ArrowLeft, Copy, Gift } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  CommissionTable,
  type Commission,
} from '@/components/affiliate/CommissionTable';

const REFERRAL_CODE = 'DAVIN-TRADER42';

const MOCK_COMMISSIONS: Commission[] = [
  {
    id: 'c1',
    commissionAmount: 8.7,
    status: 'PAID',
    earnedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    paidAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    affiliateCode: { code: REFERRAL_CODE },
  },
  {
    id: 'c2',
    commissionAmount: 8.7,
    status: 'APPROVED',
    earnedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
    paidAt: null,
    affiliateCode: { code: REFERRAL_CODE },
  },
  {
    id: 'c3',
    commissionAmount: 8.7,
    status: 'PENDING',
    earnedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    paidAt: null,
    affiliateCode: { code: REFERRAL_CODE },
  },
  {
    id: 'c4',
    commissionAmount: -8.7,
    status: 'APPROVED',
    earnedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    paidAt: null,
    affiliateCode: { code: REFERRAL_CODE },
    clawbackOfCommissionId: 'c0',
  },
];

const STATUS_GUIDE = [
  {
    label: 'PENDING',
    className:
      'border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300',
    description: 'Awaiting approval',
  },
  {
    label: 'APPROVED',
    className:
      'border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-400',
    description: 'Ready for payout',
  },
  {
    label: 'PAID',
    className:
      'border-green-500/30 bg-green-500/15 text-green-700 dark:text-green-400',
    description: 'Payment completed',
  },
  {
    label: 'CANCELLED',
    className: 'border-red-500/30 bg-red-500/15 text-red-700 dark:text-red-400',
    description: 'Refund/cancellation',
  },
  {
    label: 'CLAWBACK',
    className: 'border-red-500/30 bg-red-500/15 text-red-700 dark:text-red-400',
    description:
      'Deduction for a refund on a commission already paid — offsets your next payout',
  },
];

const Affiliate = () => {
  const navigate = useNavigate();

  const totalEarned = MOCK_COMMISSIONS.reduce(
    (sum, c) => sum + Number(c.commissionAmount),
    0
  );
  const pendingAmount = MOCK_COMMISSIONS.filter(
    (c) => c.status === 'PENDING' || c.status === 'APPROVED'
  ).reduce((sum, c) => sum + Number(c.commissionAmount), 0);
  const paidAmount = MOCK_COMMISSIONS.filter((c) => c.status === 'PAID').reduce(
    (sum, c) => sum + Number(c.commissionAmount),
    0
  );

  const copyCode = () => {
    navigator.clipboard.writeText(REFERRAL_CODE).catch(() => {});
    toast.success('Referral code copied');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/settings')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Affiliate Program</h1>
        </div>
      </div>

      <div className="space-y-6 p-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              <p className="text-sm font-medium">Your referral code</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-dashed border-primary/40 bg-background px-3 py-2">
              <span className="font-mono text-sm font-semibold">
                {REFERRAL_CODE}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyCode}
                className="h-8 gap-1"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Share this code — you earn recurring commission for 24 billing
              cycles on every subscriber who signs up with it.
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="mt-1 text-lg font-bold">
                ${totalEarned.toFixed(2)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="mt-1 text-lg font-bold text-amber-600 dark:text-amber-400">
                ${pendingAmount.toFixed(2)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Paid</p>
              <p className="mt-1 text-lg font-bold text-green-600 dark:text-green-400">
                ${paidAmount.toFixed(2)}
              </p>
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Commission History
          </h2>
          <CommissionTable commissions={MOCK_COMMISSIONS} />
        </div>

        <Card>
          <CardContent className="space-y-2 p-4">
            <h3 className="text-sm font-semibold">Commission Status Guide</h3>
            {STATUS_GUIDE.map((item) => (
              <div key={item.label} className="flex items-start gap-2 text-xs">
                <span
                  className={`shrink-0 rounded border px-2 py-0.5 font-medium ${item.className}`}
                >
                  {item.label}
                </span>
                <span className="text-muted-foreground">
                  {item.description}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Affiliate;

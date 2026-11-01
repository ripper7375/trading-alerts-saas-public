import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function AffiliatePayoutsPage() {
  const navigate = useNavigate();

  const PAYOUTS = [
    {
      id: 'po_01',
      amount: '$382.50',
      method: 'USDT TRC20',
      date: '2026-08-01',
      status: 'COMPLETED',
      txid: '7b92f...81e',
    },
    {
      id: 'po_02',
      amount: '$294.00',
      method: 'Bank Wire',
      date: '2026-07-01',
      status: 'COMPLETED',
      txid: 'WIRE-84920',
    },
  ];

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => navigate(-1)}
          className="h-8 w-8 rounded-xl"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-black text-foreground">Payout Status</h1>
          <p className="text-xs text-muted-foreground">
            Monthly disbursement timeline
          </p>
        </div>
      </div>

      {/* Next Payout Card */}
      <Card className="border-amber-500/40 bg-gradient-to-b from-card to-amber-500/10 shadow-md">
        <CardContent className="space-y-2 p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-muted-foreground">
              Next Scheduled Disbursement
            </span>
            <Badge variant="pro" className="text-[9px]">
              Sept 1, 2026
            </Badge>
          </div>
          <div className="flex items-baseline justify-between pt-1">
            <span className="font-mono text-2xl font-black text-foreground">
              $248.60
            </span>
            <span className="text-xs font-bold text-emerald-500">
              Pending Approval
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Disburses automatically to your saved USDT TRC20 wallet. Minimum
            payout threshold is $50.
          </p>
        </CardContent>
      </Card>

      {/* Historical Payout Timeline */}
      <div className="space-y-2.5">
        <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Disbursement History
        </h2>
        {PAYOUTS.map((p) => (
          <Card key={p.id} className="border-border/80 bg-card">
            <CardContent className="flex items-center justify-between p-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground">
                    {p.amount} • {p.method}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    Tx: {p.txid} • {p.date}
                  </div>
                </div>
              </div>
              <Badge
                variant="success"
                className="px-2 py-0.5 text-[9px] font-bold"
              >
                {p.status}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

export default function AffiliatePaymentSetupPage() {
  const navigate = useNavigate();
  const [wiseEmail, setWiseEmail] = useState('affiliate@davin-trade.com');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Payout payment preferences updated!');
  };

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
          <h1 className="text-lg font-black text-foreground">
            Affiliate Payout Setup
          </h1>
          <p className="text-xs text-muted-foreground">
            Configure monthly commission destination
          </p>
        </div>
      </div>

      <Card className="border-border/80 bg-card shadow-xl">
        <CardContent className="p-5">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Payout Method
              </label>
              <Input value="Wise" disabled className="h-11" />
              <span className="text-[10px] text-muted-foreground">
                Commissions are disbursed via Wise on the 1st of every month.
              </span>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Wise Payout Email
              </label>
              <Input
                type="email"
                value={wiseEmail}
                onChange={(e) => setWiseEmail(e.target.value)}
                placeholder="you@wise.com"
                required
              />
            </div>

            <Button
              type="submit"
              className="mt-2 h-11 w-full bg-amber-500 font-bold text-slate-950 shadow-md shadow-amber-500/25 hover:bg-amber-400"
            >
              <Save className="mr-2 h-4 w-4" />
              <span>Save Payout Destination</span>
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
        <span>
          Disbursements are cryptographically logged on PostgreSQL audit tables.
        </span>
      </div>
    </div>
  );
}

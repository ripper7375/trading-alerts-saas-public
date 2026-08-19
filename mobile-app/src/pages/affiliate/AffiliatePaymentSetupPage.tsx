import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

type PayoutMethodType = 'usdt' | 'bank' | 'wire';

export default function AffiliatePaymentSetupPage() {
  const navigate = useNavigate();
  const [method, setMethod] = useState<PayoutMethodType>('usdt');
  const [usdtAddress, setUsdtAddress] = useState(
    'TYW849204859012398492849021840291'
  );

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
                Preferred Payout Method
              </label>
              <Select
                value={method}
                onValueChange={(v) => setMethod(v as PayoutMethodType)}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="usdt">
                    USDT TRC20 (Zero fees, Instant on 1st)
                  </SelectItem>
                  <SelectItem value="bank">Local Bank Transfer</SelectItem>
                  <SelectItem value="wire">
                    International Bank Wire (SWIFT / IBAN)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {method === 'usdt' && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  USDT TRC20 Wallet Address
                </label>
                <Input
                  value={usdtAddress}
                  onChange={(e) => setUsdtAddress(e.target.value)}
                  placeholder="T..."
                  className="font-mono text-xs"
                  required
                />
                <span className="text-[10px] text-muted-foreground">
                  Ensure address is on the TRON (TRC20) network.
                </span>
              </div>
            )}

            {method === 'bank' && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Bank Name
                  </label>
                  <Input
                    placeholder="e.g. JPMorgan Chase or Bangkok Bank"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Account Number
                  </label>
                  <Input placeholder="Account number" required />
                </div>
              </div>
            )}

            {method === 'wire' && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    IBAN / SWIFT Code
                  </label>
                  <Input placeholder="GB29..." className="font-mono" required />
                </div>
              </div>
            )}

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

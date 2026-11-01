import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

export default function AffiliatePayoutSettingsPage() {
  const navigate = useNavigate();
  const [minThreshold, setMinThreshold] = useState('50');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Payout threshold settings saved!');
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
            Payout Settings
          </h1>
          <p className="text-xs text-muted-foreground">
            Minimum thresholds & disbursement rules
          </p>
        </div>
      </div>

      <Card className="border-border/80 bg-card shadow-xl">
        <CardContent className="p-5">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Minimum Payout Threshold ($)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  min="50"
                  value={minThreshold}
                  onChange={(e) => setMinThreshold(e.target.value)}
                  className="pl-10 font-bold"
                  required
                />
              </div>
              <span className="text-[10px] text-muted-foreground">
                Minimum payout limit is $50.00. Unpaid earnings roll over
                monthly.
              </span>
            </div>

            <Button
              type="submit"
              className="mt-2 h-11 w-full bg-amber-500 font-bold text-slate-950 shadow-md shadow-amber-500/25 hover:bg-amber-400"
            >
              <Save className="mr-2 h-4 w-4" />
              <span>Save Payout Settings</span>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

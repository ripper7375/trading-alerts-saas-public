import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

export default function DeletionCancelPage() {
  const navigate = useNavigate();

  const handleCancelDeletion = () => {
    toast.success('Account deletion cancelled! All price alerts reactivated.');
    navigate('/terminal');
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-4">
      <Card className="w-full max-w-sm border-border/80 bg-card shadow-2xl">
        <CardContent className="space-y-5 p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-500">
            <ShieldCheck className="h-8 w-8" />
          </div>

          <div>
            <h1 className="text-xl font-black text-foreground">
              Account Deletion Pending
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Your account is currently scheduled for permanent deletion in 7
              days.
            </p>
          </div>

          <div className="space-y-1 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-left text-xs text-amber-600 dark:text-amber-400">
            <span className="block font-bold">Notice:</span>
            <span>
              Tap below to instantly restore your account, resume high-priority
              MT5 alerts, and preserve your affiliate balances.
            </span>
          </div>

          <div className="space-y-2 pt-2">
            <Button
              onClick={handleCancelDeletion}
              className="h-11 w-full gap-2 bg-emerald-500 text-xs font-bold text-slate-950 hover:bg-emerald-400"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Cancel Deletion & Restore Account</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate('/login')}
              className="h-10 w-full text-xs font-semibold"
            >
              Log Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

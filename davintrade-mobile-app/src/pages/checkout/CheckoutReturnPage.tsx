import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function CheckoutReturnPage() {
  const [verifying, setVerifying] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      setVerifying(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-4">
      <Card className="w-full max-w-sm border-border/80 bg-card shadow-xl">
        <CardContent className="space-y-4 p-6 text-center">
          {verifying ? (
            <div className="flex flex-col items-center space-y-3 py-6">
              <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
              <p className="text-xs font-semibold text-muted-foreground">
                Confirming payment with Stripe / dLocal...
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-4 py-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-500">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-lg font-black text-foreground">
                  Payment Successful!
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Your PRO Analyst subscription is active.
                </p>
              </div>
              <Button
                onClick={() => navigate('/terminal')}
                className="h-11 w-full bg-amber-500 font-bold text-slate-950 hover:bg-amber-400"
              >
                Launch PRO Terminal
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

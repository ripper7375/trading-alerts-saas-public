import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function AffiliateVerifyPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-4">
      <Card className="w-full max-w-sm border-border/80 bg-card shadow-xl">
        <CardContent className="space-y-4 p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-500">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-lg font-black text-foreground">
              Partner Verified!
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Your affiliate tracking link is active and ready to generate
              commissions.
            </p>
          </div>
          <Button
            onClick={() => navigate('/affiliate/dashboard')}
            className="h-11 w-full bg-amber-500 font-bold text-slate-950 hover:bg-amber-400"
          >
            Open Affiliate Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

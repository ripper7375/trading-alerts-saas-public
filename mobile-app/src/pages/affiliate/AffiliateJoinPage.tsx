import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Sparkles, Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function AffiliateJoinPage() {
  const navigate = useNavigate();

  const PERKS = [
    '20% Lifetime Recurring Commission per PRO user',
    'Real-time Mobile Click & Conversion Tracker',
    'Pre-designed Social Marketing Kit & Banners',
    'Monthly Payouts via Wise',
    'Dedicated Partner VIP Support Desk',
  ];

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="space-y-2 pt-2 text-center">
        <h1 className="text-2xl font-black tracking-tight text-foreground">
          Join the DavinTrade Partner Network
        </h1>
        <p className="mx-auto max-w-xs text-xs text-muted-foreground">
          Monetize your trading community, signals channel, or social following.
        </p>
      </div>

      <Card className="border-border/80 bg-card shadow-xl">
        <CardContent className="space-y-4 p-5">
          <div className="space-y-2 text-xs">
            <h3 className="font-bold text-foreground">Partner Benefits:</h3>
            {PERKS.map((p) => (
              <div
                key={p}
                className="flex items-start gap-2 text-foreground/90"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <span className="leading-snug">{p}</span>
              </div>
            ))}
          </div>

          <Button
            onClick={() => navigate('/affiliate/register')}
            className="mt-2 h-11 w-full bg-amber-500 font-bold text-slate-950 hover:bg-amber-400"
          >
            <span>Proceed to Registration</span>
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

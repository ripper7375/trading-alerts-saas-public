import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function DisclaimerPage() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4">
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
            Financial Risk Disclaimer
          </h1>
          <p className="text-xs text-muted-foreground">
            High-Risk Margin Trading Warning
          </p>
        </div>
      </div>

      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="space-y-4 p-4 text-xs leading-relaxed text-muted-foreground">
          <div className="flex items-center gap-2 text-sm font-bold text-destructive">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>High Risk Investment Warning</span>
          </div>

          <p>
            Trading Contracts for Difference (CFDs), Foreign Exchange (Forex),
            Cryptocurrencies, and Commodities on margin carries a high level of
            risk and may not be suitable for all investors. The high degree of
            leverage can work against you as well as for you.
          </p>

          <p>
            Before deciding to trade foreign exchange or other financial
            markets, you should carefully consider your investment objectives,
            level of experience, and risk appetite. The possibility exists that
            you could sustain a loss of some or all of your initial capital.
          </p>

          <div className="space-y-1 border-t border-destructive/20 pt-1 font-semibold text-foreground">
            <p>⚠️ Non-Advisory Technical Tool Disclosure:</p>
            <p className="font-normal text-muted-foreground">
              DavinTrade is an independent technical software analysis tool and
              not a registered financial advisor or broker-dealer. All
              algorithmic fractal levels, signals, and Conversational AI outputs
              are purely mathematical interpretations of historical tick data
              and must not be construed as investment advice.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

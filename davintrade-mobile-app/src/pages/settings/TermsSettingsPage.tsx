import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function TermsSettingsPage() {
  const navigate = useNavigate();

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
            Terms & Disclaimers
          </h1>
          <p className="text-xs text-muted-foreground">
            In-app service level agreements
          </p>
        </div>
      </div>

      <Card className="border-border/80 bg-card">
        <CardContent className="space-y-3 p-4 text-xs leading-relaxed text-muted-foreground">
          <p className="font-bold text-foreground">
            DavinTrade Trading Alerts SaaS Agreement
          </p>
          <p>
            1. All signals, fractal levels, and conversational AI analyst
            summaries are provided as technical references and do not constitute
            financial advice.
          </p>
          <p>
            2. High-priority push notifications require an active internet
            connection on your Android or iOS device.
          </p>
          <p>
            3. Subscriptions can be managed or cancelled at any time before the
            next billing cycle.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

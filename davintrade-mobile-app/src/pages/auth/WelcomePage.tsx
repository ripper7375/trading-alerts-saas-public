import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  TrendingUp,
  Bell,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNotifications } from '@/contexts/NotificationContext';
import { toast } from 'sonner';

export default function WelcomePage() {
  const navigate = useNavigate();
  const { playAlertChime, addAlert } = useNotifications();
  const [step, setStep] = useState(1);
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([
    'XAUUSD',
    'BTCUSD',
  ]);
  const [pushEnabled, setPushEnabled] = useState(true);

  const MARKETS = [
    { symbol: 'XAUUSD', name: 'Gold Spot' },
    { symbol: 'BTCUSD', name: 'Bitcoin' },
    { symbol: 'EURUSD', name: 'Euro / USD' },
    { symbol: 'US30', name: 'Dow Jones Index' },
  ];

  const toggleMarket = (sym: string) => {
    if (selectedMarkets.includes(sym)) {
      setSelectedMarkets(selectedMarkets.filter((s) => s !== sym));
    } else {
      setSelectedMarkets([...selectedMarkets, sym]);
    }
  };

  const handleFinish = () => {
    // Arm initial welcome alert on XAUUSD
    addAlert({
      symbol: 'XAUUSD',
      timeframe: 'M15',
      condition: 'ABOVE',
      targetPrice: 2650.0,
      currentPrice: 2642.8,
      sound: 'chime_crystal',
      note: 'Welcome onboarding test alert',
    });
    playAlertChime('breakout');
    toast.success('Your workspace is configured!');
    navigate('/terminal');
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-4">
      <Card className="w-full max-w-sm border-2 border-amber-500/80 bg-gradient-to-b from-card via-card to-amber-500/10 shadow-2xl">
        <CardContent className="space-y-5 p-6 text-center">
          {/* Header Step Counter */}
          <div className="flex items-center justify-between">
            <Badge variant="pro" className="text-[10px]">
              STEP {step} OF 3
            </Badge>
            <span className="text-[11px] font-bold text-amber-500">
              Trader Onboarding
            </span>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-500">
                <TrendingUp className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-lg font-black text-foreground">
                  Select Your Core Assets
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Choose the instruments you want pinned to your live chart
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-left">
                {MARKETS.map((m) => {
                  const isSelected = selectedMarkets.includes(m.symbol);
                  return (
                    <div
                      key={m.symbol}
                      onClick={() => toggleMarket(m.symbol)}
                      className={`cursor-pointer rounded-xl border p-3 transition-all ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500/15 text-foreground'
                          : 'border-border/60 bg-muted/20 text-muted-foreground'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold">
                          {m.symbol}
                        </span>
                        {isSelected && (
                          <Check className="h-3.5 w-3.5 text-amber-500" />
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {m.name}
                      </span>
                    </div>
                  );
                })}
              </div>

              <Button
                onClick={() => setStep(2)}
                className="h-11 w-full bg-amber-500 text-xs font-bold text-slate-950 hover:bg-amber-400"
              >
                <span>Continue to Alerts</span>
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-500">
                <Bell className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-lg font-black text-foreground">
                  Configure 1st Alert
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  We'll arm a sample resistance alert on Gold (XAU/USD)
                </p>
              </div>

              <div className="space-y-2 rounded-xl border border-amber-500/40 bg-card p-4 text-left font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Asset:</span>
                  <span className="font-bold text-foreground">
                    XAUUSD (M15)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Trigger:</span>
                  <span className="font-bold text-emerald-500">
                    Crosses Above $2,650.00
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Chime:</span>
                  <span className="font-bold text-amber-500">
                    Crystal Chime
                  </span>
                </div>
              </div>

              <Button
                onClick={() => setStep(3)}
                className="h-11 w-full bg-amber-500 text-xs font-bold text-slate-950 hover:bg-amber-400"
              >
                <span>Continue to Push Setup</span>
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-500">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-lg font-black text-foreground">
                  Enable Push Chimes
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Receive instant high-priority alerts even when your phone
                  screen is locked
                </p>
              </div>

              <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 text-xs leading-relaxed text-muted-foreground">
                🔔 DavinTrade uses Firebase Cloud Messaging (FCM) to deliver
                sub-500ms market breaches directly to your Android notifications
                tray.
              </div>

              <Button
                onClick={handleFinish}
                className="h-12 w-full bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 shadow-lg shadow-amber-500/25 hover:from-amber-400 hover:to-amber-500"
              >
                <Sparkles className="mr-2 h-4 w-4 fill-slate-950" />
                <span>Launch Trading Terminal</span>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Check, TrendingUp, Zap, Bell, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function UpgradeSuccessPage() {
  const navigate = useNavigate();

  const UNLOCKED = [
    '15+ Asset Symbols & 9 Timeframes (M1-D1)',
    '20 Active Simultaneous Price Alerts',
    'Interactive Conversational AI Analyst (Gemini/Claude/GPT)',
    'Sub-500ms Real-Time MT5 Tick Streaming',
    'High-Priority Push Chimes & Instant Chime Sound',
  ];

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-4">
      <Card className="w-full max-w-sm border-2 border-amber-500/80 bg-gradient-to-b from-card via-card to-amber-500/10 shadow-2xl">
        <CardContent className="space-y-4 p-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-xl shadow-amber-500/30">
            <Sparkles className="h-8 w-8 animate-bounce fill-slate-950" />
          </div>

          <div>
            <Badge variant="pro" className="mb-2">
              PRO UPGRADE ACTIVE
            </Badge>
            <h1 className="text-xl font-black text-foreground">
              Welcome to PRO Analyst!
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Your account has been upgraded with complete institutional MT5
              alerts.
            </p>
          </div>

          <div className="space-y-2 border-t border-border/80 pt-2 text-left text-xs">
            <p className="mb-1 font-bold text-foreground">Features Unlocked:</p>
            {UNLOCKED.map((item) => (
              <div
                key={item}
                className="flex items-start gap-2 text-foreground/90"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <span className="leading-snug">{item}</span>
              </div>
            ))}
          </div>

          <Button
            onClick={() => navigate('/terminal')}
            className="mt-2 h-12 w-full bg-gradient-to-r from-amber-500 to-amber-600 font-extrabold text-slate-950 shadow-lg shadow-amber-500/25 hover:from-amber-400 hover:to-amber-500"
          >
            <TrendingUp className="mr-2 h-4 w-4" />
            <span>Launch PRO Terminal</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

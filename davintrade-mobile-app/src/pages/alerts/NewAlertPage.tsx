import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Volume2, Plus } from 'lucide-react';
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
import { Symbol, Timeframe, AlertCondition } from '@/lib/types';
import { PRO_ALLOWED_SYMBOLS, PRO_ALLOWED_TIMEFRAMES } from '@/lib/tier-config';
import { useNotifications } from '@/contexts/NotificationContext';
import { toast } from 'sonner';

export default function NewAlertPage() {
  const navigate = useNavigate();
  const { addAlert, playAlertChime } = useNotifications();

  const [symbol, setSymbol] = useState<Symbol>('XAUUSD');
  const [timeframe, setTimeframe] = useState<Timeframe>('M15');
  const [condition, setCondition] = useState<AlertCondition>('ABOVE');
  const [targetPrice, setTargetPrice] = useState<string>('2650.00');
  const [sound, setSound] = useState('chime_crystal');
  const [note, setNote] = useState('');

  const handleAdjustPrice = (pct: number) => {
    const val = parseFloat(targetPrice) || 2650;
    const adjusted = val * (1 + pct / 100);
    setTargetPrice(adjusted.toFixed(2));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(targetPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error('Please enter a valid target price');
      return;
    }

    addAlert({
      symbol,
      timeframe,
      condition,
      targetPrice: priceNum,
      currentPrice: priceNum * 0.998,
      sound,
      note,
    });

    playAlertChime('breakout');
    navigate('/alerts');
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
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
            Create Price Alert
          </h1>
          <p className="text-xs text-muted-foreground">
            Arm a high-priority MT5 fractal breach trigger.
          </p>
        </div>
      </div>

      <Card className="border-border/80 bg-card shadow-xl">
        <CardContent className="p-5">
          <form onSubmit={handleSave} className="space-y-4">
            {/* Symbol & Timeframe */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  Asset Symbol
                </label>
                <Select
                  value={symbol}
                  onValueChange={(v) => setSymbol(v as Symbol)}
                >
                  <SelectTrigger className="h-11 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRO_ALLOWED_SYMBOLS.map((s) => (
                      <SelectItem key={s} value={s} className="font-bold">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  Timeframe
                </label>
                <Select
                  value={timeframe}
                  onValueChange={(v) => setTimeframe(v as Timeframe)}
                >
                  <SelectTrigger className="h-11 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRO_ALLOWED_TIMEFRAMES.map((tf) => (
                      <SelectItem key={tf} value={tf} className="font-bold">
                        {tf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Trigger Condition */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Trigger Condition
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCondition('ABOVE')}
                  className={`rounded-xl border p-3 text-xs font-bold transition-all ${
                    condition === 'ABOVE'
                      ? 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'border-border/60 bg-muted/20 text-muted-foreground'
                  }`}
                >
                  Crosses Above (Resistance)
                </button>
                <button
                  type="button"
                  onClick={() => setCondition('BELOW')}
                  className={`rounded-xl border p-3 text-xs font-bold transition-all ${
                    condition === 'BELOW'
                      ? 'border-rose-500 bg-rose-500/15 text-rose-600 dark:text-rose-400'
                      : 'border-border/60 bg-muted/20 text-muted-foreground'
                  }`}
                >
                  Crosses Below (Support)
                </button>
              </div>
            </div>

            {/* Target Price */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Target Price ($)
              </label>
              <Input
                type="number"
                step="any"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="2650.00"
                className="h-12 font-mono text-lg font-bold"
                required
              />

              {/* Quick Offset Buttons */}
              <div className="flex items-center gap-1.5 pt-1">
                {[-1, -0.5, +0.5, +1].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => handleAdjustPrice(pct)}
                    className="flex-1 rounded-lg border border-border/80 bg-muted/30 py-1 font-mono text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                  >
                    {pct > 0 ? `+${pct}%` : `${pct}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* Alert Chime Sound Selector */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground">
                  Sound Chime
                </label>
                <button
                  type="button"
                  onClick={() => playAlertChime('breakout')}
                  className="flex items-center gap-1 text-[11px] font-bold text-amber-500 hover:underline"
                >
                  <Volume2 className="h-3 w-3" />
                  <span>Preview Audio</span>
                </button>
              </div>
              <Select value={sound} onValueChange={setSound}>
                <SelectTrigger className="h-11 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chime_crystal">
                    Crystal Chime (High Priority)
                  </SelectItem>
                  <SelectItem value="chime_bell">Trading Bell Chime</SelectItem>
                  <SelectItem value="radar_beep">MT5 Radar Beep</SelectItem>
                  <SelectItem value="laser_pulse">Laser Pulse Chime</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Optional Note */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Note / Strategy Tag (Optional)
              </label>
              <Input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. M15 EDT breakout retest"
                className="text-xs"
              />
            </div>

            <Button
              type="submit"
              className="mt-2 h-12 w-full bg-amber-500 font-bold text-slate-950 shadow-lg shadow-amber-500/25 hover:bg-amber-400"
            >
              <Plus className="mr-2 h-4 w-4" />
              <span>Arm Price Alert</span>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

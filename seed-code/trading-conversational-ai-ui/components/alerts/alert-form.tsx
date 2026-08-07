'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, ArrowLeft, Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

export default function AlertForm() {
  const router = useRouter();
  const [ruleName, setRuleName] = useState('');
  const [symbol, setSymbol] = useState('XAUUSD');
  const [timeframe, setTimeframe] = useState('M5');
  const [alertType, setAlertType] = useState('EDT Channel Breach');
  const [targetPrice, setTargetPrice] = useState('2634.50');
  const [sendEmail, setSendEmail] = useState(true);
  const [sendPush, setSendPush] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      router.push('/alerts');
    }, 600);
  };

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 rounded-2xl border border-slate-800/80 bg-[#090c14] p-6 shadow-2xl select-none">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-400">
            <Bell className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-100">
              Create New Alert Rule
            </h2>
            <p className="text-[11px] text-slate-400">
              Configure real-time price & line trigger conditions
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-300">
            Rule Name
          </Label>
          <Input
            required
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
            placeholder="e.g. XAUUSD M5 EDT Channel Retest"
            className="border-slate-750 bg-[#06080e] text-xs text-slate-100"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-300">
              Symbol
            </Label>
            <Select value={symbol} onValueChange={setSymbol}>
              <SelectTrigger className="border-slate-750 bg-[#06080e] text-xs">
                <SelectValue placeholder="Select symbol" />
              </SelectTrigger>
              <SelectContent className="border-slate-750 bg-[#0f1420]">
                <SelectItem value="XAUUSD">XAUUSD (Gold)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-300">
              Timeframe
            </Label>
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger className="border-slate-750 bg-[#06080e] text-xs">
                <SelectValue placeholder="Select timeframe" />
              </SelectTrigger>
              <SelectContent className="border-slate-750 bg-[#0f1420]">
                <SelectItem value="M5">M5 (5-Minute)</SelectItem>
                <SelectItem value="M15">M15 (15-Minute)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-300">
            Condition Type
          </Label>
          <Select value={alertType} onValueChange={setAlertType}>
            <SelectTrigger className="border-slate-750 bg-[#06080e] text-xs">
              <SelectValue placeholder="Select condition type" />
            </SelectTrigger>
            <SelectContent className="border-slate-750 bg-[#0f1420]">
              <SelectItem value="EDT Channel Breach">
                EDT Equal-Distance Channel Breach
              </SelectItem>
              <SelectItem value="SSA Z-Score Rejection">
                SSA Z-Score Rejection ($2.0+)
              </SelectItem>
              <SelectItem value="Price Threshold Crossing">
                Price Threshold Crossing
              </SelectItem>
              <SelectItem value="Drawing Line Alert">
                Custom Drawing Tool Line Breach
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-300">
            Target Price Level ($)
          </Label>
          <Input
            type="number"
            step="0.01"
            required
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            className="border-slate-750 bg-[#06080e] font-mono text-xs text-amber-300"
          />
        </div>

        <div className="space-y-2 border-t border-slate-800/80 pt-2">
          <Label className="text-xs font-semibold text-slate-300">
            Notification Delivery Channels
          </Label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-800 bg-[#06080e] p-2">
              <Checkbox
                checked={sendEmail}
                onCheckedChange={(checked) => setSendEmail(!!checked)}
              />
              <span>Email Notification</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-800 bg-[#06080e] p-2">
              <Checkbox
                checked={sendPush}
                onCheckedChange={(checked) => setSendPush(!!checked)}
              />
              <span>In-App WebSocket Alert</span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-800/80 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push('/alerts')}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Cancel
          </Button>

          <Button
            type="submit"
            disabled={isLoading}
            className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500"
          >
            {isLoading ? 'Saving...' : 'Save & Activate Alert'}
          </Button>
        </div>
      </form>
    </div>
  );
}

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Moon,
  Sun,
  Monitor,
  Sparkles,
  Check,
  Vibrate,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useTheme } from 'next-themes';
import {
  useAppearanceSettings,
  AccentColor,
} from '@/hooks/useAppearanceSettings';
import { toast } from 'sonner';

export default function AppearanceSettingsPage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { settings, setAccentColor, setCandleTheme } = useAppearanceSettings();

  const [haptics, setHaptics] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);

  const ACCENTS: { id: AccentColor; label: string; color: string }[] = [
    { id: 'amber', label: 'Amber (DavinTrade)', color: 'bg-amber-500' },
    { id: 'emerald', label: 'Emerald Green', color: 'bg-emerald-500' },
    { id: 'blue', label: 'Sapphire Blue', color: 'bg-blue-500' },
    { id: 'purple', label: 'Amethyst Purple', color: 'bg-purple-500' },
  ];

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
            Appearance & Theme
          </h1>
          <p className="text-xs text-muted-foreground">
            Customize colors, themes & charts
          </p>
        </div>
      </div>

      {/* Theme Mode Selector */}
      <div className="space-y-2">
        <label className="px-1 text-xs font-semibold text-foreground">
          Theme Mode
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'light', label: 'Light', icon: Sun },
            { id: 'dark', label: 'Dark Navy', icon: Moon },
            { id: 'oled', label: 'OLED Black', icon: Sparkles },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTheme(t.id);
                toast.info(`Theme set to ${t.label}`);
              }}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-xs font-bold transition-all ${
                theme === t.id
                  ? 'border-primary bg-primary/15 text-primary shadow-sm'
                  : 'border-border/60 bg-card/60 text-muted-foreground'
              }`}
            >
              <t.icon className="h-5 w-5" />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Accent Color Palette */}
      <div className="space-y-2">
        <label className="px-1 text-xs font-semibold text-foreground">
          Brand Accent Color
        </label>
        <Card className="border-border/80 bg-card">
          <CardContent className="space-y-2 p-3.5">
            {ACCENTS.map((a) => {
              const isSelected = settings.accentColor === a.id;
              return (
                <div
                  key={a.id}
                  onClick={() => {
                    setAccentColor(a.id);
                    toast.success(`Accent color changed to ${a.label}`);
                  }}
                  className="flex cursor-pointer items-center justify-between rounded-xl p-2.5 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-6 w-6 rounded-full ${a.color} shadow-sm ring-2 ring-background`}
                    />
                    <span className="text-xs font-bold text-foreground">
                      {a.label}
                    </span>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-primary" />}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Candlestick Palette */}
      <div className="space-y-2">
        <label className="px-1 text-xs font-semibold text-foreground">
          Chart Candlestick Colors
        </label>
        <Card className="border-border/80 bg-card">
          <CardContent className="space-y-2 p-3.5 text-xs">
            <div
              onClick={() => {
                setCandleTheme('traditional');
                toast.info('Candlestick theme set to Traditional');
              }}
              className="flex cursor-pointer items-center justify-between rounded-xl p-2.5 hover:bg-muted/40"
            >
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-emerald-500" />
                <span className="h-3 w-3 rounded-full bg-rose-500" />
                <span className="font-semibold text-foreground">
                  Traditional (Green / Red)
                </span>
              </div>
              {settings.candleTheme === 'traditional' && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </div>

            <div
              onClick={() => {
                setCandleTheme('modern');
                toast.info('Candlestick theme set to Modern Teal / Rose');
              }}
              className="flex cursor-pointer items-center justify-between rounded-xl p-2.5 hover:bg-muted/40"
            >
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-cyan-400" />
                <span className="h-3 w-3 rounded-full bg-rose-500" />
                <span className="font-semibold text-foreground">
                  Modern Teal & Rose
                </span>
              </div>
              {settings.candleTheme === 'modern' && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accessibility & Device Controls */}
      <div className="space-y-2">
        <label className="px-1 text-xs font-semibold text-foreground">
          Device Sensations
        </label>
        <Card className="divide-y divide-border/60 border-border/80 bg-card">
          <CardContent className="flex items-center justify-between p-3.5">
            <div className="flex items-center gap-3">
              <Vibrate className="h-4 w-4 text-muted-foreground" />
              <div className="text-xs font-bold text-foreground">
                Haptic Vibration on Alerts
              </div>
            </div>
            <Switch
              checked={haptics}
              onCheckedChange={(c) => {
                setHaptics(c);
                toast.info(`Haptic vibration ${c ? 'Enabled' : 'Disabled'}`);
              }}
            />
          </CardContent>

          <CardContent className="flex items-center justify-between p-3.5">
            <div className="flex items-center gap-3">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <div className="text-xs font-bold text-foreground">
                Reduce Chart Animations
              </div>
            </div>
            <Switch
              checked={reduceMotion}
              onCheckedChange={(c) => {
                setReduceMotion(c);
                toast.info(`Reduce motion ${c ? 'Enabled' : 'Disabled'}`);
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

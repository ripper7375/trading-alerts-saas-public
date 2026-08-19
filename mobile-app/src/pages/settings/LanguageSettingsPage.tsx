import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Globe, Clock, DollarSign, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

export default function LanguageSettingsPage() {
  const navigate = useNavigate();
  const [lang, setLang] = useState('en');
  const [timezone, setTimezone] = useState('UTC');
  const [currency, setCurrency] = useState('USD');

  const LANGUAGES = [
    { code: 'en', label: 'English (US & UK)' },
    { code: 'th', label: 'Thai (ภาษาไทย)' },
    { code: 'es', label: 'Spanish (Español)' },
    { code: 'pt', label: 'Portuguese (Português)' },
    { code: 'id', label: 'Indonesian (Bahasa Indonesia)' },
    { code: 'vi', label: 'Vietnamese (Tiếng Việt)' },
    { code: 'ja', label: 'Japanese (日本語)' },
    { code: 'zh', label: 'Chinese Simplified (简体中文)' },
  ];

  const TIMEZONES = [
    { code: 'UTC', label: 'UTC (Coordinated Universal Time)' },
    { code: 'America/New_York', label: 'New York (EST/EDT)' },
    { code: 'Europe/London', label: 'London (GMT/BST)' },
    { code: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { code: 'Asia/Bangkok', label: 'Bangkok / Jakarta (ICT)' },
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
            Language & Region
          </h1>
          <p className="text-xs text-muted-foreground">
            Session timezones & localization
          </p>
        </div>
      </div>

      {/* Languages List */}
      <div className="space-y-2">
        <label className="px-1 text-xs font-semibold text-foreground">
          App Language
        </label>
        <Card className="divide-y divide-border/60 border-border/80 bg-card">
          {LANGUAGES.map((l) => (
            <div
              key={l.code}
              onClick={() => {
                setLang(l.code);
                toast.success(`Language set to ${l.label}`);
              }}
              className="flex cursor-pointer items-center justify-between p-3 text-xs font-semibold text-foreground hover:bg-muted/40"
            >
              <span>{l.label}</span>
              {lang === l.code && <Check className="h-4 w-4 text-primary" />}
            </div>
          ))}
        </Card>
      </div>

      {/* Timezone List */}
      <div className="space-y-2">
        <label className="px-1 text-xs font-semibold text-foreground">
          Market Timezone
        </label>
        <Card className="divide-y divide-border/60 border-border/80 bg-card">
          {TIMEZONES.map((tz) => (
            <div
              key={tz.code}
              onClick={() => {
                setTimezone(tz.code);
                toast.success(`Timezone set to ${tz.label}`);
              }}
              className="flex cursor-pointer items-center justify-between p-3 text-xs font-semibold text-foreground hover:bg-muted/40"
            >
              <span>{tz.label}</span>
              {timezone === tz.code && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

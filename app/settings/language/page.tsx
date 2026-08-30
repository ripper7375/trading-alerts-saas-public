'use client';

import { useState, useEffect } from 'react';
import {
  Globe,
  Clock,
  Calendar,
  DollarSign,
  Check,
  Loader2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Language & Region Settings Page (Row 77)
 *
 * Bound to the real GET/PUT /api/user/preferences endpoint -- already has
 * a real backend (Session 9-0's language/timezone hand-off), not rebuilt.
 */

interface LanguageSettings {
  language: string;
  timezone: string;
  dateFormat: 'MDY' | 'DMY' | 'YMD';
  timeFormat: '12h' | '24h';
  currency: string;
}

const languages = [
  { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
  { code: 'en-GB', name: 'English (UK)', flag: '🇬🇧' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
  { code: 'ar', name: 'Arabic (العربية)', flag: '🇦🇪' },
];

const timezones = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
  { value: 'Asia/Dubai', label: 'Dubai / UAE (GST)' },
];

const currencies = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
];

export default function LanguageSettingsPage(): React.ReactElement {
  const [settings, setSettings] = useState<LanguageSettings>({
    language: 'en-US',
    timezone: 'America/New_York',
    dateFormat: 'MDY',
    timeFormat: '12h',
    currency: 'USD',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const loadSettings = async (): Promise<void> => {
      try {
        const response = await fetch('/api/user/preferences');
        if (response.ok) {
          const data = await response.json();
          if (data.preferences) {
            setSettings({
              language: data.preferences.language || 'en-US',
              timezone: data.preferences.timezone || 'America/New_York',
              dateFormat: data.preferences.dateFormat || 'MDY',
              timeFormat: data.preferences.timeFormat || '12h',
              currency: data.preferences.currency || 'USD',
            });
          }
        }
      } catch (error) {
        console.error('Failed to load language settings:', error);
      }
    };

    loadSettings();
  }, []);

  const handleChange = (field: keyof LanguageSettings, value: string): void => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const getCurrentTime = (): string => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: settings.timezone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: settings.timeFormat === '12h',
      }).format(new Date());
    } catch {
      return '--:--';
    }
  };

  const getDatePreview = (): string => {
    const date = new Date();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();

    switch (settings.dateFormat) {
      case 'MDY':
        return `${month}/${day}/${year}`;
      case 'DMY':
        return `${day}/${month}/${year}`;
      case 'YMD':
        return `${year}-${month}-${day}`;
      default:
        return `${month}/${day}/${year}`;
    }
  };

  const handleSave = async (): Promise<void> => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save language settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <h2 className="mb-6 text-2xl font-bold text-foreground">
        Language &amp; Region
      </h2>

      <section className="mb-8">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Globe className="h-5 w-5" />
          Language
        </h3>
        <div className="max-w-md">
          <Label htmlFor="language" className="mb-2 block text-sm font-medium">
            Display Language
          </Label>
          <Select
            value={settings.language}
            onValueChange={(value) => handleChange('language', value)}
          >
            <SelectTrigger id="language">
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              {languages.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <Separator className="my-8" />

      <section className="mb-8">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Clock className="h-5 w-5" />
          Timezone
        </h3>
        <div className="max-w-md">
          <Label htmlFor="timezone" className="mb-2 block text-sm font-medium">
            Your Timezone
          </Label>
          <Select
            value={settings.timezone}
            onValueChange={(value) => handleChange('timezone', value)}
          >
            <SelectTrigger id="timezone">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {timezones.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-2 text-sm text-muted-foreground">
            Current time: {getCurrentTime()}
          </p>
        </div>
      </section>

      <Separator className="my-8" />

      <section className="mb-8">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Calendar className="h-5 w-5" />
          Date &amp; Time Format
        </h3>
        <div className="max-w-md space-y-6">
          <div>
            <Label className="mb-3 block text-sm font-medium">
              Date Format
            </Label>
            <div className="space-y-2">
              {[
                {
                  value: 'MDY' as const,
                  label: 'MM/DD/YYYY',
                  example: '12/25/2024',
                },
                {
                  value: 'DMY' as const,
                  label: 'DD/MM/YYYY',
                  example: '25/12/2024',
                },
                {
                  value: 'YMD' as const,
                  label: 'YYYY-MM-DD',
                  example: '2024-12-25',
                },
              ].map((format) => (
                <label
                  key={format.value}
                  className="flex cursor-pointer items-center gap-3"
                >
                  <input
                    type="radio"
                    name="dateFormat"
                    value={format.value}
                    checked={settings.dateFormat === format.value}
                    onChange={(e) => handleChange('dateFormat', e.target.value)}
                    className="h-4 w-4 text-primary"
                  />
                  <span className="text-foreground">{format.label}</span>
                  <span className="text-sm text-muted-foreground">
                    ({format.example})
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Preview: {getDatePreview()}
            </p>
          </div>

          <div>
            <Label className="mb-3 block text-sm font-medium">
              Time Format
            </Label>
            <div className="space-y-2">
              {[
                { value: '12h' as const, label: '12-hour', example: '2:30 PM' },
                { value: '24h' as const, label: '24-hour', example: '14:30' },
              ].map((format) => (
                <label
                  key={format.value}
                  className="flex cursor-pointer items-center gap-3"
                >
                  <input
                    type="radio"
                    name="timeFormat"
                    value={format.value}
                    checked={settings.timeFormat === format.value}
                    onChange={(e) => handleChange('timeFormat', e.target.value)}
                    className="h-4 w-4 text-primary"
                  />
                  <span className="text-foreground">{format.label}</span>
                  <span className="text-sm text-muted-foreground">
                    ({format.example})
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Separator className="my-8" />

      <section className="mb-8">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
          <DollarSign className="h-5 w-5" />
          Currency
        </h3>
        <div className="max-w-md">
          <Label htmlFor="currency" className="mb-2 block text-sm font-medium">
            Display Currency
          </Label>
          <Select
            value={settings.currency}
            onValueChange={(value) => handleChange('currency', value)}
          >
            <SelectTrigger id="currency">
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              {currencies.map((curr) => (
                <SelectItem key={curr.code} value={curr.code}>
                  {curr.code} {curr.symbol} - {curr.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-2 text-sm text-muted-foreground">
            Used for displaying prices and monetary values
          </p>
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : saveSuccess ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Saved!
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </div>
  );
}

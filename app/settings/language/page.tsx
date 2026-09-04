'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { useLocale } from '@/lib/context/locale-context';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n/languages';
import {
  getAllTimezones,
  getTimezoneLabel,
  type TimezoneOption,
} from '@/lib/utils/timezones';

/**
 * Language & Region Settings Page (Row 77)
 *
 * Bound to the real GET/PUT /api/user/preferences endpoint -- already has
 * a real backend (Session 9-0's language/timezone hand-off), not rebuilt.
 *
 * `handleSave()` also calls `setLocalePreferences()` from `useLocale()` (the
 * same write path `components/layout/app-header.tsx` already uses) so a save
 * takes effect immediately in the current session, not just in the database
 * -- see `docs/policies/08-locale-i18n-compliance.md` §0.
 */

interface LanguageSettings {
  language: string;
  timezone: string;
  dateFormat: 'MDY' | 'DMY' | 'YMD';
  timeFormat: '12h' | '24h';
  currency: string;
}

const currencies = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
];

export default function LanguageSettingsPage(): React.ReactElement {
  const { t, setLocalePreferences } = useLocale();
  const [settings, setSettings] = useState<LanguageSettings>({
    language: 'en-US',
    timezone: 'America/New_York',
    dateFormat: 'MDY',
    timeFormat: '12h',
    currency: 'USD',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const allTimezones = useMemo<TimezoneOption[]>(() => getAllTimezones(), []);
  const [timezoneSearch, setTimezoneSearch] = useState('');

  const filteredTimezones = useMemo(() => {
    if (!timezoneSearch.trim()) return allTimezones;
    const query = timezoneSearch.toLowerCase();
    return allTimezones.filter(
      (tz) =>
        tz.label.toLowerCase().includes(query) ||
        tz.value.toLowerCase().includes(query) ||
        tz.gmtPrefix.toLowerCase().includes(query)
    );
  }, [allTimezones, timezoneSearch]);

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

      setLocalePreferences(settings);
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
        {t('settings.nav.language', 'Language & Region')}
      </h2>

      <section className="mb-8">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Globe className="h-5 w-5" />
          {t('Language')}
        </h3>
        <div className="max-w-md">
          <Label htmlFor="language" className="mb-2 block text-sm font-medium">
            {t('form.display_language', 'Display Language')}
          </Label>
          <Select
            value={settings.language}
            onValueChange={(value) => handleChange('language', value)}
          >
            <SelectTrigger id="language">
              <SelectValue placeholder={t('Select language')} />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LANGUAGES.map((lang) => (
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
          {t('Timezone')}
        </h3>
        <div className="max-w-md">
          <Label htmlFor="timezone" className="mb-2 block text-sm font-medium">
            {t('Your Timezone')}
          </Label>
          <Select
            value={settings.timezone}
            onValueChange={(value) => {
              handleChange('timezone', value);
              setTimezoneSearch('');
            }}
          >
            <SelectTrigger
              id="timezone"
              className="w-full font-mono text-xs sm:text-sm"
            >
              <SelectValue placeholder={t('Select timezone')}>
                {getTimezoneLabel(settings.timezone)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-80 w-[380px] overflow-y-auto sm:w-[440px]">
              <div className="sticky top-0 z-10 border-b border-border bg-popover p-2">
                <input
                  type="text"
                  placeholder={t('Search city, country, or GMT offset...')}
                  value={timezoneSearch}
                  onChange={(e) => setTimezoneSearch(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
              {filteredTimezones.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  {t('No timezones found')}
                </div>
              ) : (
                filteredTimezones.map((tz) => (
                  <SelectItem
                    key={tz.value}
                    value={tz.value}
                    className="font-mono text-xs"
                  >
                    {tz.label}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('Current time:')}{' '}
            <span className="font-mono font-semibold">{getCurrentTime()}</span>
          </p>
        </div>
      </section>

      <Separator className="my-8" />

      <section className="mb-8">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Calendar className="h-5 w-5" />
          {t('Date & Time Format')}
        </h3>
        <div className="max-w-md space-y-6">
          <div>
            <Label className="mb-3 block text-sm font-medium">
              {t('form.date_format', 'Date Format')}
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
              {t('Preview:')} {getDatePreview()}
            </p>
          </div>

          <div>
            <Label className="mb-3 block text-sm font-medium">
              {t('form.time_format', 'Time Format')}
            </Label>
            <div className="space-y-2">
              {[
                {
                  value: '12h' as const,
                  label: t('12-hour'),
                  example: '2:30 PM',
                },
                {
                  value: '24h' as const,
                  label: t('24-hour'),
                  example: '14:30',
                },
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
          {t('Currency')}
        </h3>
        <div className="max-w-md">
          <Label htmlFor="currency" className="mb-2 block text-sm font-medium">
            {t('Display Currency')}
          </Label>
          <Select
            value={settings.currency}
            onValueChange={(value) => handleChange('currency', value)}
          >
            <SelectTrigger id="currency">
              <SelectValue placeholder={t('Select currency')} />
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
            {t('Used for displaying prices and monetary values')}
          </p>
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('Saving...')}
            </>
          ) : saveSuccess ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              {t('Saved!')}
            </>
          ) : (
            t('Save Changes')
          )}
        </Button>
      </div>
    </div>
  );
}

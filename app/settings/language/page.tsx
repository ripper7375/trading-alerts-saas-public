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
  currencyForLanguage,
  preferencesForLanguage,
} from '@/lib/i18n/locale-resolver';
import { formatDateInZone, formatTimeInZone } from '@/lib/i18n/format-datetime';
import {
  getAllTimezones,
  getTimezoneLabel,
  type TimezoneOption,
} from '@/lib/utils/timezones';

/**
 * Language & Region Settings Page (Row 77)
 *
 * The form edits the live locale (`useLocale()`), the same state the header's
 * country switcher writes, so switching country there updates this page too.
 * How the fields relate:
 *
 * - The header's country sets the language.
 * - The language sets date format, time format and currency (Thai: DD/MM/YYYY,
 *   24-hour, THB). The user can then change each one before saving.
 * - The timezone is detected from the visitor's IP and never follows the
 *   language. Picking one pins it; "Use detected timezone" unpins it.
 *
 * `handleSave()` writes the database (PUT /api/user/preferences) and then the
 * live locale via `setLocalePreferences()`, so the change applies at once --
 * see `docs/policies/08-locale-i18n-compliance.md` §0.
 */

interface LanguageSettings {
  language: string;
  timezone: string;
  dateFormat: 'MDY' | 'DMY' | 'YMD';
  timeFormat: '12h' | '24h';
  currency: string;
  timezoneSetByUser: boolean;
}

const currencies = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  { code: 'PKR', symbol: 'Rs', name: 'Pakistani Rupee' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
];

export default function LanguageSettingsPage(): React.ReactElement {
  const {
    t,
    setLocalePreferences,
    detectedTimezone,
    language,
    timezone,
    dateFormat,
    timeFormat,
    currency,
    timezoneSetByUser,
  } = useLocale();
  const [settings, setSettings] = useState<LanguageSettings>({
    language,
    timezone,
    dateFormat,
    timeFormat,
    currency,
    timezoneSetByUser: !!timezoneSetByUser,
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

  // Follow the live locale: a country picked in the header, the detected
  // timezone arriving, or a save all show up here.
  useEffect(() => {
    setSettings({
      language,
      timezone,
      dateFormat,
      timeFormat,
      currency,
      timezoneSetByUser: !!timezoneSetByUser,
    });
  }, [language, timezone, dateFormat, timeFormat, currency, timezoneSetByUser]);

  const handleChange = (field: keyof LanguageSettings, value: string): void => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  // A new language brings its country's date/time format and currency; the
  // timezone is left alone. Languages without a country (Chinese, Spanish)
  // keep the current formats and suggest USD (same rule as the header's
  // language picker).
  const handleLanguageChange = (value: string): void => {
    const implied = preferencesForLanguage(value);
    setSettings((prev) => ({
      ...prev,
      language: value,
      currency: currencyForLanguage(value),
      ...(implied && {
        dateFormat: implied.dateFormat,
        timeFormat: implied.timeFormat,
      }),
    }));
  };

  const handleTimezoneChange = (value: string): void => {
    setSettings((prev) => ({
      ...prev,
      timezone: value,
      timezoneSetByUser: true,
    }));
    setTimezoneSearch('');
  };

  const resetToDetectedTimezone = (): void => {
    if (!detectedTimezone) return;
    setSettings((prev) => ({
      ...prev,
      timezone: detectedTimezone,
      timezoneSetByUser: false,
    }));
  };

  // Previews use the same formatters as the rest of the app, with the
  // values currently in the form.
  const getCurrentTime = (): string => formatTimeInZone(Date.now(), settings);

  const getDatePreview = (): string => formatDateInZone(Date.now(), settings);

  const handleSave = async (): Promise<void> => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const { timezoneSetByUser: _local, ...stored } = settings;
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stored),
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
            onValueChange={handleLanguageChange}
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
          <p className="mt-2 text-sm text-muted-foreground">
            {t(
              'settings.language.cascade_hint',
              'Changing the language also sets the date format, time format and currency. You can still change each one below.'
            )}
          </p>
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
            onValueChange={handleTimezoneChange}
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
          {detectedTimezone && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>
                {t(
                  'settings.language.detected_timezone',
                  'Detected from your location:'
                )}{' '}
                <span className="font-mono">
                  {getTimezoneLabel(detectedTimezone)}
                </span>
              </span>
              {settings.timezone !== detectedTimezone && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={resetToDetectedTimezone}
                >
                  {t(
                    'settings.language.use_detected_timezone',
                    'Use detected timezone'
                  )}
                </Button>
              )}
            </div>
          )}
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
                  {curr.code} {curr.symbol} - {t(curr.name)}
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

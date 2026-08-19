'use client';

import { useState } from 'react';
import { Globe, Clock, Calendar, DollarSign, Check } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLocale } from '@/lib/context/locale-context';

export default function LanguageSettingsPage() {
  const {
    language,
    timezone,
    dateFormat,
    timeFormat,
    currency,
    setLocalePreferences,
    formatTimestamp,
    formatDate,
    formatCurrency,
    t,
  } = useLocale();

  const [isSaved, setIsSaved] = useState(false);

  const languages = [
    { code: 'en-GB', name: 'English (UK) 🇬🇧 - Tier-1 Primary', flag: '🇬🇧' },
    { code: 'en-US', name: 'English (US) 🇺🇸', flag: '🇺🇸' },
    { code: 'th', name: 'Thai 🇹🇭 - dLocal APAC', flag: '🇹🇭' },
    { code: 'hi', name: 'Hindi (हिंदी) 🇮🇳 - dLocal APAC', flag: '🇮🇳' },
    {
      code: 'vi',
      name: 'Vietnamese (Tiếng Việt) 🇻🇳 - dLocal APAC',
      flag: '🇻🇳',
    },
    {
      code: 'id',
      name: 'Indonesian (Bahasa Indonesia) 🇮🇩 - dLocal APAC',
      flag: '🇮🇩',
    },
    { code: 'ur', name: 'Urdu (اردو) 🇵🇰 - dLocal APAC', flag: '🇵🇰' },
    { code: 'tr', name: 'Turkish (Türkçe) 🇹🇷 - dLocal EMEA', flag: '🇹🇷' },
    { code: 'es', name: 'Spanish (Español) 🇪🇸', flag: '🇪🇸' },
    { code: 'pt', name: 'Portuguese (Português) 🇵🇹', flag: '🇵🇹' },
    { code: 'ja', name: 'Japanese (日本語) 🇯🇵', flag: '🇯🇵' },
    { code: 'de', name: 'German (Deutsch) 🇩🇪', flag: '🇩🇪' },
  ];

  const timezones = [
    {
      value: 'Europe/London',
      label: 'London Session (GMT/BST) 🇬🇧 - Tier-1 Primary',
    },
    { value: 'America/New_York', label: 'New York Session (ET) 🇺🇸' },
    { value: 'Asia/Kolkata', label: 'Kolkata / India (IST) 🇮🇳' },
    { value: 'Africa/Lagos', label: 'Lagos / Nigeria (WAT) 🇳🇬' },
    { value: 'Asia/Karachi', label: 'Karachi / Pakistan (PKT) 🇵🇰' },
    { value: 'Asia/Ho_Chi_Minh', label: 'Ho Chi Minh / Vietnam (ICT) 🇻🇳' },
    { value: 'Asia/Jakarta', label: 'Jakarta / Indonesia (WIB) 🇮🇩' },
    { value: 'Asia/Bangkok', label: 'Bangkok / Thailand (ICT) 🇹🇭' },
    {
      value: 'Africa/Johannesburg',
      label: 'Johannesburg / South Africa (SAST) 🇿🇦',
    },
    { value: 'Europe/Istanbul', label: 'Istanbul / Turkey (TRT) 🇹🇷' },
    { value: 'Asia/Tokyo', label: 'Tokyo Session (JST) 🇯🇵' },
    { value: 'UTC', label: 'Coordinated Universal Time (UTC)' },
  ];

  const currencies = [
    {
      code: 'GBP',
      symbol: '£',
      name: 'British Pound Sterling (UK 🇬🇧)',
      example: 850,
    },
    {
      code: 'INR',
      symbol: '₹',
      name: 'Indian Rupee (dLocal 🇮🇳)',
      example: 4200,
    },
    {
      code: 'NGN',
      symbol: '₦',
      name: 'Nigerian Naira (dLocal 🇳🇬)',
      example: 75000,
    },
    {
      code: 'PKR',
      symbol: 'Rs',
      name: 'Pakistani Rupee (dLocal 🇵🇰)',
      example: 14000,
    },
    {
      code: 'VND',
      symbol: '₫',
      name: 'Vietnamese Dong (dLocal 🇻🇳)',
      example: 1200000,
    },
    {
      code: 'IDR',
      symbol: 'Rp',
      name: 'Indonesian Rupiah (dLocal 🇮🇩)',
      example: 750000,
    },
    { code: 'THB', symbol: '฿', name: 'Thai Baht (dLocal 🇹🇭)', example: 1750 },
    {
      code: 'ZAR',
      symbol: 'R',
      name: 'South African Rand (dLocal 🇿🇦)',
      example: 900,
    },
    {
      code: 'TRY',
      symbol: '₺',
      name: 'Turkish Lira (dLocal 🇹🇷)',
      example: 1700,
    },
    { code: 'USD', symbol: '$', name: 'US Dollar (Global 🇺🇸)', example: 1000 },
    { code: 'EUR', symbol: '€', name: 'Euro (Eurozone 🇪🇺)', example: 950 },
    {
      code: 'JPY',
      symbol: '¥',
      name: 'Japanese Yen (Japan 🇯🇵)',
      example: 150000,
    },
  ];

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="animate-fade-in space-y-6 select-none">
      <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800/80 dark:bg-[#090c14]">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-900 dark:text-slate-100">
              <Globe className="h-4 w-4 text-amber-600 dark:text-amber-400" />{' '}
              {t(
                'settings.language_title',
                'Language, Timezone & Regional Formats'
              )}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {t(
                'settings.language_subtitle',
                'Configure internationalization, session clock timezones, and date formats'
              )}
            </p>
          </div>
          <Badge className="border-amber-500/40 bg-amber-500/10 font-mono text-[9px] text-amber-700 dark:text-amber-300">
            GLOBAL + dLocal 8 + UK
          </Badge>
        </div>

        {/* Display Language Selection */}
        <div className="max-w-md space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {t('Display Language', 'Display Language')}
          </Label>
          <Select
            value={language}
            onValueChange={(val) => setLocalePreferences({ language: val })}
          >
            <SelectTrigger className="border-slate-200 bg-slate-50 text-xs text-slate-900 dark:border-slate-700 dark:bg-[#06080e] dark:text-slate-100">
              <SelectValue
                placeholder={t('Select language', 'Select language')}
              />
            </SelectTrigger>
            <SelectContent className="border-slate-200 bg-white text-xs text-slate-900 dark:border-slate-700 dark:bg-[#0f1420] dark:text-slate-100">
              {languages.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator className="bg-slate-100 dark:bg-slate-800" />

        {/* Session Timezone Selection */}
        <div className="max-w-md space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {t(
              'Session Timezone (Live Market Clock)',
              'Session Timezone (Live Market Clock)'
            )}
          </Label>
          <Select
            value={timezone}
            onValueChange={(val) => setLocalePreferences({ timezone: val })}
          >
            <SelectTrigger className="border-slate-200 bg-slate-50 text-xs text-slate-900 dark:border-slate-700 dark:bg-[#06080e] dark:text-slate-100">
              <SelectValue
                placeholder={t('Select timezone', 'Select timezone')}
              />
            </SelectTrigger>
            <SelectContent className="border-slate-200 bg-white text-xs text-slate-900 dark:border-slate-700 dark:bg-[#0f1420] dark:text-slate-100">
              {timezones.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="mt-2 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-mono text-[11px] text-slate-600 dark:border-slate-800 dark:bg-[#06080e] dark:text-slate-400">
            <span>
              {t(
                'Current Terminal Session Clock:',
                'Current Terminal Session Clock:'
              )}
            </span>
            <span className="font-bold text-amber-700 dark:text-amber-300">
              {formatTimestamp(new Date())}
            </span>
          </div>
        </div>

        <Separator className="bg-slate-100 dark:bg-slate-800" />

        {/* Date & Time Formats */}
        <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('Date Format', 'Date Format')}
            </Label>
            <div className="space-y-2 text-xs">
              {[
                {
                  value: 'DMY' as const,
                  label: t(
                    'DD/MM/YYYY (UK / International)',
                    'DD/MM/YYYY (UK / International)'
                  ),
                  example: formatDate(new Date()),
                },
                {
                  value: 'MDY' as const,
                  label: t(
                    'MM/DD/YYYY (US Standard)',
                    'MM/DD/YYYY (US Standard)'
                  ),
                  example: '08/07/2026',
                },
                {
                  value: 'YMD' as const,
                  label: t(
                    'YYYY-MM-DD (ISO Standard)',
                    'YYYY-MM-DD (ISO Standard)'
                  ),
                  example: '2026-08-07',
                },
              ].map((f) => (
                <label
                  key={f.value}
                  className="flex cursor-pointer items-center gap-2 text-slate-700 dark:text-slate-300"
                >
                  <input
                    type="radio"
                    name="dateFormat"
                    checked={dateFormat === f.value}
                    onChange={() =>
                      setLocalePreferences({ dateFormat: f.value })
                    }
                    className="accent-amber-500"
                  />
                  <span>{f.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('Time Format', 'Time Format')}
            </Label>
            <div className="space-y-2 text-xs">
              {[
                {
                  value: '24h' as const,
                  label: t(
                    '24-Hour Military Format (22:04:36)',
                    '24-Hour Military Format (22:04:36)'
                  ),
                },
                {
                  value: '12h' as const,
                  label: t(
                    '12-Hour AM/PM Format (10:04:36 PM)',
                    '12-Hour AM/PM Format (10:04:36 PM)'
                  ),
                },
              ].map((tf) => (
                <label
                  key={tf.value}
                  className="flex cursor-pointer items-center gap-2 text-slate-700 dark:text-slate-300"
                >
                  <input
                    type="radio"
                    name="timeFormat"
                    checked={timeFormat === tf.value}
                    onChange={() =>
                      setLocalePreferences({ timeFormat: tf.value })
                    }
                    className="accent-amber-500"
                  />
                  <span>{tf.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <Separator className="bg-slate-100 dark:bg-slate-800" />

        {/* Display Currency (Supporting dLocal 8 + UK + Global) */}
        <div className="max-w-md space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {t(
              'Display Currency (dLocal APAC/EMEA & UK)',
              'Display Currency (dLocal APAC/EMEA & UK)'
            )}
          </Label>
          <Select
            value={currency}
            onValueChange={(val) => setLocalePreferences({ currency: val })}
          >
            <SelectTrigger className="border-slate-200 bg-slate-50 text-xs text-slate-900 dark:border-slate-700 dark:bg-[#06080e] dark:text-slate-100">
              <SelectValue
                placeholder={t('Select currency', 'Select currency')}
              />
            </SelectTrigger>
            <SelectContent className="border-slate-200 bg-white text-xs text-slate-900 dark:border-slate-700 dark:bg-[#0f1420] dark:text-slate-100">
              {currencies.map((curr) => (
                <SelectItem key={curr.code} value={curr.code}>
                  {curr.name} ({curr.symbol})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="mt-2 space-y-1 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
            <div className="flex justify-between font-medium text-slate-700 dark:text-slate-300">
              <span>
                {t('Formatted Price Example:', 'Formatted Price Example:')}
              </span>
              <strong className="font-mono text-sm text-amber-700 dark:text-amber-300">
                {formatCurrency(
                  currencies.find((c) => c.code === currency)?.example || 1000
                )}
              </strong>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSave}
            className="h-9 bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 hover:from-amber-400 hover:to-amber-500"
          >
            {isSaved ? (
              <>
                <Check className="mr-1 h-4 w-4 text-slate-950" />{' '}
                {t('settings.saved_btn', 'Regional Preferences Saved!')}
              </>
            ) : (
              t('settings.save_btn', 'Save Regional Preferences')
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

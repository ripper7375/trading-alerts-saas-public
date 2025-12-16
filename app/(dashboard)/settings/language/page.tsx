'use client';

import { useState, useEffect } from 'react';
import { Globe, Clock, Calendar, DollarSign, Check, Loader2 } from 'lucide-react';

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
 * Language Settings Page
 *
 * Features:
 * - Language selection dropdown
 * - Timezone selection
 * - Date format (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD)
 * - Time format (12-hour, 24-hour)
 * - Currency display
 */

interface LanguageSettings {
  language: string;
  timezone: string;
  dateFormat: 'MDY' | 'DMY' | 'YMD';
  timeFormat: '12h' | '24h';
  currency: string;
}

interface LanguageOption {
  code: string;
  name: string;
  flag: string;
}

interface TimezoneOption {
  value: string;
  label: string;
  region: string;
}

const languages: LanguageOption[] = [
  { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
  { code: 'en-GB', name: 'English (UK)', flag: '🇬🇧' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
];

const timezones: TimezoneOption[] = [
  { value: 'America/New_York', label: 'Eastern Time (ET)', region: 'Americas' },
  { value: 'America/Chicago', label: 'Central Time (CT)', region: 'Americas' },
  { value: 'America/Denver', label: 'Mountain Time (MT)', region: 'Americas' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', region: 'Americas' },
  { value: 'Europe/London', label: 'London (GMT)', region: 'Europe' },
  { value: 'Europe/Paris', label: 'Paris (CET)', region: 'Europe' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)', region: 'Europe' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)', region: 'Asia' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)', region: 'Asia' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)', region: 'Asia' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)', region: 'Australia' },
];

const currencies = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
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

  // Load preferences from API
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

  // Handle setting change
  const handleChange = (field: keyof LanguageSettings, value: string): void => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  // Get current time in selected timezone
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

  // Get date preview
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

  // Save settings
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
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Language & Region
      </h2>

      {/* Language Selection */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Language
        </h3>
        <div className="max-w-md">
          <Label htmlFor="language" className="text-sm font-medium mb-2 block">
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

      {/* Timezone */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Timezone
        </h3>
        <div className="max-w-md">
          <Label htmlFor="timezone" className="text-sm font-medium mb-2 block">
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
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Current time: {getCurrentTime()}
          </p>
        </div>
      </section>

      <Separator className="my-8" />

      {/* Date & Time Format */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Date & Time Format
        </h3>
        <div className="space-y-6 max-w-md">
          {/* Date Format */}
          <div>
            <Label className="text-sm font-medium mb-3 block">
              Date Format
            </Label>
            <div className="space-y-2">
              {[
                { value: 'MDY' as const, label: 'MM/DD/YYYY', example: '12/25/2024' },
                { value: 'DMY' as const, label: 'DD/MM/YYYY', example: '25/12/2024' },
                { value: 'YMD' as const, label: 'YYYY-MM-DD', example: '2024-12-25' },
              ].map((format) => (
                <label
                  key={format.value}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="dateFormat"
                    value={format.value}
                    checked={settings.dateFormat === format.value}
                    onChange={(e) => handleChange('dateFormat', e.target.value)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    {format.label}
                  </span>
                  <span className="text-gray-400 text-sm">({format.example})</span>
                </label>
              ))}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Preview: {getDatePreview()}
            </p>
          </div>

          {/* Time Format */}
          <div>
            <Label className="text-sm font-medium mb-3 block">
              Time Format
            </Label>
            <div className="space-y-2">
              {[
                { value: '12h' as const, label: '12-hour', example: '2:30 PM' },
                { value: '24h' as const, label: '24-hour', example: '14:30' },
              ].map((format) => (
                <label
                  key={format.value}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="timeFormat"
                    value={format.value}
                    checked={settings.timeFormat === format.value}
                    onChange={(e) => handleChange('timeFormat', e.target.value)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    {format.label}
                  </span>
                  <span className="text-gray-400 text-sm">({format.example})</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Separator className="my-8" />

      {/* Currency */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Currency
        </h3>
        <div className="max-w-md">
          <Label htmlFor="currency" className="text-sm font-medium mb-2 block">
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
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Used for displaying prices and monetary values
          </p>
        </div>
      </section>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          className="bg-blue-600 hover:bg-blue-700"
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : saveSuccess ? (
            <>
              <Check className="w-4 h-4 mr-2" />
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

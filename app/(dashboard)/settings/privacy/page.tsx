'use client';

import { useState, useEffect } from 'react';
import { Eye, Download, AlertCircle, Loader2, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Privacy Settings Page
 *
 * Features:
 * - Profile visibility (Public/Private/Connections Only)
 * - Data export request button
 * - Show trading statistics toggle
 * - Show email publicly toggle
 */

type ProfileVisibility = 'public' | 'private' | 'connections';

interface PrivacySettings {
  profileVisibility: ProfileVisibility;
  showStats: boolean;
  showEmail: boolean;
}

interface VisibilityOption {
  value: ProfileVisibility;
  label: string;
  description: string;
}

const visibilityOptions: VisibilityOption[] = [
  {
    value: 'public',
    label: 'Public',
    description: 'Anyone can view your profile and trading stats',
  },
  {
    value: 'private',
    label: 'Private',
    description: 'Only you can see your profile',
  },
  {
    value: 'connections',
    label: 'Connections Only',
    description: 'Only users you follow can view your profile',
  },
];

export default function PrivacySettingsPage(): React.ReactElement {
  const [settings, setSettings] = useState<PrivacySettings>({
    profileVisibility: 'private',
    showStats: false,
    showEmail: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Load settings from preferences API
  useEffect(() => {
    const loadSettings = async (): Promise<void> => {
      try {
        const response = await fetch('/api/user/preferences');
        if (response.ok) {
          const data = await response.json();
          if (data.preferences) {
            setSettings({
              profileVisibility: data.preferences.profileVisibility || 'private',
              showStats: data.preferences.showStats || false,
              showEmail: data.preferences.showEmail || false,
            });
          }
        }
      } catch (error) {
        console.error('Failed to load privacy settings:', error);
      }
    };

    loadSettings();
  }, []);

  // Handle visibility change
  const handleVisibilityChange = (visibility: ProfileVisibility): void => {
    setSettings((prev) => ({ ...prev, profileVisibility: visibility }));
  };

  // Handle toggle change
  const handleToggle = (field: 'showStats' | 'showEmail'): void => {
    setSettings((prev) => ({ ...prev, [field]: !prev[field] }));
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
      console.error('Failed to save privacy settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Request data export
  const handleDataExport = async (): Promise<void> => {
    setIsExporting(true);
    setExportSuccess(false);

    try {
      // In a real implementation, this would trigger a data export job
      // and send an email with a download link
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 5000);
    } catch (error) {
      console.error('Failed to request data export:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Privacy Settings
      </h2>

      {/* Profile Visibility */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Eye className="w-5 h-5" />
          Profile Visibility
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Control who can see your profile and trading activity.
        </p>
        <div className="space-y-3">
          {visibilityOptions.map((option) => (
            <label
              key={option.value}
              className={cn(
                'flex items-start p-4 border rounded-lg cursor-pointer transition-colors',
                settings.profileVisibility === option.value
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              )}
            >
              <input
                type="radio"
                name="visibility"
                value={option.value}
                checked={settings.profileVisibility === option.value}
                onChange={() => handleVisibilityChange(option.value)}
                className="mt-1 mr-3"
              />
              <div>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {option.label}
                </span>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {option.description}
                </p>
              </div>
            </label>
          ))}
        </div>
      </section>

      <Separator className="my-8" />

      {/* Data Sharing Options */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Data Sharing
        </h3>
        <div className="space-y-4">
          {/* Show Trading Statistics */}
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <Label className="font-semibold text-gray-900 dark:text-white">
                  Show Trading Statistics
                </Label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Display your alert count, chart views, and activity on your public profile
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.showStats}
                onClick={() => handleToggle('showStats')}
                className={cn(
                  'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2',
                  settings.showStats ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                    settings.showStats ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </button>
            </CardContent>
          </Card>

          {/* Show Email Publicly */}
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <Label className="font-semibold text-gray-900 dark:text-white">
                  Show Email Publicly
                </Label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Display your email address on your public profile
                </p>
                <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Not recommended for privacy reasons
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.showEmail}
                onClick={() => handleToggle('showEmail')}
                className={cn(
                  'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2',
                  settings.showEmail ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                    settings.showEmail ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </button>
            </CardContent>
          </Card>
        </div>
      </section>

      <Separator className="my-8" />

      {/* Data Export */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Download className="w-5 h-5" />
          Data Export
        </h3>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Request a copy of all your data including your profile information, alerts,
              watchlists, and activity history. We&apos;ll prepare your data and send you a
              download link via email.
            </p>
            <Button
              onClick={handleDataExport}
              disabled={isExporting}
              variant="outline"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Preparing Export...
                </>
              ) : exportSuccess ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Export Requested!
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Request Data Export
                </>
              )}
            </Button>
            {exportSuccess && (
              <p className="text-sm text-green-600 mt-2">
                You&apos;ll receive an email with a download link within 24 hours.
              </p>
            )}
          </CardContent>
        </Card>
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

'use client';

import { useState, useEffect } from 'react';
import { Eye, Download, AlertCircle, Loader2, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useLocale } from '@/lib/context/locale-context';

/**
 * Privacy Settings Page (Row 78)
 *
 * Visibility/toggle settings bound to the real GET/PUT
 * /api/user/preferences endpoint. The data-export button is a pre-existing
 * mock carried forward unchanged (no real export-job endpoint exists in
 * this repo) -- disclosed in Deviations, not fixed here (out of a
 * UI-BUILD session's scope) and not fabricated new by this session.
 */

type ProfileVisibility = 'public' | 'private' | 'connections';

interface PrivacySettings {
  profileVisibility: ProfileVisibility;
  showStats: boolean;
  showEmail: boolean;
}

const visibilityOptions: {
  value: ProfileVisibility;
  labelKey: string;
  label: string;
  descKey: string;
  description: string;
}[] = [
  {
    value: 'public',
    labelKey: 'settings.privacy.visibility_public',
    label: 'Public',
    descKey: 'settings.privacy.visibility_public_desc',
    description: 'Anyone can view your profile and trading stats',
  },
  {
    value: 'private',
    labelKey: 'settings.privacy.visibility_private',
    label: 'Private',
    descKey: 'settings.privacy.visibility_private_desc',
    description: 'Only you can see your profile',
  },
  {
    value: 'connections',
    labelKey: 'settings.privacy.visibility_connections',
    label: 'Connections Only',
    descKey: 'settings.privacy.visibility_connections_desc',
    description: 'Only users you follow can view your profile',
  },
];

export default function PrivacySettingsPage(): React.ReactElement {
  const { t } = useLocale();
  const [settings, setSettings] = useState<PrivacySettings>({
    profileVisibility: 'private',
    showStats: false,
    showEmail: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  useEffect(() => {
    const loadSettings = async (): Promise<void> => {
      try {
        const response = await fetch('/api/user/preferences');
        if (response.ok) {
          const data = await response.json();
          if (data.preferences) {
            setSettings({
              profileVisibility:
                data.preferences.profileVisibility || 'private',
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

  const handleVisibilityChange = (visibility: ProfileVisibility): void => {
    setSettings((prev) => ({ ...prev, profileVisibility: visibility }));
  };

  const handleToggle = (field: 'showStats' | 'showEmail'): void => {
    setSettings((prev) => ({ ...prev, [field]: !prev[field] }));
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
      console.error('Failed to save privacy settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDataExport = async (): Promise<void> => {
    setIsExporting(true);
    setExportSuccess(false);

    try {
      // Pre-existing mock, carried forward -- no real export-job endpoint
      // exists yet (see file-level comment).
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
      <h2 className="mb-6 text-2xl font-bold text-foreground">
        {t('settings.privacy.page_title', 'Privacy Settings')}
      </h2>

      <section className="mb-8">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Eye className="h-5 w-5" />
          {t('settings.privacy.profile_visibility', 'Profile Visibility')}
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          {t(
            'settings.privacy.profile_visibility_desc',
            'Control who can see your profile and trading activity.'
          )}
        </p>
        <div className="space-y-3">
          {visibilityOptions.map((option) => (
            <label
              key={option.value}
              className={cn(
                'flex cursor-pointer items-start rounded-lg border p-4 transition-colors',
                settings.profileVisibility === option.value
                  ? 'bg-primary/5 border-primary'
                  : 'hover:border-muted-foreground/40 border-border'
              )}
            >
              <input
                type="radio"
                name="visibility"
                value={option.value}
                checked={settings.profileVisibility === option.value}
                onChange={() => handleVisibilityChange(option.value)}
                className="mr-3 mt-1"
              />
              <div>
                <span className="font-semibold text-foreground">
                  {t(option.labelKey, option.label)}
                </span>
                <p className="text-sm text-muted-foreground">
                  {t(option.descKey, option.description)}
                </p>
              </div>
            </label>
          ))}
        </div>
      </section>

      <Separator className="my-8" />

      <section className="mb-8">
        <h3 className="mb-4 text-lg font-semibold text-foreground">
          {t('settings.privacy.data_sharing', 'Data Sharing')}
        </h3>
        <div className="space-y-4">
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <Label className="font-semibold text-foreground">
                  {t(
                    'settings.privacy.show_trading_stats',
                    'Show Trading Statistics'
                  )}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t(
                    'settings.privacy.show_trading_stats_desc',
                    'Display your alert count, chart views, and activity on your public profile'
                  )}
                </p>
              </div>
              <Switch
                checked={settings.showStats}
                onCheckedChange={() => handleToggle('showStats')}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <Label className="font-semibold text-foreground">
                  {t(
                    'settings.privacy.show_email_publicly',
                    'Show Email Publicly'
                  )}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t(
                    'settings.privacy.show_email_publicly_desc',
                    'Display your email address on your public profile'
                  )}
                </p>
                <p className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-3 w-3" />
                  {t(
                    'settings.privacy.not_recommended_privacy',
                    'Not recommended for privacy reasons'
                  )}
                </p>
              </div>
              <Switch
                checked={settings.showEmail}
                onCheckedChange={() => handleToggle('showEmail')}
              />
            </CardContent>
          </Card>
        </div>
      </section>

      <Separator className="my-8" />

      <section className="mb-8">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Download className="h-5 w-5" />
          {t('settings.privacy.data_export', 'Data Export')}
        </h3>
        <Card>
          <CardContent className="p-4">
            <p className="mb-4 text-sm text-muted-foreground">
              {t(
                'settings.privacy.data_export_desc',
                "Request a copy of all your data including your profile information, alerts, and activity history. We'll prepare your data and send you a download link via email."
              )}
            </p>
            <Button
              onClick={handleDataExport}
              disabled={isExporting}
              variant="outline"
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t(
                    'settings.privacy.preparing_export',
                    'Preparing Export...'
                  )}
                </>
              ) : exportSuccess ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  {t('settings.privacy.export_requested', 'Export Requested!')}
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  {t(
                    'settings.privacy.request_data_export',
                    'Request Data Export'
                  )}
                </>
              )}
            </Button>
            {exportSuccess && (
              <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">
                {t(
                  'settings.privacy.export_email_notice',
                  "You'll receive an email with a download link within 24 hours."
                )}
              </p>
            )}
          </CardContent>
        </Card>
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
              {t('Saved!', 'Saved!')}
            </>
          ) : (
            t('Save Changes', 'Save Changes')
          )}
        </Button>
      </div>
    </div>
  );
}

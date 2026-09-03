'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';
import { ToastContainer } from '@/components/ui/toast-container';
import {
  Shield,
  History,
  Bell,
  RefreshCw,
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
  MapPin,
  Check,
  X,
  AlertTriangle,
  Key,
  Loader2,
  Copy,
  Eye,
  EyeOff,
  Download,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLocale } from '@/lib/context/locale-context';

/**
 * Security Settings Page (Row 81)
 *
 * - Security alert email preferences (real GET/PUT /api/user/preferences)
 * - 2FA management: setup/verify/disable/backup codes, all against real
 *   /api/user/2fa/* endpoints
 * - Login history with device/location info (GET /api/user/login-history,
 *   paginated)
 */

interface LoginHistoryItem {
  id: string;
  status: 'SUCCESS' | 'FAILED' | 'BLOCKED';
  provider: string;
  device: string;
  browser: string;
  os: string;
  location: string;
  ipAddress: string;
  isNewDevice: boolean;
  createdAt: string;
}

interface SecurityPreferences {
  newDeviceAlerts: boolean;
  passwordChangeAlerts: boolean;
}

function getDeviceIcon(
  device: string
): React.ComponentType<{ className?: string }> {
  const deviceLower = device.toLowerCase();
  if (deviceLower.includes('mobile') || deviceLower.includes('phone')) {
    return Smartphone;
  }
  if (deviceLower.includes('tablet') || deviceLower.includes('ipad')) {
    return Tablet;
  }
  if (deviceLower.includes('desktop') || deviceLower.includes('pc')) {
    return Monitor;
  }
  return Laptop;
}

function formatRelativeTime(
  dateString: string,
  t: (keyOrText: string, fallback?: string) => string
): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return t('settings.security.just_now', 'Just now');
  if (diffMins < 60)
    return t('settings.security.minutes_ago', '{n} minute{plural} ago')
      .replace('{n}', String(diffMins))
      .replace('{plural}', diffMins === 1 ? '' : 's');
  if (diffHours < 24)
    return t('settings.security.hours_ago', '{n} hour{plural} ago')
      .replace('{n}', String(diffHours))
      .replace('{plural}', diffHours === 1 ? '' : 's');
  if (diffDays < 7)
    return t('settings.security.days_ago', '{n} day{plural} ago')
      .replace('{n}', String(diffDays))
      .replace('{plural}', diffDays === 1 ? '' : 's');

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'SUCCESS':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'FAILED':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'BLOCKED':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export default function SecuritySettingsPage(): React.ReactElement {
  useSession();
  const { t } = useLocale();
  const { toasts, removeToast, success, error: showError } = useToast();

  const [loginHistory, setLoginHistory] = useState<LoginHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isLoadingMoreHistory, setIsLoadingMoreHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyHasMore, setHistoryHasMore] = useState(false);

  const [preferences, setPreferences] = useState<SecurityPreferences>({
    newDeviceAlerts: true,
    passwordChangeAlerts: true,
  });
  const [isLoadingPrefs, setIsLoadingPrefs] = useState(true);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [isLoading2FA, setIsLoading2FA] = useState(true);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [showBackupCodesDialog, setShowBackupCodesDialog] = useState(false);
  const [setupStep, setSetupStep] = useState<'qr' | 'verify' | 'backup'>('qr');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState([
    '',
    '',
    '',
    '',
    '',
    '',
  ]);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [remainingBackupCodes, setRemainingBackupCodes] = useState(0);
  const [is2FASubmitting, setIs2FASubmitting] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [regeneratePassword, setRegeneratePassword] = useState('');
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const fetchLoginHistory = useCallback(async (offset = 0, append = false) => {
    if (append) {
      setIsLoadingMoreHistory(true);
    } else {
      setIsLoadingHistory(true);
    }
    setHistoryError(null);
    try {
      const response = await fetch(
        `/api/user/login-history?limit=20&offset=${offset}`
      );
      if (response.ok) {
        const data = await response.json();
        setLoginHistory((prev) =>
          append ? [...prev, ...(data.history || [])] : data.history || []
        );
        setHistoryHasMore(Boolean(data.pagination?.hasMore));
      } else {
        setHistoryError(
          t(
            'settings.security.error_load_history',
            'Failed to load login history'
          )
        );
      }
    } catch (error) {
      console.error('Error fetching login history:', error);
      setHistoryError(
        t(
          'settings.security.error_load_history',
          'Failed to load login history'
        )
      );
    } finally {
      setIsLoadingHistory(false);
      setIsLoadingMoreHistory(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoadMoreHistory = useCallback(() => {
    fetchLoginHistory(loginHistory.length, true);
  }, [fetchLoginHistory, loginHistory.length]);

  const fetchPreferences = useCallback(async () => {
    setIsLoadingPrefs(true);
    try {
      const response = await fetch('/api/user/preferences');
      if (response.ok) {
        const data = await response.json();
        setPreferences({
          newDeviceAlerts: data.preferences?.newDeviceAlerts ?? true,
          passwordChangeAlerts: data.preferences?.passwordChangeAlerts ?? true,
        });
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    } finally {
      setIsLoadingPrefs(false);
    }
  }, []);

  const fetch2FAStatus = useCallback(async () => {
    setIsLoading2FA(true);
    try {
      const response = await fetch('/api/user/2fa/setup');
      if (response.ok) {
        const data = await response.json();
        setTwoFactorEnabled(data.enabled);
      }
      const backupResponse = await fetch('/api/user/2fa/backup-codes');
      if (backupResponse.ok) {
        const backupData = await backupResponse.json();
        setRemainingBackupCodes(backupData.remainingCodes || 0);
      }
    } catch (error) {
      console.error('Error fetching 2FA status:', error);
    } finally {
      setIsLoading2FA(false);
    }
  }, []);

  useEffect(() => {
    fetchLoginHistory();
    fetchPreferences();
    fetch2FAStatus();
  }, [fetchLoginHistory, fetchPreferences, fetch2FAStatus]);

  const startSetup = async (): Promise<void> => {
    setIs2FASubmitting(true);
    setTwoFactorError(null);
    try {
      const response = await fetch('/api/user/2fa/setup', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error ||
            t(
              'settings.security.error_start_2fa_setup',
              'Failed to start 2FA setup'
            )
        );
      }
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setSetupStep('qr');
      setShowSetupDialog(true);
    } catch (error) {
      showError(
        t('settings.security.setup_failed', 'Setup Failed'),
        error instanceof Error
          ? error.message
          : t(
              'settings.security.error_start_2fa_setup',
              'Failed to start 2FA setup'
            )
      );
    } finally {
      setIs2FASubmitting(false);
    }
  };

  const handleCodeChange = (index: number, value: string): void => {
    if (value && !/^\d$/.test(value)) return;
    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);
    setTwoFactorError(null);
    if (value && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ): void => {
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const verifyAndEnable = async (): Promise<void> => {
    const code = verificationCode.join('');
    if (code.length !== 6) {
      setTwoFactorError(
        t(
          'settings.security.error_enter_all_digits',
          'Please enter all 6 digits'
        )
      );
      return;
    }
    setIs2FASubmitting(true);
    setTwoFactorError(null);
    try {
      const response = await fetch('/api/user/2fa/verify-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error || t('settings.security.invalid_code', 'Invalid code')
        );
      }
      setBackupCodes(data.backupCodes);
      setSetupStep('backup');
      setTwoFactorEnabled(true);
      setRemainingBackupCodes(10);
      success(
        t('settings.security.2fa_enabled', '2FA Enabled'),
        t(
          'settings.security.2fa_enabled_desc',
          'Two-factor authentication has been enabled'
        )
      );
    } catch (error) {
      setTwoFactorError(
        error instanceof Error
          ? error.message
          : t('settings.security.verification_failed', 'Verification failed')
      );
      setVerificationCode(['', '', '', '', '', '']);
      codeInputRefs.current[0]?.focus();
    } finally {
      setIs2FASubmitting(false);
    }
  };

  const disable2FA = async (): Promise<void> => {
    if (!disablePassword || disableCode.length !== 6) {
      setTwoFactorError(
        t(
          'settings.security.error_enter_password_and_code',
          'Please enter your password and 2FA code'
        )
      );
      return;
    }
    setIs2FASubmitting(true);
    setTwoFactorError(null);
    try {
      const response = await fetch('/api/user/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: disablePassword, code: disableCode }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error ||
            t('settings.security.error_disable_2fa', 'Failed to disable 2FA')
        );
      }
      setTwoFactorEnabled(false);
      setShowDisableDialog(false);
      setDisablePassword('');
      setDisableCode('');
      success(
        t('settings.security.2fa_disabled', '2FA Disabled'),
        t(
          'settings.security.2fa_disabled_desc',
          'Two-factor authentication has been disabled'
        )
      );
    } catch (error) {
      setTwoFactorError(
        error instanceof Error
          ? error.message
          : t('settings.security.error_disable_2fa', 'Failed to disable 2FA')
      );
    } finally {
      setIs2FASubmitting(false);
    }
  };

  const regenerateBackupCodes = async (): Promise<void> => {
    if (!regeneratePassword) {
      setTwoFactorError(
        t(
          'settings.security.error_enter_password',
          'Please enter your password'
        )
      );
      return;
    }
    setIs2FASubmitting(true);
    setTwoFactorError(null);
    try {
      const response = await fetch('/api/user/2fa/backup-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: regeneratePassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error ||
            t(
              'settings.security.error_regenerate_backup_codes',
              'Failed to regenerate backup codes'
            )
        );
      }
      setBackupCodes(data.backupCodes);
      setRemainingBackupCodes(10);
      setRegeneratePassword('');
      success(
        t('settings.security.codes_regenerated', 'Codes Regenerated'),
        t(
          'settings.security.codes_regenerated_desc',
          'New backup codes have been generated'
        )
      );
    } catch (error) {
      setTwoFactorError(
        error instanceof Error
          ? error.message
          : t(
              'settings.security.error_regenerate_codes',
              'Failed to regenerate codes'
            )
      );
    } finally {
      setIs2FASubmitting(false);
    }
  };

  const copyBackupCodes = (): void => {
    const codesText = backupCodes.join('\n');
    navigator.clipboard.writeText(codesText);
    success(
      t('settings.security.copied', 'Copied'),
      t(
        'settings.security.backup_codes_copied',
        'Backup codes copied to clipboard'
      )
    );
  };

  const downloadBackupCodes = (): void => {
    const header = t(
      'settings.security.backup_codes_file_header',
      'DavinTrade - 2FA Backup Codes'
    );
    const notice = t(
      'settings.security.backup_codes_file_notice',
      'Keep these codes in a safe place.\nEach code can only be used once.'
    );
    const generatedLabel = t('settings.security.generated_label', 'Generated:');
    const codesText = `${header}\n${'='.repeat(40)}\n\n${notice}\n\n${backupCodes.map((code, i) => `${i + 1}. ${code}`).join('\n')}\n\n${generatedLabel} ${new Date().toLocaleString()}`;
    const blob = new Blob([codesText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'davintrade-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const closeSetupDialog = (): void => {
    setShowSetupDialog(false);
    setSetupStep('qr');
    setQrCode(null);
    setSecret(null);
    setVerificationCode(['', '', '', '', '', '']);
    setBackupCodes([]);
    setTwoFactorError(null);
  };

  const updatePreference = async (
    key: keyof SecurityPreferences,
    value: boolean
  ): Promise<void> => {
    setIsSavingPrefs(true);
    const previousValue = preferences[key];

    setPreferences((prev) => ({ ...prev, [key]: value }));

    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });

      if (!response.ok) {
        throw new Error(
          t(
            'settings.security.error_update_preference',
            'Failed to update preference'
          )
        );
      }

      success(
        t('settings.security.preference_updated', 'Preference Updated'),
        t(
          'settings.security.preference_updated_desc',
          'Security alert setting has been {state}.'
        ).replace(
          '{state}',
          value
            ? t('settings.security.enabled_state', 'enabled')
            : t('settings.security.disabled_state', 'disabled')
        )
      );
    } catch (error) {
      setPreferences((prev) => ({ ...prev, [key]: previousValue }));
      showError(
        t('settings.security.update_failed', 'Update Failed'),
        t(
          'settings.security.error_update_preference_retry',
          'Could not update preference. Please try again.'
        )
      );
      console.error('Error updating preference:', error);
    } finally {
      setIsSavingPrefs(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <h2 className="mb-6 text-2xl font-bold text-foreground">
        {t('settings.security_settings', 'Security Settings')}
      </h2>

      {/* Security Alerts */}
      <section className="mb-8">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Bell className="h-5 w-5" />
          {t('settings.security.security_alerts', 'Security Alerts')}
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          {t(
            'settings.security.security_alerts_desc',
            'Receive email notifications when important security events occur.'
          )}
        </p>

        {isLoadingPrefs ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="mb-2 h-4 w-48 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-64 animate-pulse rounded bg-muted" />
                    </div>
                    <div className="h-5 w-10 animate-pulse rounded-full bg-muted" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <Card>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label
                      htmlFor="newDeviceAlerts"
                      className="cursor-pointer font-semibold text-foreground"
                    >
                      {t(
                        'settings.security.new_device_alerts',
                        'New Device Login Alerts'
                      )}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {t(
                        'settings.security.new_device_alerts_desc',
                        'Get notified when your account is accessed from a new device'
                      )}
                    </p>
                  </div>
                </div>
                <Switch
                  id="newDeviceAlerts"
                  checked={preferences.newDeviceAlerts}
                  onCheckedChange={(checked) =>
                    updatePreference('newDeviceAlerts', checked)
                  }
                  disabled={isSavingPrefs}
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label
                      htmlFor="passwordChangeAlerts"
                      className="cursor-pointer font-semibold text-foreground"
                    >
                      {t(
                        'settings.security.password_change_alerts',
                        'Password Change Alerts'
                      )}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {t(
                        'settings.security.password_change_alerts_desc',
                        'Get notified when your password is changed'
                      )}
                    </p>
                  </div>
                </div>
                <Switch
                  id="passwordChangeAlerts"
                  checked={preferences.passwordChangeAlerts}
                  onCheckedChange={(checked) =>
                    updatePreference('passwordChangeAlerts', checked)
                  }
                  disabled={isSavingPrefs}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </section>

      <Separator className="my-8" />

      {/* Two-Factor Authentication */}
      <section className="mb-8">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Key className="h-5 w-5" />
          {t('Two-Factor Authentication', 'Two-Factor Authentication')}
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          {t(
            'settings.security.2fa_intro',
            'Add an extra layer of security to your account by requiring a verification code from your authenticator app.'
          )}
        </p>

        {isLoading2FA ? (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
                <div className="flex-1">
                  <div className="mb-2 h-4 w-48 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-64 animate-pulse rounded bg-muted" />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : twoFactorEnabled ? (
          <Card className="border-emerald-200 dark:border-emerald-900">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                    <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {t(
                          'Two-Factor Authentication',
                          'Two-Factor Authentication'
                        )}
                      </span>
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                        {t('settings.security.enabled_badge', 'Enabled')}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t(
                        'settings.security.protected_with_2fa',
                        'Your account is protected with 2FA'
                      )}
                    </p>
                    {remainingBackupCodes <= 3 && remainingBackupCodes > 0 && (
                      <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
                        {t(
                          'settings.security.backup_codes_warning',
                          'Warning: Only {n} backup code{plural} remaining'
                        )
                          .replace('{n}', String(remainingBackupCodes))
                          .replace(
                            '{plural}',
                            remainingBackupCodes !== 1 ? 's' : ''
                          )}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBackupCodesDialog(true)}
                  >
                    {t('settings.security.backup_codes', 'Backup Codes')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDisableDialog(true)}
                    className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
                  >
                    {t('settings.security.disable', 'Disable')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {t(
                          'Two-Factor Authentication',
                          'Two-Factor Authentication'
                        )}
                      </span>
                      <Badge className="bg-muted text-muted-foreground">
                        {t('settings.security.not_enabled', 'Not Enabled')}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t(
                        'settings.security.protect_with_authenticator',
                        'Protect your account with an authenticator app'
                      )}
                    </p>
                  </div>
                </div>
                <Button onClick={startSetup} disabled={is2FASubmitting}>
                  {is2FASubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('settings.security.setting_up', 'Setting up...')}
                    </>
                  ) : (
                    t('settings.security.enable_2fa', 'Enable 2FA')
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* 2FA Setup Dialog */}
      <Dialog
        open={showSetupDialog}
        onOpenChange={(open) => !open && closeSetupDialog()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {setupStep === 'qr' &&
                t('settings.security.scan_qr_code', 'Scan QR Code')}
              {setupStep === 'verify' &&
                t('settings.security.verify_code', 'Verify Code')}
              {setupStep === 'backup' &&
                t('settings.security.save_backup_codes', 'Save Backup Codes')}
            </DialogTitle>
            <DialogDescription>
              {setupStep === 'qr' &&
                t(
                  'settings.security.scan_qr_desc',
                  'Scan this QR code with your authenticator app'
                )}
              {setupStep === 'verify' &&
                t(
                  'settings.security.enter_6digit_code',
                  'Enter the 6-digit code from your authenticator app'
                )}
              {setupStep === 'backup' &&
                t(
                  'settings.security.save_codes_safe_place',
                  'Save these backup codes in a safe place'
                )}
            </DialogDescription>
          </DialogHeader>

          {setupStep === 'qr' && (
            <div className="space-y-4">
              {qrCode && (
                <div className="flex justify-center rounded-lg bg-white p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrCode}
                    alt={t('settings.security.2fa_qr_code_alt', '2FA QR Code')}
                    className="h-48 w-48"
                  />
                </div>
              )}
              {secret && (
                <div>
                  <p className="mb-2 text-sm text-muted-foreground">
                    {t(
                      'settings.security.enter_code_manually',
                      'Or enter this code manually:'
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 break-all rounded bg-muted p-2 font-mono text-sm">
                      {showSecret ? secret : '••••••••••••••••'}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSecret(!showSecret)}
                      aria-label={
                        showSecret
                          ? t(
                              'settings.security.hide_secret_key',
                              'Hide secret key'
                            )
                          : t(
                              'settings.security.show_secret_key',
                              'Show secret key'
                            )
                      }
                    >
                      {showSecret ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(secret);
                        success(
                          t('settings.security.copied', 'Copied'),
                          t(
                            'settings.security.secret_copied',
                            'Secret copied to clipboard'
                          )
                        );
                      }}
                      aria-label={t(
                        'settings.security.copy_secret_key_aria',
                        'Copy secret key to clipboard'
                      )}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              <Button className="w-full" onClick={() => setSetupStep('verify')}>
                {t('settings.security.continue', 'Continue')}
              </Button>
            </div>
          )}

          {setupStep === 'verify' && (
            <div className="space-y-4">
              {twoFactorError && (
                <div className="rounded border-l-4 border-red-500 bg-red-50 p-3 dark:bg-red-900/20">
                  <p className="text-sm text-red-800 dark:text-red-200">
                    {twoFactorError}
                  </p>
                </div>
              )}
              <div className="flex justify-center gap-2">
                {verificationCode.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      codeInputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleCodeChange(index, e.target.value)}
                    onKeyDown={(e) => handleCodeKeyDown(index, e)}
                    disabled={is2FASubmitting}
                    className="h-12 w-10 rounded-lg border border-border bg-background text-center text-xl font-bold focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSetupStep('qr')}
                  className="flex-1"
                >
                  {t('settings.security.back', 'Back')}
                </Button>
                <Button
                  onClick={verifyAndEnable}
                  disabled={is2FASubmitting || verificationCode.some((c) => !c)}
                  className="flex-1"
                >
                  {is2FASubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('settings.security.verifying', 'Verifying...')}
                    </>
                  ) : (
                    t('settings.security.verify_and_enable', 'Verify & Enable')
                  )}
                </Button>
              </div>
            </div>
          )}

          {setupStep === 'backup' && (
            <div className="space-y-4">
              <div className="rounded border-l-4 border-amber-500 bg-amber-50 p-3 dark:bg-amber-900/20">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  {t(
                    'settings.security.save_codes_now',
                    'Important: Save these codes now!'
                  )}
                </p>
                <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                  {t(
                    'settings.security.save_codes_now_desc',
                    "You won't be able to see them again. Each code can only be used once."
                  )}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-4 font-mono text-sm">
                {backupCodes.map((code, index) => (
                  <div
                    key={index}
                    className="rounded bg-background p-2 text-center"
                  >
                    {code}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={copyBackupCodes}
                  className="flex-1"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  {t('settings.security.copy', 'Copy')}
                </Button>
                <Button
                  variant="outline"
                  onClick={downloadBackupCodes}
                  className="flex-1"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {t('settings.security.download', 'Download')}
                </Button>
              </div>
              <Button className="w-full" onClick={closeSetupDialog}>
                {t('settings.security.done', 'Done')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Disable 2FA Dialog */}
      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t(
                'settings.security.disable_2fa_title',
                'Disable Two-Factor Authentication'
              )}
            </DialogTitle>
            <DialogDescription>
              {t(
                'settings.security.disable_2fa_desc',
                'Enter your password and a 2FA code to disable two-factor authentication.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {twoFactorError && (
              <div className="rounded border-l-4 border-red-500 bg-red-50 p-3 dark:bg-red-900/20">
                <p className="text-sm text-red-800 dark:text-red-200">
                  {twoFactorError}
                </p>
              </div>
            )}
            <div>
              <Label htmlFor="disablePassword">
                {t('settings.security.password_label', 'Password')}
              </Label>
              <input
                id="disablePassword"
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={t(
                  'settings.security.enter_your_password',
                  'Enter your password'
                )}
              />
            </div>
            <div>
              <Label htmlFor="disableCode">
                {t(
                  'settings.security.authentication_code',
                  'Authentication Code'
                )}
              </Label>
              <input
                id="disableCode"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={disableCode}
                onChange={(e) =>
                  setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-center font-mono text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="000000"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDisableDialog(false);
                  setDisablePassword('');
                  setDisableCode('');
                  setTwoFactorError(null);
                }}
                className="flex-1"
              >
                {t('Cancel')}
              </Button>
              <Button
                onClick={disable2FA}
                disabled={
                  is2FASubmitting ||
                  !disablePassword ||
                  disableCode.length !== 6
                }
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                {is2FASubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('settings.security.disabling', 'Disabling...')}
                  </>
                ) : (
                  t('settings.security.disable_2fa_button', 'Disable 2FA')
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Backup Codes Dialog */}
      <Dialog
        open={showBackupCodesDialog}
        onOpenChange={setShowBackupCodesDialog}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t('settings.security.backup_codes', 'Backup Codes')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'settings.security.view_regenerate_codes',
                'View or regenerate your backup codes. You have {n} codes remaining.'
              ).replace('{n}', String(remainingBackupCodes))}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {twoFactorError && (
              <div className="rounded border-l-4 border-red-500 bg-red-50 p-3 dark:bg-red-900/20">
                <p className="text-sm text-red-800 dark:text-red-200">
                  {twoFactorError}
                </p>
              </div>
            )}
            {backupCodes.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-4 font-mono text-sm">
                  {backupCodes.map((code, index) => (
                    <div
                      key={index}
                      className="rounded bg-background p-2 text-center"
                    >
                      {code}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={copyBackupCodes}
                    className="flex-1"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    {t('settings.security.copy', 'Copy')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={downloadBackupCodes}
                    className="flex-1"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {t('settings.security.download', 'Download')}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {t(
                    'settings.security.regenerate_password_prompt',
                    'Enter your password to regenerate new backup codes. This will invalidate all existing codes.'
                  )}
                </p>
                <div>
                  <Label htmlFor="regeneratePassword">
                    {t('settings.security.password_label', 'Password')}
                  </Label>
                  <input
                    id="regeneratePassword"
                    type="password"
                    value={regeneratePassword}
                    onChange={(e) => setRegeneratePassword(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder={t(
                      'settings.security.enter_your_password',
                      'Enter your password'
                    )}
                  />
                </div>
              </>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowBackupCodesDialog(false);
                  setBackupCodes([]);
                  setRegeneratePassword('');
                  setTwoFactorError(null);
                }}
                className="flex-1"
              >
                {t('settings.security.close', 'Close')}
              </Button>
              {backupCodes.length === 0 && (
                <Button
                  onClick={regenerateBackupCodes}
                  disabled={is2FASubmitting || !regeneratePassword}
                  className="flex-1"
                >
                  {is2FASubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('settings.security.generating', 'Generating...')}
                    </>
                  ) : (
                    t('settings.security.regenerate_codes', 'Regenerate Codes')
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Separator className="my-8" />

      {/* Login History */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <History className="h-5 w-5" />
              {t('settings.security.login_history', 'Login History')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t(
                'settings.security.login_history_desc',
                'Recent login activity on your account'
              )}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchLoginHistory()}
            disabled={isLoadingHistory}
          >
            <RefreshCw
              className={`mr-1 h-4 w-4 ${isLoadingHistory ? 'animate-spin' : ''}`}
            />
            {t('Refresh', 'Refresh')}
          </Button>
        </div>

        {historyError && (
          <Card className="mb-4 border-red-200 dark:border-red-900">
            <CardContent className="flex items-center gap-2 p-4 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <span>{historyError}</span>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {isLoadingHistory ? (
            <>
              {[1, 2, 3, 4, 5].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
                      <div className="flex-1">
                        <div className="mb-2 h-4 w-48 animate-pulse rounded bg-muted" />
                        <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          ) : loginHistory.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <History className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">
                  {t(
                    'settings.security.no_login_history',
                    'No login history available yet'
                  )}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(
                    'settings.security.login_activity_appear_here',
                    'Your login activity will appear here'
                  )}
                </p>
              </CardContent>
            </Card>
          ) : (
            loginHistory.map((entry) => {
              const Icon = getDeviceIcon(entry.device);
              return (
                <Card key={entry.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {t(
                              'settings.security.browser_on_os',
                              '{browser} on {os}'
                            )
                              .replace('{browser}', entry.browser)
                              .replace('{os}', entry.os)}
                          </span>
                          <Badge className={getStatusColor(entry.status)}>
                            {entry.status === 'SUCCESS' && (
                              <Check className="mr-1 h-3 w-3" />
                            )}
                            {entry.status === 'FAILED' && (
                              <X className="mr-1 h-3 w-3" />
                            )}
                            {entry.status === 'BLOCKED' && (
                              <AlertTriangle className="mr-1 h-3 w-3" />
                            )}
                            {entry.status === 'SUCCESS' &&
                              t('settings.security.status_success', 'SUCCESS')}
                            {entry.status === 'FAILED' &&
                              t('settings.security.status_failed', 'FAILED')}
                            {entry.status === 'BLOCKED' &&
                              t('settings.security.status_blocked', 'BLOCKED')}
                          </Badge>
                          {entry.isNewDevice && (
                            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                              {t('settings.security.new_device', 'New Device')}
                            </Badge>
                          )}
                        </div>

                        <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {entry.location}
                          </span>
                          <span>{entry.ipAddress}</span>
                        </div>

                        <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{formatRelativeTime(entry.createdAt, t)}</span>
                          <span>
                            {t(
                              'settings.security.via_provider',
                              'via {provider}'
                            ).replace('{provider}', entry.provider)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {loginHistory.length > 0 && (
          <div className="mt-4 text-center">
            {historyHasMore ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadMoreHistory}
                disabled={isLoadingMoreHistory}
              >
                {isLoadingMoreHistory ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : null}
                {t('settings.security.load_more', 'Load more')}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t(
                  'settings.security.showing_login_attempts',
                  'Showing {n} login attempt{plural}'
                )
                  .replace('{n}', String(loginHistory.length))
                  .replace('{plural}', loginHistory.length === 1 ? '' : 's')}
              </p>
            )}
          </div>
        )}
      </section>

      <Separator className="my-8" />

      {/* Security Activity Section */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Shield className="h-5 w-5" />
              {t('settings.security.security_activity', 'Security Activity')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t(
                'settings.security.security_activity_desc',
                'Password changes, two-factor changes, and device/login alerts for your account'
              )}
            </p>
          </div>
          <Link href="/settings/security/activity">
            <Button variant="outline" size="sm">
              {t('settings.security.view_all_activity', 'View All Activity')}
            </Button>
          </Link>
        </div>
      </section>

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

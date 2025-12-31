'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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

/**
 * Security Settings Page
 *
 * Features:
 * - Login history with device/location info
 * - Security alert preferences (new device, password change)
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

/**
 * Get icon component based on device type
 */
function getDeviceIcon(device: string): React.ComponentType<{ className?: string }> {
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

/**
 * Format relative time
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Get status badge color
 */
function getStatusColor(status: string): string {
  switch (status) {
    case 'SUCCESS':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'FAILED':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'BLOCKED':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  }
}

export default function SecuritySettingsPage(): React.ReactElement {
  useSession();
  const { toasts, removeToast, success, error: showError } = useToast();

  // Login history state
  const [loginHistory, setLoginHistory] = useState<LoginHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Security preferences state
  const [preferences, setPreferences] = useState<SecurityPreferences>({
    newDeviceAlerts: true,
    passwordChangeAlerts: true,
  });
  const [isLoadingPrefs, setIsLoadingPrefs] = useState(true);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  // 2FA state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [isLoading2FA, setIsLoading2FA] = useState(true);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [showBackupCodesDialog, setShowBackupCodesDialog] = useState(false);
  const [setupStep, setSetupStep] = useState<'qr' | 'verify' | 'backup'>('qr');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [remainingBackupCodes, setRemainingBackupCodes] = useState(0);
  const [is2FASubmitting, setIs2FASubmitting] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [regeneratePassword, setRegeneratePassword] = useState('');
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Fetch login history
  const fetchLoginHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const response = await fetch('/api/user/login-history?limit=20');
      if (response.ok) {
        const data = await response.json();
        setLoginHistory(data.history || []);
      } else {
        setHistoryError('Failed to load login history');
      }
    } catch (error) {
      console.error('Error fetching login history:', error);
      setHistoryError('Failed to load login history');
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Fetch security preferences
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

  // Fetch 2FA status
  const fetch2FAStatus = useCallback(async () => {
    setIsLoading2FA(true);
    try {
      const response = await fetch('/api/user/2fa/setup');
      if (response.ok) {
        const data = await response.json();
        setTwoFactorEnabled(data.enabled);
      }
      // Also fetch backup codes count
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

  // Fetch data on mount
  useEffect(() => {
    fetchLoginHistory();
    fetchPreferences();
    fetch2FAStatus();
  }, [fetchLoginHistory, fetchPreferences, fetch2FAStatus]);

  // 2FA Setup Functions
  const startSetup = async (): Promise<void> => {
    setIs2FASubmitting(true);
    setTwoFactorError(null);
    try {
      const response = await fetch('/api/user/2fa/setup', {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start 2FA setup');
      }
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setSetupStep('qr');
      setShowSetupDialog(true);
    } catch (error) {
      showError('Setup Failed', error instanceof Error ? error.message : 'Failed to start 2FA setup');
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

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const verifyAndEnable = async (): Promise<void> => {
    const code = verificationCode.join('');
    if (code.length !== 6) {
      setTwoFactorError('Please enter all 6 digits');
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
        throw new Error(data.error || 'Invalid code');
      }
      setBackupCodes(data.backupCodes);
      setSetupStep('backup');
      setTwoFactorEnabled(true);
      setRemainingBackupCodes(10);
      success('2FA Enabled', 'Two-factor authentication has been enabled');
    } catch (error) {
      setTwoFactorError(error instanceof Error ? error.message : 'Verification failed');
      setVerificationCode(['', '', '', '', '', '']);
      codeInputRefs.current[0]?.focus();
    } finally {
      setIs2FASubmitting(false);
    }
  };

  const disable2FA = async (): Promise<void> => {
    if (!disablePassword || disableCode.length !== 6) {
      setTwoFactorError('Please enter your password and 2FA code');
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
        throw new Error(data.error || 'Failed to disable 2FA');
      }
      setTwoFactorEnabled(false);
      setShowDisableDialog(false);
      setDisablePassword('');
      setDisableCode('');
      success('2FA Disabled', 'Two-factor authentication has been disabled');
    } catch (error) {
      setTwoFactorError(error instanceof Error ? error.message : 'Failed to disable 2FA');
    } finally {
      setIs2FASubmitting(false);
    }
  };

  const regenerateBackupCodes = async (): Promise<void> => {
    if (!regeneratePassword) {
      setTwoFactorError('Please enter your password');
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
        throw new Error(data.error || 'Failed to regenerate backup codes');
      }
      setBackupCodes(data.backupCodes);
      setRemainingBackupCodes(10);
      setRegeneratePassword('');
      success('Codes Regenerated', 'New backup codes have been generated');
    } catch (error) {
      setTwoFactorError(error instanceof Error ? error.message : 'Failed to regenerate codes');
    } finally {
      setIs2FASubmitting(false);
    }
  };

  const copyBackupCodes = (): void => {
    const codesText = backupCodes.join('\n');
    navigator.clipboard.writeText(codesText);
    success('Copied', 'Backup codes copied to clipboard');
  };

  const downloadBackupCodes = (): void => {
    const codesText = `Trading Alerts - 2FA Backup Codes\n${'='.repeat(40)}\n\nKeep these codes in a safe place.\nEach code can only be used once.\n\n${backupCodes.map((code, i) => `${i + 1}. ${code}`).join('\n')}\n\nGenerated: ${new Date().toLocaleString()}`;
    const blob = new Blob([codesText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trading-alerts-backup-codes.txt';
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

  // Update preference
  const updatePreference = async (
    key: keyof SecurityPreferences,
    value: boolean
  ): Promise<void> => {
    setIsSavingPrefs(true);
    const previousValue = preferences[key];

    // Optimistic update
    setPreferences((prev) => ({ ...prev, [key]: value }));

    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });

      if (!response.ok) {
        throw new Error('Failed to update preference');
      }

      success('Preference Updated', `Security alert setting has been ${value ? 'enabled' : 'disabled'}.`);
    } catch (error) {
      // Rollback on error
      setPreferences((prev) => ({ ...prev, [key]: previousValue }));
      showError('Update Failed', 'Could not update preference. Please try again.');
      console.error('Error updating preference:', error);
    } finally {
      setIsSavingPrefs(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Security Settings
      </h2>

      {/* Security Alerts Section */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Security Alerts
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Receive email notifications when important security events occur.
        </p>

        {isLoadingPrefs ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-2 animate-pulse" />
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-64 animate-pulse" />
                    </div>
                    <div className="w-10 h-5 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {/* New Device Alerts */}
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-gray-500" />
                  <div>
                    <Label
                      htmlFor="newDeviceAlerts"
                      className="font-semibold text-gray-900 dark:text-white cursor-pointer"
                    >
                      New Device Login Alerts
                    </Label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Get notified when your account is accessed from a new device
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

            {/* Password Change Alerts */}
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-gray-500" />
                  <div>
                    <Label
                      htmlFor="passwordChangeAlerts"
                      className="font-semibold text-gray-900 dark:text-white cursor-pointer"
                    >
                      Password Change Alerts
                    </Label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Get notified when your password is changed
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

      {/* Two-Factor Authentication Section */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Key className="w-5 h-5" />
          Two-Factor Authentication
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Add an extra layer of security to your account by requiring a verification code from your authenticator app.
        </p>

        {isLoading2FA ? (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-2 animate-pulse" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-64 animate-pulse" />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : twoFactorEnabled ? (
          <Card className="border-green-200 dark:border-green-900">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        Two-Factor Authentication
                      </span>
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        Enabled
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Your account is protected with 2FA
                    </p>
                    {remainingBackupCodes <= 3 && remainingBackupCodes > 0 && (
                      <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                        Warning: Only {remainingBackupCodes} backup code{remainingBackupCodes !== 1 ? 's' : ''} remaining
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
                    Backup Codes
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDisableDialog(true)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    Disable
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
                  <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        Two-Factor Authentication
                      </span>
                      <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400">
                        Not Enabled
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Protect your account with an authenticator app
                    </p>
                  </div>
                </div>
                <Button onClick={startSetup} disabled={is2FASubmitting}>
                  {is2FASubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    'Enable 2FA'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* 2FA Setup Dialog */}
      <Dialog open={showSetupDialog} onOpenChange={(open) => !open && closeSetupDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {setupStep === 'qr' && 'Scan QR Code'}
              {setupStep === 'verify' && 'Verify Code'}
              {setupStep === 'backup' && 'Save Backup Codes'}
            </DialogTitle>
            <DialogDescription>
              {setupStep === 'qr' && 'Scan this QR code with your authenticator app'}
              {setupStep === 'verify' && 'Enter the 6-digit code from your authenticator app'}
              {setupStep === 'backup' && 'Save these backup codes in a safe place'}
            </DialogDescription>
          </DialogHeader>

          {setupStep === 'qr' && (
            <div className="space-y-4">
              {qrCode && (
                <div className="flex justify-center p-4 bg-white rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
                </div>
              )}
              {secret && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Or enter this code manually:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 bg-gray-100 dark:bg-gray-800 rounded font-mono text-sm break-all">
                      {showSecret ? secret : '••••••••••••••••'}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSecret(!showSecret)}
                    >
                      {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(secret);
                        success('Copied', 'Secret copied to clipboard');
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
              <Button className="w-full" onClick={() => setSetupStep('verify')}>
                Continue
              </Button>
            </div>
          )}

          {setupStep === 'verify' && (
            <div className="space-y-4">
              {twoFactorError && (
                <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-3 rounded">
                  <p className="text-red-800 dark:text-red-200 text-sm">{twoFactorError}</p>
                </div>
              )}
              <div className="flex justify-center gap-2">
                {verificationCode.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { codeInputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleCodeChange(index, e.target.value)}
                    onKeyDown={(e) => handleCodeKeyDown(index, e)}
                    disabled={is2FASubmitting}
                    className="w-10 h-12 text-center text-xl font-bold border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSetupStep('qr')} className="flex-1">
                  Back
                </Button>
                <Button
                  onClick={verifyAndEnable}
                  disabled={is2FASubmitting || verificationCode.some((c) => !c)}
                  className="flex-1"
                >
                  {is2FASubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify & Enable'
                  )}
                </Button>
              </div>
            </div>
          )}

          {setupStep === 'backup' && (
            <div className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-3 rounded">
                <p className="text-amber-800 dark:text-amber-200 text-sm font-medium">
                  Important: Save these codes now!
                </p>
                <p className="text-amber-700 dark:text-amber-300 text-sm mt-1">
                  You won&apos;t be able to see them again. Each code can only be used once.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg font-mono text-sm">
                {backupCodes.map((code, index) => (
                  <div key={index} className="p-2 bg-white dark:bg-gray-700 rounded text-center">
                    {code}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={copyBackupCodes} className="flex-1">
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
                <Button variant="outline" onClick={downloadBackupCodes} className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
              <Button className="w-full" onClick={closeSetupDialog}>
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Disable 2FA Dialog */}
      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Enter your password and a 2FA code to disable two-factor authentication.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {twoFactorError && (
              <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-3 rounded">
                <p className="text-red-800 dark:text-red-200 text-sm">{twoFactorError}</p>
              </div>
            )}
            <div>
              <Label htmlFor="disablePassword">Password</Label>
              <input
                id="disablePassword"
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter your password"
              />
            </div>
            <div>
              <Label htmlFor="disableCode">Authentication Code</Label>
              <input
                id="disableCode"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full mt-1 px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary font-mono text-center text-lg tracking-widest"
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
                Cancel
              </Button>
              <Button
                onClick={disable2FA}
                disabled={is2FASubmitting || !disablePassword || disableCode.length !== 6}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                {is2FASubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Disabling...
                  </>
                ) : (
                  'Disable 2FA'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Backup Codes Dialog */}
      <Dialog open={showBackupCodesDialog} onOpenChange={setShowBackupCodesDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Backup Codes</DialogTitle>
            <DialogDescription>
              View or regenerate your backup codes. You have {remainingBackupCodes} codes remaining.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {twoFactorError && (
              <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-3 rounded">
                <p className="text-red-800 dark:text-red-200 text-sm">{twoFactorError}</p>
              </div>
            )}
            {backupCodes.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-2 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg font-mono text-sm">
                  {backupCodes.map((code, index) => (
                    <div key={index} className="p-2 bg-white dark:bg-gray-700 rounded text-center">
                      {code}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={copyBackupCodes} className="flex-1">
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                  <Button variant="outline" onClick={downloadBackupCodes} className="flex-1">
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Enter your password to regenerate new backup codes. This will invalidate all existing codes.
                </p>
                <div>
                  <Label htmlFor="regeneratePassword">Password</Label>
                  <input
                    id="regeneratePassword"
                    type="password"
                    value={regeneratePassword}
                    onChange={(e) => setRegeneratePassword(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter your password"
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
                Close
              </Button>
              {backupCodes.length === 0 && (
                <Button
                  onClick={regenerateBackupCodes}
                  disabled={is2FASubmitting || !regeneratePassword}
                  className="flex-1"
                >
                  {is2FASubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    'Regenerate Codes'
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Separator className="my-8" />

      {/* Login History Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <History className="w-5 h-5" />
              Login History
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Recent login activity on your account
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchLoginHistory}
            disabled={isLoadingHistory}
          >
            <RefreshCw
              className={`w-4 h-4 mr-1 ${isLoadingHistory ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </div>

        {historyError && (
          <Card className="mb-4 border-red-200 dark:border-red-900">
            <CardContent className="p-4 flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <span>{historyError}</span>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {isLoadingHistory ? (
            // Loading skeleton
            <>
              {[1, 2, 3, 4, 5].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-2 animate-pulse" />
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          ) : loginHistory.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  No login history available yet
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  Your login activity will appear here
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
                      {/* Device Icon */}
                      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {entry.browser} on {entry.os}
                          </span>
                          <Badge className={getStatusColor(entry.status)}>
                            {entry.status === 'SUCCESS' && <Check className="w-3 h-3 mr-1" />}
                            {entry.status === 'FAILED' && <X className="w-3 h-3 mr-1" />}
                            {entry.status === 'BLOCKED' && <AlertTriangle className="w-3 h-3 mr-1" />}
                            {entry.status}
                          </Badge>
                          {entry.isNewDevice && (
                            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                              New Device
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {entry.location}
                          </span>
                          <span>{entry.ipAddress}</span>
                        </div>

                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 dark:text-gray-500">
                          <span>{formatRelativeTime(entry.createdAt)}</span>
                          <span>via {entry.provider}</span>
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
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-4 text-center">
            Showing last {loginHistory.length} login attempts
          </p>
        )}
      </section>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

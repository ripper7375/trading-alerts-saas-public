'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';
import { useBeforeUnload } from '@/hooks/use-unsaved-changes';
import { ToastContainer } from '@/components/ui/toast-container';
import {
  Eye,
  EyeOff,
  Lock,
  Monitor,
  AlertTriangle,
  Loader2,
  Check,
  Shield,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

/**
 * Account Settings Page
 *
 * Features:
 * - Change password section (current, new, confirm)
 * - Password strength indicator
 * - Two-factor authentication toggle
 * - Active sessions list
 * - Delete account section with confirmation
 */

type PasswordStrength = 'weak' | 'medium' | 'strong';

interface PasswordVisibility {
  current: boolean;
  new: boolean;
  confirm: boolean;
}

interface SessionInfo {
  id: string;
  device: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
}

function getPasswordStrength(password: string): PasswordStrength {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score < 3) return 'weak';
  if (score < 5) return 'medium';
  return 'strong';
}

function getPasswordStrengthColor(strength: PasswordStrength): string {
  switch (strength) {
    case 'weak':
      return 'bg-red-500';
    case 'medium':
      return 'bg-yellow-500';
    case 'strong':
      return 'bg-green-500';
  }
}

function getPasswordStrengthPercent(strength: PasswordStrength): number {
  switch (strength) {
    case 'weak':
      return 33;
    case 'medium':
      return 66;
    case 'strong':
      return 100;
  }
}

export default function AccountSettingsPage(): React.ReactElement {
  // Session available for future use (2FA, session management)
  useSession();

  // Toast notifications
  const { toasts, removeToast, success, error: showError } = useToast();

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState<PasswordVisibility>({
    current: false,
    new: false,
    confirm: false,
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false);

  // 2FA state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  // Delete account state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Sessions state
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isRevokingSession, setIsRevokingSession] = useState<string | null>(null);

  // Fetch sessions on mount
  const fetchSessions = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/user/sessions');
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const passwordStrength = newPassword
    ? getPasswordStrength(newPassword)
    : null;

  // Check if password form has unsaved changes
  const hasPasswordChanges = useMemo(
    () => currentPassword.length > 0 || newPassword.length > 0 || confirmPassword.length > 0,
    [currentPassword, newPassword, confirmPassword]
  );

  // Warn before leaving with unsaved password changes
  useBeforeUnload(hasPasswordChanges, 'You have unsaved password changes. Are you sure you want to leave?');

  // Toggle password visibility
  const togglePasswordVisibility = (field: keyof PasswordVisibility): void => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  // Handle password change
  const handlePasswordChange = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setPasswordError(null);

    // Validation
    if (!currentPassword) {
      setPasswordError('Please enter your current password');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }

    if (!/[A-Z]/.test(newPassword)) {
      setPasswordError('Password must contain at least one uppercase letter');
      return;
    }

    if (!/[a-z]/.test(newPassword)) {
      setPasswordError('Password must contain at least one lowercase letter');
      return;
    }

    if (!/[0-9]/.test(newPassword)) {
      setPasswordError('Password must contain at least one number');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setIsChangingPassword(true);

    try {
      const response = await fetch('/api/user/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to change password');
      }

      setPasswordChangeSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Reset success indicator after 3 seconds
      setTimeout(() => setPasswordChangeSuccess(false), 3000);
    } catch (error) {
      setPasswordError(
        error instanceof Error ? error.message : 'Failed to change password'
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Handle 2FA toggle
  const handleTwoFactorToggle = (): void => {
    // In a real implementation, this would open a 2FA setup flow
    setTwoFactorEnabled(!twoFactorEnabled);
  };

  // Handle revoking a specific session
  const handleRevokeSession = async (sessionId: string): Promise<void> => {
    setIsRevokingSession(sessionId);
    try {
      const response = await fetch(`/api/user/sessions?id=${sessionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        success('Session Revoked', 'The session has been successfully revoked.');
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to revoke session');
      }
    } catch (error) {
      showError(
        'Failed to Revoke',
        error instanceof Error ? error.message : 'Failed to revoke session'
      );
    } finally {
      setIsRevokingSession(null);
    }
  };

  // Handle sign out all devices
  const handleSignOutAllDevices = async (): Promise<void> => {
    try {
      // First, revoke all other sessions via API
      await fetch('/api/user/sessions?all=true', {
        method: 'DELETE',
      });

      // Then sign out current session
      await signOut({ callbackUrl: '/login' });
    } catch (error) {
      console.error('Failed to sign out all devices:', error);
      await signOut({ callbackUrl: '/login' });
    }
  };

  // Handle account deletion
  const handleDeleteAccount = async (): Promise<void> => {
    if (deleteConfirmation !== 'DELETE') {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch('/api/user/account/deletion-request', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to request account deletion');
      }

      // Close dialog and notify user
      setIsDeleteDialogOpen(false);
      success(
        'Deletion Request Sent',
        'Check your email for confirmation link.'
      );
    } catch (error) {
      console.error('Delete account error:', error);
      showError(
        'Request Failed',
        error instanceof Error
          ? error.message
          : 'Failed to request account deletion'
      );
    } finally {
      setIsDeleting(false);
      setDeleteConfirmation('');
    }
  };

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Account Settings
      </h2>

      {/* Change Password Section */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Lock className="w-5 h-5" />
          Change Password
        </h3>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          {/* Current Password */}
          <div>
            <Label htmlFor="currentPassword" className="text-sm font-medium">
              Current Password
            </Label>
            <div className="relative mt-1">
              <Input
                id="currentPassword"
                type={showPasswords.current ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('current')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPasswords.current ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <Label htmlFor="newPassword" className="text-sm font-medium">
              New Password
            </Label>
            <div className="relative mt-1">
              <Input
                id="newPassword"
                type={showPasswords.new ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('new')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPasswords.new ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {newPassword && passwordStrength && (
              <div className="mt-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600 dark:text-gray-400">
                    Password strength:
                  </span>
                  <span
                    className={`font-semibold ${
                      passwordStrength === 'strong'
                        ? 'text-green-600'
                        : passwordStrength === 'medium'
                          ? 'text-yellow-600'
                          : 'text-red-600'
                    }`}
                  >
                    {passwordStrength.charAt(0).toUpperCase() +
                      passwordStrength.slice(1)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                  <div
                    className={`h-1 rounded-full transition-all ${getPasswordStrengthColor(passwordStrength)}`}
                    style={{
                      width: `${getPasswordStrengthPercent(passwordStrength)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <Label htmlFor="confirmPassword" className="text-sm font-medium">
              Confirm New Password
            </Label>
            <div className="relative mt-1">
              <Input
                id="confirmPassword"
                type={showPasswords.confirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('confirm')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPasswords.confirm ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-red-600 mt-1">
                Passwords do not match
              </p>
            )}
          </div>

          {/* Error Message */}
          {passwordError && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              {passwordError}
            </p>
          )}

          {/* Success Message */}
          {passwordChangeSuccess && (
            <p className="text-sm text-green-600 flex items-center gap-1">
              <Check className="w-4 h-4" />
              Password changed successfully
            </p>
          )}

          <Button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700"
            disabled={isChangingPassword}
          >
            {isChangingPassword ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Password'
            )}
          </Button>
        </form>
      </section>

      <Separator className="my-8" />

      {/* Two-Factor Authentication */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Two-Factor Authentication
        </h3>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">
                2FA Status
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {twoFactorEnabled
                  ? 'Your account is protected with 2FA'
                  : 'Add an extra layer of security to your account'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge
                className={
                  twoFactorEnabled
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }
              >
                {twoFactorEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
              <Button
                variant={twoFactorEnabled ? 'outline' : 'default'}
                onClick={handleTwoFactorToggle}
                className={
                  twoFactorEnabled ? '' : 'bg-blue-600 hover:bg-blue-700'
                }
              >
                {twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator className="my-8" />

      {/* Active Sessions */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Active Sessions
        </h3>
        <div className="space-y-3">
          {isLoadingSessions ? (
            // Loading skeleton
            [1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    <div>
                      <div className="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1" />
                      <div className="h-3 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : sessions.length === 0 ? (
            <Card>
              <CardContent className="p-4 text-center text-gray-500">
                No active sessions found
              </CardContent>
            </Card>
          ) : (
            sessions.map((sessionItem) => (
              <Card key={sessionItem.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Monitor className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="font-semibold text-sm text-gray-900 dark:text-white">
                        {sessionItem.device}
                        {sessionItem.isCurrent && (
                          <Badge className="ml-2 bg-green-100 text-green-800 text-xs">
                            Current
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {sessionItem.location} • {sessionItem.lastActive}
                      </p>
                    </div>
                  </div>
                  {!sessionItem.isCurrent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleRevokeSession(sessionItem.id)}
                      disabled={isRevokingSession === sessionItem.id}
                    >
                      {isRevokingSession === sessionItem.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Revoke'
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
        <Button
          variant="destructive"
          className="mt-4"
          onClick={handleSignOutAllDevices}
        >
          Sign Out All Devices
        </Button>
      </section>

      <Separator className="my-8" />

      {/* Delete Account */}
      <section>
        <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Danger Zone
        </h3>
        <Card className="border-red-200 dark:border-red-900">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  Delete Account
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Permanently delete your account and all associated data. This
                  action cannot be undone.
                </p>
              </div>
              <Dialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button variant="destructive">Delete Account</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-600">
                      <AlertTriangle className="w-5 h-5" />
                      Delete Account
                    </DialogTitle>
                    <DialogDescription>
                      This action cannot be undone. This will permanently delete
                      your account and remove all your data from our servers.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="my-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Type <strong>DELETE</strong> to confirm:
                    </p>
                    <Input
                      value={deleteConfirmation}
                      onChange={(e) => setDeleteConfirmation(e.target.value)}
                      placeholder="Type DELETE to confirm"
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsDeleteDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDeleteAccount}
                      disabled={deleteConfirmation !== 'DELETE' || isDeleting}
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        'Delete Account'
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

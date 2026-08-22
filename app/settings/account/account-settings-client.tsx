'use client';

import { format, formatDistanceToNow } from 'date-fns';
import {
  Eye,
  EyeOff,
  Lock,
  Laptop,
  Smartphone,
  Monitor,
  Tablet,
  AlertTriangle,
  Loader2,
  Check,
  Shield,
  RefreshCw,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ToastContainer } from '@/components/ui/toast-container';
import { useToast } from '@/hooks/use-toast';

/**
 * Account Settings Page (Row 73, client half)
 *
 * Features:
 * - Change password (real POST /api/user/password)
 * - Pending account-deletion banner + cancel (POST
 *   /api/user/account/deletion-cancel)
 * - 2FA entry point (real flows live on /settings/security)
 * - Active sessions list (GET/DELETE /api/user/sessions)
 * - Delete account -- wired to POST /api/user/account/deletion-request
 *   (Closes F21). The 7-day link-expiry + 24h post-confirm grace period are
 *   both real (AccountDeletionRequest state machine); the confirmation
 *   email and the actual 24h-later deletion job are both still TODO stubs
 *   in the backend routes themselves (console.log only) -- a pre-existing,
 *   disclosed gap this UI-BUILD session does not fix. See Deviations.
 */

type PasswordStrength = 'weak' | 'medium' | 'strong';

interface PasswordVisibility {
  current: boolean;
  new: boolean;
  confirm: boolean;
}

interface SessionData {
  id: string;
  device: string;
  browser: string;
  os: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
}

export interface DeletionStatus {
  status: 'PENDING' | 'CONFIRMED';
  /** ISO string -- the 7-day link-expiry deadline (AccountDeletionRequest.expiresAt). */
  expiresAt: string;
  /** ISO string, only set once status is CONFIRMED. */
  confirmedAt: string | null;
}

interface AccountSettingsClientProps {
  initialDeletionStatus: DeletionStatus | null;
}

function getDeviceIcon(
  os: string
): React.ComponentType<{ className?: string }> {
  const osLower = os.toLowerCase();
  if (osLower.includes('ios') || osLower.includes('iphone')) {
    return Smartphone;
  }
  if (osLower.includes('android')) {
    return Smartphone;
  }
  if (osLower.includes('ipad')) {
    return Tablet;
  }
  if (
    osLower.includes('mac') ||
    osLower.includes('windows') ||
    osLower.includes('linux')
  ) {
    return Monitor;
  }
  return Laptop;
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
      return 'bg-amber-500';
    case 'strong':
      return 'bg-emerald-500';
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

function getDeletionTargetDate(deletionStatus: DeletionStatus): Date {
  if (deletionStatus.status === 'CONFIRMED' && deletionStatus.confirmedAt) {
    return new Date(
      new Date(deletionStatus.confirmedAt).getTime() + 24 * 60 * 60 * 1000
    );
  }
  return new Date(deletionStatus.expiresAt);
}

function PendingDeletionBanner({
  deletionStatus,
  isCancelling,
  onCancel,
}: {
  deletionStatus: DeletionStatus;
  isCancelling: boolean;
  onCancel: () => void;
}): React.ReactElement {
  const isConfirmed = deletionStatus.status === 'CONFIRMED';
  const targetDate = getDeletionTargetDate(deletionStatus);

  return (
    <Card
      role="alert"
      className="mb-6 border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
    >
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400"
              aria-hidden="true"
            />
            <div>
              <p className="font-semibold text-red-900 dark:text-red-200">
                {isConfirmed
                  ? 'Account Deletion Confirmed'
                  : 'Account Deletion Pending'}
              </p>
              <p className="text-sm text-red-800 dark:text-red-300">
                {isConfirmed
                  ? `Your account will be permanently deleted in about ${formatDistanceToNow(
                      targetDate
                    )} (around ${format(targetDate, 'PPp')}).`
                  : `Confirm via the link in your email within ${formatDistanceToNow(
                      targetDate
                    )} (link expires ${format(targetDate, 'PPp')}), or cancel below.`}
                {' You can still cancel this request.'}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="shrink-0 border-red-300 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300"
            onClick={onCancel}
            disabled={isCancelling}
            aria-busy={isCancelling}
          >
            {isCancelling ? (
              <>
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                Cancelling...
              </>
            ) : (
              'Cancel Deletion Request'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function AccountSettingsClient({
  initialDeletionStatus,
}: AccountSettingsClientProps): React.ReactElement {
  const { data: session } = useSession();

  const { toasts, removeToast, success, error: showError } = useToast();

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

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletionStatus, setDeletionStatus] = useState<DeletionStatus | null>(
    initialDeletionStatus
  );
  const [isCancellingDeletion, setIsCancellingDeletion] = useState(false);

  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isRevokingSession, setIsRevokingSession] = useState<string | null>(
    null
  );

  const fetchSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    try {
      const response = await fetch('/api/user/sessions');
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      } else {
        console.error('Failed to fetch sessions');
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleRevokeSession = async (sessionId: string): Promise<void> => {
    setIsRevokingSession(sessionId);
    try {
      const response = await fetch(`/api/user/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        success('Session Revoked', 'The session has been logged out.');
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      } else {
        const data = await response.json();
        showError('Failed', data.error || 'Could not revoke session');
      }
    } catch (error) {
      console.error('Error revoking session:', error);
      showError('Error', 'Failed to revoke session');
    } finally {
      setIsRevokingSession(null);
    }
  };

  const passwordStrength = newPassword
    ? getPasswordStrength(newPassword)
    : null;

  const togglePasswordVisibility = (field: keyof PasswordVisibility): void => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handlePasswordChange = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setPasswordError(null);

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
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to change password');
      }

      setPasswordChangeSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => setPasswordChangeSuccess(false), 3000);
    } catch (error) {
      setPasswordError(
        error instanceof Error ? error.message : 'Failed to change password'
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSignOutAllDevices = async (): Promise<void> => {
    try {
      const response = await fetch('/api/user/sessions', {
        method: 'DELETE',
      });

      if (response.ok) {
        const data = await response.json();
        success(
          'Sessions Revoked',
          `Logged out from ${data.revokedCount} other device${data.revokedCount === 1 ? '' : 's'}.`
        );
        fetchSessions();
      } else {
        showError('Failed', 'Could not revoke other sessions');
      }
    } catch (error) {
      console.error('Error signing out all devices:', error);
      showError('Error', 'Failed to sign out other devices');
    }
  };

  const handleDeleteAccount = async (): Promise<void> => {
    if (deleteConfirmation !== 'DELETE') {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch('/api/user/account/deletion-request', {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to request account deletion');
      }

      setIsDeleteDialogOpen(false);
      if (data.expiresAt) {
        setDeletionStatus({
          status: 'PENDING',
          expiresAt: data.expiresAt,
          confirmedAt: null,
        });
      }
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

  const handleCancelDeletion = async (): Promise<void> => {
    setIsCancellingDeletion(true);
    try {
      const response = await fetch('/api/user/account/deletion-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json();

      if (!response.ok) {
        showError(
          'Failed',
          data.message || data.error || 'Could not cancel deletion request'
        );
        return;
      }

      setDeletionStatus(null);
      success('Deletion Cancelled', 'Your account remains active.');
    } catch (error) {
      console.error('Cancel deletion error:', error);
      showError('Error', 'Failed to cancel deletion request');
    } finally {
      setIsCancellingDeletion(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <h2 className="mb-6 text-2xl font-bold text-foreground">
        Account Settings
      </h2>

      {deletionStatus && (
        <PendingDeletionBanner
          deletionStatus={deletionStatus}
          isCancelling={isCancellingDeletion}
          onCancel={handleCancelDeletion}
        />
      )}

      {/* Change Password Section */}
      <section className="mb-8">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Lock className="h-5 w-5" />
          Change Password
        </h3>
        <form onSubmit={handlePasswordChange} className="space-y-4">
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={
                  showPasswords.current
                    ? 'Hide current password'
                    : 'Show current password'
                }
              >
                {showPasswords.current ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={
                  showPasswords.new ? 'Hide new password' : 'Show new password'
                }
              >
                {showPasswords.new ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {newPassword && passwordStrength && (
              <div className="mt-2">
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    Password strength:
                  </span>
                  <span
                    className={`font-semibold ${
                      passwordStrength === 'strong'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : passwordStrength === 'medium'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-red-600'
                    }`}
                  >
                    {passwordStrength.charAt(0).toUpperCase() +
                      passwordStrength.slice(1)}
                  </span>
                </div>
                <div className="h-1 w-full rounded-full bg-muted">
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={
                  showPasswords.confirm
                    ? 'Hide password confirmation'
                    : 'Show password confirmation'
                }
              >
                {showPasswords.confirm ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="mt-1 text-xs text-red-600">
                Passwords do not match
              </p>
            )}
          </div>

          {passwordError && (
            <p className="flex items-center gap-1 text-sm text-red-600">
              <AlertTriangle className="h-4 w-4" />
              {passwordError}
            </p>
          )}

          {passwordChangeSuccess && (
            <p className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
              <Check className="h-4 w-4" />
              Password changed successfully
            </p>
          )}

          <Button type="submit" disabled={isChangingPassword}>
            {isChangingPassword ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Shield className="h-5 w-5" />
          Two-Factor Authentication
        </h3>
        <Card>
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-foreground">
                Manage Two-Factor Authentication
              </p>
              <p className="text-sm text-muted-foreground">
                Set up, verify, disable 2FA, or regenerate backup codes from
                Security Settings.
              </p>
            </div>
            <Link href="/settings/security">
              <Button variant="outline">Manage 2FA</Button>
            </Link>
          </CardContent>
        </Card>
      </section>

      <Separator className="my-8" />

      {/* Active Sessions */}
      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">
            Active Sessions
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchSessions}
            disabled={isLoadingSessions}
          >
            <RefreshCw
              className={`mr-1 h-4 w-4 ${isLoadingSessions ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </div>

        <div className="space-y-3">
          {isLoadingSessions ? (
            <>
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-5 w-5 animate-pulse rounded bg-muted" />
                      <div className="flex-1">
                        <div className="mb-2 h-4 w-48 animate-pulse rounded bg-muted" />
                        <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          ) : sessions.length === 0 ? (
            <Card>
              <CardContent className="p-4 text-center text-muted-foreground">
                No active sessions found
              </CardContent>
            </Card>
          ) : (
            sessions.map((sessionItem) => {
              const Icon = getDeviceIcon(sessionItem.os);
              return (
                <Card key={sessionItem.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {sessionItem.device}
                          {sessionItem.isCurrent && (
                            <Badge className="ml-2 bg-emerald-100 text-xs text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                              Current
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
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
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Revoke'
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {sessions.length > 1 && (
          <Button
            variant="destructive"
            className="mt-4"
            onClick={handleSignOutAllDevices}
          >
            Sign Out All Other Devices
          </Button>
        )}
      </section>

      <Separator className="my-8" />

      {/* Delete Account */}
      <section>
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-red-600 dark:text-red-400">
          <AlertTriangle className="h-5 w-5" />
          Danger Zone
        </h3>
        <Card className="border-red-200 dark:border-red-900">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-foreground">Delete Account</p>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account and all associated data. This
                  action cannot be undone.
                </p>
              </div>
              <Dialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button variant="destructive" disabled={!!deletionStatus}>
                    {deletionStatus
                      ? 'Deletion Already Requested'
                      : 'Delete Account'}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-600">
                      <AlertTriangle className="h-5 w-5" />
                      Delete Account
                    </DialogTitle>
                    <DialogDescription>
                      This action cannot be undone. This will permanently delete
                      your account and remove all your data from our servers.
                    </DialogDescription>
                    {(session?.user as { role?: string })?.role ===
                      'AFFILIATE' && (
                      <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                        <p className="font-semibold">
                          ⚠️ Affiliate Partner Notice:
                        </p>
                        <p className="mt-1">
                          Deleting your account will forfeit any pending or
                          unpaid commission balances and invalidate your active
                          promo codes. Make sure your payouts are completed
                          before deleting.
                        </p>
                      </div>
                    )}
                  </DialogHeader>
                  <div className="my-4">
                    <p className="mb-2 text-sm text-muted-foreground">
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
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

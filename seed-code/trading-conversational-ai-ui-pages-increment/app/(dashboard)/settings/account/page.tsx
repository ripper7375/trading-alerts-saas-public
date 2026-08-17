'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  Laptop,
  Smartphone,
  LogOut,
} from 'lucide-react';
import { useLocale } from '@/lib/context/locale-context';

interface Session {
  id: string;
  device: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
  type: 'desktop' | 'mobile';
}

export default function AccountSettingsPage() {
  const { t } = useLocale();
  const [isRequested, setIsRequested] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Change Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const passwordsMismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;

  const handlePasswordUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || newPassword.length < 8 || passwordsMismatch) {
      return;
    }
    setPasswordSaved(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setPasswordSaved(false), 2500);
  };

  // Active Sessions
  const [sessions, setSessions] = useState<Session[]>([
    {
      id: 'sess-current',
      device: 'Windows Workstation — Chrome 128.0',
      location: 'Bangkok, Thailand',
      lastActive: t('Active Now'),
      isCurrent: true,
      type: 'desktop',
    },
    {
      id: 'sess-2',
      device: 'iPhone 15 Pro — Safari Mobile',
      location: 'Bangkok, Thailand',
      lastActive: '4 hours ago',
      isCurrent: false,
      type: 'mobile',
    },
  ]);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const handleRevokeSession = (id: string) => {
    setRevokingId(id);
    setTimeout(() => {
      setSessions((prev) => prev.filter((s) => s.id !== id));
      setRevokingId(null);
    }, 400);
  };

  // Delete Account (typed-confirmation gate)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const handleDataExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 4000);
    }, 1500);
  };

  const handleConfirmDeletion = () => {
    if (deleteConfirmation !== 'DELETE') return;
    setIsRequested(true);
    setIsDeleteDialogOpen(false);
    setDeleteConfirmation('');
  };

  return (
    <div className="animate-fade-in space-y-6 select-none">
      {/* Change Password */}
      <div className="space-y-4 rounded-2xl border border-slate-800/80 bg-[#090c14] p-6 shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Lock className="h-5 w-5 text-amber-400" />
          <h2 className="text-sm font-extrabold text-slate-100">
            {t('Change Password')}
          </h2>
        </div>

        <form onSubmit={handlePasswordUpdate} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-300">
              {t('Current Password')}
            </Label>
            <div className="relative">
              <Input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••••••"
                className="border-slate-750 bg-[#06080e] pr-9 text-xs"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                aria-label={
                  showCurrent
                    ? 'Hide current password'
                    : 'Show current password'
                }
                className="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showCurrent ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-300">
              {t('New Password')}
            </Label>
            <div className="relative">
              <Input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••••••"
                className="border-slate-750 bg-[#06080e] pr-9 text-xs"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                aria-label={showNew ? 'Hide new password' : 'Show new password'}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showNew ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-300">
              {t('Confirm New Password')}
            </Label>
            <Input
              type={showNew ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              className="border-slate-750 bg-[#06080e] text-xs"
            />
            {passwordsMismatch && (
              <p className="text-[11px] text-rose-400">
                {t('Passwords do not match')}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={
              !currentPassword || newPassword.length < 8 || passwordsMismatch
            }
            className="h-9 bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 hover:from-amber-400 hover:to-amber-500"
          >
            {passwordSaved ? t('Password Updated!') : t('Update Password')}
          </Button>
        </form>
      </div>

      {/* Two-Factor Authentication entry point */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-800/80 bg-[#090c14] p-6 shadow-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <h2 className="text-sm font-extrabold text-slate-100">
              {t('Two-Factor Authentication')}
            </h2>
            <p className="text-[11px] text-slate-400">
              {t(
                'Set up, verify, disable 2FA, or regenerate backup codes from Security & 2FA settings.'
              )}
            </p>
          </div>
        </div>
        <Link href="/settings/security">
          <Button
            variant="outline"
            className="border-slate-750 h-8 shrink-0 bg-slate-800 text-xs text-slate-200"
          >
            {t('Manage 2FA')}
          </Button>
        </Link>
      </div>

      {/* Active Sessions */}
      <div className="space-y-4 rounded-2xl border border-slate-800/80 bg-[#090c14] p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-sm font-extrabold text-slate-100">
            {t('Active Sessions')}
          </h2>
          <Badge className="border-slate-700 bg-slate-800 font-mono text-[9px] text-slate-300">
            {sessions.length} {t('Devices')}
          </Badge>
        </div>

        <div className="divide-y divide-slate-800/60">
          {sessions.map((session) => {
            const Icon = session.type === 'mobile' ? Smartphone : Laptop;
            return (
              <div
                key={session.id}
                className="flex items-center justify-between py-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 shrink-0 text-amber-400" />
                  <div>
                    <div className="flex items-center gap-2 font-bold text-slate-200">
                      {session.device}
                      {session.isCurrent && (
                        <Badge className="border-emerald-500/40 bg-emerald-500/15 font-mono text-[8px] text-emerald-400">
                          {t('This Device')}
                        </Badge>
                      )}
                    </div>
                    <div className="font-mono text-[10px] text-slate-400">
                      {session.location} • {session.lastActive}
                    </div>
                  </div>
                </div>

                {!session.isCurrent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevokeSession(session.id)}
                    disabled={revokingId === session.id}
                    className="text-rose-400 hover:bg-rose-500/20 hover:text-rose-300"
                  >
                    <LogOut className="mr-1.5 h-3.5 w-3.5" />
                    {revokingId === session.id ? t('Revoking...') : t('Revoke')}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Data Export Box */}
      <div className="space-y-3 rounded-2xl border border-slate-800/80 bg-[#090c14] p-6 shadow-xl">
        <h2 className="text-sm font-extrabold text-slate-100">
          {t('Download Account Data Package (GDPR)')}
        </h2>
        <p className="text-xs text-slate-400">
          {t(
            'Export all your active alert rules, historical AI prompts, and billing logs in JSON format.'
          )}
        </p>
        <Button
          variant="outline"
          onClick={handleDataExport}
          disabled={isExporting}
          className="border-slate-750 h-8 bg-slate-800 text-xs text-slate-200"
        >
          {isExporting
            ? t('Preparing Data Archive...')
            : exportSuccess
              ? t('Export Requested!')
              : t('Request Data Archive')}
        </Button>
        {exportSuccess && (
          <p className="flex items-center gap-1 text-xs font-bold text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t("You'll receive an email with a download link within 24 hours.")}
          </p>
        )}
      </div>

      {/* Danger Zone: Account Deletion */}
      <div className="space-y-4 rounded-2xl border border-rose-500/40 bg-rose-500/5 p-6 shadow-xl">
        <div className="flex items-center gap-2 border-b border-rose-500/30 pb-3 text-rose-400">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <h2 className="text-sm font-extrabold">
            {t('Danger Zone: Account Deletion')}
          </h2>
        </div>

        {!isRequested ? (
          <div className="space-y-3 text-xs text-slate-300">
            <p>
              {t(
                'Initiating account deletion schedules your account for permanent erasure after a'
              )}{' '}
              <strong className="text-amber-400">
                {t('7-day grace period')}
              </strong>
              .
            </p>
            <p className="text-slate-400">
              {t(
                'During this period, you can log in anytime to cancel the deletion request.'
              )}
            </p>

            <Dialog
              open={isDeleteDialogOpen}
              onOpenChange={(open) => {
                setIsDeleteDialogOpen(open);
                if (!open) setDeleteConfirmation('');
              }}
            >
              <Button
                onClick={() => setIsDeleteDialogOpen(true)}
                className="h-9 bg-rose-600 text-xs font-extrabold text-white hover:bg-rose-500"
              >
                {t('Request Account Deletion (7-Day Grace)')}
              </Button>
              <DialogContent className="border-slate-800 bg-[#0c0f18] sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-rose-400">
                    <AlertTriangle className="h-5 w-5" />
                    {t('Delete Account')}
                  </DialogTitle>
                  <DialogDescription className="text-slate-400">
                    {t(
                      'This action cannot be undone. This will schedule your account and all associated data for permanent erasure after a 7-day grace period.'
                    )}
                  </DialogDescription>
                </DialogHeader>
                <div className="my-2">
                  <p className="mb-2 text-xs text-slate-400">
                    {t('Type')}{' '}
                    <strong className="text-slate-200">DELETE</strong>{' '}
                    {t('to confirm:')}
                  </p>
                  <Input
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder="DELETE"
                    className="border-slate-750 bg-[#06080e] text-xs"
                  />
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsDeleteDialogOpen(false)}
                    className="border-slate-750 bg-slate-800 text-xs text-slate-200"
                  >
                    {t('Cancel')}
                  </Button>
                  <Button
                    onClick={handleConfirmDeletion}
                    disabled={deleteConfirmation !== 'DELETE'}
                    className="bg-rose-600 text-xs font-extrabold text-white hover:bg-rose-500"
                  >
                    {t('Delete Account')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs">
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <ShieldAlert className="h-4 w-4" />{' '}
              {t('Account Scheduled for Deletion')}
            </div>
            <p className="text-slate-300">
              {t('Your account is scheduled to be erased in')}{' '}
              <strong>
                6 {t('days')}, 23 {t('hours')}
              </strong>
              .{' '}
              {t('All active alert triggers will stop firing upon expiration.')}
            </p>
            <Button
              onClick={() => setIsRequested(false)}
              className="h-8 bg-amber-500 text-xs font-extrabold text-slate-950 hover:bg-amber-400"
            >
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />{' '}
              {t('Cancel Deletion Request & Keep Account')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

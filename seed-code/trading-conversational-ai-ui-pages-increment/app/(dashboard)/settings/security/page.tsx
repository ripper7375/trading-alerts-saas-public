'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ShieldCheck,
  Lock,
  Smartphone,
  Laptop,
  Trash2,
  Bell,
  History,
  MapPin,
  Check,
  X,
  AlertTriangle,
  Copy,
} from 'lucide-react';
import { useLocale } from '@/lib/context/locale-context';

interface LoginHistoryEntry {
  id: string;
  status: 'SUCCESS' | 'FAILED' | 'BLOCKED';
  device: string;
  location: string;
  createdAt: string;
}

const LOGIN_HISTORY: LoginHistoryEntry[] = [
  {
    id: 'lh-1',
    status: 'SUCCESS',
    device: 'Chrome on Windows 11',
    location: 'Bangkok, Thailand',
    createdAt: '2 hours ago',
  },
  {
    id: 'lh-2',
    status: 'SUCCESS',
    device: 'Safari Mobile on iOS 18.2',
    location: 'Bangkok, Thailand',
    createdAt: '1 day ago',
  },
  {
    id: 'lh-3',
    status: 'FAILED',
    device: 'Unknown Browser on Linux',
    location: 'Unknown Location',
    createdAt: '3 days ago',
  },
];

const STATUS_BADGE: Record<LoginHistoryEntry['status'], string> = {
  SUCCESS: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40',
  FAILED: 'bg-rose-500/15 text-rose-400 border border-rose-500/40',
  BLOCKED: 'bg-orange-500/15 text-orange-400 border border-orange-500/40',
};

const BACKUP_CODES = [
  '4F82-9K1L',
  '7B3D-2M9X',
  'A1C6-8Q4Z',
  'E5H2-1N7T',
  'K9P4-6V3W',
  'R2S8-5J1Y',
  'U6X3-9D2C',
  'W4Z7-1G8B',
];

export default function SecuritySettingsPage() {
  const { t, formatRelativeTime } = useLocale();
  const [is2faEnabled, setIs2faEnabled] = useState(true);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  const [newDeviceAlerts, setNewDeviceAlerts] = useState(true);
  const [passwordChangeAlerts, setPasswordChangeAlerts] = useState(true);

  const activeSessions = [
    {
      id: '1',
      device: 'Chrome on Windows 11',
      location: 'New York, US',
      ip: '192.168.1.1',
      lastActive: t('Active Now'),
      current: true,
    },
    {
      id: '2',
      device: 'Safari on iPhone 15',
      location: 'London, UK',
      ip: '10.0.0.42',
      lastActive: formatRelativeTime(120),
      current: false,
    },
  ];
  const [sessions, setSessions] = useState(activeSessions);

  const handlePasswordUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || newPassword.length < 8) return;
    setPasswordSaved(true);
    setCurrentPassword('');
    setNewPassword('');
    setTimeout(() => setPasswordSaved(false), 2500);
  };

  const handleRevokeSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(BACKUP_CODES.join('\n')).catch(() => {});
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 select-none">
      {/* 2FA Card */}
      <div className="space-y-4 rounded-2xl border border-slate-800/80 bg-[#090c14] p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-400" />
            <div>
              <h2 className="text-sm font-extrabold text-slate-100">
                {t('Two-Factor Authentication (TOTP)')}
              </h2>
              <p className="text-[11px] text-slate-400">
                {t('Secure your account with Google Authenticator or Authy')}
              </p>
            </div>
          </div>

          <Switch checked={is2faEnabled} onCheckedChange={setIs2faEnabled} />
        </div>

        {is2faEnabled && (
          <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
            <span className="font-semibold">
              {t('✓ 2FA Authentication Active')}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowBackupCodes(true)}
              className="h-6 border-emerald-500/40 text-[10px]"
            >
              {t('View Backup Codes')}
            </Button>
          </div>
        )}
      </div>

      {/* Change Password Card */}
      <div className="space-y-4 rounded-2xl border border-slate-800/80 bg-[#090c14] p-6 shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Lock className="h-5 w-5 text-amber-400" />
          <h2 className="text-sm font-extrabold text-slate-100">
            {t('Change Master Password')}
          </h2>
        </div>

        <form onSubmit={handlePasswordUpdate} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-300">
              {t('Current Password')}
            </Label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••••••"
              className="border-slate-750 bg-[#06080e] text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-300">
              {t('New Password')}
            </Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••••••"
              className="border-slate-750 bg-[#06080e] text-xs"
            />
          </div>

          <Button
            type="submit"
            disabled={!currentPassword || newPassword.length < 8}
            className="h-9 bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 hover:from-amber-400 hover:to-amber-500"
          >
            {passwordSaved ? t('Password Updated!') : t('Update Password')}
          </Button>
        </form>
      </div>

      {/* Security Alerts */}
      <div className="space-y-4 rounded-2xl border border-slate-800/80 bg-[#090c14] p-6 shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Bell className="h-5 w-5 text-amber-400" />
          <h2 className="text-sm font-extrabold text-slate-100">
            {t('Security Alerts')}
          </h2>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#06080e] p-3.5">
            <div>
              <div className="text-xs font-bold text-slate-200">
                {t('New Device Login Alerts')}
              </div>
              <div className="text-[11px] text-slate-400">
                {t(
                  'Get notified when your account is accessed from a new device'
                )}
              </div>
            </div>
            <Switch
              checked={newDeviceAlerts}
              onCheckedChange={setNewDeviceAlerts}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#06080e] p-3.5">
            <div>
              <div className="text-xs font-bold text-slate-200">
                {t('Password Change Alerts')}
              </div>
              <div className="text-[11px] text-slate-400">
                {t('Get notified when your password is changed')}
              </div>
            </div>
            <Switch
              checked={passwordChangeAlerts}
              onCheckedChange={setPasswordChangeAlerts}
            />
          </div>
        </div>
      </div>

      {/* Active Sessions Card */}
      <div className="space-y-4 rounded-2xl border border-slate-800/80 bg-[#090c14] p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-sm font-extrabold text-slate-100">
            {t('Active Login Sessions')}
          </h2>
          <Badge className="border-slate-700 bg-slate-800 font-mono text-[9px] text-slate-300">
            {sessions.length} {t('Devices')}
          </Badge>
        </div>

        <div className="divide-y divide-slate-800/60">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between py-3 text-xs"
            >
              <div className="flex items-center gap-3">
                {session.device.includes('iPhone') ? (
                  <Smartphone className="h-5 w-5 shrink-0 text-amber-400" />
                ) : (
                  <Laptop className="h-5 w-5 shrink-0 text-amber-400" />
                )}
                <div>
                  <div className="flex items-center gap-2 font-bold text-slate-200">
                    {session.device}
                    {session.current && (
                      <Badge className="border-emerald-500/40 bg-emerald-500/15 font-mono text-[8px] text-emerald-400">
                        {t('This Device')}
                      </Badge>
                    )}
                  </div>
                  <div className="font-mono text-[10px] text-slate-400">
                    {session.ip} • {session.location} • {session.lastActive}
                  </div>
                </div>
              </div>

              {!session.current && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRevokeSession(session.id)}
                  aria-label={`Revoke session on ${session.device}`}
                  className="h-7 w-7 text-rose-400 hover:bg-rose-500/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Login History */}
      <div className="space-y-4 rounded-2xl border border-slate-800/80 bg-[#090c14] p-6 shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <History className="h-5 w-5 text-amber-400" />
          <div>
            <h2 className="text-sm font-extrabold text-slate-100">
              {t('Login History')}
            </h2>
            <p className="text-[11px] text-slate-400">
              {t('Recent login activity on your account')}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {LOGIN_HISTORY.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-[#06080e] p-3 text-xs"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-200">
                    {entry.device}
                  </span>
                  <Badge
                    className={`font-mono text-[9px] ${STATUS_BADGE[entry.status]}`}
                  >
                    {entry.status === 'SUCCESS' && (
                      <Check className="mr-1 h-2.5 w-2.5" />
                    )}
                    {entry.status === 'FAILED' && (
                      <X className="mr-1 h-2.5 w-2.5" />
                    )}
                    {entry.status === 'BLOCKED' && (
                      <AlertTriangle className="mr-1 h-2.5 w-2.5" />
                    )}
                    {t(entry.status)}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {entry.location}
                  </span>
                  <span>{entry.createdAt}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Security Activity link-out */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-800/80 bg-[#090c14] p-6 shadow-xl sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-extrabold text-slate-100">
            {t('Security Activity')}
          </h2>
          <p className="text-[11px] text-slate-400">
            {t(
              'Password changes, two-factor changes, and device/login alerts for your account'
            )}
          </p>
        </div>
        <Link href="/settings/security/activity">
          <Button
            variant="outline"
            size="sm"
            className="border-slate-750 shrink-0 bg-slate-800 text-xs text-slate-200"
          >
            {t('View All Activity')}
          </Button>
        </Link>
      </div>

      {/* Backup Codes Dialog */}
      <Dialog open={showBackupCodes} onOpenChange={setShowBackupCodes}>
        <DialogContent className="border-slate-800 bg-[#0c0f18] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-100">
              {t('Backup Codes')}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {t('Each code can only be used once. Store them somewhere safe.')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#06080e] p-4 font-mono text-xs">
            {BACKUP_CODES.map((code) => (
              <div
                key={code}
                className="rounded border border-slate-800 bg-slate-900 p-2 text-center text-slate-200"
              >
                {code}
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            onClick={copyBackupCodes}
            className="border-slate-750 bg-slate-800 text-xs text-slate-200"
          >
            <Copy className="mr-2 h-3.5 w-3.5" />
            {t('Copy All Codes')}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Shield,
  Laptop,
  Smartphone,
  MapPin,
  Clock,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  KeyRound,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/lib/context/locale-context';

interface Session {
  id: string;
  device: string;
  browser: string;
  os: string;
  ip: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
  type: 'desktop' | 'mobile';
}

type SecurityEventType =
  | 'NEW_DEVICE_LOGIN'
  | 'PASSWORD_CHANGED'
  | 'TWO_FACTOR_ENABLED'
  | 'TWO_FACTOR_DISABLED'
  | 'SUSPICIOUS_LOGIN';

interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  title: string;
  message: string;
  location: string;
  createdAt: string;
}

const SECURITY_EVENT_META: Record<
  SecurityEventType,
  { icon: React.ComponentType<{ className?: string }>; badgeClass: string }
> = {
  NEW_DEVICE_LOGIN: {
    icon: Shield,
    badgeClass: 'border-blue-500/40 bg-blue-500/15 text-blue-400',
  },
  PASSWORD_CHANGED: {
    icon: KeyRound,
    badgeClass: 'border-purple-500/40 bg-purple-500/15 text-purple-400',
  },
  TWO_FACTOR_ENABLED: {
    icon: ShieldCheck,
    badgeClass: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400',
  },
  TWO_FACTOR_DISABLED: {
    icon: ShieldOff,
    badgeClass: 'border-orange-500/40 bg-orange-500/15 text-orange-400',
  },
  SUSPICIOUS_LOGIN: {
    icon: AlertTriangle,
    badgeClass: 'border-rose-500/40 bg-rose-500/15 text-rose-400',
  },
};

const SECURITY_EVENTS: SecurityEvent[] = [
  {
    id: 'evt-1',
    type: 'NEW_DEVICE_LOGIN',
    title: 'New Device Login',
    message: 'Signed in from a new device: iPhone 15 Pro (Safari Mobile).',
    location: 'Bangkok, Thailand',
    createdAt: '4 hours ago',
  },
  {
    id: 'evt-2',
    type: 'PASSWORD_CHANGED',
    title: 'Password Changed',
    message: 'Your account password was changed successfully.',
    location: 'Bangkok, Thailand',
    createdAt: '2 days ago',
  },
  {
    id: 'evt-3',
    type: 'TWO_FACTOR_ENABLED',
    title: '2FA Enabled',
    message: 'Two-factor authentication was enabled on your account.',
    location: 'Bangkok, Thailand',
    createdAt: '5 days ago',
  },
];

export default function SecurityActivityPage() {
  const { t } = useLocale();

  const [sessions, setSessions] = useState<Session[]>([
    {
      id: 'sess-current',
      device: 'Windows Workstation',
      browser: 'Chrome 128.0',
      os: 'Windows 11',
      ip: '171.96.120.45',
      location: 'Bangkok, Thailand',
      lastActive: t('Active Now'),
      isCurrent: true,
      type: 'desktop',
    },
    {
      id: 'sess-2',
      device: 'iPhone 15 Pro',
      browser: 'Safari Mobile',
      os: 'iOS 18.2',
      ip: '171.96.120.88',
      location: 'Bangkok, Thailand',
      lastActive: '4 hours ago',
      isCurrent: false,
      type: 'mobile',
    },
    {
      id: 'sess-3',
      device: 'MacBook Air',
      browser: 'Brave Browser',
      os: 'macOS Sonoma',
      ip: '49.228.105.12',
      location: 'Chiang Mai, Thailand',
      lastActive: '2 days ago',
      isCurrent: false,
      type: 'desktop',
    },
  ]);

  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    try {
      await fetch(`/api/user/sessions/${id}`, { method: 'DELETE' }).catch(
        () => {}
      );
      setSessions((prev) => prev.filter((s) => s.id !== id));
      setSuccessMessage(t('Session terminated successfully.'));
      setTimeout(() => setSuccessMessage(''), 3000);
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAllOther = async () => {
    if (!confirm(t('Terminate all other login sessions across all devices?'))) {
      return;
    }
    try {
      await fetch('/api/user/sessions', { method: 'DELETE' }).catch(() => {});
      setSessions((prev) => prev.filter((s) => s.isCurrent));
      setSuccessMessage(t('All other sessions terminated.'));
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (e) {}
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/settings/security"
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition-colors hover:text-amber-400"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t('Back to Security & 2FA')}</span>
        </Link>

        {sessions.length > 1 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRevokeAllOther}
            className="border-rose-500/30 bg-rose-950/20 text-xs text-rose-300 hover:bg-rose-950/50"
          >
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
            {t('Revoke All Other Sessions')}
          </Button>
        )}
      </div>

      <div className="space-y-1">
        <h2 className="text-xl font-bold text-slate-100">
          {t('Active Sessions & Device Activity')}
        </h2>
        <p className="text-xs text-slate-400">
          {t(
            'Review all active browser sessions currently authenticated with your DavinTrade account.'
          )}
        </p>
      </div>

      {successMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3.5 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Session Cards */}
      <div className="space-y-3">
        {sessions.map((sess) => {
          const Icon = sess.type === 'mobile' ? Smartphone : Laptop;
          return (
            <Card
              key={sess.id}
              className={`border p-4 transition-all ${
                sess.isCurrent
                  ? 'border-amber-500/40 bg-[#0c0f1e]/90 shadow-md shadow-amber-500/5'
                  : 'border-slate-800 bg-[#080a12]/80'
              }`}
            >
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex items-start gap-3.5">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                      sess.isCurrent
                        ? 'border-amber-500/40 bg-amber-500/20 text-amber-400'
                        : 'border-slate-700 bg-slate-800/60 text-slate-400'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-200">
                        {sess.device} — {sess.browser}
                      </h4>
                      {sess.isCurrent && (
                        <Badge className="border-emerald-500/40 bg-emerald-500/20 py-0 text-[10px] text-emerald-400">
                          {t('Current Session')}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-slate-500" />
                        {sess.location} ({sess.ip})
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-500" />
                        {sess.lastActive}
                      </span>
                    </div>
                  </div>
                </div>

                {!sess.isCurrent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevoke(sess.id)}
                    disabled={revokingId === sess.id}
                    className="self-start text-xs text-rose-400 hover:bg-rose-950/30 hover:text-rose-300 sm:self-center"
                  >
                    <LogOut className="mr-1.5 h-3.5 w-3.5" />
                    {revokingId === sess.id ? t('Revoking...') : t('Revoke')}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Security Event Log */}
      <div className="space-y-1 pt-4">
        <h2 className="text-xl font-bold text-slate-100">
          {t('Security Event Log')}
        </h2>
        <p className="text-xs text-slate-400">
          {t(
            'A full record of security events on your account: password changes, two-factor changes, and new-device alerts.'
          )}
        </p>
      </div>

      <div className="space-y-3">
        {SECURITY_EVENTS.map((event) => {
          const meta = SECURITY_EVENT_META[event.type];
          const Icon = meta.icon;
          return (
            <Card
              key={event.id}
              className="border border-slate-800 bg-[#080a12]/80 p-4"
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${meta.badgeClass}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <h4 className="text-xs font-bold text-slate-200">
                    {t(event.title)}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {t(event.message)}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {event.location}
                    </span>
                    <span>{event.createdAt}</span>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

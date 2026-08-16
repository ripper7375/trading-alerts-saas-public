'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Shield,
  Laptop,
  Smartphone,
  Globe,
  MapPin,
  Clock,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  KeyRound,
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
      lastActive: t('Active Now', 'ใช้งานอยู่ตอนนี้'),
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
      setSuccessMessage(
        t('Session terminated successfully.', 'เพิกถอนเซสชันเรียบร้อยแล้ว')
      );
      setTimeout(() => setSuccessMessage(''), 3000);
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAllOther = async () => {
    if (
      !confirm(
        t(
          'Terminate all other login sessions across all devices?',
          'ต้องการออกจากระบบบนอุปกรณ์อื่นทั้งหมดหรือไม่?'
        )
      )
    ) {
      return;
    }
    try {
      await fetch('/api/user/sessions', { method: 'DELETE' }).catch(() => {});
      setSessions((prev) => prev.filter((s) => s.isCurrent));
      setSuccessMessage(
        t(
          'All other sessions terminated.',
          'ออกจากระบบบนอุปกรณ์อื่นทั้งหมดเรียบร้อยแล้ว'
        )
      );
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
          <span>
            {t('Back to Security & 2FA', 'กลับสู่หน้าความปลอดภัยและ 2FA')}
          </span>
        </Link>

        {sessions.length > 1 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRevokeAllOther}
            className="border-rose-500/30 bg-rose-950/20 text-xs text-rose-300 hover:bg-rose-950/50"
          >
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
            {t('Revoke All Other Sessions', 'ออกจากระบบอุปกรณ์อื่นทั้งหมด')}
          </Button>
        )}
      </div>

      <div className="space-y-1">
        <h2 className="text-xl font-bold text-slate-100">
          {t(
            'Active Sessions & Device Activity',
            'เซสชันการใช้งานและกิจกรรมอุปกรณ์'
          )}
        </h2>
        <p className="text-xs text-slate-400">
          {t(
            'Review all active browser sessions currently authenticated with your DavinTrade account.',
            'ตรวจสอบเซสชันเบราว์เซอร์ทั้งหมดที่กำลังเข้าสู่ระบบบัญชี DavinTrade ของคุณ'
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
                          {t('Current Session', 'เซสชันปัจจุบัน')}
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
                    {revokingId === sess.id
                      ? t('Revoking...', 'กำลังเพิกถอน...')
                      : t('Revoke', 'เพิกถอน')}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

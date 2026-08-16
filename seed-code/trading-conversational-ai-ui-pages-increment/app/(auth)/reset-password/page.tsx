'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Lock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/lib/context/locale-context';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const { t } = useLocale();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError(
        t(
          'Password must be at least 8 characters long.',
          'รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร'
        )
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(t('Passwords do not match.', 'รหัสผ่านทั้งสองช่องไม่ตรงกัน'));
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.message ||
            t(
              'Invalid or expired reset token.',
              'ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว'
            )
        );
      }

      setIsSuccess(true);
      setTimeout(() => {
        router.push('/login?reset=success');
      }, 2500);
    } catch (err: any) {
      setError(
        err.message ||
          t('Failed to reset password.', 'ไม่สามารถรีเซ็ตรหัสผ่านได้')
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <Link href="/" className="inline-flex items-center gap-2">
          <div className="relative flex h-10 w-10 overflow-hidden rounded-xl border border-amber-500/40 bg-amber-500/20 p-0.5 shadow-lg shadow-amber-500/20">
            <Image
              src="/davintrade-ai-icon.png"
              alt="DavinTrade AI"
              width={40}
              height={40}
              className="h-full w-full rounded-[9px] object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <span className="bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-xl font-black text-transparent">
            DavinTrade AI
          </span>
        </Link>
        <h1 className="text-2xl font-bold text-slate-100">
          {t('Set New Password', 'ตั้งรหัสผ่านใหม่')}
        </h1>
        <p className="text-xs text-slate-400">
          {t(
            'Enter your new secure account password below.',
            'กรอกรหัสผ่านใหม่ที่ปลอดภัยสำหรับบัญชีของคุณ'
          )}
        </p>
      </div>

      <Card className="space-y-4 border-slate-800/80 bg-[#090b14]/95 p-6 shadow-2xl backdrop-blur-2xl">
        {isSuccess ? (
          <div className="space-y-3 py-6 text-center">
            <div className="flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </div>
            <h3 className="text-base font-bold text-emerald-200">
              {t('Password Reset Successfully!', 'รีเซ็ตรหัสผ่านสำเร็จ!')}
            </h3>
            <p className="text-xs text-slate-400">
              {t(
                'Redirecting you to login portal...',
                'กำลังนำคุณไปยังหน้าเข้าสู่ระบบ...'
              )}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">
                {t('New Password', 'รหัสผ่านใหม่')}
              </Label>
              <div className="relative">
                <KeyRound className="absolute top-3 left-3 h-4 w-4 text-slate-500" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border-slate-800 bg-[#06080e] pr-10 pl-9 text-slate-200 focus:border-amber-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-3 right-3 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">
                {t('Confirm New Password', 'ยืนยันรหัสผ่านใหม่')}
              </Label>
              <div className="relative">
                <Lock className="absolute top-3 left-3 h-4 w-4 text-slate-500" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="border-slate-800 bg-[#06080e] pl-9 text-slate-200 focus:border-amber-500"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-amber-500 py-5 font-bold text-slate-950 hover:bg-amber-400"
            >
              {isLoading ? (
                <span>{t('Resetting...', 'กำลังรีเซ็ต...')}</span>
              ) : (
                <span className="flex items-center gap-1.5">
                  {t('Update Password', 'บันทึกรหัสผ่านใหม่')}
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>
        )}

        <div className="border-t border-slate-800/80 pt-2 text-center">
          <Link
            href="/login"
            className="text-xs text-slate-400 transition-colors hover:text-amber-400"
          >
            ← {t('Back to Login', 'กลับไปหน้าเข้าสู่ระบบ')}
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050609] p-4 text-slate-100">
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}

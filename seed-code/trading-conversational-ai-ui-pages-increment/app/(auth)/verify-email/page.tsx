'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  MailCheck,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/lib/context/locale-context';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { t } = useLocale();

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>(
    token ? 'verifying' : 'error'
  );
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage(
        t('No verification token provided.', 'ไม่พบโทเค็นสำหรับการยืนยัน')
      );
      return;
    }

    const verify = async () => {
      try {
        const res = await fetch(
          `/api/auth/verify-email?token=${encodeURIComponent(token)}`,
          {
            method: 'GET',
          }
        );

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            data.message ||
              t(
                'Verification token is invalid or expired.',
                'โทเค็นยืนยันไม่ถูกต้องหรือหมดอายุแล้ว'
              )
          );
        }

        setStatus('success');
      } catch (err: any) {
        setStatus('error');
        setErrorMessage(
          err.message ||
            t('Failed to verify email.', 'เกิดข้อผิดพลาดในการยืนยันอีเมล')
        );
      }
    };

    verify();
  }, [token, t]);

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
          {t('Email Verification', 'การยืนยันอีเมล')}
        </h1>
      </div>

      <Card className="space-y-6 border-slate-800/80 bg-[#090b14]/95 p-6 text-center shadow-2xl backdrop-blur-2xl md:p-8">
        {status === 'verifying' && (
          <div className="space-y-4 py-8">
            <div className="flex justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-amber-400" />
            </div>
            <h3 className="text-base font-bold text-slate-200">
              {t(
                'Verifying your email address...',
                'กำลังตรวจสอบและยืนยันอีเมลของคุณ...'
              )}
            </h3>
            <p className="text-xs text-slate-400">
              {t(
                'Please hold on while we activate your account permissions.',
                'กรุณารอสักครู่เพื่อเปิดใช้งานสิทธิ์บัญชี'
              )}
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4 py-6">
            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="h-8 w-8" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-emerald-300">
                {t('Email Successfully Verified!', 'ยืนยันอีเมลเรียบร้อยแล้ว!')}
              </h3>
              <p className="text-xs text-slate-400">
                {t(
                  'Your DavinTrade account is fully verified and ready for live market telemetry.',
                  'บัญชี DavinTrade ของคุณได้รับการยืนยันและพร้อมใช้งานแล้ว'
                )}
              </p>
            </div>

            <Link href="/welcome" className="block pt-2">
              <Button className="w-full bg-amber-500 py-5 font-bold text-slate-950 hover:bg-amber-400">
                <span>
                  {t('Continue to Onboarding', 'ดำเนินการต่อไปยังหน้าเริ่มต้น')}
                </span>
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4 py-6">
            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/40 bg-rose-500/20 text-rose-400">
                <AlertCircle className="h-8 w-8" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-rose-300">
                {t('Verification Failed', 'การยืนยันไม่สำเร็จ')}
              </h3>
              <p className="text-xs text-slate-400">
                {errorMessage ||
                  t(
                    'The token might be expired or already used.',
                    'โทเค็นอาจหมดอายุหรือถูกใช้งานไปแล้ว'
                  )}
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Link href="/verify-email/pending">
                <Button className="w-full bg-amber-500 font-bold text-slate-950 hover:bg-amber-400">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t(
                    'Request New Verification Link',
                    'ขอลิงก์ยืนยันใหม่อีกครั้ง'
                  )}
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  variant="outline"
                  className="w-full border-slate-800 text-slate-300"
                >
                  {t('Back to Login', 'กลับไปหน้าเข้าสู่ระบบ')}
                </Button>
              </Link>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050609] p-4 text-slate-100">
      <Suspense fallback={null}>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}

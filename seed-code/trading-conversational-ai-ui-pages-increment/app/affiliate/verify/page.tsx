'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Share2,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useLocale } from '@/lib/context/locale-context';

function AffiliateVerifyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { t } = useLocale();

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>(
    token ? 'verifying' : 'error'
  );
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg(
        t('No affiliate token provided.', 'ไม่พบโทเค็นสำหรับการยืนยันพันธมิตร')
      );
      return;
    }

    const verifyPartner = async () => {
      try {
        const res = await fetch(
          `/api/affiliate/auth/verify-email?token=${encodeURIComponent(token)}`
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            data.message ||
              t(
                'Invalid or expired partner verification link.',
                'ลิงก์ยืนยันพันธมิตรไม่ถูกต้องหรือหมดอายุ'
              )
          );
        }
        setStatus('success');
      } catch (err: any) {
        setStatus('error');
        setErrorMsg(
          err.message || t('Verification failed.', 'การยืนยันไม่สำเร็จ')
        );
      }
    };

    verifyPartner();
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
          {t('Partner Verification', 'ยืนยันบัญชีพันธมิตร')}
        </h1>
      </div>

      <Card className="space-y-6 border-slate-800/80 bg-[#090b14]/95 p-6 text-center shadow-2xl backdrop-blur-2xl md:p-8">
        {status === 'verifying' && (
          <div className="space-y-4 py-6">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-amber-400" />
            <p className="text-xs text-slate-400">
              {t(
                'Verifying your affiliate credentials...',
                'กำลังตรวจสอบข้อมูลการเป็นพันธมิตรของคุณ...'
              )}
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="h-8 w-8" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-emerald-300">
                {t(
                  'Partner Account Verified!',
                  'ยืนยันบัญชีพันธมิตรเรียบร้อยแล้ว!'
                )}
              </h3>
              <p className="text-xs text-slate-400">
                {t(
                  'Your affiliate account is now fully approved. You can generate custom discount codes and track payouts.',
                  'บัญชีพันธมิตรของคุณได้รับการอนุมัติแล้ว คุณสามารถสร้างรหัสโปรโมชันและติดตามการจ่ายเงินได้ทันที'
                )}
              </p>
            </div>

            <div className="pt-2">
              <Link href="/affiliate/dashboard">
                <Button className="w-full bg-amber-500 py-5 font-bold text-slate-950 hover:bg-amber-400">
                  <Share2 className="mr-2 h-4 w-4" />
                  {t('Open Partner Dashboard', 'เปิดแดชบอร์ดพันธมิตร')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/40 bg-rose-500/20 text-rose-400">
                <AlertCircle className="h-8 w-8" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-rose-300">
                {t('Partner Verification Failed', 'การยืนยันไม่สำเร็จ')}
              </h3>
              <p className="text-xs text-slate-400">
                {errorMsg ||
                  t(
                    'The token might be expired or invalid.',
                    'โทเค็นอาจหมดอายุหรือไม่ถูกต้อง'
                  )}
              </p>
            </div>

            <div className="pt-2">
              <Link href="/affiliate/register">
                <Button className="w-full bg-amber-500 font-bold text-slate-950 hover:bg-amber-400">
                  {t('Register Again', 'ลงทะเบียนใหม่อีกครั้ง')}
                </Button>
              </Link>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function AffiliateVerifyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050609] p-4 text-slate-100">
      <Suspense fallback={null}>
        <AffiliateVerifyContent />
      </Suspense>
    </div>
  );
}

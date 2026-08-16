'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Zap,
  Receipt,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/lib/context/locale-context';

function CheckoutReturnContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentId =
    searchParams.get('payment_id') || searchParams.get('paymentId') || '';
  const statusParam = searchParams.get('status') || '';
  const { t } = useLocale();

  const [status, setStatus] = useState<'SUCCESS' | 'PENDING' | 'FAILED'>(
    statusParam.toUpperCase() === 'FAILED'
      ? 'FAILED'
      : statusParam.toUpperCase() === 'PENDING'
        ? 'PENDING'
        : 'SUCCESS'
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (paymentId) {
      // Validate payment status from backend
      const checkPayment = async () => {
        setIsLoading(true);
        try {
          const res = await fetch(`/api/payments/dlocal/${paymentId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'PAID' || data.status === 'COMPLETED') {
              setStatus('SUCCESS');
            } else if (data.status === 'PENDING') {
              setStatus('PENDING');
            } else if (
              data.status === 'REJECTED' ||
              data.status === 'CANCELLED'
            ) {
              setStatus('FAILED');
            }
          }
        } catch (e) {
          // keep fallback
        } finally {
          setIsLoading(false);
        }
      };
      checkPayment();
    }
  }, [paymentId]);

  return (
    <div className="w-full max-w-lg space-y-6">
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
          {t('Payment Confirmation', 'ยืนยันสถานะการชำระเงิน')}
        </h1>
      </div>

      <Card className="space-y-6 border-slate-800/80 bg-[#090b14]/95 p-6 text-center shadow-2xl backdrop-blur-2xl md:p-8">
        {isLoading ? (
          <div className="space-y-4 py-8">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-amber-400" />
            <p className="text-xs text-slate-400">
              {t(
                'Verifying payment with gateway...',
                'กำลังตรวจสอบการชำระเงินกับเกตเวย์...'
              )}
            </p>
          </div>
        ) : status === 'SUCCESS' ? (
          <div className="space-y-5">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="h-9 w-9" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-extrabold text-emerald-300">
                {t('Payment Successful!', 'ชำระเงินเรียบร้อยแล้ว!')}
              </h3>
              <p className="text-xs text-slate-400">
                {t(
                  'Your PRO subscription is activated. You now have full zero-latency access to the PRO Terminal and conversational AI models.',
                  'แพ็กเกจ PRO ของคุณเปิดใช้งานแล้ว ตอนนี้คุณสามารถเข้าใช้งาน PRO Terminal และโมเดล AI สนทนาได้เต็มรูปแบบ'
                )}
              </p>
            </div>

            {paymentId && (
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#06080e] p-3 font-mono text-xs text-slate-400">
                <span>{t('Transaction ID', 'รหัสธุรกรรม')}:</span>
                <span className="font-semibold text-slate-200">
                  {paymentId}
                </span>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <Link href="/terminal">
                <Button className="w-full bg-amber-500 py-5 font-bold text-slate-950 hover:bg-amber-400">
                  <Zap className="mr-2 h-4 w-4" />
                  {t('Launch PRO Terminal', 'เปิดใช้งาน PRO Terminal ทันที')}
                </Button>
              </Link>
              <Link href="/settings/billing">
                <Button
                  variant="ghost"
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  <Receipt className="mr-1.5 h-3.5 w-3.5" />
                  {t(
                    'View Invoices & Billing Details',
                    'ดูใบเสร็จและการเรียกเก็บเงิน'
                  )}
                </Button>
              </Link>
            </div>
          </div>
        ) : status === 'PENDING' ? (
          <div className="space-y-5">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/20 text-amber-400">
                <Clock className="h-9 w-9" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-extrabold text-amber-300">
                {t(
                  'Payment Pending Processing',
                  'การชำระเงินอยู่ระหว่างดำเนินการ'
                )}
              </h3>
              <p className="text-xs text-slate-400">
                {t(
                  'Your bank transfer or local payment is being cleared. Your account will automatically upgrade once payment is confirmed.',
                  'การโอนเงินหรือการชำระเงินท้องถิ่นกำลังรอการยืนยัน บัญชีของคุณจะได้รับการอัปเกรดอัตโนมัติเมื่อได้รับการยืนยัน'
                )}
              </p>
            </div>

            <Link href="/dashboard">
              <Button className="w-full bg-slate-800 font-bold text-slate-200 hover:bg-slate-700">
                {t('Return to Dashboard', 'กลับสู่แดชบอร์ด')}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-500/40 bg-rose-500/20 text-rose-400">
                <AlertCircle className="h-9 w-9" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-extrabold text-rose-300">
                {t('Payment Unsuccessful', 'การชำระเงินไม่สำเร็จ')}
              </h3>
              <p className="text-xs text-slate-400">
                {t(
                  'The transaction was cancelled or declined by your financial institution.',
                  'ธุรกรรมถูกยกเลิกหรือถูกปฏิเสธโดยสถาบันการเงินของคุณ'
                )}
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Link href="/checkout">
                <Button className="w-full bg-amber-500 font-bold text-slate-950 hover:bg-amber-400">
                  {t('Try Another Payment Method', 'ลองใช้วิธีชำระเงินอื่น')}
                </Button>
              </Link>
              <Link href="/pricing">
                <Button
                  variant="ghost"
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  {t('Review Plans', 'ดูแผนบริการทั้งหมด')}
                </Button>
              </Link>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function CheckoutReturnPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050609] p-4 text-slate-100">
      <Suspense fallback={null}>
        <CheckoutReturnContent />
      </Suspense>
    </div>
  );
}

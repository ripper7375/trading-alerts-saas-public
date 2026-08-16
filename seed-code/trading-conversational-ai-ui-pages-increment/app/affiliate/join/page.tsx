'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Share2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Percent,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MarketingNavbar } from '@/components/marketing/marketing-navbar';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { useLocale } from '@/lib/context/locale-context';

export default function AffiliateJoinPage() {
  const router = useRouter();
  const { t } = useLocale();

  return (
    <div className="flex min-h-screen flex-col bg-[#050609] text-slate-100">
      <MarketingNavbar />

      <main className="container mx-auto max-w-3xl flex-1 px-4 py-16 md:px-6">
        <div className="space-y-8 text-center">
          <div className="space-y-3">
            <Badge className="border-amber-500/40 bg-amber-500/15 px-3 py-1 font-mono text-xs text-amber-400">
              {t('Partner Onboarding', 'การสมัครเป็นพันธมิตร')}
            </Badge>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 md:text-4xl">
              {t(
                'Join the DavinTrade Partner Network',
                'เข้าร่วมเครือข่ายพันธมิตร DavinTrade'
              )}
            </h1>
            <p className="mx-auto max-w-xl text-sm text-slate-400">
              {t(
                'Instant partner application. Start creating custom promo codes and earning 30% lifetime recurring commissions immediately.',
                'สมัครเป็นพันธมิตรได้ทันที เริ่มต้นสร้างรหัสโปรโมชันและรับค่าคอมมิชชัน 30% ต่อเนื่องตลอดชีพ'
              )}
            </p>
          </div>

          <Card className="space-y-6 border-amber-500/30 bg-[#090b14]/95 p-6 text-left shadow-2xl backdrop-blur-2xl md:p-8">
            <div className="space-y-4">
              <h3 className="text-base font-bold text-slate-100">
                {t('Program Highlights', 'จุดเด่นของโปรแกรม')}
              </h3>

              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-[#06080e] p-3.5">
                  <Percent className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">
                      {t(
                        '30% Recurring Monthly Share',
                        'ส่วนแบ่งรายได้ 30% ต่อเนื่องทุกเดือน'
                      )}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      {t(
                        'Earn every month as long as referred subscribers remain active.',
                        'รับรายได้ทุกเดือนตราบใดที่สมาชิกที่คุณแนะนำยังคงใช้งาน'
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-[#06080e] p-3.5">
                  <Share2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">
                      {t(
                        'Unique Promo Code Attribution',
                        'ระบบติดตามผ่านรหัสโปรโมชันเฉพาะตัว'
                      )}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      {t(
                        'Give 10% discount to your users while binding their account to you forever.',
                        'มอบส่วนลด 10% ให้ผู้ติดตาม พร้อมผูกบัญชีแนะนำอย่างถาวร'
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-[#06080e] p-3.5">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">
                      {t(
                        'Automated Wise Payouts on the 1st of every month',
                        'โอนเงินอัตโนมัติผ่าน Wise ทุกวันที่ 1 ของเดือน'
                      )}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      {t(
                        'Transparent ledger with zero hidden fees and direct bank transfer options.',
                        'บัญชีโปร่งใส ไม่มีค่าธรรมเนียมแอบแฝง พร้อมตัวเลือกโอนเข้าธนาคารโดยตรง'
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-4">
              <Link href="/affiliate/register">
                <Button className="w-full bg-amber-500 py-5 font-bold text-slate-950 hover:bg-amber-400">
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t(
                    'Proceed to Partner Registration',
                    'ไปยังหน้าลงทะเบียนพันธมิตร'
                  )}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <p className="text-center text-[11px] text-slate-500">
                {t('Already registered?', 'ลงทะเบียนเรียบร้อยแล้ว?')}{' '}
                <Link
                  href="/affiliate/dashboard"
                  className="text-amber-400 hover:underline"
                >
                  {t('Access Partner Dashboard', 'เข้าสู่แดชบอร์ดพันธมิตร')}
                </Link>
              </p>
            </div>
          </Card>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}

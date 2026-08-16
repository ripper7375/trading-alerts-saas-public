'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Share2,
  Percent,
  Landmark,
  ShieldCheck,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Users,
  CheckCircle2,
  DollarSign,
  Calculator,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { MarketingNavbar } from '@/components/marketing/marketing-navbar';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { useLocale } from '@/lib/context/locale-context';

export default function AffiliateLandingPage() {
  const { t } = useLocale();
  const [referralsCount, setReferralsCount] = useState(50);
  const planPrice = 49; // $49/mo
  const commissionRate = 0.3; // 30%
  const monthlyEarnings = Math.round(
    referralsCount * planPrice * commissionRate
  );
  const annualEarnings = monthlyEarnings * 12;

  const benefits = [
    {
      icon: Percent,
      title: t(
        '30% Lifetime Recurring Commission',
        'รับค่าคอมมิชชัน 30% ตลอดชีพแบบต่อเนื่อง'
      ),
      desc: t(
        'Earn 30% on every renewal as long as your referred trader maintains their PRO subscription.',
        'รับ 30% จากทุกรอบการต่ออายุตราบเท่าที่ผู้ใช้ที่คุณแนะนำยังคงเป็นสมาชิก PRO'
      ),
    },
    {
      icon: Landmark,
      title: t(
        'Automated Wise & RiseWorks Payouts',
        'จ่ายเงินอัตโนมัติผ่าน Wise และ RiseWorks'
      ),
      desc: t(
        'Direct monthly disbursements in your preferred local currency with minimal gateway friction.',
        'โอนเงินเข้าบัญชีท้องถิ่นของคุณทุกเดือนในสกุลเงินที่คุณต้องการ'
      ),
    },
    {
      icon: Share2,
      title: t('Custom Promo Code Engine', 'ระบบสร้างรหัสโปรโมชันเฉพาะตัว'),
      desc: t(
        'Generate branded discount coupons that give your audience 10-20% off while securing your tracking attribution.',
        'สร้างคูปองส่วนลดพิเศษ 10-20% สำหรับผู้ติดตามของคุณพร้อมระบบผูกบัญชีแนะนำที่แม่นยำ'
      ),
    },
    {
      icon: Users,
      title: t('Dedicated Partner Success Manager', 'ผู้ดูแลพันธมิตรส่วนตัว'),
      desc: t(
        'Direct Telegram/Discord channel access, marketing banner packs, and high-converting video assets.',
        'ติดต่อทีมงานโดยตรงผ่าน Telegram/Discord พร้อมรับสื่อการตลาดและวิดีโอแนะนำ'
      ),
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#050609] text-slate-100">
      <MarketingNavbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-slate-800/80 px-4 py-20 md:px-6 md:py-28">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.15),transparent_60%)]" />
          <div className="relative container mx-auto max-w-5xl space-y-6 text-center">
            <Badge className="border-amber-500/40 bg-amber-500/15 px-3 py-1 font-mono text-xs text-amber-400">
              {t('DavinTrade Partner Program', 'โปรแกรมพันธมิตร DavinTrade')}
            </Badge>

            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
              {t('Partner with the Leader in', 'ร่วมเป็นพันธมิตรกับผู้นำด้าน')}{' '}
              <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-yellow-500 bg-clip-text text-transparent">
                {t('Quantitative AI Trading', 'การเทรดเชิงปริมาณด้วย AI')}
              </span>
            </h1>

            <p className="mx-auto max-w-2xl text-base leading-relaxed text-slate-400 md:text-lg">
              {t(
                'Earn 30% recurring monthly revenue by introducing traders to DavinTrade AI precision fractal analytics and conversational copilots.',
                'สร้างรายได้ต่อเนื่อง 30% ทุกเดือนด้วยการแนะนำนักเทรดสู่ระบบวิเคราะห์แฟร็กทัลและผู้ช่วย AI ของ DavinTrade'
              )}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <Link href="/affiliate/register">
                <Button className="bg-gradient-to-r from-amber-500 to-amber-600 px-8 py-5 font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500">
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t('Join Affiliate Program', 'สมัครเข้าร่วมโปรแกรมพันธมิตร')}
                </Button>
              </Link>
              <Link href="/affiliate/dashboard">
                <Button
                  variant="outline"
                  className="border-slate-700 bg-slate-900/60 px-6 py-5 text-slate-200 hover:bg-slate-800"
                >
                  <Share2 className="mr-2 h-4 w-4 text-amber-400" />
                  {t('Partner Login', 'เข้าสู่ระบบพันธมิตร')}
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Earnings Calculator */}
        <section className="container mx-auto max-w-4xl px-4 py-16 md:px-6">
          <Card className="border-amber-500/40 bg-gradient-to-br from-[#0c0f1d] via-[#090b14] to-[#07080e] p-6 shadow-2xl backdrop-blur-xl md:p-10">
            <div className="mb-8 space-y-2 text-center">
              <div className="flex justify-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                  <Calculator className="h-5 w-5" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-slate-100">
                {t(
                  'Estimate Your Monthly Recurring Revenue',
                  'คำนวณรายได้ต่อเนื่องรายเดือนของคุณ'
                )}
              </h2>
              <p className="text-xs text-slate-400">
                {t(
                  'Based on active PRO subscriptions at $49/mo with 30% commission.',
                  'คำนวณจากสมาชิก PRO ราคา $49/เดือน ที่ค่าคอมมิชชัน 30%'
                )}
              </p>
            </div>

            <div className="mx-auto max-w-xl space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-slate-300">
                    {t('Active Referred Traders', 'จำนวนนักเทรดที่คุณแนะนำ')}:
                  </span>
                  <span className="font-mono text-lg font-bold text-amber-400">
                    {referralsCount} {t('traders', 'คน')}
                  </span>
                </div>
                <Slider
                  value={[referralsCount]}
                  min={5}
                  max={500}
                  step={5}
                  onValueChange={(val) => setReferralsCount(val[0])}
                  className="py-4"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-800 bg-[#06080e] p-6 text-center">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-slate-400">
                    {t('Monthly Recurring', 'รายได้รายเดือน')}
                  </div>
                  <div className="font-mono text-3xl font-extrabold text-emerald-400 md:text-4xl">
                    ${monthlyEarnings.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-500">/ month</div>
                </div>
                <div className="space-y-1 border-l border-slate-800">
                  <div className="text-xs font-medium text-slate-400">
                    {t('Annual Potential', 'รายได้สะสมรายปี')}
                  </div>
                  <div className="font-mono text-3xl font-extrabold text-amber-400 md:text-4xl">
                    ${annualEarnings.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-500">/ year</div>
                </div>
              </div>

              <div className="pt-2 text-center">
                <Link href="/affiliate/register">
                  <Button className="w-full bg-amber-500 py-5 font-bold text-slate-950 hover:bg-amber-400">
                    {t('Start Earning Today', 'เริ่มต้นรับรายได้วันนี้')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </section>

        {/* Benefits Grid */}
        <section className="border-t border-slate-800/80 bg-[#070910] px-4 py-16 md:px-6">
          <div className="container mx-auto max-w-6xl">
            <div className="mb-12 space-y-3 text-center">
              <h2 className="text-2xl font-extrabold text-slate-100 md:text-3xl">
                {t(
                  'Why Top Creators & Educators Choose DavinTrade',
                  'เหตุผลที่ครีเอเตอร์และอาจารย์สอนเทรดเลือก DavinTrade'
                )}
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {benefits.map((b, idx) => {
                const Icon = b.icon;
                return (
                  <Card
                    key={idx}
                    className="space-y-4 border-slate-800/80 bg-[#090b14]/90 p-6 transition-colors hover:border-amber-500/40"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-base font-bold text-slate-100">
                      {b.title}
                    </h3>
                    <p className="text-xs leading-relaxed text-slate-400 md:text-sm">
                      {b.desc}
                    </p>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}

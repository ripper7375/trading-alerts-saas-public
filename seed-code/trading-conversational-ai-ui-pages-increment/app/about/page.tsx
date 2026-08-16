'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Target,
  Zap,
  ShieldCheck,
  LineChart,
  Brain,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Cpu,
  Globe2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MarketingNavbar } from '@/components/marketing/marketing-navbar';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { useLocale } from '@/lib/context/locale-context';

export default function AboutPage() {
  const { t } = useLocale();

  const values = [
    {
      icon: Target,
      title: t('Focus Over Feature-Bloat', 'มุ่งเน้นคุณภาพมากกว่าฟีเจอร์ล้น'),
      description: t(
        'One primary asset, engineered with absolute mathematical depth. XAUUSD across M5 and M15 with full fractal analysis and quantitative harmonic models, instead of shallow alerts across hundreds of noisy symbols.',
        'เน้นสินทรัพย์หลักหนึ่งเดียวด้วยความลึกซึ้งทางคณิตศาสตร์ XAUUSD ในกรอบ M5 และ M15 พร้อมการวิเคราะห์แฟร็กทัลและฮาร์มอนิกเชิงปริมาณ แทนที่จะเป็นการแจ้งเตือนแบบตื้นเขินในหลายร้อยคู่เงิน'
      ),
    },
    {
      icon: Zap,
      title: t('Signal, Not Noise', 'สัญญาณคุณภาพ ปราศจากสัญญาณรบกวน'),
      description: t(
        'Real-time automated validation filters every tick. Alerts trigger only when multi-timeframe fractal alignment, momentum exhaustion, and institutional volume thresholds are strictly satisfied.',
        'ตัวกรองการตรวจสอบอัตโนมัติแบบเรียลไทม์จะประเมินทุกติ๊ก แจ้งเตือนเมื่อมีการยืนยันจากแฟร็กทัลหลายกรอบเวลา การหมดแรงของโมเมนตัม และวอลุ่มสถาบัน'
      ),
    },
    {
      icon: Brain,
      title: t(
        'Conversational Quantitative AI',
        'ปัญญาประดิษฐ์เชิงปริมาณแบบสนทนา'
      ),
      description: t(
        'Ask Davin AI anything about current market structure, support/resistance clustering, macroeconomic calendar risks, or strategy setups in natural language 24/7.',
        'สอบถาม Davin AI ได้ตลอด 24 ชั่วโมงเกี่ยวกับโครงสร้างตลาด แนวรับแนวต้าน ความเสี่ยงปฏิทินเศรษฐกิจ หรือกลยุทธ์การเทรดด้วยภาษาธรรมชาติ'
      ),
    },
    {
      icon: ShieldCheck,
      title: t('Total Transparency & Speed', 'ความโปร่งใสและความเร็วสูงสุด'),
      description: t(
        'Sub-millisecond MT5 execution pipes, zero black-box promises, clear risk-to-reward metrics, and verified public performance telemetry.',
        'ท่อส่งข้อมูล MT5 ความเร็วต่ำกว่ามิลลิวินาที ไม่มีการโอ้อวดเกินจริง การคำนวณอัตราส่วนผลตอบแทนต่อความเสี่ยงที่ชัดเจน และโทรมาตรสาธารณะที่ตรวจสอบได้'
      ),
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#050609] text-slate-100">
      <MarketingNavbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-slate-800/80 px-4 py-20 md:px-6 md:py-28">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.15),transparent_60%)]" />
          <div className="relative container mx-auto max-w-5xl space-y-6 text-center">
            <Badge className="border-amber-500/40 bg-amber-500/15 px-3 py-1 font-mono text-xs text-amber-400">
              {t('About DavinTrade AI', 'เกี่ยวกับ DavinTrade AI')}
            </Badge>

            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
              {t(
                'Precision Gold Analytics Powered by',
                'การวิเคราะห์ทองคำที่แม่นยำ ขับเคลื่อนด้วย'
              )}{' '}
              <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-yellow-500 bg-clip-text text-transparent">
                {t('Conversational AI', 'ปัญญาประดิษฐ์แบบสนทนา')}
              </span>
            </h1>

            <p className="mx-auto max-w-2xl text-base leading-relaxed text-slate-400 md:text-lg">
              {t(
                'We built DavinTrade because retail traders deserve the same quantitative rigor, real-time fractal signal precision, and sub-second execution telemetry that institutional desks use every day.',
                'เราสร้าง DavinTrade ขึ้นมาเพราะนักเทรดรายย่อยคู่ควรกับความแม่นยำเชิงปริมาณ สัญญาณแฟร็กทัลแบบเรียลไทม์ และระบบโทรมาตรระดับสถาบัน'
              )}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <Link href="/register">
                <Button className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-5 font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500">
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t('Start Exploring Free', 'เริ่มต้นใช้งานฟรี')}
                </Button>
              </Link>
              <Link href="/terminal">
                <Button
                  variant="outline"
                  className="border-slate-700 bg-slate-900/60 px-6 py-5 text-slate-200 hover:bg-slate-800"
                >
                  <LineChart className="mr-2 h-4 w-4 text-amber-400" />
                  {t('Open PRO Terminal', 'เปิดเทอร์มินัล PRO')}
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Core Principles */}
        <section className="container mx-auto max-w-6xl px-4 py-16 md:px-6">
          <div className="mb-12 space-y-3 text-center">
            <h2 className="text-2xl font-extrabold text-slate-100 md:text-3xl">
              {t('Our Engineering Principles', 'หลักการทางวิศวกรรมของเรา')}
            </h2>
            <p className="mx-auto max-w-xl text-sm text-slate-400">
              {t(
                'How we design algorithmic tools that genuinely empower traders to make disciplined, high-probability decisions.',
                'วิธีที่เราออกแบบเครื่องมืออัลกอริทึมที่ช่วยให้นักเทรดตัดสินใจได้อย่างมีวินัยและมีความน่าจะเป็นสูง'
              )}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {values.map((v, idx) => {
              const Icon = v.icon;
              return (
                <Card
                  key={idx}
                  className="border-slate-800/80 bg-[#090b14]/80 backdrop-blur-xl transition-all duration-200 hover:border-amber-500/40 hover:bg-[#0c0f1d]"
                >
                  <CardContent className="space-y-4 p-6">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-100">
                      {v.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-slate-400">
                      {v.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Global Infrastructure Stats */}
        <section className="border-t border-slate-800/80 bg-[#070910] px-4 py-16 md:px-6">
          <div className="container mx-auto max-w-5xl">
            <div className="grid grid-cols-2 gap-6 text-center md:grid-cols-4">
              <div className="space-y-1">
                <div className="font-mono text-3xl font-extrabold text-amber-400 md:text-4xl">
                  &lt; 50ms
                </div>
                <div className="text-xs font-medium text-slate-400">
                  {t('Tick Processing Latency', 'ความเร็วประมวลผลติ๊ก')}
                </div>
              </div>
              <div className="space-y-1">
                <div className="font-mono text-3xl font-extrabold text-amber-400 md:text-4xl">
                  99.98%
                </div>
                <div className="text-xs font-medium text-slate-400">
                  {t('Platform Uptime', 'ความพร้อมใช้งานระบบ')}
                </div>
              </div>
              <div className="space-y-1">
                <div className="font-mono text-3xl font-extrabold text-amber-400 md:text-4xl">
                  24/7
                </div>
                <div className="text-xs font-medium text-slate-400">
                  {t('AI Copilot Availability', 'ความพร้อมของ AI ผู้ช่วย')}
                </div>
              </div>
              <div className="space-y-1">
                <div className="font-mono text-3xl font-extrabold text-amber-400 md:text-4xl">
                  100%
                </div>
                <div className="text-xs font-medium text-slate-400">
                  {t('Rule-Based Logic', 'ลอจิกตามกฎที่โปร่งใส')}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}

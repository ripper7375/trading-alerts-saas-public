'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  LineChart,
  Palette,
  Bell,
  MessageSquare,
  Shield,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/lib/context/locale-context';
import { useAppearance } from '@/components/providers/appearance-provider';

export default function WelcomePage() {
  const router = useRouter();
  const { t } = useLocale();
  const { settings, updateSettings } = useAppearance();
  const [step, setStep] = useState(1);

  const steps = [
    {
      step: 1,
      title: t('Welcome to DavinTrade AI', 'ยินดีต้อนรับสู่ DavinTrade AI'),
      subtitle: t(
        'Your quantitative AI copilot for XAUUSD fractal market intelligence is ready.',
        'ผู้ช่วย AI เชิงปริมาณสำหรับการวิเคราะห์แฟร็กทัลทองคำของคุณพร้อมแล้ว'
      ),
    },
    {
      step: 2,
      title: t('Choose Your Preferred Theme Accent', 'เลือกสีธีมที่คุณชื่นชอบ'),
      subtitle: t(
        'Customize your charting accents and workspace aesthetics.',
        'ปรับแต่งสีสันของกราฟและพื้นที่ทำงานของคุณ'
      ),
    },
    {
      step: 3,
      title: t('Launch Your First Workspace', 'เปิดพื้นที่ทำงานแรกของคุณ'),
      subtitle: t(
        'Select whether you want to explore the Free Workspace or enter the PRO Terminal.',
        'เลือกว่าคุณต้องการเริ่มด้วยพื้นที่ทำงานฟรี หรือเข้าสู่เทอร์มินัล PRO'
      ),
    },
  ];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050609] p-4 text-slate-100">
      <div className="w-full max-w-xl space-y-6">
        {/* Logo & Step indicator */}
        <div className="space-y-3 text-center">
          <div className="inline-flex items-center gap-2">
            <div className="relative flex h-11 w-11 overflow-hidden rounded-xl border border-amber-500/40 bg-amber-500/20 p-0.5 shadow-lg shadow-amber-500/20">
              <Image
                src="/davintrade-ai-icon.png"
                alt="DavinTrade AI"
                width={44}
                height={44}
                className="h-full w-full rounded-[9px] object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <span className="bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-2xl font-black text-transparent">
              DavinTrade AI
            </span>
          </div>

          <div className="flex items-center justify-center gap-2 pt-1">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  step === s
                    ? 'w-8 bg-amber-500'
                    : step > s
                      ? 'w-4 bg-amber-500/50'
                      : 'w-4 bg-slate-800'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step Card */}
        <Card className="space-y-6 border-slate-800/80 bg-[#090b14]/95 p-6 shadow-2xl backdrop-blur-2xl md:p-8">
          <div className="space-y-2 text-center">
            <h2 className="text-xl font-bold text-slate-100 md:text-2xl">
              {steps[step - 1].title}
            </h2>
            <p className="text-xs text-slate-400 md:text-sm">
              {steps[step - 1].subtitle}
            </p>
          </div>

          {step === 1 && (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-[#06080e] p-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                  <LineChart className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">
                    {t(
                      'Real-Time XAUUSD M5/M15 Fractal Feeds',
                      'ฟีดข้อมูลแฟร็กทัลทองคำ M5/M15 เรียลไทม์'
                    )}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {t(
                      'Multi-timeframe liquidity detection.',
                      'ตรวจจับสภาพคล่องหลายกรอบเวลา'
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-[#06080e] p-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">
                    {t(
                      'Davin AI Quantitative Chat Copilot',
                      'AI ผู้ช่วยสนทนาเชิงปริมาณ 24/7'
                    )}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {t(
                      'Instant market context via floating widget.',
                      'วิเคราะห์โครงสร้างตลาดผ่านวิดเจ็ตอัจฉริยะ'
                    )}
                  </p>
                </div>
              </div>

              <Button
                onClick={() => setStep(2)}
                className="mt-4 w-full bg-amber-500 py-5 font-bold text-slate-950 hover:bg-amber-400"
              >
                <span>{t('Continue', 'ดำเนินการต่อ')}</span>
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'amber', label: 'Gold Amber', color: 'bg-amber-500' },
                  {
                    id: 'emerald',
                    label: 'Emerald Green',
                    color: 'bg-emerald-500',
                  },
                  { id: 'blue', label: 'Sapphire Blue', color: 'bg-blue-500' },
                  {
                    id: 'purple',
                    label: 'Amethyst Purple',
                    color: 'bg-purple-500',
                  },
                ].map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() => updateSettings({ accent: acc.id as any })}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                      settings.accent === acc.id
                        ? 'border-amber-500 bg-amber-500/15 text-slate-100'
                        : 'border-slate-800 bg-[#06080e] text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className={`h-4 w-4 rounded-full ${acc.color}`} />
                    <span className="text-xs font-semibold">{acc.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex-1 border-slate-700 text-slate-300"
                >
                  {t('Back', 'ย้อนกลับ')}
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  className="flex-1 bg-amber-500 font-bold text-slate-950 hover:bg-amber-400"
                >
                  <span>{t('Next', 'ถัดไป')}</span>
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 py-2">
              <div className="grid gap-3">
                <Link href="/terminal">
                  <div className="group flex items-center justify-between rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-[#0e1220] p-4 transition-all hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/10">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 font-bold text-slate-950">
                        <Zap className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-100">
                            {t(
                              'PRO Terminal Workspace',
                              'พื้นที่ทำงาน PRO Terminal'
                            )}
                          </h4>
                          <Badge className="bg-amber-500 text-[10px] font-bold text-slate-950">
                            RECOMMENDED
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {t(
                            'Real-time zero latency, conversational AI, full indicators.',
                            'ข้อมูลสดความเร็วสูง, AI เต็มรูปแบบ, อินดิเคเตอร์ครบครัน'
                          )}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-amber-400 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>

                <Link href="/free">
                  <div className="group flex items-center justify-between rounded-xl border border-slate-800 bg-[#06080e] p-4 transition-all hover:border-slate-700">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-300">
                        <LineChart className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-200">
                          {t('Free Workspace Overview', 'พื้นที่ทำงานฟรี')}
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          {t(
                            'Explore delayed sample charts and baseline telemetry.',
                            'สำรวจกราฟตัวอย่างและข้อมูลเบื้องต้น'
                          )}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              </div>

              <div className="pt-2 text-center">
                <Link
                  href="/dashboard"
                  className="text-xs text-slate-500 underline underline-offset-4 hover:text-amber-400"
                >
                  {t(
                    'Or go straight to User Dashboard',
                    'หรือไปที่แดชบอร์ดหลัก'
                  )}
                </Link>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

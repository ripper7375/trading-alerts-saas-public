'use client';

import React from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Zap,
  CheckCircle2,
  Terminal,
  Shield,
  CreditCard,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MarketingNavbar } from '@/components/marketing/marketing-navbar';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { useLocale } from '@/lib/context/locale-context';

export default function ChangelogPage() {
  const { t } = useLocale();

  const releases = [
    {
      version: 'v2.4.0',
      date: 'August 16, 2026',
      badge: 'Latest Release',
      title: t(
        'Conversational AI Copilot & Unified Multi-Language Workspaces',
        'AI ผู้ช่วยสนทนาและพื้นที่ทำงานหลายภาษาระดับสากล'
      ),
      items: [
        t(
          'Integrated 24/7 Davin AI conversational widget across all terminals and settings pages.',
          'รวมวิดเจ็ต AI สนทนา Davin AI 24/7 ในทุกหน้าจอและเทอร์มินัล'
        ),
        t(
          'Full 12-language localization engine with real-time currency formatting.',
          'ระบบแปลภาษา 12 ภาษาสมบูรณ์แบบพร้อมการแสดงผลสกุลเงินท้องถิ่น'
        ),
        t(
          'New /terminal workspace for PRO users and /free workspace for exploring users.',
          'เปิดตัวพื้นที่ทำงานใหม่ /terminal สำหรับผู้ใช้ PRO และ /free สำหรับผู้ใช้ทั่วไป'
        ),
        t(
          'Dynamic theme accent switching (Amber, Emerald, Sapphire, Amethyst).',
          'ระบบปรับเปลี่ยนสีธีมแบบไดนามิก (อำพัน, มรกต, ไพลิน, อเมทิสต์)'
        ),
      ],
    },
    {
      version: 'v2.2.0',
      date: 'July 28, 2026',
      badge: 'Major Update',
      title: t(
        'Automated Wise & RiseWorks Partner Disbursements',
        'ระบบจ่ายเงินพันธมิตรอัตโนมัติผ่าน Wise และ RiseWorks'
      ),
      items: [
        t(
          'Automated batch payout scheduler with recipient bank account pre-validation.',
          'ระบบกำหนดการจ่ายเงินอัตโนมัติแบบกลุ่มพร้อมตรวจสอบความถูกต้องของบัญชีผู้รับ'
        ),
        t(
          'Promotional discount code generator with click tracking telemetry.',
          'เครื่องมือสร้างรหัสโปรโมชันพร้อมระบบตรวจวัดสถิติการคลิก'
        ),
        t(
          'Detailed commission statements with PDF/CSV export support.',
          'ใบแจ้งยอดค่าคอมมิชชันพร้อมรองรับการดาวน์โหลด PDF/CSV'
        ),
      ],
    },
    {
      version: 'v2.0.0',
      date: 'June 15, 2026',
      badge: 'Architecture',
      title: t(
        'Sub-Millisecond MT5 WebSocket Telemetry Engine',
        'เครื่องมือส่งข้อมูลโทรมาตร MT5 ความเร็วระดับมิลลิวินาที'
      ),
      items: [
        t(
          'Redesigned low-latency tick pipeline for Spot Gold (XAUUSD).',
          'ปรับปรุงระบบท่อส่งข้อมูลติ๊กความหน่วงต่ำสำหรับทองคำ (XAUUSD)'
        ),
        t(
          'Multi-timeframe fractal detection across M5 and M15 charts.',
          'ระบบตรวจจับแฟร็กทัลหลายกรอบเวลาในกราฟ M5 และ M15'
        ),
        t(
          'Multi-channel alert dispatch (In-app, Telegram bot, custom Webhooks).',
          'ระบบส่งการแจ้งเตือนหลายช่องทาง (ในแอป, Telegram, Webhook)'
        ),
      ],
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#050609] text-slate-100">
      <MarketingNavbar />

      <main className="container mx-auto max-w-4xl flex-1 px-4 py-16 md:px-6">
        <div className="space-y-10">
          <div className="mx-auto max-w-2xl space-y-4 text-center">
            <Badge className="border-amber-500/40 bg-amber-500/15 px-3 py-1 font-mono text-xs text-amber-400">
              {t(
                'Product Updates & Release Notes',
                'อัปเดตผลิตภัณฑ์และบันทึกประจำรุ่น'
              )}
            </Badge>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 md:text-5xl">
              {t('DavinTrade Changelog', 'บันทึกการเปลี่ยนแปลง DavinTrade')}
            </h1>
            <p className="text-sm text-slate-400">
              {t(
                'Follow the evolution of our quantitative AI trading platform, feature rollouts, and infrastructure enhancements.',
                'ติดตามการพัฒนาของแพลตฟอร์ม ฟีเจอร์ใหม่ และการปรับปรุงโครงสร้างพื้นฐาน'
              )}
            </p>
          </div>

          {/* Timeline */}
          <div className="relative ml-4 space-y-10 border-l border-slate-800 md:ml-8">
            {releases.map((rel, idx) => (
              <div key={idx} className="relative space-y-3 pl-6 md:pl-8">
                {/* Node dot */}
                <div className="absolute top-1.5 -left-[9px] h-4 w-4 rounded-full border-2 border-amber-500 bg-[#06070a]" />

                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-amber-500 text-xs font-bold text-slate-950">
                    {rel.version}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-slate-700 text-[10px] text-slate-400"
                  >
                    {rel.badge}
                  </Badge>
                  <span className="text-xs font-medium text-slate-500">
                    {rel.date}
                  </span>
                </div>

                <Card className="border-slate-800/80 bg-[#090b14]/90 p-6 backdrop-blur-xl">
                  <h3 className="mb-3 text-base font-bold text-slate-100">
                    {rel.title}
                  </h3>
                  <ul className="space-y-2 text-xs text-slate-300 md:text-sm">
                    {rel.items.map((it, iIdx) => (
                      <li key={iIdx} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Rocket,
  Bell,
  LineChart,
  Code,
  CreditCard,
  Users,
  ChevronDown,
  ChevronUp,
  Brain,
  Sparkles,
  Zap,
  Terminal,
  Shield,
  Search,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MarketingNavbar } from '@/components/marketing/marketing-navbar';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { useLocale } from '@/lib/context/locale-context';

export default function DocsPage() {
  const { t } = useLocale();
  const [searchQuery, setSearchQuery] = useState('');
  const [openSections, setOpenSections] = useState<Record<number, boolean>>({
    0: true,
    1: true,
  });

  const toggleSection = (index: number) => {
    setOpenSections((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const docSections = [
    {
      icon: Rocket,
      title: t('1. Getting Started & Setup', '1. เริ่มต้นใช้งานและการตั้งค่า'),
      summary: t(
        'Account creation, tier activation, and connecting to DavinTrade AI workspaces.',
        'การสร้างบัญชี การเปิดใช้งานแผนสมาชิก และการเชื่อมต่อพื้นที่ทำงาน DavinTrade AI'
      ),
      content: [
        t(
          'Create an account via /register using email or Google single sign-on.',
          'สร้างบัญชีผ่าน /register ด้วยอีเมลหรือ Google SSO'
        ),
        t(
          'Configure appearance themes, chart candlestick colors, and language in Settings.',
          'ตั้งค่าธีม สีแท่งเทียนกราฟ และภาษาได้ที่เมนู Settings'
        ),
        t(
          'Launch the Free Workspace (/free) or PRO Terminal (/terminal) to begin real-time quantitative monitoring.',
          'เปิดพื้นที่ทำงานฟรี (/free) หรือ PRO Terminal (/terminal) เพื่อเริ่มวิเคราะห์เชิงปริมาณแบบเรียลไทม์'
        ),
      ],
    },
    {
      icon: Brain,
      title: t(
        '2. Conversational AI Copilot',
        '2. ปัญญาประดิษฐ์ผู้ช่วยสนทนา (Davin AI)'
      ),
      summary: t(
        'How to interact with Davin AI for market structure queries, harmonic levels, and risk calculations.',
        'วิธีพูดคุยกับ Davin AI เพื่อถามโครงสร้างตลาด ระดับฮาร์มอนิก และการคำนวณความเสี่ยง'
      ),
      content: [
        t(
          'Click the AI Mascot chat trigger at the bottom right of any workspace or terminal.',
          'คลิกที่ไอคอนมาสคอต AI ด้านล่างขวาของทุกหน้าจอเพื่อเปิดหน้าต่างสนทนา'
        ),
        t(
          'Ask prompts such as "Summarize current XAUUSD M15 fractal structure" or "What is today\'s key liquidity pool?".',
          'ถามคำถาม เช่น "สรุปโครงสร้างแฟร็กทัล XAUUSD M15 ตอนนี้" หรือ "แนวรับแนวต้านสำคัญวันนี้คืออะไร"'
        ),
        t(
          'Davin AI references live order flow, MT5 tick feeds, and historical volatility matrices.',
          'Davin AI อ้างอิงข้อมูลคำสั่งซื้อขายสด ฟีดติ๊ก MT5 และเมทริกซ์ความผันผวนย้อนหลัง'
        ),
      ],
    },
    {
      icon: LineChart,
      title: t(
        '3. Fractal Analysis & Multi-Timeframe Signals',
        '3. การวิเคราะห์แฟร็กทัลและสัญญาณหลายกรอบเวลา'
      ),
      summary: t(
        'Understanding M5/M15 fractal markers, liquidity sweeps, and trend alignment metrics.',
        'ทำความเข้าใจเครื่องหมายแฟร็กทัล M5/M15 การกวาดสภาพคล่อง และการยืนยันแนวโน้ม'
      ),
      content: [
        t(
          'High & Low fractals indicate key structural pivots identified by 5-bar mathematical models.',
          'แฟร็กทัลบน/ล่างระบุจุดกลับตัวเชิงโครงสร้างที่คำนวณจากแบบจำลองคณิตศาสตร์ 5 แท่ง'
        ),
        t(
          'Multi-timeframe confirmation: M15 sets the macro trend bias, while M5 provides precision tactical trigger points.',
          'การยืนยันหลายกรอบเวลา: M15 กำหนดแนวโน้มหลัก ขณะที่ M5 ให้จุดเข้าเทรดที่แม่นยำ'
        ),
        t(
          'Candle color synchronization dynamically updates charts across your selected DavinTrade theme.',
          'ระบบสีแท่งเทียนจะซิงค์อัตโนมัติตามธีมสีที่คุณเลือกไว้ใน DavinTrade'
        ),
      ],
    },
    {
      icon: Bell,
      title: t(
        '4. Real-Time Alert Engine',
        '4. เครื่องมือการแจ้งเตือนแบบเรียลไทม์'
      ),
      summary: t(
        'Creating custom price triggers, fractal breach alerts, and webhook notifications.',
        'การสร้างการแจ้งเตือนราคา สัญญาณทะลุแฟร็กทัล และการเชื่อมต่อ Webhook'
      ),
      content: [
        t(
          'Navigate to /alerts/new to build conditional trigger logic.',
          'ไปที่ /alerts/new เพื่อสร้างเงื่อนไขการแจ้งเตือนตามต้องการ'
        ),
        t(
          'Select delivery methods: In-app real-time popups, sound pings, Telegram bot, or custom webhook JSON payloads.',
          'เลือกช่องทางรับการแจ้งเตือน: ป๊อปอัปในแอป, เสียงแจ้งเตือน, บอท Telegram หรือ Webhook JSON'
        ),
        t(
          'Monitor alert execution velocity and historical triggers in /alerts.',
          'ตรวจสอบประวัติการแจ้งเตือนและสถิติการทำงานได้ที่ /alerts'
        ),
      ],
    },
    {
      icon: CreditCard,
      title: t(
        '5. Subscriptions, Invoicing & dLocal/Stripe Billing',
        '5. การสมัครสมาชิก ใบเสร็จ และระบบชำระเงิน'
      ),
      summary: t(
        'Managing PRO access, localized payment gateways, and recurring invoices.',
        'การจัดการสถานะ PRO เกตเวย์การชำระเงินท้องถิ่น และใบเสร็จรับเงิน'
      ),
      content: [
        t(
          'Upgrade seamlessly through /checkout supporting Credit Cards, PromptPay, Pix, and regional bank transfers via dLocal & Stripe.',
          'อัปเกรดง่ายๆ ผ่าน /checkout รองรับบัตรเครดิต, พร้อมเพย์, Pix และโอนผ่านธนาคาร'
        ),
        t(
          'Download official PDF invoices and change payment methods under /settings/billing.',
          'ดาวน์โหลดใบเสร็จรับเงิน PDF และเปลี่ยนวิธีชำระเงินได้ที่ /settings/billing'
        ),
        t(
          'Manage auto-renewals or cancel subscription at any time with zero lock-in.',
          'จัดการการต่ออายุอัตโนมัติหรือยกเลิกแพ็กเกจได้ทุกเมื่อโดยไม่มีข้อผูกมัด'
        ),
      ],
    },
    {
      icon: Users,
      title: t(
        '6. Affiliate Partner Program & Wise Payouts',
        '6. โปรแกรมพันธมิตรและการรับเงินผ่าน Wise'
      ),
      summary: t(
        'Referral code generation, commission tracking, and automated disbursement batches.',
        'การสร้างรหัสแนะนำ การติดตามค่าคอมมิชชัน และการจ่ายเงินอัตโนมัติ'
      ),
      content: [
        t(
          'Register as an affiliate partner at /affiliate/register.',
          'สมัครเป็นพันธมิตรได้ที่ /affiliate/register'
        ),
        t(
          'Create custom discount promo codes for your audience in /affiliate/dashboard/codes.',
          'สร้างรหัสโปรโมชันส่วนลดพิเศษสำหรับผู้ติดตามของคุณได้ที่ /affiliate/dashboard/codes'
        ),
        t(
          'Receive 30% recurring commissions disbursed directly to your Wise or RiseWorks account.',
          'รับค่าคอมมิชชัน 30% แบบต่อเนื่อง จ่ายตรงเข้าบัญชี Wise หรือ RiseWorks ของคุณ'
        ),
      ],
    },
  ];

  const filtered = docSections.filter(
    (s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.summary.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#050609] text-slate-100">
      <MarketingNavbar />

      <main className="container mx-auto max-w-5xl flex-1 px-4 py-16 md:px-6">
        <div className="space-y-8">
          <div className="mx-auto max-w-2xl space-y-4 text-center">
            <Badge className="border-amber-500/40 bg-amber-500/15 px-3 py-1 font-mono text-xs text-amber-400">
              {t('DavinTrade AI Knowledge Hub', 'คลังความรู้ DavinTrade AI')}
            </Badge>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 md:text-5xl">
              {t(
                'Documentation & Platform Guides',
                'เอกสารคู่มือและวิธีใช้งานแพลตฟอร์ม'
              )}
            </h1>
            <p className="text-sm text-slate-400">
              {t(
                'Complete reference for trading workspaces, algorithmic signals, conversational AI, billing, and API endpoints.',
                'คู่มือฉบับสมบูรณ์สำหรับพื้นที่ทำงาน สัญญาณอัลกอริทึม ระบบ AI สนทนา การเรียกเก็บเงิน และ API'
              )}
            </p>

            {/* Search Input */}
            <div className="relative mx-auto max-w-md pt-2">
              <Search className="absolute top-5 left-3.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder={t(
                  'Search topics, signals, webhooks...',
                  'ค้นหาหัวข้อ, สัญญาณ, webhook...'
                )}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 border-slate-800 bg-[#090b14] pl-10 text-slate-200 focus:border-amber-500/60"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4">
            {filtered.map((section, idx) => {
              const Icon = section.icon;
              const isOpen = openSections[idx];

              return (
                <Card
                  key={idx}
                  className="border-slate-800/80 bg-[#090b14]/90 backdrop-blur-xl transition-colors hover:border-slate-700"
                >
                  <div
                    onClick={() => toggleSection(idx)}
                    className="flex cursor-pointer items-center justify-between p-5 select-none"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-100">
                          {section.title}
                        </h3>
                        <p className="text-xs text-slate-400">
                          {section.summary}
                        </p>
                      </div>
                    </div>
                    <button className="p-1 text-slate-400 hover:text-slate-200">
                      {isOpen ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </button>
                  </div>

                  {isOpen && (
                    <CardContent className="space-y-2 border-t border-slate-800/80 bg-[#06080e]/60 px-6 py-4">
                      <ul className="space-y-2 text-xs text-slate-300 md:text-sm">
                        {section.content.map((point, pIdx) => (
                          <li key={pIdx} className="flex items-start gap-2">
                            <span className="font-bold text-amber-400">•</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}

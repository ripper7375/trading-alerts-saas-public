'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Calendar,
  Clock,
  ArrowRight,
  TrendingUp,
  Brain,
  Sparkles,
  Zap,
  Tag,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MarketingNavbar } from '@/components/marketing/marketing-navbar';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { useLocale } from '@/lib/context/locale-context';

export default function BlogPage() {
  const { t } = useLocale();
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = [
    'All',
    'Fractal Models',
    'AI Research',
    'Risk Management',
    'Market Insights',
  ];

  const posts = [
    {
      id: 1,
      title: t(
        'Decoding Gold Fractal Geometry: Multi-Timeframe Alignment on M5 and M15',
        'ถอดรหัสเรขาคณิตแฟร็กทัลทองคำ: การประสานกรอบเวลา M5 และ M15'
      ),
      excerpt: t(
        'How 5-bar mathematical pivot structures identify liquidity sweeps before institutional breakout extensions materialize.',
        'โครงสร้างจุดหมุนทางคณิตศาสตร์ 5 แท่งช่วยตรวจจับการกวาดสภาพคล่องก่อนการเบรกเอาต์ระดับสถาบันได้อย่างไร'
      ),
      category: 'Fractal Models',
      date: 'Aug 14, 2026',
      readTime: '6 min read',
      badge: 'Featured',
    },
    {
      id: 2,
      title: t(
        'Conversational Quantitative Copilots: Transforming Raw Tick Feeds into Natural Insights',
        'AI ผู้ช่วยสนทนาเชิงปริมาณ: แปลงข้อมูลติ๊กดิบเป็นข้อมูลเชิงลึกที่เข้าใจง่าย'
      ),
      excerpt: t(
        'Why LLMs combined with sub-millisecond MT5 tick feeds give retail traders real-time statistical confidence without cluttered screen fatigue.',
        'เหตุใดการผสาน LLM เข้ากับฟีดติ๊กความเร็วสูงจึงมอบความมั่นใจทางสถิติแก่นักเทรดรายย่อย'
      ),
      category: 'AI Research',
      date: 'Aug 10, 2026',
      readTime: '8 min read',
      badge: 'Engineering',
    },
    {
      id: 3,
      title: t(
        'Asymmetric Risk-to-Reward: Surviving Gold Volatility During Macroeconomic Releases',
        'ผลตอบแทนต่อความเสี่ยงแบบอสมมาตร: เอาตัวรอดจากความผันผวนของทองคำช่วงข่าวเศรษฐกิจ'
      ),
      excerpt: t(
        'Quantitative risk rules for managing position sizing and volatility expansion around CPI and FOMC announcements.',
        'กฎการบริหารความเสี่ยงเชิงปริมาณสำหรับการคำนวณขนาดการเทรดช่วงประกาศตัวเลขเงินเฟ้อและอัตราดอกเบี้ย'
      ),
      category: 'Risk Management',
      date: 'Aug 04, 2026',
      readTime: '5 min read',
      badge: 'Strategy',
    },
  ];

  const filtered =
    selectedCategory === 'All'
      ? posts
      : posts.filter((p) => p.category === selectedCategory);

  return (
    <div className="flex min-h-screen flex-col bg-[#050609] text-slate-100">
      <MarketingNavbar />

      <main className="container mx-auto max-w-6xl flex-1 px-4 py-16 md:px-6">
        <div className="space-y-10">
          <div className="mx-auto max-w-2xl space-y-4 text-center">
            <Badge className="border-amber-500/40 bg-amber-500/15 px-3 py-1 font-mono text-xs text-amber-400">
              {t(
                'DavinTrade Research & Insights',
                'งานวิจัยและบทความ DavinTrade'
              )}
            </Badge>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 md:text-5xl">
              {t('Trading Intelligence Blog', 'บล็อกข่าวกรองการเทรด')}
            </h1>
            <p className="text-sm text-slate-400">
              {t(
                'Deep dives into quantitative trading, fractal market structures, and conversational AI architecture.',
                'เจาะลึกการเทรดเชิงปริมาณ โครงสร้างตลาดแบบแฟร็กทัล และสถาปัตยกรรม AI สำหรับตลาดการเงิน'
              )}
            </p>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
                    selectedCategory === cat
                      ? 'bg-amber-500 font-bold text-slate-950 shadow-md shadow-amber-500/20'
                      : 'border border-slate-800 bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Posts Grid */}
          <div className="grid gap-6 md:grid-cols-3">
            {filtered.map((post) => (
              <Card
                key={post.id}
                className="flex flex-col justify-between border-slate-800/80 bg-[#090b14]/90 backdrop-blur-xl transition-all duration-200 hover:border-amber-500/40 hover:bg-[#0c0f1c]"
              >
                <CardContent className="flex flex-1 flex-col justify-between space-y-4 p-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge className="border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-400">
                        {post.category}
                      </Badge>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500">
                        <Clock className="h-3 w-3" />
                        <span>{post.readTime}</span>
                      </div>
                    </div>

                    <h3 className="text-base leading-snug font-bold text-slate-100 transition-colors hover:text-amber-300">
                      {post.title}
                    </h3>

                    <p className="line-clamp-3 text-xs leading-relaxed text-slate-400">
                      {post.excerpt}
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-800/80 pt-4 text-xs text-slate-500">
                    <span>{post.date}</span>
                    <Link
                      href="/terminal"
                      className="flex items-center gap-1 font-semibold text-amber-400 hover:text-amber-300"
                    >
                      <span>{t('Read in Terminal', 'อ่านในเทอร์มินัล')}</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Newsletter Box */}
          <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-[#0d101a] to-[#090b14] p-8 text-center">
            <h3 className="text-lg font-bold text-slate-100">
              {t(
                'Get Weekly Quantitative Alpha Directly to Your Inbox',
                'รับบทวิเคราะห์เชิงปริมาณรายสัปดาห์ส่งตรงถึงคุณ'
              )}
            </h3>
            <p className="text-xs text-slate-400">
              {t(
                'Zero spam. Strictly fractal levels, volatility previews, and AI signal recaps.',
                'ไม่มีสแปม มีเพียงระดับแนวรับแนวต้าน ความผันผวน และสรุปสัญญาณ AI'
              )}
            </p>
            <div className="mx-auto flex max-w-md gap-2">
              <Input
                placeholder={t('Enter your email', 'กรอกอีเมลของคุณ')}
                className="border-slate-800 bg-[#06080e] text-slate-200"
              />
              <Button className="shrink-0 bg-amber-500 font-bold text-slate-950 hover:bg-amber-400">
                {t('Subscribe', 'ติดตาม')}
              </Button>
            </div>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}

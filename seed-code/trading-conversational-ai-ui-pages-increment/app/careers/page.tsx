'use client';

import React from 'react';
import Link from 'next/link';
import {
  Briefcase,
  Globe2,
  Code2,
  Cpu,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Heart,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MarketingNavbar } from '@/components/marketing/marketing-navbar';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { useLocale } from '@/lib/context/locale-context';

export default function CareersPage() {
  const { t } = useLocale();

  const openings = [
    {
      title: t('Senior Quantitative Engineer (Rust / Python)'),
      department: 'Engineering',
      location: 'Remote (Global)',
      type: 'Full-Time',
      description: t(
        'Architect high-throughput MT5 tick processing pipelines and real-time mathematical fractal engines.'
      ),
    },
    {
      title: t('AI / LLM Financial Systems Researcher'),
      department: 'AI Research',
      location: 'Remote',
      type: 'Full-Time',
      description: t(
        'Train and fine-tune specialized financial reasoning agents for natural language market telemetry.'
      ),
    },
    {
      title: t('Full-Stack Next.js / TypeScript Engineer'),
      department: 'Product',
      location: 'Remote',
      type: 'Full-Time',
      description: t(
        'Build high-performance web workspaces, canvas charting overlays, and localized fintech billing flows.'
      ),
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#050609] text-slate-100">
      <MarketingNavbar />

      <main className="container mx-auto max-w-5xl flex-1 px-4 py-16 md:px-6">
        <div className="space-y-10">
          <div className="mx-auto max-w-2xl space-y-4 text-center">
            <Badge className="border-amber-500/40 bg-amber-500/15 px-3 py-1 font-mono text-xs text-amber-400">
              {t('Careers at DavinTrade AI')}
            </Badge>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 md:text-5xl">
              {t('Build the Future of Quantitative Trading Intelligence')}
            </h1>
            <p className="text-sm text-slate-400">
              {t(
                'We are a fully remote, global team obsessed with high-speed systems, mathematical elegance, and frictionless UX.'
              )}
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-200">
              {t('Open Positions')}
            </h2>

            <div className="grid gap-4">
              {openings.map((job, idx) => (
                <Card
                  key={idx}
                  className="border-slate-800/80 bg-[#090b14]/90 p-6 backdrop-blur-xl transition-all hover:border-amber-500/40 hover:bg-[#0c0f1c]"
                >
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-400">
                          {job.department}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="border-slate-700 text-[10px] text-slate-400"
                        >
                          {job.location}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="border-slate-700 text-[10px] text-slate-400"
                        >
                          {job.type}
                        </Badge>
                      </div>
                      <h3 className="text-base font-bold text-slate-100">
                        {job.title}
                      </h3>
                      <p className="max-w-2xl text-xs text-slate-400">
                        {job.description}
                      </p>
                    </div>

                    <Button
                      onClick={() => {
                        window.location.href = `mailto:careers@davintrade.com?subject=Application: ${encodeURIComponent(job.title)}`;
                      }}
                      className="shrink-0 bg-amber-500 font-bold text-slate-950 hover:bg-amber-400"
                    >
                      <span>{t('Apply Now')}</span>
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}

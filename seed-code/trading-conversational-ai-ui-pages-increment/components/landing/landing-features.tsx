'use client';

import {
  Brain,
  Zap,
  ShieldCheck,
  Calculator,
  LineChart,
  BellRing,
  Layers,
  Cpu,
} from 'lucide-react';
import { useLocale } from '@/lib/context/locale-context';

const features = [
  {
    icon: Brain,
    title: 'AI Pattern Recognition',
    description:
      'Automated scanning for double bottoms, head & shoulders, order blocks, and Liquidity Sweeps in real time across M5 to D1 timeframes.',
    badge: 'Real-time AI',
    color: 'from-amber-500 to-amber-600',
    borderColor: 'hover:border-amber-500/50',
    glowColor: 'group-hover:shadow-amber-500/10',
  },
  {
    icon: BellRing,
    title: 'Sub-500ms Breach Alerts',
    description:
      'Set precise price breach and trendline alert triggers evaluated every 500ms on server-side engine with instant push notifications.',
    badge: '<500ms Latency',
    color: 'from-emerald-500 to-emerald-600',
    borderColor: 'hover:border-emerald-500/50',
    glowColor: 'group-hover:shadow-emerald-500/10',
  },
  {
    icon: Layers,
    title: 'Multi-Model Confluence',
    description:
      'Dual AI models cross-examine technical signals and macroeconomic sentiment to produce a 0–100% Confluence Score before you enter.',
    badge: 'Dual AI Verification',
    color: 'from-cyan-500 to-cyan-600',
    borderColor: 'hover:border-cyan-500/50',
    glowColor: 'group-hover:shadow-cyan-500/10',
  },
  {
    icon: Calculator,
    title: 'Risk & Order Calculator',
    description:
      'Institutional lot size computation based on account equity, maximum risk % per trade, spread buffer, and precise pip distance.',
    badge: '1-Click Execution',
    color: 'from-purple-500 to-purple-600',
    borderColor: 'hover:border-purple-500/50',
    glowColor: 'group-hover:shadow-purple-500/10',
  },
];

export function LandingFeatures() {
  const { t } = useLocale();

  return (
    <section
      id="features"
      className="relative bg-slate-50 py-20 dark:bg-[#06070a]"
    >
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Header */}
        <div className="mx-auto mb-16 max-w-3xl space-y-4 text-center">
          <div className="inline-flex items-center space-x-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
            <Cpu className="h-3.5 w-3.5" />
            <span>{t('POWERFUL QUANTITATIVE STACK')}</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            {t('Engineered for Precision Traders & Analysts')}
          </h2>
          <p className="text-base text-slate-500 sm:text-lg dark:text-slate-400">
            {t(
              'DavinTrade combines ultra-low latency price monitoring with cutting-edge conversational AI models to give you an unshakeable market edge.'
            )}
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className={`group relative rounded-2xl border border-slate-200 bg-white/80 p-6 backdrop-blur-md transition-all duration-300 dark:border-slate-800 dark:bg-[#0c0f18]/80 ${item.borderColor} ${item.glowColor} shadow-lg shadow-black/60 hover:-translate-y-1`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${item.color} p-0.5 shadow-md`}
                  >
                    <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-white dark:bg-[#0c0f18]">
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <span className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
                    {t(item.badge)}
                  </span>
                </div>

                <h3 className="mb-2 text-xl font-bold text-white transition-colors group-hover:text-amber-700 dark:group-hover:text-amber-300">
                  {t(item.title)}
                </h3>
                <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  {t(item.description)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

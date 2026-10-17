import {
  Rocket,
  Bell,
  LineChart,
  CreditCard,
  Users,
  Brain,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CommissionPercentText } from '@/components/affiliate/commission-percent-text';
import {
  DocsSearch,
  DocsSearchInput,
  DocsSectionList,
  type DocsSectionView,
} from '@/components/marketing/docs-browser';
import { getServerTranslator } from '@/lib/i18n/server-translator';

export default async function DocsPage() {
  const t = await getServerTranslator();

  const docSections = [
    {
      icon: Rocket,
      title: t('1. Getting Started & Setup'),
      summary: t(
        'Account creation, tier activation, and connecting to DavinTrade AI workspaces.'
      ),
      content: [
        t(
          'Create an account via /register using email or Google single sign-on.'
        ),
        t(
          'Configure appearance themes, chart candlestick colors, and language in Settings.'
        ),
        t(
          'Launch the Free Workspace (/free) or PRO Terminal (/terminal) to begin real-time quantitative monitoring.'
        ),
      ],
    },
    {
      icon: Brain,
      title: t('2. Conversational AI Copilot'),
      summary: t(
        'How to interact with Davin AI for market structure queries, harmonic levels, and risk calculations.'
      ),
      content: [
        t(
          'Click the AI Mascot chat trigger at the bottom right of any workspace or terminal.'
        ),
        t(
          'Ask prompts such as "Summarize current XAUUSD M15 fractal structure" or "What is today\'s key liquidity pool?".'
        ),
        t(
          'Davin AI references live order flow, MT5 tick feeds, and historical volatility matrices.'
        ),
      ],
    },
    {
      icon: LineChart,
      title: t('3. Fractal Analysis & Multi-Timeframe Signals'),
      summary: t(
        'Understanding M5/M15 fractal markers, liquidity sweeps, and trend alignment metrics.'
      ),
      content: [
        t(
          'High & Low fractals indicate key structural pivots identified by 5-bar mathematical models.'
        ),
        t(
          'Multi-timeframe confirmation: M15 sets the macro trend bias, while M5 provides precision tactical trigger points.'
        ),
        t(
          'Candle color synchronization dynamically updates charts across your selected DavinTrade theme.'
        ),
      ],
    },
    {
      icon: Bell,
      title: t('4. Real-Time Alert Engine'),
      summary: t(
        'Creating custom price triggers, fractal breach alerts, and webhook notifications.'
      ),
      content: [
        t('Navigate to /alerts/new to build conditional trigger logic.'),
        t(
          'Select delivery methods: In-app real-time popups, sound pings, Telegram bot, or custom webhook JSON payloads.'
        ),
        t(
          'Monitor alert execution velocity and historical triggers in /alerts.'
        ),
      ],
    },
    {
      icon: CreditCard,
      title: t('5. Subscriptions, Invoicing & dLocal/Stripe Billing'),
      summary: t(
        'Managing PRO access, localized payment gateways, and recurring invoices.'
      ),
      content: [
        t(
          'Upgrade seamlessly through /checkout supporting Credit Cards, PromptPay, Pix, and regional bank transfers via dLocal & Stripe.'
        ),
        t(
          'Download official PDF invoices and change payment methods under /settings/billing.'
        ),
        t(
          'Manage auto-renewals or cancel subscription at any time with zero lock-in.'
        ),
      ],
    },
    {
      icon: Users,
      title: t('6. Affiliate Partner Program & Wise Payouts'),
      summary: t(
        'Referral code generation, commission tracking, and automated disbursement batches.'
      ),
      content: [
        t('Register as an affiliate partner at /affiliate/register.'),
        t(
          'Create custom discount promo codes for your audience in /affiliate/dashboard/codes.'
        ),
        // The one line that quotes the live commission rate.
        <CommissionPercentText
          key="commission"
          template={t(
            'docs.affiliate_commission_payouts',
            'Receive {percent}% recurring commissions disbursed directly to your Wise or RiseWorks account.'
          )}
        />,
      ],
    },
  ];

  // Each section's heading and list are built here, on the server; the list
  // component only filters them by the search text and opens and closes them.
  const sections: DocsSectionView[] = docSections.map((section) => {
    const Icon = section.icon;
    return {
      title: section.title,
      summary: section.summary,
      header: (
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {section.title}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {section.summary}
            </p>
          </div>
        </div>
      ),
      body: (
        <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300 md:text-sm">
          {section.content.map((point, pIdx) => (
            <li key={pIdx} className="flex items-start gap-2">
              <span className="font-bold text-amber-600 dark:text-amber-400">
                •
              </span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      ),
    };
  });

  return (
    <div className="bg-slate-50 text-slate-900 dark:bg-[#050609] dark:text-slate-100">
      <div className="container mx-auto max-w-5xl px-4 py-16 md:px-6">
        <DocsSearch>
          <div className="space-y-8">
            <div className="mx-auto max-w-2xl space-y-4 text-center">
              <Badge className="border-amber-500/40 bg-amber-500/15 px-3 py-1 font-mono text-xs text-amber-700 dark:text-amber-400">
                {t('DavinTrade AI Knowledge Hub')}
              </Badge>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 md:text-5xl">
                {t('Documentation & Platform Guides')}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t(
                  'Complete reference for trading workspaces, algorithmic signals, conversational AI, billing, and API endpoints.'
                )}
              </p>

              {/* Search Input */}
              <DocsSearchInput
                placeholder={t('Search topics, signals, webhooks...')}
              />
            </div>

            <DocsSectionList sections={sections} />
          </div>
        </DocsSearch>
      </div>
    </div>
  );
}

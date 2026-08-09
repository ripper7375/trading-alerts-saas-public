'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  HelpCircle,
  Book,
  MessageCircle,
  Mail,
  Bug,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Check,
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLocale } from '@/lib/context/locale-context';

export default function HelpPage() {
  const { t } = useLocale();
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(0);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const quickLinks = [
    {
      icon: Book,
      title: 'Documentation',
      desc: 'Learn how to use DavinTrade MTF & line alert tools',
      href: '#',
    },
    {
      icon: MessageCircle,
      title: 'VIP Discord Community',
      desc: 'Chat with our quantitative traders in real-time',
      href: '#',
    },
    {
      icon: Mail,
      title: '24/7 Email Support',
      desc: 'Get assistance via email (sub-2 hour PRO SLA)',
      href: 'mailto:support@davin-trade.com',
    },
    {
      icon: Bug,
      title: 'Report a Bug',
      desc: 'Help us improve by reporting interface issues',
      href: '#',
    },
  ];

  const faqs = [
    {
      question: 'How do server-side price & line alerts work?',
      answer:
        'Alerts evaluate 24/7 on our server-side engine. PRO subscribers get 100 active alert rules evaluated every 500ms against live XAUUSD tick data. You can set threshold rules or draw custom lines on the chart canvas that fire push & email notifications upon price breach.',
    },
    {
      question: 'What is the difference between FREE and PRO tiers?',
      answer:
        'FREE tier gives you access to the M5/M15 XAUUSD live chart, basic Gemini 3.6 Flash AI analysis, and read-only past chat history. PRO tier unlocks 100 active alerts, multi-model AI analysis (Claude Sonnet 5, GPT 5.6, GLM-5.2), live M5 on M15 equal-distance channel overlay, and unrestricted WebSocket comment feeds.',
    },
    {
      question: 'How do I cancel or modify my subscription?',
      answer:
        'You can manage or cancel your PRO subscription anytime under Settings > Billing. Your PRO privileges will remain active until the end of your paid billing cycle with no hidden cancellation fees.',
    },
    {
      question: 'How does the 7-day account deletion grace period work?',
      answer:
        'When you request account deletion under Settings > Account, your account enters a 7-day grace period. You can log in anytime during these 7 days to cancel the deletion request and restore your settings.',
    },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !message) return;
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
      setSubject('');
      setMessage('');
      setTimeout(() => setSubmitted(false), 4000);
    }, 1000);
  };

  return (
    <div className="animate-fade-in space-y-6 select-none">
      <div className="space-y-6 rounded-2xl border border-slate-800/80 bg-[#090c14] p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-100">
              <HelpCircle className="h-4 w-4 text-amber-400" />{' '}
              {t('Help Center & Technical Support')}
            </h2>
            <p className="text-[11px] text-slate-400">
              {t(
                'Search documentation, read FAQs, or contact our support team'
              )}
            </p>
          </div>
          <Badge className="border-amber-500/40 bg-amber-500/10 font-mono text-[9px] text-amber-300">
            {t('24/7 SUPPORT')}
          </Badge>
        </div>

        {/* Quick Link Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {quickLinks.map((item, idx) => {
            const Icon = item.icon;
            return (
              <a
                key={idx}
                href={item.href}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-800 bg-[#06080e] p-3.5 transition-all hover:border-amber-500/40 hover:bg-slate-800/50"
              >
                <div className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/15 p-2 text-amber-400">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="flex items-center gap-1 text-xs font-bold text-slate-200">
                    {t(item.title)}{' '}
                    <ExternalLink className="h-3 w-3 text-slate-500" />
                  </h4>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {t(item.desc)}
                  </p>
                </div>
              </a>
            );
          })}
        </div>

        <Separator className="bg-slate-800" />

        {/* FAQ Accordion */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold text-slate-300">
            {t('Frequently Asked Questions (FAQ)')}
          </Label>
          <div className="space-y-2">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="overflow-hidden rounded-xl border border-slate-800 bg-[#06080e]"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedFAQ(expandedFAQ === idx ? null : idx)
                  }
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-bold text-slate-200 transition-colors hover:bg-slate-800/40"
                >
                  <span>{t(faq.question)}</span>
                  {expandedFAQ === idx ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-amber-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
                  )}
                </button>
                {expandedFAQ === idx && (
                  <div className="border-t border-slate-800/60 px-4 pt-1 pb-3.5 text-xs leading-relaxed text-slate-400">
                    {t(faq.answer)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <Separator className="bg-slate-800" />

        {/* Contact Support Ticket Form */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold text-slate-300">
            {t('Submit Technical Support Ticket')}
          </Label>
          {submitted ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs font-bold text-emerald-300">
              <Check className="h-4 w-4 text-emerald-400" />{' '}
              {t(
                'Ticket Submitted! Our support team will respond via email within 2 hours.'
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="max-w-xl space-y-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-slate-400">
                  {t('Issue Category')}
                </Label>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger className="border-slate-750 bg-[#06080e] text-xs">
                    <SelectValue placeholder={t('Select topic')} />
                  </SelectTrigger>
                  <SelectContent className="border-slate-750 bg-[#0f1420] text-xs">
                    <SelectItem value="Alert Engine Query">
                      {t('Alert Engine Trigger Issue')}
                    </SelectItem>
                    <SelectItem value="AI Model Query">
                      {t('AI Analyst Model Response Query')}
                    </SelectItem>
                    <SelectItem value="Billing Payment Issue">
                      {t('Billing & Invoice Query')}
                    </SelectItem>
                    <SelectItem value="Affiliate Payout Issue">
                      {t('Affiliate Payout Issue')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-slate-400">
                  {t('Message Description')}
                </Label>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t(
                    'Describe your issue or question in detail...'
                  )}
                  className="border-slate-750 w-full rounded-xl border bg-[#06080e] p-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-500/60 focus:outline-none"
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || !subject || !message.trim()}
                className="h-9 bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 hover:from-amber-400 hover:to-amber-500"
              >
                {isSubmitting
                  ? t('Submitting Ticket...')
                  : t('Submit Support Ticket')}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

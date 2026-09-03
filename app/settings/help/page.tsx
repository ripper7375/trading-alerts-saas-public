'use client';

import { useState } from 'react';
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
  Headphones,
} from 'lucide-react';

import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLocale } from '@/lib/context/locale-context';

/**
 * Help Page (Row 76, Protected Page #6)
 *
 * Ported from Codebase 2's design (amber DavinTrade styling, quick links,
 * FAQ accordion, ticket form) with two real-vs-mock swaps, per Decision 5
 * (100% visual fidelity) and the "Zero Mock Data" rule:
 *  - seed-code's "Launch Support Chat" button calls useSupportChat() from
 *    components/chat-widget/chat-context -- that widget was explicitly
 *    deferred to Phase 14 (Session 9-1) and is not mounted anywhere in the
 *    main repo. Replaced with a real `mailto:support@davintrade.app` link,
 *    matching this order's own Step 2 instruction.
 *  - seed-code's ticket form "submits" via a fake setTimeout with no real
 *    endpoint (confirmed: no /api/support, /api/contact, or /api/ticket
 *    route exists in this repo). Rather than ship a fabricated success
 *    toast for a request that is never actually delivered, the form
 *    composes a real `mailto:` link pre-filled with the category + message
 *    so "submit" performs a genuine action (opens the user's mail client).
 */

const quickLinks = [
  {
    icon: Book,
    titleKey: 'settings.help.documentation',
    title: 'Documentation',
    descKey: 'settings.help.documentation_desc',
    desc: 'Learn how to use DavinTrade MTF & line alert tools',
    href: '/docs',
  },
  {
    icon: MessageCircle,
    titleKey: 'settings.help.vip_discord',
    title: 'VIP Discord Community',
    descKey: 'settings.help.vip_discord_desc',
    desc: 'Chat with our quantitative traders in real-time',
    href: '#',
  },
  {
    icon: Mail,
    titleKey: 'settings.help.email_support_24_7',
    title: '24/7 Email Support',
    descKey: 'settings.help.email_support_24_7_desc',
    desc: 'Get assistance via email (sub-2 hour PRO SLA)',
    href: 'mailto:support@davintrade.app',
  },
  {
    icon: Bug,
    titleKey: 'settings.help.report_a_bug',
    title: 'Report a Bug',
    descKey: 'settings.help.report_a_bug_desc',
    desc: 'Help us improve by reporting interface issues',
    href: 'mailto:support@davintrade.app?subject=Bug%20Report',
  },
];

const faqs = [
  {
    questionKey: 'settings.help.faq_alerts_q',
    question: 'How do server-side price & line alerts work?',
    answerKey: 'settings.help.faq_alerts_a',
    answer:
      'Alerts evaluate 24/7 on our server-side engine. PRO subscribers get 100 active alert rules evaluated every 500ms against live XAUUSD tick data. You can set threshold rules or draw custom lines on the chart canvas that fire push & email notifications upon price breach.',
  },
  {
    questionKey: 'settings.help.faq_tiers_q',
    question: 'What is the difference between FREE and PRO tiers?',
    answerKey: 'settings.help.faq_tiers_a',
    answer:
      'FREE tier gives you access to the M5/M15 XAUUSD live chart and full market data & indicators. PRO tier unlocks 100 active price alerts, drawing engine line alerts, and multi-timeframe visualization.',
  },
  {
    questionKey: 'settings.help.faq_cancel_q',
    question: 'How do I cancel or modify my subscription?',
    answerKey: 'settings.help.faq_cancel_a',
    answer:
      'You can manage or cancel your PRO subscription anytime under Settings > Billing. Your PRO privileges will remain active until the end of your paid billing cycle with no hidden cancellation fees.',
  },
  {
    questionKey: 'settings.help.faq_deletion_q',
    question: 'How does the account deletion grace period work?',
    answerKey: 'settings.help.faq_deletion_a',
    answer:
      'When you request account deletion under Settings > Account, you get a 7-day window to confirm via the link in your email. Once confirmed, there is a further 24-hour grace period before deletion executes -- you can cancel any time before that.',
  },
];

export default function HelpPage(): React.ReactElement {
  const { t } = useLocale();
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(0);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!subject || !message) return;

    const mailBody = encodeURIComponent(message);
    const mailSubject = encodeURIComponent(`[${subject}] Support Request`);
    window.location.href = `mailto:support@davintrade.app?subject=${mailSubject}&body=${mailBody}`;

    setSent(true);
    setSubject('');
    setMessage('');
    setTimeout(() => setSent(false), 4000);
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-foreground">
              <HelpCircle className="h-4 w-4 text-primary" />{' '}
              {t('settings.help.page_title', 'Help Center & Technical Support')}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {t(
                'settings.help.page_subtitle',
                'Search documentation, read FAQs, or contact our support team'
              )}
            </p>
          </div>
          <Badge className="border-primary/40 bg-primary/10 font-mono text-[9px] text-primary">
            {t('settings.help.support_badge', '24/7 SUPPORT')}
          </Badge>
        </div>

        {/* Support Banner */}
        <div className="border-primary/40 from-primary/15 via-primary/10 flex flex-col items-center justify-between gap-3 rounded-xl border bg-gradient-to-r to-transparent p-4 sm:flex-row">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
              <Headphones className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xs font-extrabold text-foreground">
                {t(
                  'settings.help.instant_assistance_title',
                  'Need Instant Assistance? Email Our Support Team'
                )}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {t(
                  'settings.help.instant_assistance_desc',
                  'Connect with the DavinTrade support team by email'
                )}
              </p>
            </div>
          </div>
          <Button asChild className="h-9 shrink-0 text-xs font-extrabold">
            <a href="mailto:support@davintrade.app">
              {t('settings.help.email_support_button', 'Email Support')}
            </a>
          </Button>
        </div>

        {/* Quick Link Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {quickLinks.map((item, idx) => {
            const Icon = item.icon;
            return (
              <a
                key={idx}
                href={item.href}
                className="hover:border-primary/40 bg-muted/40 flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3.5 transition-all hover:bg-accent"
              >
                <div className="border-primary/30 bg-primary/15 shrink-0 rounded-lg border p-2 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="flex items-center gap-1 text-xs font-bold text-foreground">
                    {t(item.titleKey, item.title)}{' '}
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </h4>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {t(item.descKey, item.desc)}
                  </p>
                </div>
              </a>
            );
          })}
        </div>

        <Separator />

        {/* FAQ Accordion */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold text-muted-foreground">
            {t('settings.help.faq_heading', 'Frequently Asked Questions (FAQ)')}
          </Label>
          <div className="space-y-2">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="bg-muted/40 overflow-hidden rounded-xl border border-border"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedFAQ(expandedFAQ === idx ? null : idx)
                  }
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-bold text-foreground transition-colors hover:bg-accent"
                >
                  <span>{t(faq.questionKey, faq.question)}</span>
                  {expandedFAQ === idx ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
                {expandedFAQ === idx && (
                  <div className="border-t border-border px-4 pb-3.5 pt-1 text-xs leading-relaxed text-muted-foreground">
                    {t(faq.answerKey, faq.answer)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Contact Support Form -- real mailto compose, not a fake API call */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold text-muted-foreground">
            {t('settings.help.contact_support', 'Contact Support')}
          </Label>
          {sent ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              <Check className="h-4 w-4" />{' '}
              {t(
                'settings.help.opening_email_client',
                'Opening your email client to send this to support@davintrade.app...'
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="max-w-xl space-y-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  {t('Issue Category', 'Issue Category')}
                </Label>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger className="text-xs">
                    <SelectValue
                      placeholder={t('Select topic', 'Select topic')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Alert Engine Query">
                      {t(
                        'Alert Engine Trigger Issue',
                        'Alert Engine Trigger Issue'
                      )}
                    </SelectItem>
                    <SelectItem value="Billing Payment Issue">
                      {t('Billing & Invoice Query', 'Billing & Invoice Query')}
                    </SelectItem>
                    <SelectItem value="Affiliate Payout Issue">
                      {t('Affiliate Payout Issue', 'Affiliate Payout Issue')}
                    </SelectItem>
                    <SelectItem value="Other">
                      {t('settings.help.other_option', 'Other')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  {t('Message Description', 'Message Description')}
                </Label>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t(
                    'Describe your issue or question in detail...',
                    'Describe your issue or question in detail...'
                  )}
                  className="focus:border-primary/60 bg-muted/40 w-full rounded-xl border border-border p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>

              <Button
                type="submit"
                disabled={!subject || !message.trim()}
                className="h-9 text-xs font-extrabold"
              >
                {t('settings.help.send_via_email', 'Send via Email')}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

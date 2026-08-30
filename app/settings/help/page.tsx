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
    title: 'Documentation',
    desc: 'Learn how to use DavinTrade MTF & line alert tools',
    href: '/docs',
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
    href: 'mailto:support@davintrade.app',
  },
  {
    icon: Bug,
    title: 'Report a Bug',
    desc: 'Help us improve by reporting interface issues',
    href: 'mailto:support@davintrade.app?subject=Bug%20Report',
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
      'FREE tier gives you access to the M5/M15 XAUUSD live chart and full market data & indicators. PRO tier unlocks 100 active price alerts, drawing engine line alerts, and multi-timeframe visualization.',
  },
  {
    question: 'How do I cancel or modify my subscription?',
    answer:
      'You can manage or cancel your PRO subscription anytime under Settings > Billing. Your PRO privileges will remain active until the end of your paid billing cycle with no hidden cancellation fees.',
  },
  {
    question: 'How does the account deletion grace period work?',
    answer:
      'When you request account deletion under Settings > Account, you get a 7-day window to confirm via the link in your email. Once confirmed, there is a further 24-hour grace period before deletion executes -- you can cancel any time before that.',
  },
];

export default function HelpPage(): React.ReactElement {
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
              <HelpCircle className="h-4 w-4 text-primary" /> Help Center &amp;
              Technical Support
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Search documentation, read FAQs, or contact our support team
            </p>
          </div>
          <Badge className="border-primary/40 bg-primary/10 font-mono text-[9px] text-primary">
            24/7 SUPPORT
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
                Need Instant Assistance? Email Our Support Team
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Connect with the DavinTrade support team by email
              </p>
            </div>
          </div>
          <Button asChild className="h-9 shrink-0 text-xs font-extrabold">
            <a href="mailto:support@davintrade.app">Email Support</a>
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
                    {item.title}{' '}
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </h4>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {item.desc}
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
            Frequently Asked Questions (FAQ)
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
                  <span>{faq.question}</span>
                  {expandedFAQ === idx ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
                {expandedFAQ === idx && (
                  <div className="border-t border-border px-4 pb-3.5 pt-1 text-xs leading-relaxed text-muted-foreground">
                    {faq.answer}
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
            Contact Support
          </Label>
          {sent ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              <Check className="h-4 w-4" /> Opening your email client to send
              this to support@davintrade.app...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="max-w-xl space-y-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Issue Category
                </Label>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Select topic" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Alert Engine Query">
                      Alert Engine Trigger Issue
                    </SelectItem>
                    <SelectItem value="Billing Payment Issue">
                      Billing &amp; Invoice Query
                    </SelectItem>
                    <SelectItem value="Affiliate Payout Issue">
                      Affiliate Payout Issue
                    </SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Message Description
                </Label>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your issue or question in detail..."
                  className="focus:border-primary/60 bg-muted/40 w-full rounded-xl border border-border p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>

              <Button
                type="submit"
                disabled={!subject || !message.trim()}
                className="h-9 text-xs font-extrabold"
              >
                Send via Email
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

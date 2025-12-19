'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Book,
  MessageCircle,
  Mail,
  Bug,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Check,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Help Page
 *
 * Features:
 * - Quick links (Documentation, Live Chat, Email Support, Report Bug)
 * - FAQ accordion
 * - Contact form (subject, message)
 */

interface QuickLink {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href: string;
  external?: boolean;
}

interface FAQItem {
  question: string;
  answer: string;
}

const quickLinks: QuickLink[] = [
  {
    icon: Book,
    title: 'Documentation',
    description: 'Learn how to use Trading Alerts effectively',
    href: '/docs',
    external: false,
  },
  {
    icon: MessageCircle,
    title: 'Live Chat',
    description: 'Chat with our support team in real-time',
    href: '#',
    external: false,
  },
  {
    icon: Mail,
    title: 'Email Support',
    description: 'Get help via email (24-48 hour response)',
    href: 'mailto:support@tradingalerts.com',
    external: true,
  },
  {
    icon: Bug,
    title: 'Report a Bug',
    description: 'Help us improve by reporting issues',
    href: 'https://github.com/tradingalerts/issues',
    external: true,
  },
];

const faqItems: FAQItem[] = [
  {
    question: 'How do I create my first alert?',
    answer:
      'Navigate to the Alerts page from the dashboard sidebar, then click "Create Alert". Select your symbol, timeframe, and set your price conditions. Finally, choose how you want to be notified (email, push, or both).',
  },
  {
    question: 'What is the difference between FREE and PRO tiers?',
    answer:
      'FREE tier includes 5 symbols, 3 timeframes, and 5 active alerts. PRO tier offers 15 symbols, 9 timeframes (M5 to D1), 20 alerts, and priority notifications with 30-second updates instead of 60 seconds.',
  },
  {
    question: 'How do I upgrade to PRO?',
    answer:
      'Go to Settings > Billing and click "Upgrade to PRO". You can pay monthly ($29/month) with credit card or other payment methods. Your upgrade takes effect immediately.',
  },
  {
    question: 'Can I cancel my PRO subscription?',
    answer:
      'Yes, you can cancel anytime from Settings > Billing. Your PRO features will remain active until the end of your current billing period. After cancellation, you will be downgraded to the FREE tier.',
  },
  {
    question: 'How are alerts triggered?',
    answer:
      'Alerts are triggered when the market price meets your specified conditions. FREE users receive updates every 60 seconds, while PRO users get 30-second updates. You will be notified via your chosen notification method.',
  },
  {
    question: 'What timeframes are available?',
    answer:
      'FREE tier: M15, H1, H4. PRO tier: M5, M15, M30, H1, H2, H4, H8, D1. Longer timeframes like W1 and MN are planned for future releases.',
  },
  {
    question: 'How do I delete my account?',
    answer:
      'Go to Settings > Account and scroll to the "Danger Zone" section. Click "Delete Account" and follow the confirmation process. You will receive an email to confirm the deletion. You have 7 days to cancel the deletion request.',
  },
  {
    question: 'Can I use affiliate discount codes?',
    answer:
      'Yes! PRO users can use affiliate discount codes to save on their subscription. Enter the code during checkout or in Settings > Billing before your renewal date.',
  },
];

export default function HelpPage(): React.ReactElement {
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Toggle FAQ expansion
  const toggleFAQ = (index: number): void => {
    setExpandedFAQ(expandedFAQ === index ? null : index);
  };

  // Handle contact form submission
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    if (!contactSubject || !contactMessage) {
      return;
    }

    setIsSubmitting(true);

    try {
      // In a real implementation, this would send to a support system
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setSubmitSuccess(true);
      setContactSubject('');
      setContactMessage('');

      setTimeout(() => setSubmitSuccess(false), 5000);
    } catch (error) {
      console.error('Failed to submit contact form:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Help & Support
      </h2>

      {/* Quick Links */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Quick Links
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.title}
                href={link.href}
                target={link.external ? '_blank' : undefined}
                rel={link.external ? 'noopener noreferrer' : undefined}
              >
                <Card className="hover:border-blue-500 transition-colors cursor-pointer h-full">
                  <CardContent className="p-4 flex items-start gap-4">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Icon className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        {link.title}
                        {link.external && (
                          <ExternalLink className="w-3 h-3 text-gray-400" />
                        )}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {link.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <Separator className="my-8" />

      {/* FAQ Section */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Frequently Asked Questions
        </h3>
        <div className="space-y-3">
          {faqItems.map((item, index) => (
            <div
              key={index}
              className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleFAQ(index)}
                className="w-full px-4 py-3 flex items-center justify-between text-left bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="font-medium text-gray-900 dark:text-white">
                  {item.question}
                </span>
                {expandedFAQ === index ? (
                  <ChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
                )}
              </button>
              {expandedFAQ === index && (
                <div className="px-4 py-3 bg-white dark:bg-gray-900">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {item.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <Separator className="my-8" />

      {/* Contact Form */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Contact Us
        </h3>
        <Card>
          <CardContent className="p-6">
            {submitSuccess ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Message Sent!
                </h4>
                <p className="text-gray-600 dark:text-gray-400">
                  We&apos;ll get back to you within 24-48 hours.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label
                    htmlFor="subject"
                    className="text-sm font-medium mb-2 block"
                  >
                    Subject
                  </Label>
                  <Select
                    value={contactSubject}
                    onValueChange={setContactSubject}
                  >
                    <SelectTrigger id="subject">
                      <SelectValue placeholder="Select a topic" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General Question</SelectItem>
                      <SelectItem value="billing">Billing Issue</SelectItem>
                      <SelectItem value="technical">
                        Technical Support
                      </SelectItem>
                      <SelectItem value="feature">Feature Request</SelectItem>
                      <SelectItem value="bug">Bug Report</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label
                    htmlFor="message"
                    className="text-sm font-medium mb-2 block"
                  >
                    Message
                  </Label>
                  <textarea
                    id="message"
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    rows={5}
                    placeholder="Describe your issue or question in detail..."
                    className="flex w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                  disabled={!contactSubject || !contactMessage || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Send Message
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

import React, { useState } from 'react';
import { Search, HelpCircle, Mail, MessageSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function HelpPage() {
  const [search, setSearch] = useState('');

  const FAQS = [
    {
      q: 'How does DavinTrade detect fractal support & resistance?',
      a: 'Our backend connects directly to MetaTrader 5 terminals running specialized MQL5 fractal algorithms. Peak-to-peak highs and lows are calculated in real time and synced to your mobile app under 500ms.',
    },
    {
      q: 'How do mobile push notifications work on Android and iOS?',
      a: 'On Android, alerts are delivered via Firebase Cloud Messaging (FCM) high-priority channels with custom audio chimes. On iOS, you can add DavinTrade to your Home Screen for Safari Web Push notifications.',
    },
    {
      q: 'What is the difference between Free and PRO plans?',
      a: 'Free includes 5 symbols and 3 timeframes with basic alerts. PRO unlocks 15+ symbols, all 9 timeframes (M1-D1), MT5 real-time tick streaming, 20+ active alerts, and full Conversational AI analyst models.',
    },
    {
      q: 'How do I earn 20% recurring commissions with the Affiliate Program?',
      a: 'Generate your personal referral code in the Affiliate Dashboard and share it with traders. When they subscribe to PRO, you earn 20% every month their subscription remains active.',
    },
  ];

  const filtered = FAQS.filter(
    (f) =>
      f.q.toLowerCase().includes(search.toLowerCase()) ||
      f.a.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="space-y-1">
        <h1 className="text-xl font-black tracking-tight text-foreground">
          Help & Support Center
        </h1>
        <p className="text-xs text-muted-foreground">
          Find answers to frequently asked questions about MT5 alerts and AI
          analysis.
        </p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search questions or topics..."
          className="pl-10"
        />
      </div>

      {/* FAQ Accordion */}
      <div className="space-y-2">
        <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Frequently Asked Questions
        </h2>
        <Card className="border-border/80 bg-card/60">
          <CardContent className="p-3">
            <Accordion type="single" collapsible className="w-full">
              {filtered.map((item, idx) => (
                <AccordionItem key={idx} value={`faq-${idx}`}>
                  <AccordionTrigger className="py-3 text-left">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent>{item.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>

      {/* Direct Contact Card */}
      <Card className="mt-2 border-border/80 bg-card/60">
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-foreground">
                Need dedicated assistance?
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Our support team is available 24/7.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => window.open('mailto:support@davintrade.com')}
            className="text-xs font-bold"
          >
            Email Support
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MessageSquare,
  Send,
  HelpCircle,
  Search,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

export default function HelpSettingsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('mt5');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const FAQS = [
    {
      q: 'How fast are the MT5 Price Breach Push Notifications?',
      a: 'DavinTrade connects directly to institutional broker feeds, processing tick breaches with sub-500ms latency. Notifications are dispatched via high-priority FCM channels.',
    },
    {
      q: 'Can I use DavinTrade on multiple devices simultaneously?',
      a: 'Yes, PRO accounts support simultaneous sessions across your Android app, iPad/tablet, and Desktop browser with real-time alert sync.',
    },
    {
      q: 'What LLM models power the Conversational AI Analyst?',
      a: 'Our Quad-RAG architecture dynamically queries Gemini 3.6 Flash, Claude Sonnet 5, and GPT 5.6 Terra against real-time MT5 fractal order book data.',
    },
    {
      q: 'How do affiliate commissions and monthly payouts work?',
      a: 'Affiliates earn a 20% recurring monthly commission on all referred PRO subscribers ($5.80/mo). Payouts disburse on the 1st of every month via USDT TRC20 or Bank Wire.',
    },
  ];

  const filteredFaqs = FAQS.filter(
    (f) =>
      f.q.toLowerCase().includes(search.toLowerCase()) ||
      f.a.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success('Support ticket submitted! Ticket ID: #DT-9482');
      setSubject('');
      setMessage('');
    }, 900);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => navigate(-1)}
          className="h-8 w-8 rounded-xl"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-black text-foreground">Help & Support</h1>
          <p className="text-xs text-muted-foreground">
            FAQ guides & ticket submission
          </p>
        </div>
      </div>

      {/* FAQ Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search questions & guides..."
          className="pl-10 text-xs"
        />
      </div>

      {/* Accordion FAQs */}
      <div className="space-y-2">
        <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Frequently Asked Questions
        </h3>
        <Card className="border-border/80 bg-card">
          <CardContent className="p-3">
            <Accordion type="single" collapsible className="w-full">
              {filteredFaqs.map((faq, i) => (
                <AccordionItem
                  key={i}
                  value={`item-${i}`}
                  className="border-border/60"
                >
                  <AccordionTrigger className="py-3 text-left text-xs font-bold text-foreground hover:no-underline">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="pb-3 text-xs leading-relaxed text-muted-foreground">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>

      {/* Submit Ticket Form */}
      <Card className="border-border/80 bg-card shadow-xl">
        <CardContent className="p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Submit VIP Support Ticket
            </h3>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Inquiry Category
              </label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-10 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mt5">
                    MT5 Alert Triggers & Push Notifications
                  </SelectItem>
                  <SelectItem value="billing">
                    Billing & Stripe Subscription
                  </SelectItem>
                  <SelectItem value="ai">
                    AI Analyst / Quad-RAG Tokens
                  </SelectItem>
                  <SelectItem value="affiliate">
                    Affiliate Partner Commissions
                  </SelectItem>
                  <SelectItem value="other">
                    General Feedback / Bug Report
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Subject
              </label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of your question..."
                className="text-xs"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Message
              </label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Please include symbol or device details if reporting an issue..."
                rows={3}
                className="text-xs"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full bg-amber-500 text-xs font-bold text-slate-950 hover:bg-amber-400"
            >
              <Send className="mr-2 h-4 w-4" />
              <span>{loading ? 'Submitting...' : 'Send Support Ticket'}</span>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

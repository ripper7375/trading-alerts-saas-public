import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  ArrowLeft,
  HelpCircle,
  MessageCircle,
  Mail,
  FileText,
  ExternalLink,
  Send,
  Search,
  ChevronRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const faqItems = [
  {
    question: 'How do I create a price alert?',
    answer:
      "Navigate to the Alerts tab, tap the '+' button, select a symbol, choose your condition (above, below, or equals), enter your target price, and tap 'Create Alert'.",
  },
  {
    question: 'Why am I not receiving notifications?',
    answer:
      "Make sure notifications are enabled in Settings > Notifications. Also check that your device's notification permissions are enabled for the app, and that you're not in Quiet Hours.",
  },
  {
    question: 'How do I add symbols to my watchlist?',
    answer:
      "Go to the Watchlist tab and tap the 'Add' button in the top right. Search for the symbol you want to track and tap it to add it to your watchlist.",
  },
  {
    question: 'Can I customize chart indicators?',
    answer:
      "Yes! In the Charts tab, scroll down to the 'Technical Indicators' section where you can toggle various indicators like SMA, EMA, RSI, MACD, and Bollinger Bands.",
  },
  {
    question: 'How do I enable two-factor authentication?',
    answer:
      "Go to Settings > Security and toggle on 'Authenticator App' under Two-Factor Authentication. Follow the prompts to set up with Google Authenticator or Authy.",
  },
  {
    question: 'How do I change the app theme?',
    answer:
      'Navigate to Settings > Appearance where you can switch between Light, Dark, or System theme. You can also customize accent colors and font sizes.',
  },
  {
    question: 'What is Quiet Hours?',
    answer:
      'Quiet Hours allows you to silence non-critical notifications during specific times (e.g., overnight). You can configure this in Settings > Notifications > Quiet Hours.',
  },
  {
    question: 'How do I delete my account?',
    answer:
      'For account deletion requests, please contact our support team at support@tradingalerts.com. Note that this action is irreversible and all data will be permanently deleted.',
  },
];

const supportOptions = [
  {
    icon: MessageCircle,
    label: 'Live Chat',
    description: 'Chat with our support team',
    badge: 'Online',
    action: 'chat',
  },
  {
    icon: Mail,
    label: 'Email Support',
    description: 'support@tradingalerts.com',
    action: 'email',
  },
  {
    icon: FileText,
    label: 'Documentation',
    description: 'Browse our help articles',
    action: 'docs',
  },
];

const HelpSupport = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackEmail, setFeedbackEmail] = useState('');

  const filteredFaq = faqItems.filter(
    (item) =>
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSupportAction = (action: string) => {
    switch (action) {
      case 'chat':
        toast({
          title: 'Live Chat',
          description: 'Connecting to support agent...',
        });
        break;
      case 'email':
        window.location.href = 'mailto:support@tradingalerts.com';
        break;
      case 'docs':
        toast({
          title: 'Documentation',
          description: 'Opening help center...',
        });
        break;
    }
  };

  const handleSubmitFeedback = () => {
    if (!feedbackMessage.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter your message',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Feedback Sent',
      description: "Thank you for your feedback! We'll get back to you soon.",
    });
    setFeedbackMessage('');
    setFeedbackEmail('');
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/settings')} className="p-1">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              Help & Support
            </h1>
            <p className="text-sm text-muted-foreground">
              Get help with the app
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 space-y-4 p-4 pb-24">
        {/* Contact Support */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
              Contact Us
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-2">
            {supportOptions.map((option) => (
              <button
                key={option.label}
                onClick={() => handleSupportAction(option.action)}
                className="flex w-full items-center gap-3 rounded-lg p-3 transition-colors hover:bg-accent"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <option.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-foreground">{option.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {option.description}
                  </p>
                </div>
                {option.badge && (
                  <Badge
                    variant="secondary"
                    className="bg-green-500/10 text-xs text-green-500"
                  >
                    {option.badge}
                  </Badge>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </CardContent>
        </Card>

        {/* FAQ Section */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wide text-muted-foreground">
              <HelpCircle className="h-4 w-4" />
              Frequently Asked Questions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search FAQ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {filteredFaq.length > 0 ? (
              <Accordion type="single" collapsible className="w-full">
                {filteredFaq.map((item, index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger className="text-left text-sm">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <p className="py-4 text-center text-muted-foreground">
                No matching questions found
              </p>
            )}
          </CardContent>
        </Card>

        {/* Send Feedback */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
              Send Feedback
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            <div className="space-y-2">
              <Label htmlFor="feedback-email">Your Email (optional)</Label>
              <Input
                id="feedback-email"
                type="email"
                placeholder="you@example.com"
                value={feedbackEmail}
                onChange={(e) => setFeedbackEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feedback-message">Message</Label>
              <Textarea
                id="feedback-message"
                placeholder="Tell us what's on your mind..."
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                rows={4}
              />
            </div>
            <Button onClick={handleSubmitFeedback} className="w-full gap-2">
              <Send className="h-4 w-4" />
              Send Feedback
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default HelpSupport;

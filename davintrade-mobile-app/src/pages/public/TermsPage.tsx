import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function TermsPage() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4">
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
          <h1 className="text-lg font-black text-foreground">
            Terms of Service
          </h1>
          <p className="text-xs text-muted-foreground">
            Last updated: August 2026
          </p>
        </div>
      </div>

      <Card className="border-border/80 bg-card">
        <CardContent className="space-y-4 p-4 text-xs leading-relaxed text-muted-foreground">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground">
              1. Introduction & SaaS Scope
            </h3>
            <p>
              By accessing DavinTrade SaaS and associated native mobile
              applications, you agree to be bound by these Terms of Service.
              DavinTrade provides technical indicators, automated MT5 fractal
              price breach triggers, and conversational AI analysis for
              informational purposes.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground">
              2. Subscription & Billing
            </h3>
            <p>
              PRO subscriptions are billed on a recurring monthly ($29.00/mo) or
              annual basis ($278.40/yr). Subscriptions automatically renew
              unless cancelled prior to the billing cycle via the in-app Stripe
              Customer Portal.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground">
              3. Service Level Agreement (SLA)
            </h3>
            <p>
              We strive to maintain 99.9% uptime for broker WebSocket feeds and
              push notification delivery. Scheduled maintenance will be
              announced with prior notice on our status page.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground">
              4. Account Security & 2FA
            </h3>
            <p>
              Users are responsible for safeguarding their login credentials and
              configuring Two-Factor Authentication (TOTP) to prevent
              unauthorized access.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

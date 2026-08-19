import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function PrivacyPage() {
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
          <h1 className="text-lg font-black text-foreground">Privacy Policy</h1>
          <p className="text-xs text-muted-foreground">
            GDPR & CCPA Compliance Disclosures
          </p>
        </div>
      </div>

      <Card className="border-border/80 bg-card">
        <CardContent className="space-y-4 p-4 text-xs leading-relaxed text-muted-foreground">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground">
              1. Data We Collect
            </h3>
            <p>
              We collect account registration data (email, name), subscription
              identifiers from Stripe / dLocal, armed price alert thresholds,
              and anonymized diagnostic crash logs to improve MT5 feed
              performance.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground">
              2. AI Analyst Chat Privacy
            </h3>
            <p>
              Queries submitted to our Conversational AI Analyst are processed
              in memory through encrypted API endpoints and are not utilized to
              train public foundation models.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground">
              3. GDPR Data Rights
            </h3>
            <p>
              Users in the European Economic Area (EEA) have the right to
              request a complete JSON data export or initiate permanent account
              and data deletion from the in-app settings menu.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

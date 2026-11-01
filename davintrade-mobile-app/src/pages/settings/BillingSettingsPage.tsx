import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CreditCard,
  Sparkles,
  Zap,
  CheckCircle2,
  Shield,
  Download,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function BillingSettingsPage() {
  const navigate = useNavigate();
  const { user, isPro } = useAuth();

  const INVOICES = [
    {
      id: 'inv_aug_2026',
      date: 'Aug 19, 2026',
      amount: '$29.00',
      status: 'PAID',
      plan: 'PRO Monthly',
    },
    {
      id: 'inv_jul_2026',
      date: 'Jul 19, 2026',
      amount: '$29.00',
      status: 'PAID',
      plan: 'PRO Monthly',
    },
    {
      id: 'inv_jun_2026',
      date: 'Jun 19, 2026',
      amount: '$29.00',
      status: 'PAID',
      plan: 'PRO Monthly',
    },
  ];

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
          <h1 className="text-lg font-black text-foreground">
            Billing & Plans
          </h1>
          <p className="text-xs text-muted-foreground">
            Manage your SaaS tier and payments
          </p>
        </div>
      </div>

      {/* Current Subscription Tier Card */}
      <Card className="border-2 border-amber-500/60 bg-gradient-to-b from-card via-card to-amber-500/5 shadow-lg">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase text-muted-foreground">
                Current Plan
              </div>
              <h2 className="mt-0.5 text-xl font-black text-foreground">
                {isPro ? 'PRO Analyst Subscription' : 'FREE Starter Plan'}
              </h2>
            </div>
            <Badge
              variant={isPro ? 'pro' : 'outline'}
              className="px-2.5 py-1 text-xs"
            >
              {user?.tier}
            </Badge>
          </div>

          <div className="flex items-baseline gap-1 border-t border-border/60 pt-1">
            <span className="text-2xl font-black text-foreground">
              {isPro ? '$29.00' : '$0.00'}
            </span>
            <span className="text-xs text-muted-foreground">/ month</span>
          </div>

          {isPro ? (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-500">
                <CheckCircle2 className="h-4 w-4" />
                <span>Renews automatically on Sept 19, 2026</span>
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  toast.info(
                    'Redirecting to Stripe / dLocal Customer Portal...'
                  )
                }
                className="h-10 w-full text-xs font-bold"
              >
                Manage Stripe Billing Portal
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => navigate('/pricing')}
              className="h-11 w-full bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500"
            >
              <Zap className="mr-2 h-4 w-4 fill-slate-950" />
              <span>Upgrade to PRO ($29/mo)</span>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Payment Method Card */}
      {isPro && (
        <Card className="border-border/80 bg-card">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/60 text-foreground">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-foreground">
                  Mastercard ending in 4242
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Expires 12/28 • Default Payment
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toast.info('Opening payment update form...')}
              className="text-xs font-bold text-amber-500 hover:bg-amber-500/10"
            >
              Edit
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Invoice History */}
      {isPro && (
        <div className="space-y-2">
          <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Billing Invoices
          </h3>
          <Card className="divide-y divide-border/60 border-border/80 bg-card">
            {INVOICES.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between p-3.5 text-xs"
              >
                <div>
                  <div className="font-bold text-foreground">{inv.plan}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {inv.date}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-foreground">
                    {inv.amount}
                  </span>
                  <button
                    onClick={() =>
                      toast.success(`Invoice ${inv.id} PDF downloaded`)
                    }
                    className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Payment Security */}
      <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-muted/30 p-4 text-xs text-muted-foreground">
        <Shield className="h-5 w-5 shrink-0 text-emerald-500" />
        <span>
          Sub-merchant processing secured via Stripe & dLocal multi-currency
          webhooks.
        </span>
      </div>
    </div>
  );
}

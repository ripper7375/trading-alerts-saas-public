import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  DollarSign,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Share2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';

export default function AffiliateLandingPage() {
  const navigate = useNavigate();
  const { isAffiliate } = useAuth();

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="space-y-2 pt-2 text-center">
        <Badge variant="pro" className="px-3 py-0.5 text-[11px]">
          Partner Program
        </Badge>
        <h1 className="text-2xl font-black tracking-tight text-foreground">
          Earn 20% Lifetime <br />
          <span className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
            Recurring Commissions
          </span>
        </h1>
        <p className="mx-auto max-w-xs text-xs text-muted-foreground">
          Partner with DavinTrade and earn recurring rev-share every month from
          referred active traders.
        </p>

        <div className="pt-2">
          <Button
            onClick={() =>
              navigate(isAffiliate ? '/affiliate/dashboard' : '/affiliate/join')
            }
            className="h-12 w-full max-w-xs gap-2 bg-amber-500 font-bold text-slate-950 shadow-lg shadow-amber-500/25 hover:bg-amber-400"
          >
            <Users className="h-4 w-4" />
            <span>
              {isAffiliate
                ? 'Open Partner Dashboard'
                : 'Join Affiliate Program'}
            </span>
            <ArrowRight className="ml-auto h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Program Benefits */}
      <div className="grid grid-cols-1 gap-3">
        <Card className="border-border/80 bg-card">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
              <DollarSign className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-foreground">
                20% Monthly Recurring
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                As long as your referred trader stays subscribed to PRO
                ($29/mo), you earn $5.80/month continuously.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-foreground">
                Reliable Global Payouts
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Disbursements executed automatically on the 1st of every month
                via Wise ($50 minimum threshold).
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-500">
              <Share2 className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-foreground">
                1-Tap Mobile Sharing
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Instant referral link generation with pre-formatted marketing
                banners for Telegram, WhatsApp, and Twitter.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

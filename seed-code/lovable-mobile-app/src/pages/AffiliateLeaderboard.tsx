/**
 * Public Affiliate Leaderboard (mobile reference)
 *
 * Mobile version of the monolith's app/affiliate/leaderboard/page.tsx --
 * public, unauthenticated marketing social proof for the Partner Program
 * (business-intelligence-dashboard manifest §1.6). Reachable without login
 * from the Auth screen. Renders only the privacy-preserving leaderboard
 * (masked partner IDs, no name/email) plus a headline active-partner
 * count -- never the full admin affiliate analytics payload.
 */

import { ArrowLeft, Sparkles, Trophy, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  TopAffiliatesLeaderboard,
  type LeaderboardRow,
} from '@/components/affiliate/TopAffiliatesLeaderboard';

const TOTAL_ACTIVE_AFFILIATES = 214;

const MOCK_LEADERBOARD: LeaderboardRow[] = [
  {
    rank: 1,
    anonymizedPartnerId: 'Partner #AE-7f3a',
    country: 'United Arab Emirates',
    countryIso: 'AE',
    saasTier: 'PRO',
    activeCode: 'TRADE-AE-01',
    subscribersReferred: 58,
    grossSalesUsd: 16820,
    commissionEarnedUsd: 5046.0,
    payoutStatus: 'PAID',
  },
  {
    rank: 2,
    anonymizedPartnerId: 'Partner #IN-2c91',
    country: 'India',
    countryIso: 'IN',
    saasTier: 'PRO',
    activeCode: 'TRADE-IN-14',
    subscribersReferred: 51,
    grossSalesUsd: 14790,
    commissionEarnedUsd: 4437.0,
    payoutStatus: 'PAID',
  },
  {
    rank: 3,
    anonymizedPartnerId: 'Partner #TR-91be',
    country: 'Turkey',
    countryIso: 'TR',
    saasTier: 'PRO',
    activeCode: 'TRADE-TR-08',
    subscribersReferred: 40,
    grossSalesUsd: 11600,
    commissionEarnedUsd: 3480.0,
    payoutStatus: 'APPROVED',
  },
  {
    rank: 4,
    anonymizedPartnerId: 'Partner #US-4d17',
    country: 'United States',
    countryIso: 'US',
    saasTier: 'PRO',
    activeCode: 'TRADE-US-22',
    subscribersReferred: 33,
    grossSalesUsd: 9570,
    commissionEarnedUsd: 2871.0,
    payoutStatus: 'PAID',
  },
  {
    rank: 5,
    anonymizedPartnerId: 'Partner #NG-6a02',
    country: 'Nigeria',
    countryIso: 'NG',
    saasTier: 'FREE',
    activeCode: 'TRADE-NG-05',
    subscribersReferred: 27,
    grossSalesUsd: 7830,
    commissionEarnedUsd: 2349.0,
    payoutStatus: 'PENDING',
  },
];

export default function AffiliateLeaderboard() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/auth')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Top Affiliate Earners</h1>
        </div>
      </div>

      <div className="space-y-6 p-4 pb-10">
        <div className="space-y-3 text-center">
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400">
            DavinTrade Partner Program
          </Badge>
          <div className="flex items-center justify-center gap-2">
            <Trophy className="h-7 w-7 text-amber-500" />
            <h2 className="text-2xl font-extrabold">Top Affiliate Earners</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {TOTAL_ACTIVE_AFFILIATES.toLocaleString()} active partners are
            already earning recurring commission. Here's what our top 5 are
            making right now.
          </p>
          <Button
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 font-bold text-slate-950 hover:from-amber-400 hover:to-amber-500"
            onClick={() => navigate('/auth')}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Become an Affiliate Now
          </Button>
        </div>

        <Card className="border-amber-500/40">
          <CardContent className="space-y-3 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground">
                Trailing 3-month earnings
              </p>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                No names or contact details shown
              </div>
            </div>
            <TopAffiliatesLeaderboard rows={MOCK_LEADERBOARD} />
          </CardContent>
        </Card>

        <div className="space-y-3 text-center">
          <h3 className="text-lg font-bold">Ready to join them?</h3>
          <p className="text-sm text-muted-foreground">
            Get your own referral codes and start earning recurring commission
            today.
          </p>
          <Button
            variant="outline"
            className="w-full border-amber-500/40"
            onClick={() => navigate('/auth')}
          >
            Join Affiliate Program
          </Button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { FileText, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export default function TermsPage() {
  return (
    <div className="animate-fade-in space-y-6 select-none">
      <div className="space-y-6 rounded-2xl border border-slate-800/80 bg-[#090c14] p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-100">
              <FileText className="h-4 w-4 text-amber-400" /> Terms of Service &
              Risk Disclosure Statements
            </h2>
            <p className="text-[11px] text-slate-400">
              Legal agreements, privacy disclosures, and financial trading risk
              notices
            </p>
          </div>
          <Badge className="border-slate-700 bg-slate-800 font-mono text-[9px] text-slate-300">
            LEGAL
          </Badge>
        </div>

        {/* High Risk Trading Warning Box */}
        <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <ShieldAlert className="h-4 w-4" /> Important Risk Disclosure Notice
          </div>
          <p className="leading-relaxed text-slate-300">
            Trading foreign exchange, precious metals (XAUUSD Gold), and futures
            carries a high level of risk and may not be suitable for all
            investors. Quantitative signals and AI chart analysis provided by
            DavinTrade are for informational and analytical purposes only and do
            not constitute financial advice.
          </p>
        </div>

        {/* Terms Articles */}
        <div className="space-y-4 text-xs leading-relaxed text-slate-300">
          <h3 className="text-xs font-bold tracking-wider text-slate-100 uppercase">
            1. Master Subscription Agreement
          </h3>
          <p>
            By accessing DavinTrade SaaS services, you agree to abide by our
            subscription terms. PRO Tier accounts grant access to server-side
            line alerts, quad-RAG AI queries, and multi-timeframe visualization
            overlays. Account credentials may not be shared across unauthorized
            third-party automated scripts.
          </p>

          <Separator className="bg-slate-800" />

          <h3 className="text-xs font-bold tracking-wider text-slate-100 uppercase">
            2. Data Privacy & GDPR Compliance
          </h3>
          <p>
            Your account data, alert rules, and analytical queries are encrypted
            using 256-bit SSL protocols. DavinTrade never sells personal trading
            data to third-party brokers or advertisers.
          </p>

          <Separator className="bg-slate-800" />

          <h3 className="text-xs font-bold tracking-wider text-slate-100 uppercase">
            3. Cancellation & Refund Policy
          </h3>
          <p>
            Subscriptions renew automatically on a monthly or annual basis. You
            may cancel your subscription at any time under Settings &gt;
            Billing. All features remain active through the paid billing period.
          </p>
        </div>
      </div>
    </div>
  );
}

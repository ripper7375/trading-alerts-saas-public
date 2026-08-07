'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, CheckCircle2, Tag, Plus } from 'lucide-react';

export default function CodeTable() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const codes = [
    {
      code: 'PRO20',
      discount: '20% Off First Month',
      redemptions: 34,
      status: 'Active',
      link: 'https://trading-alerts.test/register?ref=PRO20',
    },
    {
      code: 'DAVIN10',
      discount: '$10 Off Annual Plan',
      redemptions: 14,
      status: 'Active',
      link: 'https://trading-alerts.test/register?ref=DAVIN10',
    },
  ];

  const copyLink = (link: string, code: string) => {
    navigator.clipboard.writeText(link);
    setCopiedId(code);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-800 bg-[#090c14] p-4 shadow-xl select-none">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-200 uppercase">
          <Tag className="h-4 w-4 text-amber-400" /> Active Promo Codes &
          Referral Links
        </h3>

        <Button
          size="sm"
          className="h-7 bg-amber-500 text-xs font-bold text-slate-950 hover:bg-amber-400"
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Request Custom Code
        </Button>
      </div>

      <div className="divide-y divide-slate-800/60">
        {codes.map((c) => (
          <div
            key={c.code}
            className="flex flex-col items-start justify-between gap-2 py-3 text-xs sm:flex-row sm:items-center"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-extrabold text-amber-300">
                  {c.code}
                </span>
                <Badge className="border-emerald-500/40 bg-emerald-500/15 font-mono text-[9px] text-emerald-300">
                  {c.discount}
                </Badge>
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-slate-400">
                {c.link}
              </div>
            </div>

            <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
              <span className="font-mono text-[10px] text-slate-400">
                {c.redemptions} Redemptions
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyLink(c.link, c.code)}
                className="border-slate-750 h-7 bg-slate-800 text-[10px] text-slate-200"
              >
                {copiedId === c.code ? (
                  <>
                    <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-400" />{' '}
                    Copied Link
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 h-3 w-3 text-amber-400" /> Copy Link
                  </>
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

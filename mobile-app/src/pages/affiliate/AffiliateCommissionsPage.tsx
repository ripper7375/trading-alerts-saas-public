import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, DollarSign, Filter, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function AffiliateCommissionsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'ALL' | 'PAID' | 'PENDING'>('ALL');

  const COMMISSIONS = [
    {
      id: 'com_1',
      user: 'user_8492***',
      plan: 'PRO Monthly ($29)',
      amount: '+$5.80',
      date: '2026-08-18',
      status: 'PENDING',
    },
    {
      id: 'com_2',
      user: 'user_3910***',
      plan: 'PRO Annual ($278.40)',
      amount: '+$55.68',
      date: '2026-08-16',
      status: 'PENDING',
    },
    {
      id: 'com_3',
      user: 'user_1194***',
      plan: 'PRO Monthly ($29)',
      amount: '+$5.80',
      date: '2026-08-01',
      status: 'PAID',
    },
    {
      id: 'com_4',
      user: 'user_6722***',
      plan: 'PRO Monthly ($29)',
      amount: '+$5.80',
      date: '2026-08-01',
      status: 'PAID',
    },
  ];

  const filtered = COMMISSIONS.filter((c) => {
    if (filter === 'PAID') return c.status === 'PAID';
    if (filter === 'PENDING') return c.status === 'PENDING';
    return true;
  });

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
            Commissions Ledger
          </h1>
          <p className="text-xs text-muted-foreground">
            20% recurring monthly earnings
          </p>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-1 rounded-xl bg-muted p-1 text-xs font-semibold">
        {(['ALL', 'PENDING', 'PAID'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`rounded-lg px-3 py-1 transition-all ${
              filter === tab
                ? 'shadow-xs bg-background text-foreground'
                : 'text-muted-foreground'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Commission Cards */}
      <div className="space-y-2.5">
        {filtered.map((c) => (
          <Card key={c.id} className="border-border/80 bg-card">
            <CardContent className="flex items-center justify-between p-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-xs font-bold text-emerald-500">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground">
                    {c.plan}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Referred: {c.user} • {c.date}
                  </div>
                </div>
              </div>

              <div className="space-y-1 text-right">
                <div className="font-mono text-sm font-black text-emerald-500">
                  {c.amount}
                </div>
                <Badge
                  variant={c.status === 'PAID' ? 'success' : 'warning'}
                  className="px-1.5 py-0 text-[9px] font-bold"
                >
                  {c.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

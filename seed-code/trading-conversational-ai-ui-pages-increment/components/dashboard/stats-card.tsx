'use client';

import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface StatsCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  description?: string;
}

export default function StatsCard({
  title,
  value,
  change,
  changeType = 'positive',
  icon: Icon,
  description,
}: StatsCardProps) {
  return (
    <Card className="border-slate-200 bg-white text-slate-900 shadow-xl select-none dark:border-slate-800/80 dark:bg-[#090c14] dark:text-slate-100">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {title}
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Icon className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-2 flex items-baseline justify-between">
          <h3 className="font-mono text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            {value}
          </h3>
          {change && (
            <Badge
              className={
                changeType === 'positive'
                  ? 'border-emerald-500/40 bg-emerald-500/15 font-mono text-[10px] text-emerald-700 dark:text-emerald-400'
                  : changeType === 'negative'
                    ? 'border-rose-500/40 bg-rose-500/15 font-mono text-[10px] text-rose-700 dark:text-rose-400'
                    : 'border-slate-200 bg-slate-100 font-mono text-[10px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }
            >
              {change}
            </Badge>
          )}
        </div>

        {description && (
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

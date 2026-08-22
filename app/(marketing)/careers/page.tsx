'use client';

import { Mail, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/lib/context/locale-context';

/**
 * Public Careers Page.
 *
 * No ATS/job-board backend exists behind this page -- rather than fabricate
 * specific fake job listings (the F64/6-1b anti-pattern this codebase's own
 * Codebase-1 counterpart documents), this honestly states there are no open
 * roles posted right now and invites contact, restyled in DavinTrade's dark
 * theme/tokens rather than Codebase 1's plain light styling.
 *
 * @module app/careers/page
 */
export default function CareersPage() {
  const { t } = useLocale();

  return (
    <div className="bg-slate-50 text-slate-900 dark:bg-[#050609] dark:text-slate-100">
      <div className="container mx-auto max-w-5xl px-4 py-16 md:px-6">
        <div className="mx-auto max-w-2xl space-y-4 text-center">
          <Badge className="border-amber-500/40 bg-amber-500/15 px-3 py-1 font-mono text-xs text-amber-700 dark:text-amber-400">
            {t('Careers at DavinTrade AI')}
          </Badge>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 md:text-5xl">
            {t('Build the Future of Quantitative Trading Intelligence')}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t(
              'We are a fully remote, global team obsessed with high-speed systems, mathematical elegance, and frictionless UX.'
            )}
          </p>
        </div>

        <Card className="mx-auto mt-10 max-w-xl border-slate-200 bg-white p-8 text-center shadow-md dark:border-slate-800/80 dark:bg-[#090b14]/90 dark:backdrop-blur-xl">
          <CardContent className="space-y-4 p-0">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
              <Users
                className="h-7 w-7 text-amber-600 dark:text-amber-400"
                aria-hidden="true"
              />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              {t('No open positions right now')}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t(
                "We don't have any roles posted at the moment, but we're always interested in hearing from engineers who care about trading systems, AI research, or fintech UX. Openings will be listed here when we have them."
              )}
            </p>
            <a
              href="mailto:careers@davintrade.com"
              className="inline-flex items-center gap-2 font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              careers@davintrade.com
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

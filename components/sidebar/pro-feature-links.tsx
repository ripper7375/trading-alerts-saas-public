'use client';

/**
 * ProFeatureLinks -- the two PRO feature buttons in the workbench sidebar
 * (components/chat-sidebar.tsx), above PNG Download:
 *
 * - "28-Pair Screener"               -> /pro/currency-index
 * - "Currency Index Comparison PRO"  -> /pro/currency-index/compare
 *
 * On the PRO workbench (/terminal) they are plain links. On the FREE
 * workbench (/free) each is covered by a frosted-glass overlay with a padlock
 * and "Upgrade to PRO", and links to /pricing -- the same destination the
 * sidebar's own locked PNG Download already uses. The lock is an affordance
 * only: both PRO pages enforce the tier server-side regardless.
 *
 * The overlay tint uses literal palette colors (white / slate-950 with
 * opacity), NOT `bg-background/NN`: an opacity modifier on this app's
 * CSS-variable color tokens renders fully transparent (found live on the
 * /xaux-vs-usdx page, see that page's manifest §4).
 *
 * @module components/sidebar/pro-feature-links
 */

import { LayoutGrid, LineChart, Lock } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { useLocale } from '@/lib/context/locale-context';
import { CURRENCY_INDEX_COMPARE_PATH } from '@/lib/currency-index-comparison/series';
import { cn } from '@/lib/utils';

export const PRO_FEATURE_LINKS = [
  { href: '/pro/currency-index', label: '28-Pair Screener', icon: LayoutGrid },
  {
    href: CURRENCY_INDEX_COMPARE_PATH,
    label: 'Currency Index Comparison PRO',
    icon: LineChart,
  },
] as const;

interface ProFeatureLinksProps {
  /** true on the FREE workbench: show the glass + padlock upgrade overlay. */
  locked: boolean;
  isCollapsed?: boolean;
}

export function ProFeatureLinks({
  locked,
  isCollapsed = false,
}: ProFeatureLinksProps): React.JSX.Element {
  const { t } = useLocale();

  return (
    <div className="space-y-2">
      {PRO_FEATURE_LINKS.map(({ href, label, icon: Icon }) => {
        const text = t(label);

        if (isCollapsed) {
          return (
            <Button
              key={href}
              asChild
              variant="outline"
              size="sm"
              className="h-9 w-full rounded-xl p-0"
            >
              <Link
                href={locked ? '/pricing' : href}
                title={locked ? `${text} -- ${t('Upgrade to PRO')}` : text}
                aria-label={locked ? `${text} -- ${t('Upgrade to PRO')}` : text}
              >
                {locked ? (
                  <Lock className="h-4 w-4 text-[var(--primary)]" />
                ) : (
                  <Icon className="h-4 w-4 text-[var(--primary)]" />
                )}
              </Link>
            </Button>
          );
        }

        if (!locked) {
          return (
            <Button
              key={href}
              asChild
              variant="outline"
              size="sm"
              className="h-auto min-h-10 w-full justify-center whitespace-normal rounded-xl border-sidebar-border py-2 text-center text-xs font-bold text-sidebar-foreground shadow-sm hover:bg-sidebar-accent"
            >
              <Link href={href}>
                <Icon className="mr-1.5 h-3.5 w-3.5 shrink-0 text-[var(--primary)]" />
                {text}
              </Link>
            </Button>
          );
        }

        return (
          <Link
            key={href}
            href="/pricing"
            aria-label={`${text} -- ${t('Upgrade to PRO')}`}
            className="group relative block overflow-hidden rounded-xl border border-sidebar-border shadow-sm"
          >
            {/* The real label, visible but frosted -- it shows what PRO unlocks. */}
            <span
              aria-hidden="true"
              className="flex min-h-10 select-none items-center justify-center px-2 py-2 text-center text-xs font-bold text-sidebar-foreground blur-[1.5px]"
            >
              <Icon className="mr-1.5 h-3.5 w-3.5 shrink-0" />
              {text}
            </span>
            <span
              aria-hidden="true"
              className={cn(
                'absolute inset-0 flex items-center justify-center gap-1.5 backdrop-blur-[2px] transition-colors',
                'bg-white/45 group-hover:bg-white/60 dark:bg-slate-950/45 dark:group-hover:bg-slate-950/60'
              )}
            >
              <Lock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span className="text-[11px] font-extrabold text-amber-700 dark:text-amber-300">
                {t('Upgrade to PRO')}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

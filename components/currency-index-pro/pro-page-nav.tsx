'use client';

/**
 * ProPageNav -- the "AI Workbench" and "28-Pair Screener" buttons in the
 * headers of the PRO currency index pages (`/pro/currency-index` and
 * `/pro/currency-index/compare`), so each page reaches the workbench and the
 * screener directly instead of through the browser's back button or a text
 * link.
 *
 * Labels and destinations match the rest of the app: "AI Workbench" is the
 * marketing footer's name for `/terminal`, "28-Pair Screener" is the
 * workbench sidebar's (components/sidebar/pro-feature-links.tsx).
 *
 * @module components/currency-index-pro/pro-page-nav
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useLocale } from '@/lib/context/locale-context';
import { cn } from '@/lib/utils';

export const PRO_PAGE_NAV_LINKS = [
  { href: '/terminal', label: 'AI Workbench' },
  { href: '/pro/currency-index', label: '28-Pair Screener' },
] as const;

interface ProPageNavProps {
  className?: string;
}

export function ProPageNav({ className }: ProPageNavProps): React.JSX.Element {
  const { t } = useLocale();
  const pathname = usePathname();

  return (
    <nav
      aria-label={t('PRO pages')}
      className={cn('flex flex-wrap items-center gap-2', className)}
    >
      {PRO_PAGE_NAV_LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? 'page' : undefined}
          className="inline-flex h-8 items-center rounded-md bg-amber-500 px-4 text-sm font-bold text-slate-950 shadow-sm transition-colors hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {t(label)}
        </Link>
      ))}
    </nav>
  );
}

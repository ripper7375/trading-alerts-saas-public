'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const TABS = [
  {
    href: '/admin/dashboards/revenue',
    icon: '📊',
    label: 'Sales & Revenue Velocity',
    badge: 'Metrics #8-#11',
  },
  {
    href: '/admin/dashboards/users',
    icon: '👥',
    label: 'Customer Funnel & 6M Trajectory',
    badge: 'Metrics #1-#7, #12',
  },
  {
    href: '/admin/dashboards/regional',
    icon: '🌍',
    label: 'Regional & Tax Surveillance',
    badge: 'Metrics #13-#19',
  },
  {
    href: '/admin/dashboards/affiliates',
    icon: '🤝',
    label: 'Affiliate Partner Network',
    badge: 'Metrics #20-#25',
  },
  {
    href: '/admin/dashboards/executive',
    icon: '⚡',
    label: 'Executive Command Center',
    badge: 'C-Suite Overview',
  },
] as const;

/**
 * BI dashboard sub-navigation tab bar. Mirrors the visual prototype's tab
 * strip, but as real routes with `usePathname()`-driven active styling
 * instead of client-side `.hidden` class toggling.
 */
export function DashboardTabs(): React.ReactElement {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Business Intelligence dashboards"
      className="flex items-center gap-2 overflow-x-auto border-b border-border bg-card px-6 py-2.5"
    >
      {TABS.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition-all',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            <span
              className={cn(
                'rounded px-1.5 py-0.5 font-mono text-[10px]',
                isActive ? 'bg-black/20' : 'bg-muted'
              )}
            >
              {tab.badge}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

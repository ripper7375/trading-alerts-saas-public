'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Package,
  ArrowLeftRight,
  Landmark,
  ClipboardList,
  Settings2,
  ChevronRight,
} from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import { AdminNav } from '@/components/admin/admin-nav';
import { cn } from '@/lib/utils';
import { useLocale } from '@/lib/context/locale-context';

interface DisbursementTab {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  exact?: boolean;
}

// Mirrors Codebase 1's `app/(dashboard)/admin/disbursement/layout.tsx`
// sidebar nav (Overview / Payable Affiliates / Payment Batches /
// Transactions / Payout Accounts / Audit Logs / Configuration) — that
// section-specific navigation had no Codebase 2 equivalent at all, so
// every disbursement sub-page was previously a dead end reachable only
// by typing a URL directly.
const disbursementTabs: DisbursementTab[] = [
  {
    id: 'overview',
    icon: LayoutDashboard,
    label: 'Overview',
    href: '/admin/disbursement',
    exact: true,
  },
  {
    id: 'affiliates',
    icon: Users,
    label: 'Payable Affiliates',
    href: '/admin/disbursement/affiliates',
  },
  {
    id: 'batches',
    icon: Package,
    label: 'Payment Batches',
    href: '/admin/disbursement/batches',
  },
  {
    id: 'transactions',
    icon: ArrowLeftRight,
    label: 'Transactions',
    href: '/admin/disbursement/transactions',
  },
  {
    id: 'accounts',
    icon: Landmark,
    label: 'Payout Accounts',
    href: '/admin/disbursement/accounts',
  },
  {
    id: 'audit',
    icon: ClipboardList,
    label: 'Audit Logs',
    href: '/admin/disbursement/audit',
  },
  {
    id: 'config',
    icon: Settings2,
    label: 'Configuration',
    href: '/admin/disbursement/config',
  },
];

function isTabActive(tab: DisbursementTab, pathname: string | null): boolean {
  if (!pathname) return false;
  if (tab.exact) return pathname === tab.href;
  if (tab.id === 'accounts') {
    return (
      pathname.startsWith('/admin/disbursement/accounts') ||
      pathname.startsWith('/admin/disbursement/recipients')
    );
  }
  return pathname.startsWith(tab.href);
}

export default function DisbursementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { t } = useLocale();

  const activeTab =
    disbursementTabs.find((tab) => isTabActive(tab, pathname)) ??
    disbursementTabs[0];

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
      <AppHeader
        title={t('Disbursement Admin')}
        subtitle={t(
          'Wise & RiseWorks Payout System — Batches, Payouts, Transactions & Audit Trail'
        )}
      />

      <AdminNav />

      <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 font-mono text-xs text-slate-400">
          <Link
            href="/admin"
            className="transition-colors hover:text-amber-300"
          >
            {t('breadcrumb.admin', 'Admin')}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
          <Link
            href="/admin/disbursement"
            className="transition-colors hover:text-amber-300"
          >
            {t('breadcrumb.disbursement', 'Disbursement')}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
          <span className="font-bold text-amber-400">{t(activeTab.label)}</span>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Desktop Sub-Sidebar */}
          <div className="hidden w-64 shrink-0 lg:block">
            <div className="sticky top-4 space-y-1 rounded-2xl border border-slate-800/80 bg-[#090c14] p-3 shadow-xl">
              <div className="px-3 py-2 text-[10px] font-extrabold tracking-wider text-slate-500 uppercase">
                {t('disbursement.nav_title', 'DISBURSEMENT ADMIN')}
              </div>
              <nav className="grid gap-1">
                {disbursementTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = isTabActive(tab, pathname);

                  return (
                    <Link
                      key={tab.id}
                      href={tab.href}
                      className={cn(
                        'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all',
                        isActive
                          ? 'border border-amber-500/40 bg-amber-500/15 font-bold text-amber-300 shadow-md shadow-amber-500/10'
                          : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100'
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-4 w-4',
                          isActive ? 'text-amber-400' : 'text-slate-400'
                        )}
                      />
                      <span>{t(tab.label)}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="my-1 border-t border-slate-800" />

              {/* Payment Provider status — mirrors Codebase 1's sidebar
                  footer widget showing which disbursement gateway is live. */}
              <div className="rounded-xl bg-slate-800/50 px-3 py-3">
                <p className="mb-1.5 text-[10px] font-bold tracking-wide text-slate-500 uppercase">
                  {t('disbursement.provider_label', 'Payment Provider')}
                </p>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-slate-200">
                    {t('disbursement.provider_active', 'Wise Business — Live')}
                  </span>
                </div>
              </div>

              <Link
                href="/admin"
                className="block px-3 py-2 text-xs text-slate-400 transition-colors hover:text-white"
              >
                {t('disbursement.back_to_admin', '← Back to Admin Panel')}
              </Link>
            </div>
          </div>

          {/* Mobile Horizontal Sub-Navigation */}
          <div className="overflow-x-auto pb-2 lg:hidden">
            <div className="flex gap-2">
              {disbursementTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = isTabActive(tab, pathname);

                return (
                  <Link
                    key={tab.id}
                    href={tab.href}
                    className={cn(
                      'flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors',
                      isActive
                        ? 'bg-amber-500 font-bold text-slate-950 shadow-md'
                        : 'border border-slate-800 bg-[#090c14] text-slate-300 hover:bg-slate-800'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{t(tab.label)}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Page Content */}
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </main>
    </div>
  );
}

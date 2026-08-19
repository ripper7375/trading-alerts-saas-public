'use client';

import AppHeader from '@/components/layout/app-header';
import AlertList from '@/components/alerts/alert-list';
import { usePathname } from 'next/navigation';
import { useLocale } from '@/lib/context/locale-context';

export default function AlertsPage() {
  const pathname = usePathname();
  const { t } = useLocale();
  const isFree = pathname.startsWith('/free');

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-slate-50 select-none dark:bg-[#06070a]">
      <AppHeader
        title={t('Real-Time Alerts Manager')}
        subtitle={t('Configure & Monitor Server-Side Price & Line Triggers')}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
        <AlertList tier={isFree ? 'FREE' : 'PRO'} />
      </main>
    </div>
  );
}

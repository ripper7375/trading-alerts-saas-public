'use client';

import AppHeader from '@/components/layout/app-header';
import AlertForm from '@/components/alerts/alert-form';
import { useLocale } from '@/lib/context/locale-context';

export default function NewAlertPage() {
  const { t } = useLocale();

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#06070a] select-none">
      <AppHeader
        title={t('New Alert Rule Wizard')}
        subtitle={t('Define Technical Channel & Line Breach Triggers')}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
        <AlertForm />
      </main>
    </div>
  );
}

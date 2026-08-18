'use client';

import AppHeader from '@/components/layout/app-header';
import { AdminNav } from '@/components/admin/admin-nav';
import UserTable from '@/components/admin/user-table';
import { useLocale } from '@/lib/context/locale-context';

export default function AdminUsersPage() {
  const { t } = useLocale();

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] select-none">
      <AppHeader
        title={t('User Directory Management')}
        subtitle={t('System Account Oversight, Role Assignment & Account Bans')}
      />
      <AdminNav />
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
        <UserTable />
      </main>
    </div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Ban, UserCheck, ChevronRight } from 'lucide-react';
import { useLocale } from '@/lib/context/locale-context';

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: 'FREE' | 'PRO' | 'ADMIN' | 'AFFILIATE';
  status: 'Active' | 'Suspended';
  joinedAt: string;
  alertsCount: number;
}

export default function UserTable() {
  const { t, formatDate } = useLocale();

  const [users, setUsers] = useState<UserRecord[]>([
    {
      id: '1',
      name: 'PRO Test User',
      email: 'pro-test@trading-alerts.test',
      role: 'PRO',
      status: 'Active',
      joinedAt: '2026-05-12',
      alertsCount: 12,
    },
    {
      id: '2',
      name: 'FREE Test User',
      email: 'free-test@trading-alerts.test',
      role: 'FREE',
      status: 'Active',
      joinedAt: '2026-06-01',
      alertsCount: 0,
    },
    {
      id: '3',
      name: 'Admin Master',
      email: 'admin-test@trading-alerts.test',
      role: 'ADMIN',
      status: 'Active',
      joinedAt: '2026-01-01',
      alertsCount: 45,
    },
    {
      id: '4',
      name: 'Affiliate Partner',
      email: 'affiliate-test@trading-alerts.test',
      role: 'AFFILIATE',
      status: 'Active',
      joinedAt: '2026-04-15',
      alertsCount: 8,
    },
  ]);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRecord['role']>(
    'ALL'
  );

  const toggleUserStatus = (id: string) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? { ...u, status: u.status === 'Active' ? 'Suspended' : 'Active' }
          : u
      )
    );
  };

  const filteredUsers = users.filter(
    (u) =>
      (roleFilter === 'ALL' || u.role === roleFilter) &&
      (u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-xl select-none dark:border-slate-800 dark:bg-[#090c14]">
      <div className="flex flex-col items-start justify-between gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center dark:border-slate-800">
        <h3 className="text-xs font-bold tracking-wider text-slate-900 uppercase dark:text-slate-200">
          {t('User Account Directory')} ({filteredUsers.length})
        </h3>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <div className="relative w-full sm:w-64">
            <Search className="absolute top-2.5 left-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('Search users by email...')}
              className="dark:border-slate-750 h-8 border-slate-200 bg-slate-50 pl-8 text-xs text-slate-900 dark:bg-[#06080e] dark:text-slate-200"
            />
          </div>

          <Select
            value={roleFilter}
            onValueChange={(v) =>
              setRoleFilter(v as 'ALL' | UserRecord['role'])
            }
          >
            <SelectTrigger className="dark:border-slate-750 h-8 w-full border-slate-200 bg-slate-50 text-xs text-slate-900 sm:w-36 dark:bg-[#06080e] dark:text-slate-200">
              <SelectValue placeholder={t('Role')} />
            </SelectTrigger>
            <SelectContent className="border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-[#090b14] dark:text-slate-200">
              <SelectItem value="ALL">{t('All Roles')}</SelectItem>
              <SelectItem value="FREE">{t('FREE')}</SelectItem>
              <SelectItem value="PRO">{t('PRO')}</SelectItem>
              <SelectItem value="ADMIN">{t('ADMIN')}</SelectItem>
              <SelectItem value="AFFILIATE">{t('AFFILIATE')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="divide-y divide-slate-200 dark:divide-slate-800/60">
        {filteredUsers.map((user) => (
          <div
            key={user.id}
            className="flex flex-col items-start justify-between gap-2 py-3 text-xs sm:flex-row sm:items-center"
          >
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Link
                  href={`/admin/users/${user.id}`}
                  className="font-bold text-slate-900 hover:text-amber-600 hover:underline dark:text-slate-100 dark:hover:text-amber-400"
                >
                  {t(
                    user.name,
                    user.name === 'PRO Test User'
                      ? 'Test PRO Trader'
                      : user.name === 'FREE Test User'
                        ? 'Test FREE User'
                        : user.name === 'Admin Master'
                          ? 'Master Administrator'
                          : 'Referral Partner'
                  )}
                </Link>
                <Badge
                  className={
                    user.role === 'PRO'
                      ? 'border-amber-500/40 bg-amber-500/15 font-mono text-[9px] text-amber-700 dark:text-amber-300'
                      : user.role === 'ADMIN'
                        ? 'border-rose-500/40 bg-rose-500/15 font-mono text-[9px] text-rose-700 dark:text-rose-300'
                        : user.role === 'AFFILIATE'
                          ? 'border-emerald-500/40 bg-emerald-500/15 font-mono text-[9px] text-emerald-700 dark:text-emerald-300'
                          : 'border-slate-300 bg-slate-100 font-mono text-[9px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                  }
                >
                  {t(user.role)}
                </Badge>
              </div>
              <Link
                href={`/admin/users/${user.id}`}
                className="font-mono text-[11px] text-slate-600 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400"
              >
                {user.email} • {t('Joined')} {formatDate(user.joinedAt)}
              </Link>
            </div>

            <div className="flex w-full items-center justify-between gap-4 text-right sm:w-auto sm:justify-end">
              <div className="text-right">
                <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                  {user.alertsCount} {t('Alerts Configured')}
                </span>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => toggleUserStatus(user.id)}
                className={
                  user.status === 'Active'
                    ? 'h-7 border-rose-500/40 bg-rose-500/10 text-[10px] text-rose-700 hover:bg-rose-500/20 dark:text-rose-300'
                    : 'h-7 border-emerald-500/40 bg-emerald-500/10 text-[10px] text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300'
                }
              >
                {user.status === 'Active' ? (
                  <Ban className="mr-1 h-3 w-3" />
                ) : (
                  <UserCheck className="mr-1 h-3 w-3" />
                )}
                {user.status === 'Active' ? t('Suspend') : t('Reactivate')}
              </Button>

              <Link href={`/admin/users/${user.id}`}>
                <Button
                  size="sm"
                  variant="outline"
                  className="dark:border-slate-750 h-7 border-slate-300 bg-slate-50 text-[10px] text-slate-800 hover:bg-slate-100 dark:bg-[#06080e] dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {t('Inspect')}
                  <ChevronRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

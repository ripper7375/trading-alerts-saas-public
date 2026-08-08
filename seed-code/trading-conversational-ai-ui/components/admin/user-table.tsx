'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Ban, UserCheck } from 'lucide-react';
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
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4 overflow-hidden rounded-2xl border border-slate-800 bg-[#090c14] p-4 shadow-xl select-none">
      <div className="flex flex-col items-start justify-between gap-3 border-b border-slate-800 pb-3 sm:flex-row sm:items-center">
        <h3 className="text-xs font-bold tracking-wider text-slate-200 uppercase">
          {t('USER ACCOUNT DIRECTORY (4)')} ({users.length})
        </h3>

        <div className="relative w-full sm:w-64">
          <Search className="absolute top-2.5 left-2.5 h-3.5 w-3.5 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('Search users by email...')}
            className="border-slate-750 h-8 bg-[#06080e] pl-8 text-xs text-slate-200"
          />
        </div>
      </div>

      <div className="divide-y divide-slate-800/60">
        {filteredUsers.map((user) => (
          <div
            key={user.id}
            className="flex flex-col items-start justify-between gap-2 py-3 text-xs sm:flex-row sm:items-center"
          >
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-100">{user.name}</span>
                <Badge
                  className={
                    user.role === 'PRO'
                      ? 'border-amber-500/40 bg-amber-500/15 font-mono text-[9px] text-amber-300'
                      : user.role === 'ADMIN'
                        ? 'border-rose-500/40 bg-rose-500/15 font-mono text-[9px] text-rose-300'
                        : user.role === 'AFFILIATE'
                          ? 'border-emerald-500/40 bg-emerald-500/15 font-mono text-[9px] text-emerald-300'
                          : 'border-slate-700 bg-slate-800 font-mono text-[9px] text-slate-400'
                  }
                >
                  {user.role}
                </Badge>
              </div>
              <div className="font-mono text-[11px] text-slate-400">
                {user.email} • {t('Joined')} {formatDate(user.joinedAt)}
              </div>
            </div>

            <div className="flex w-full items-center justify-between gap-4 text-right sm:w-auto sm:justify-end">
              <div className="text-right">
                <span className="font-mono text-[10px] text-slate-400">
                  {user.alertsCount} {t('Alerts Configured')}
                </span>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => toggleUserStatus(user.id)}
                className={
                  user.status === 'Active'
                    ? 'h-7 border-rose-500/40 bg-rose-500/10 text-[10px] text-rose-300 hover:bg-rose-500/20'
                    : 'h-7 border-emerald-500/40 bg-emerald-500/10 text-[10px] text-emerald-300 hover:bg-emerald-500/20'
                }
              >
                {user.status === 'Active' ? (
                  <Ban className="mr-1 h-3 w-3" />
                ) : (
                  <UserCheck className="mr-1 h-3 w-3" />
                )}
                {user.status === 'Active'
                  ? t('Suspend')
                  : t('Reactivate', 'ยกเลิกระงับ')}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

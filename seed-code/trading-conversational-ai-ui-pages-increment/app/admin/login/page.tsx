'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ShieldAlert, Lock, Mail, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocale } from '@/lib/context/locale-context';

export default function AdminLoginPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [email, setEmail] = useState('admin-test@trading-alerts.test');
  const [password, setPassword] = useState('AdminPassword123!');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      router.push('/admin');
    }, 800);
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#050609] p-4 select-none">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-rose-500/30 bg-[#090c14] p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/15 text-rose-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="bg-gradient-to-r from-rose-400 via-rose-200 to-amber-400 bg-clip-text text-xl font-extrabold tracking-tight text-transparent">
            {t('DavinTrade Admin Portal')}
          </h2>
          <p className="text-xs text-slate-400">
            {t('Restricted System Control & Disbursement Oversight')}
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-300">
              {t('Admin Email')}
            </Label>
            <div className="relative">
              <Mail className="absolute top-3 left-3 h-4 w-4 text-slate-500" />
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border-slate-750 bg-[#05070d] pl-10 text-xs text-slate-100"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-300">
              {t('Master Passcode')}
            </Label>
            <div className="relative">
              <Lock className="absolute top-3 left-3 h-4 w-4 text-slate-500" />
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-slate-750 bg-[#05070d] pl-10 text-xs text-slate-100"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="h-10 w-full bg-gradient-to-r from-rose-600 to-amber-600 text-xs font-extrabold text-white shadow-md shadow-rose-500/20 hover:from-rose-500 hover:to-amber-500"
          >
            {isLoading
              ? t('Authenticating Admin...')
              : t('Authenticate Master Admin')}
            {!isLoading && <ArrowRight className="ml-1.5 h-4 w-4" />}
          </Button>
        </form>

        <div className="border-t border-slate-800 pt-2 text-center text-xs text-slate-500">
          {t('Standard User?')}{' '}
          <Link
            href="/login"
            className="font-semibold text-slate-300 hover:underline"
          >
            {t('Go to User Login')}
          </Link>
        </div>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Compass, Home, LayoutDashboard, ArrowLeft } from 'lucide-react';
import { useLocale } from '@/lib/context/locale-context';

export default function NotFound() {
  const { t } = useLocale();
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 text-center select-none dark:bg-[#07090e]">
      <div className="max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl dark:border-slate-800 dark:bg-[#0c0f18]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/30 dark:text-amber-400">
          <Compass className="animate-spin-slow h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h1 className="font-mono text-3xl font-black tracking-tight text-amber-600 dark:text-amber-400">
            404
          </h1>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
            {t('Page Not Found')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('This page could not be found.')}
          </p>
        </div>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            onClick={() => router.back()}
            variant="outline"
            className="h-9 w-full border-slate-300 bg-transparent text-xs font-bold text-slate-700 hover:bg-slate-100 sm:w-auto dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            {t('Go Back')}
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-9 w-full border-slate-300 bg-transparent text-xs font-bold text-slate-700 hover:bg-slate-100 sm:w-auto dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Link href="/dashboard">
              <LayoutDashboard className="mr-1.5 h-4 w-4" />
              {t('Dashboard')}
            </Link>
          </Button>
          <Button
            asChild
            className="h-9 w-full bg-amber-500 text-xs font-extrabold text-slate-950 hover:bg-amber-400 sm:w-auto"
          >
            <Link href="/">
              <Home className="mr-1.5 h-4 w-4" />
              {t('Return to Home')}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

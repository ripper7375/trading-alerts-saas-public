'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Compass, Home } from 'lucide-react';
import { useLocale } from '@/lib/context/locale-context';

export default function NotFound() {
  const { t } = useLocale();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#07090e] p-4 text-center select-none">
      <div className="max-w-md space-y-4 rounded-2xl border border-slate-800 bg-[#0c0f18] p-8 shadow-2xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/30">
          <Compass className="animate-spin-slow h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h1 className="font-mono text-3xl font-black tracking-tight text-amber-400">
            404
          </h1>
          <h2 className="text-base font-extrabold text-slate-100">
            {t('Page Not Found')}
          </h2>
          <p className="text-xs text-slate-400">
            {t('This page could not be found.')}
          </p>
        </div>
        <Button
          asChild
          className="mt-2 h-9 w-full bg-amber-500 text-xs font-extrabold text-slate-950 hover:bg-amber-400"
        >
          <Link href="/">
            <Home className="mr-1.5 h-4 w-4" />
            {t('Return to Home')}
          </Link>
        </Button>
      </div>
    </div>
  );
}

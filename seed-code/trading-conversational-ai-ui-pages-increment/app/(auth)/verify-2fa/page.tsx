'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ArrowLeft, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocale } from '@/lib/context/locale-context';

export default function Verify2faPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [code, setCode] = useState('');
  const [useBackup, setUseBackup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      router.push('/dashboard');
    }, 800);
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#06070a] p-4 select-none">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-800/80 bg-[#0b0e17] p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-400">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 bg-clip-text text-xl font-extrabold tracking-tight text-transparent">
            {t('Two-Factor Authentication')}
          </h2>
          <p className="text-xs text-slate-400">
            {useBackup
              ? t('Enter one of your 8-digit emergency backup codes')
              : t(
                  'Enter the 6-digit verification code from your authenticator app'
                )}
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-1.5 text-center">
            <Label className="text-xs font-semibold text-slate-300">
              {useBackup ? t('Backup Code') : t('6-Digit Security Code')}
            </Label>
            <Input
              type="text"
              required
              maxLength={useBackup ? 9 : 6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={useBackup ? '1234-5678' : '123456'}
              className="border-slate-750 h-12 bg-[#06080e] text-center font-mono text-lg tracking-widest text-amber-300"
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading || !code.trim()}
            className="h-10 w-full bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500"
          >
            {isLoading ? t('Verifying...') : t('Verify & Continue')}
          </Button>
        </form>

        <div className="flex items-center justify-between border-t border-slate-800/80 pt-2 text-xs">
          <button
            type="button"
            onClick={() => setUseBackup(!useBackup)}
            className="flex items-center gap-1 font-semibold text-amber-400 hover:underline"
          >
            <KeyRound className="h-3.5 w-3.5" />
            {useBackup ? t('Use Authenticator App') : t('Use Backup Code')}
          </button>

          <Link
            href="/login"
            className="flex items-center gap-1 text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {t('Back to Login')}
          </Link>
        </div>
      </div>
    </div>
  );
}

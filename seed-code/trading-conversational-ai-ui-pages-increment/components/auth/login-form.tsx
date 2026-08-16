'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/lib/context/locale-context';

export default function LoginForm() {
  const router = useRouter();
  const { t } = useLocale();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Simulate login validation & redirect
    setTimeout(() => {
      setIsLoading(false);
      if (email.includes('admin')) {
        router.push('/admin');
      } else if (email.includes('free')) {
        router.push('/free');
      } else {
        router.push('/dashboard');
      }
    }, 800);
  };

  const handleQuickPreset = (presetEmail: string, role: string) => {
    setEmail(presetEmail);
    setPassword('TestPassword123!');
  };

  return (
    <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-800/80 bg-[#0b0e17] p-8 shadow-2xl backdrop-blur-xl">
      {/* Brand Header */}
      <div className="flex flex-col items-center space-y-2 text-center">
        <div className="relative h-12 w-12 overflow-hidden rounded-xl shadow-lg ring-2 shadow-amber-500/10 ring-amber-500/40">
          <Image
            src="/DavinTrade_Logo.jpg"
            alt="DavinTrade Logo"
            fill
            className="object-cover"
            priority
          />
        </div>
        <h2 className="bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 bg-clip-text text-xl font-extrabold tracking-tight text-transparent">
          {t('Sign in to DavinTrade')}
        </h2>
        <p className="text-xs text-slate-400">
          {t(
            'Welcome back! Enter your credentials to access your trading workspace.'
          )}
        </p>
      </div>

      {/* Preset Test Credentials Helper */}
      <div className="space-y-2 rounded-xl border border-slate-800 bg-[#070910] p-3 text-xs">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
          <span>⚡ {t('Quick Test Credentials:')}</span>
          <Badge className="border-amber-500/30 bg-amber-500/10 text-[9px] text-amber-400">
            {t('Click to Autofill')}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
          <button
            type="button"
            onClick={() =>
              handleQuickPreset('pro-test@trading-alerts.test', 'PRO')
            }
            className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 p-1.5 text-amber-300 transition-colors hover:bg-amber-500/15"
          >
            <span>{t('PRO User')}</span>
            <CheckCircle2 className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() =>
              handleQuickPreset('free-test@trading-alerts.test', 'FREE')
            }
            className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/60 p-1.5 text-slate-300 transition-colors hover:bg-slate-800"
          >
            <span>{t('FREE User')}</span>
            <CheckCircle2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Form Fields */}
      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-300">
            {t('Email Address')}
          </Label>
          <div className="relative">
            <Mail className="absolute top-3 left-3 h-4 w-4 text-slate-500" />
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="border-slate-750 bg-[#06080e] pl-10 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-500/60 focus:ring-amber-500/20"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-slate-300">
              {t('Password')}
            </Label>
            <Link
              href="/forgot-password"
              className="text-[11px] font-semibold text-amber-400 hover:underline"
            >
              {t('Forgot password?')}
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute top-3 left-3 h-4 w-4 text-slate-500" />
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="border-slate-750 bg-[#06080e] pl-10 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-500/60 focus:ring-amber-500/20"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 text-xs">
          <label className="flex cursor-pointer items-center gap-2 text-slate-400">
            <Checkbox
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(!!checked)}
            />
            <span>{t('Remember me')}</span>
          </label>
          <Link
            href="/verify-2fa"
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />{' '}
            {t('Two-Factor Authentication')}
          </Link>
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="h-10 w-full bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500"
        >
          {isLoading ? t('Authenticating...') : t('Sign In')}
          {!isLoading && <ArrowRight className="ml-1.5 h-4 w-4" />}
        </Button>
      </form>

      {/* Footer Register Link */}
      <div className="border-t border-slate-800/80 pt-2 text-center text-xs text-slate-400">
        {t("Don't have an account?")}{' '}
        <Link
          href="/register"
          className="font-bold text-amber-400 hover:underline"
        >
          {t('Sign up for FREE')}
        </Link>
      </div>
    </div>
  );
}

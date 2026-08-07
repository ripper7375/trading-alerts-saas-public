'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Lock, Mail, User, ArrowRight, Sparkles, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tier, setTier] = useState<'PRO' | 'FREE'>('PRO');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      if (tier === 'PRO') {
        router.push('/checkout');
      } else {
        router.push('/free');
      }
    }, 800);
  };

  return (
    <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-800/80 bg-[#0b0e17] p-8 shadow-2xl backdrop-blur-xl">
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
          Create Your DavinTrade Account
        </h2>
        <p className="text-xs text-slate-400">
          Join thousands of traders using AI quantitative analysis & MTF alerts
        </p>
      </div>

      {/* Tier Selection Radio Toggle */}
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-[#06080e] p-1">
        <button
          type="button"
          onClick={() => setTier('PRO')}
          className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition-all ${
            tier === 'PRO'
              ? 'border-amber-500/60 bg-amber-500/15 text-amber-300 shadow-sm'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="flex w-full items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" /> PRO Tier
            </span>
            {tier === 'PRO' && <Check className="h-3.5 w-3.5 text-amber-400" />}
          </div>
          <span className="mt-1 text-[10px] text-slate-400">
            Full AI Models + 100 Alerts + MTF Overlay
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTier('FREE')}
          className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition-all ${
            tier === 'FREE'
              ? 'border-slate-600 bg-slate-800 text-slate-200 shadow-sm'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="flex w-full items-center justify-between text-xs font-bold">
            <span>FREE Tier</span>
            {tier === 'FREE' && (
              <Check className="h-3.5 w-3.5 text-slate-300" />
            )}
          </div>
          <span className="mt-1 text-[10px] text-slate-400">
            Basic Gemini Flash + Read-Only History
          </span>
        </button>
      </div>

      <form onSubmit={handleRegister} className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-300">
            Full Name
          </Label>
          <div className="relative">
            <User className="absolute top-3 left-3 h-4 w-4 text-slate-500" />
            <Input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Trader"
              className="border-slate-750 bg-[#06080e] pl-10 text-xs text-slate-100 placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-300">
            Email Address
          </Label>
          <div className="relative">
            <Mail className="absolute top-3 left-3 h-4 w-4 text-slate-500" />
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="border-slate-750 bg-[#06080e] pl-10 text-xs text-slate-100 placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-300">
            Password
          </Label>
          <div className="relative">
            <Lock className="absolute top-3 left-3 h-4 w-4 text-slate-500" />
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="border-slate-750 bg-[#06080e] pl-10 text-xs text-slate-100 placeholder:text-slate-500"
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="h-10 w-full bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500"
        >
          {isLoading
            ? 'Creating Account...'
            : tier === 'PRO'
              ? 'Proceed to Checkout ($49/mo)'
              : 'Get Started Free'}
          {!isLoading && <ArrowRight className="ml-1.5 h-4 w-4" />}
        </Button>
      </form>

      <div className="border-t border-slate-800/80 pt-2 text-center text-xs text-slate-400">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-bold text-amber-400 hover:underline"
        >
          Sign In
        </Link>
      </div>
    </div>
  );
}

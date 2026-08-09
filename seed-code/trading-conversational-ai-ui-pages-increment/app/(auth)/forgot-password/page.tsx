'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocale } from '@/lib/context/locale-context';

export default function ForgotPasswordPage() {
  const { t } = useLocale();
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#06070a] p-4 select-none">
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
            {t('Reset Password', 'รีเซ็ตรหัสผ่าน')}
          </h2>
          <p className="text-xs text-slate-400">
            {t(
              'Enter your account email to receive reset instructions',
              'ป้อนอีเมลบัญชีของคุณเพื่อรับคำแนะนำในการรีเซ็ต'
            )}
          </p>
        </div>

        {isSubmitted ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-100">
              {t('Check Your Email', 'ตรวจสอบอีเมลของคุณ')}
            </h3>
            <p className="text-xs text-slate-400">
              {t(
                "We've sent a password reset link to",
                'เราได้ส่งลิงก์รีเซ็ตรหัสผ่านไปยัง'
              )}{' '}
              <strong className="text-slate-200">{email}</strong>.{' '}
              {t(
                'Please follow the instructions in the email.',
                'โปรดปฏิบัติตามคำแนะนำในอีเมล'
              )}
            </p>
            <Button
              variant="outline"
              asChild
              className="border-slate-750 h-9 w-full bg-slate-800 text-xs text-slate-200"
            >
              <Link href="/login">
                {t('Return to Sign In', 'กลับสู่หน้าเข้าสู่ระบบ')}
              </Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">
                {t('Email Address', 'ที่อยู่อีเมล')}
              </Label>
              <div className="relative">
                <Mail className="absolute top-3 left-3 h-4 w-4 text-slate-500" />
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="border-slate-750 bg-[#06080e] pl-10 text-xs text-slate-100"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="h-10 w-full bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500"
            >
              {t('Send Reset Instructions', 'ส่งคำแนะนำการรีเซ็ต')}
            </Button>
          </form>
        )}

        <div className="border-t border-slate-800/80 pt-2 text-center">
          <Link
            href="/login"
            className="inline-flex items-center text-xs font-semibold text-amber-400 hover:underline"
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />{' '}
            {t('Back to Sign In', 'กลับสู่หน้าเข้าสู่ระบบ')}
          </Link>
        </div>
      </div>
    </div>
  );
}

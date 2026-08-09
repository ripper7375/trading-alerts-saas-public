'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Share2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocale } from '@/lib/context/locale-context';

export default function AffiliateRegisterPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      router.push('/affiliate/dashboard');
    }, 800);
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#06070a] p-4 select-none">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-amber-500/30 bg-[#0b0e17] p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-400">
            <Share2 className="h-6 w-6" />
          </div>
          <h2 className="bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 bg-clip-text text-xl font-extrabold tracking-tight text-transparent">
            {t('Join Partner Program', 'เข้าร่วมโปรแกรมพันธมิตร')}
          </h2>
          <p className="text-xs text-slate-400">
            {t(
              'Earn 30% monthly recurring commission on every trader you refer',
              'รับค่าคอมมิชชัน 30% ต่อเดือนอย่างต่อเนื่องจากเทรดเดอร์ทุกคนที่คุณแนะนำ'
            )}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-300">
              {t('Partner Name / Channel', 'ชื่อพันธมิตร / ช่องทาง')}
            </Label>
            <Input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t(
                'e.g. Gold Traders Community',
                'เช่น ชุมชนเทรดเดอร์ทองคำ'
              )}
              className="border-slate-750 bg-[#06080e] text-xs text-slate-100"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-300">
              {t('Business Email', 'อีเมลธุรกิจ')}
            </Label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="partner@example.com"
              className="border-slate-750 bg-[#06080e] text-xs text-slate-100"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-300">
              {t(
                'Channel Link / Website (Optional)',
                'ลิงก์ช่องทาง / เว็บไซต์ (ไม่บังคับ)'
              )}
            </Label>
            <Input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://t.me/yourchannel"
              className="border-slate-750 bg-[#06080e] text-xs text-slate-100"
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="h-10 w-full bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500"
          >
            {isLoading
              ? t('Creating Partner Account...', 'กำลังสร้างบัญชีพันธมิตร...')
              : t('Apply for Partner Portal', 'สมัครเข้าใช้พอร์ตัลพันธมิตร')}
            {!isLoading && <ArrowRight className="ml-1.5 h-4 w-4" />}
          </Button>
        </form>

        <div className="border-t border-slate-800/80 pt-2 text-center text-xs text-slate-400">
          {t('Already registered?', 'ลงทะเบียนแล้วใช่หรือไม่?')}{' '}
          <Link
            href="/affiliate/dashboard"
            className="font-bold text-amber-400 hover:underline"
          >
            {t('Partner Dashboard', 'แดชบอร์ดพันธมิตร')}
          </Link>
        </div>
      </div>
    </div>
  );
}

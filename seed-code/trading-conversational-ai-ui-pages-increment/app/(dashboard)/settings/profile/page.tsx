'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Save } from 'lucide-react';
import { useLocale } from '@/lib/context/locale-context';

export default function ProfileSettingsPage() {
  const { t } = useLocale();
  const [name, setName] = useState('Trader User');
  const [email, setEmail] = useState('user@davin-trade.com');
  const [username, setUsername] = useState('trader_user');
  const [bio, setBio] = useState('');
  const [company, setCompany] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [experience, setExperience] = useState('Intermediate Trader');
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="mx-auto w-full max-w-3xl select-none">
      <div className="space-y-6 rounded-2xl border border-slate-800/80 bg-[#090c14] p-6 shadow-xl">
        <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
          <Avatar className="h-16 w-16 ring-2 ring-amber-500/40">
            <AvatarImage src="/placeholder-user.jpg" />
            <AvatarFallback className="bg-slate-800 text-lg text-slate-200">
              TU
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-base font-extrabold text-slate-100">
              {t(name, 'Trader User')}
            </h2>
            <p className="text-xs text-slate-400">{email}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 h-6 border-slate-700 bg-slate-800 text-[10px]"
            >
              {t('Change Avatar')}
            </Button>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-300">
              {t('Display Name')}
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-slate-750 bg-[#06080e] text-xs text-slate-100"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-300">
              {t('Primary Email')}
            </Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-slate-750 bg-[#06080e] text-xs text-slate-100"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-300">
              {t('Username')}
            </Label>
            <div className="relative">
              <span className="absolute top-1/2 left-3 -translate-y-1/2 text-xs text-slate-500">
                @
              </span>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                className="border-slate-750 bg-[#06080e] pl-6 text-xs text-slate-100"
                placeholder="username"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-slate-300">
                {t('Bio')}
              </Label>
              <span className="text-[10px] text-slate-500">
                {bio.length}/500
              </span>
            </div>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder={t('Tell us about your trading style...')}
              className="border-slate-750 flex w-full rounded-md border bg-[#06080e] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-300">
              {t('Company/Organization')}
            </Label>
            <Input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder={t('Optional')}
              className="border-slate-750 bg-[#06080e] text-xs text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">
                {t('Timezone')}
              </Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger className="border-slate-750 bg-[#06080e] text-xs">
                  <SelectValue placeholder={t('Select timezone')} />
                </SelectTrigger>
                <SelectContent className="border-slate-750 bg-[#0f1420]">
                  <SelectItem value="UTC">
                    {t('UTC (Coordinated Universal Time)')}
                  </SelectItem>
                  <SelectItem value="EST">
                    {t('EST (New York Time)')}
                  </SelectItem>
                  <SelectItem value="GMT">{t('GMT (London Time)')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">
                {t('Trading Experience')}
              </Label>
              <Select value={experience} onValueChange={setExperience}>
                <SelectTrigger className="border-slate-750 bg-[#06080e] text-xs">
                  <SelectValue placeholder={t('Select level')} />
                </SelectTrigger>
                <SelectContent className="border-slate-750 bg-[#0f1420]">
                  <SelectItem value="Beginner">
                    {t('Beginner Trader')}
                  </SelectItem>
                  <SelectItem value="Intermediate Trader">
                    {t('Intermediate Trader')}
                  </SelectItem>
                  <SelectItem value="Quantitative Professional">
                    {t('Quantitative Professional')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              className="h-9 bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 hover:from-amber-400 hover:to-amber-500"
            >
              <Save className="mr-1.5 h-4 w-4" />
              {isSaved ? t('Changes Saved!') : t('Save Profile Changes')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

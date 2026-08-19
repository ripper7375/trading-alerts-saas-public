'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Landmark, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useLocale } from '@/lib/context/locale-context';

const CURRENCY_OPTIONS = [
  'USD',
  'THB',
  'GBP',
  'EUR',
  'AUD',
  'CAD',
  'SGD',
  'MYR',
  'NZD',
];

export default function WiseRecipientForm() {
  const { t } = useLocale();
  const [accountHolderName, setAccountHolderName] = useState('');
  const [targetCurrency, setTargetCurrency] = useState('USD');
  const [recipientCountry, setRecipientCountry] = useState('');
  const [bankAccount, setBankAccount] = useState('GB89 WEST 1234 5678 9012 34');
  const [wiseEmail, setWiseEmail] = useState('affiliate@davin-trade.com');
  const [isSaved, setIsSaved] = useState(false);
  const [nameError, setNameError] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountHolderName.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="mx-auto max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl select-none dark:border-slate-800 dark:bg-[#090c14]">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
            {t('Payout Account Configuration')}
          </h2>
        </div>
        <Badge className="border-emerald-500/40 bg-emerald-500/15 font-mono text-[9px] text-emerald-700 dark:text-emerald-300">
          {t('AUTO-DISBURSEMENT')}
        </Badge>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {t('Disbursement Provider')}
          </Label>
          <Input
            type="text"
            value={t('Wise Business (Direct Bank Transfer)')}
            disabled
            className="dark:border-slate-750 border-slate-200 bg-slate-100 text-xs text-slate-500 dark:bg-[#0a0d15] dark:text-slate-500"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {t('Account Holder Name')}
            <span className="text-red-500 dark:text-red-400"> *</span>
          </Label>
          <Input
            type="text"
            value={accountHolderName}
            onChange={(e) => {
              setAccountHolderName(e.target.value);
              if (nameError) setNameError(false);
            }}
            className={`dark:border-slate-750 border-slate-200 bg-slate-50 text-xs text-slate-900 dark:bg-[#06080e] dark:text-slate-100 ${
              nameError ? 'border-red-500' : ''
            }`}
          />
          {nameError && (
            <p className="text-[11px] text-red-500 dark:text-red-400">
              {t('Account holder name is required')}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('Payout Currency')}
            </Label>
            <Select
              value={targetCurrency}
              onValueChange={(val: string) => setTargetCurrency(val)}
            >
              <SelectTrigger className="dark:border-slate-750 border-slate-200 bg-slate-50 text-xs text-slate-900 dark:bg-[#06080e] dark:text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="dark:border-slate-750 border-slate-200 bg-white text-xs text-slate-900 dark:bg-[#0f1420] dark:text-slate-100">
                {CURRENCY_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('Recipient Country')}
            </Label>
            <Input
              type="text"
              value={recipientCountry}
              onChange={(e) =>
                setRecipientCountry(e.target.value.toUpperCase())
              }
              maxLength={2}
              placeholder="US"
              className="dark:border-slate-750 border-slate-200 bg-slate-50 text-xs text-slate-900 uppercase dark:bg-[#06080e] dark:text-slate-100"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {t('Wise Account Email')}
          </Label>
          <Input
            type="email"
            value={wiseEmail}
            onChange={(e) => setWiseEmail(e.target.value)}
            className="dark:border-slate-750 border-slate-200 bg-slate-50 text-xs text-slate-900 dark:bg-[#06080e] dark:text-slate-100"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {t('Bank IBAN / Account Number')}
          </Label>
          <Input
            type="text"
            value={bankAccount}
            onChange={(e) => setBankAccount(e.target.value)}
            className="dark:border-slate-750 border-slate-200 bg-slate-50 font-mono text-xs text-slate-900 dark:bg-[#06080e] dark:text-slate-100"
          />
        </div>

        <Button
          type="submit"
          className="h-9 w-full bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 hover:from-amber-400 hover:to-amber-500"
        >
          {isSaved ? t('Payout Details Updated!') : t('Save Payout Details')}
        </Button>
      </form>
    </div>
  );
}

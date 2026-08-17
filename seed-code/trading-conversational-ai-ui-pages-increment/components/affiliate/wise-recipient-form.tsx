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
  const [provider, setProvider] = useState<'wise' | 'rise'>('wise');
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
    <div className="mx-auto max-w-xl space-y-4 rounded-2xl border border-slate-800 bg-[#090c14] p-6 shadow-xl select-none">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-amber-400" />
          <h2 className="text-sm font-extrabold text-slate-100">
            {t('Payout Account Configuration')}
          </h2>
        </div>
        <Badge className="border-emerald-500/40 bg-emerald-500/15 font-mono text-[9px] text-emerald-300">
          {t('AUTO-DISBURSEMENT')}
        </Badge>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-300">
            {t('Disbursement Provider')}
          </Label>
          <Select
            value={provider}
            onValueChange={(val: any) => setProvider(val)}
          >
            <SelectTrigger className="border-slate-750 bg-[#06080e] text-xs">
              <SelectValue placeholder={t('Select provider')} />
            </SelectTrigger>
            <SelectContent className="border-slate-750 bg-[#0f1420] text-xs">
              <SelectItem value="wise">
                {t('Wise Business (Direct Bank Transfer)')}
              </SelectItem>
              <SelectItem value="rise">
                {t('RiseWorks (Crypto / SIWE Wallet Payout)')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-300">
            {t('Account Holder Name')}
            <span className="text-red-400"> *</span>
          </Label>
          <Input
            type="text"
            value={accountHolderName}
            onChange={(e) => {
              setAccountHolderName(e.target.value);
              if (nameError) setNameError(false);
            }}
            className={`border-slate-750 bg-[#06080e] text-xs text-slate-100 ${
              nameError ? 'border-red-500' : ''
            }`}
          />
          {nameError && (
            <p className="text-[11px] text-red-400">
              {t('Account holder name is required')}
            </p>
          )}
        </div>

        {provider === 'wise' ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300">
                  {t('Payout Currency')}
                </Label>
                <Select
                  value={targetCurrency}
                  onValueChange={(val: string) => setTargetCurrency(val)}
                >
                  <SelectTrigger className="border-slate-750 bg-[#06080e] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-slate-750 bg-[#0f1420] text-xs">
                    {CURRENCY_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300">
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
                  className="border-slate-750 bg-[#06080e] text-xs text-slate-100 uppercase"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">
                {t('Wise Account Email')}
              </Label>
              <Input
                type="email"
                value={wiseEmail}
                onChange={(e) => setWiseEmail(e.target.value)}
                className="border-slate-750 bg-[#06080e] text-xs text-slate-100"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">
                {t('Bank IBAN / Account Number')}
              </Label>
              <Input
                type="text"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                className="border-slate-750 bg-[#06080e] font-mono text-xs text-slate-100"
              />
            </div>
          </>
        ) : (
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-300">
              {t('RiseWorks EVM Wallet Address')}
            </Label>
            <Input
              type="text"
              placeholder="0x71C...39A"
              className="border-slate-750 bg-[#06080e] font-mono text-xs text-slate-100"
            />
          </div>
        )}

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

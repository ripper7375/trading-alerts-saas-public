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

export default function WiseRecipientForm() {
  const { t } = useLocale();
  const [provider, setProvider] = useState<'wise' | 'rise'>('wise');
  const [bankAccount, setBankAccount] = useState('GB89 WEST 1234 5678 9012 34');
  const [wiseEmail, setWiseEmail] = useState('affiliate@davin-trade.com');
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="mx-auto max-w-xl space-y-4 rounded-2xl border border-slate-800 bg-[#090c14] p-6 shadow-xl select-none">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-amber-400" />
          <h2 className="text-sm font-extrabold text-slate-100">
            {t('Payout Account Configuration', 'การตั้งค่าบัญชีการถอนเงิน')}
          </h2>
        </div>
        <Badge className="border-emerald-500/40 bg-emerald-500/15 font-mono text-[9px] text-emerald-300">
          {t('AUTO-DISBURSEMENT', 'การโอนเงินอัตโนมัติ')}
        </Badge>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-300">
            {t('Disbursement Provider', 'ผู้ให้บริการการโอนเงิน')}
          </Label>
          <Select
            value={provider}
            onValueChange={(val: any) => setProvider(val)}
          >
            <SelectTrigger className="border-slate-750 bg-[#06080e] text-xs">
              <SelectValue
                placeholder={t('Select provider', 'เลือกผู้ให้บริการ')}
              />
            </SelectTrigger>
            <SelectContent className="border-slate-750 bg-[#0f1420] text-xs">
              <SelectItem value="wise">
                {t(
                  'Wise Business (Direct Bank Transfer)',
                  'Wise Business (โอนผ่านธนาคารโดยตรง)'
                )}
              </SelectItem>
              <SelectItem value="rise">
                {t(
                  'RiseWorks (Crypto / SIWE Wallet Payout)',
                  'RiseWorks (การถอนเงินเข้ากระเป๋า คริปโท / SIWE)'
                )}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {provider === 'wise' ? (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">
                {t('Wise Account Email', 'อีเมลบัญชี Wise')}
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
                {t(
                  'Bank IBAN / Account Number',
                  'เลข IBAN / เลขที่บัญชีธนาคาร'
                )}
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
              {t(
                'RiseWorks EVM Wallet Address',
                'ที่อยู่กระเป๋าเงิน RiseWorks EVM'
              )}
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
          {isSaved
            ? t('Payout Details Updated!', 'อัปเดตรายละเอียดการถอนเงินแล้ว!')
            : t('Save Payout Details', 'บันทึกรายละเอียดการถอนเงิน')}
        </Button>
      </form>
    </div>
  );
}

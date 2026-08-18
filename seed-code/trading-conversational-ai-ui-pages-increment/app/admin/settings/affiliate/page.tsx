'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Settings,
  Percent,
  Save,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Share2,
} from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import { AdminNav } from '@/components/admin/admin-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useLocale } from '@/lib/context/locale-context';

export default function AdminSettingsAffiliatePage() {
  const { t, language } = useLocale();

  // These figures configure the platform's actual USD-denominated pricing
  // (see the "($)" labels on the inputs below) — they are an internal admin
  // config value, not a customer-facing amount to be converted into the
  // admin operator's own locale currency. `formatCurrency()` would convert
  // via the admin's exchange rate and desync the preview from the raw "$"
  // figures the admin is directly typing, so only number GROUPING is
  // localized here, deliberately keeping the "$"/USD denomination fixed.
  const formatUsd = (amount: number) =>
    amount.toLocaleString(language, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const [defaultRate, setDefaultRate] = useState('30');
  const [cookieDays, setCookieDays] = useState('60');
  const [autoApprovePartners, setAutoApprovePartners] = useState(true);
  const [allowCustomCoupons, setAllowCustomCoupons] = useState(true);
  const [antiFraudProtection, setAntiFraudProtection] = useState(true);

  // Pricing & payout levers (matches Codebase 1's Configuration form)
  const [discountPercent, setDiscountPercent] = useState(20);
  const [codesPerMonth, setCodesPerMonth] = useState(15);
  const [basePrice, setBasePrice] = useState(49);
  const [threeDayPrice, setThreeDayPrice] = useState(1.99);
  const [reason, setReason] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState('');

  const commissionPercent = Number(defaultRate) || 0;
  const exampleNetPrice = basePrice * (1 - discountPercent / 100);
  const exampleCommission = exampleNetPrice * (commissionPercent / 100);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setSuccess(t('Affiliate global system settings saved successfully.'));
      setReason('');
      setTimeout(() => setSuccess(''), 3000);
    }, 500);
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
      <AppHeader
        title={t('Admin Settings: Affiliate Program Engine')}
        subtitle={t(
          'Commission Tiers, Attribution Windows, Cookie Life & Anti-Self-Referral Controls'
        )}
      />

      <AdminNav />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-4 md:p-6">
        <Link
          href="/admin/affiliates"
          className="flex w-fit items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-400"
        >
          <Share2 className="h-3.5 w-3.5" />
          {t('Back to Affiliates')}
        </Link>

        {success && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3.5 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <form onSubmit={handleSave} className="space-y-6">
            <Card className="space-y-5 border-slate-800/80 bg-[#090b14]/90 p-6">
              <h3 className="border-b border-slate-800 pb-3 text-sm font-bold text-slate-100">
                {t('Attribution & Commission Rules')}
              </h3>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">
                    {t('Default Recurring Commission Rate (%)')}
                  </Label>
                  <Input
                    type="number"
                    value={defaultRate}
                    onChange={(e) => setDefaultRate(e.target.value)}
                    className="border-slate-800 bg-[#06080e] font-mono text-slate-200"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">
                    {t('Referral Cookie Lifespan (Days)')}
                  </Label>
                  <Input
                    type="number"
                    value={cookieDays}
                    onChange={(e) => setCookieDays(e.target.value)}
                    className="border-slate-800 bg-[#06080e] font-mono text-slate-200"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">
                    {t('Customer Discount (%)')}
                  </Label>
                  <Input
                    type="number"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Number(e.target.value))}
                    className="border-slate-800 bg-[#06080e] font-mono text-slate-200"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">
                    {t('Codes Distributed Per Month')}
                  </Label>
                  <Input
                    type="number"
                    value={codesPerMonth}
                    onChange={(e) => setCodesPerMonth(Number(e.target.value))}
                    className="border-slate-800 bg-[#06080e] font-mono text-slate-200"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">
                    {t('Monthly Subscription Price ($)')}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={basePrice}
                    onChange={(e) => setBasePrice(Number(e.target.value))}
                    className="border-slate-800 bg-[#06080e] font-mono text-slate-200"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">
                    {t('3-Day Trial Price ($)')}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={threeDayPrice}
                    onChange={(e) => setThreeDayPrice(Number(e.target.value))}
                    className="border-slate-800 bg-[#06080e] font-mono text-slate-200"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">
                  {t('Reason for Change (Optional)')}
                </Label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t('e.g., Holiday promotion, Market adjustment')}
                  className="border-slate-800 bg-[#06080e] text-slate-200"
                />
                <p className="text-[11px] text-slate-500">
                  {t('This will be recorded in the audit history.')}
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#06080e] p-3.5">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-200">
                      {t('Auto-Approve Verified Partner Applications')}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {t(
                        'Instantly unlocks referral codes upon email verification.'
                      )}
                    </p>
                  </div>
                  <Switch
                    checked={autoApprovePartners}
                    onCheckedChange={setAutoApprovePartners}
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#06080e] p-3.5">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-200">
                      {t('Allow Custom Coupon Codes')}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {t(
                        'Lets verified partners request a vanity code instead of a generated one.'
                      )}
                    </p>
                  </div>
                  <Switch
                    checked={allowCustomCoupons}
                    onCheckedChange={setAllowCustomCoupons}
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#06080e] p-3.5">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-200">
                      {t('Enable Anti-Self-Referral Machine Learning Guardian')}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {t(
                        'Flags credit card fingerprints and IP subnet collisions automatically.'
                      )}
                    </p>
                  </div>
                  <Switch
                    checked={antiFraudProtection}
                    onCheckedChange={setAntiFraudProtection}
                  />
                </div>
              </div>
            </Card>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-amber-500 px-6 font-bold text-slate-950 hover:bg-amber-400"
              >
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? t('Saving...') : t('Save Global Settings')}
              </Button>
            </div>
          </form>

          {/* Live Preview */}
          <div className="space-y-4">
            <Card className="space-y-3 border-slate-800/80 bg-[#090b14]/90 p-6">
              <h3 className="border-b border-slate-800 pb-3 text-sm font-bold text-slate-100">
                {t('Example Calculation')}
              </h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('Regular Price')}</span>
                  <span className="font-mono text-slate-200">
                    ${formatUsd(basePrice)}
                  </span>
                </div>
                <div className="flex justify-between text-amber-400">
                  <span>
                    {t('Discount')} ({discountPercent}%)
                  </span>
                  <span className="font-mono">
                    -${formatUsd((basePrice * discountPercent) / 100)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-800 pt-2">
                  <span className="text-slate-400">{t('Customer Pays')}</span>
                  <span className="font-mono font-semibold text-slate-100">
                    ${formatUsd(exampleNetPrice)}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-400">
                  <span>
                    {t('Affiliate Earns')} ({commissionPercent}%)
                  </span>
                  <span className="font-mono font-semibold">
                    ${formatUsd(exampleCommission)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-800 pt-2 text-cyan-400">
                  <span>{t('Company Revenue')}</span>
                  <span className="font-mono font-semibold">
                    ${formatUsd(exampleNetPrice - exampleCommission)}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="space-y-2 border-amber-500/20 bg-amber-500/5 p-6">
              <h4 className="flex items-center gap-2 text-xs font-bold text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" />
                {t('Important Notes')}
              </h4>
              <ul className="space-y-1.5 text-[11px] text-slate-400">
                <li>
                  {t(
                    'Changes take effect immediately for new code distributions.'
                  )}
                </li>
                <li>
                  {t(
                    'Existing codes retain their original discount/commission rates.'
                  )}
                </li>
                <li>
                  {t(
                    'Frontend pages will update within 5 minutes due to caching.'
                  )}
                </li>
                <li>{t('All changes are logged in the audit history.')}</li>
              </ul>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

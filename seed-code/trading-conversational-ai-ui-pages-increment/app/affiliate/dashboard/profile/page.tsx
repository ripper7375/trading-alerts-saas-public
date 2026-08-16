'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  User,
  Mail,
  Building,
  Globe,
  Save,
  CheckCircle2,
  AlertTriangle,
  Shield,
} from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import { AffiliateNav } from '@/components/affiliate/affiliate-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/lib/context/locale-context';

export default function AffiliateProfilePage() {
  const { t } = useLocale();

  const [partnerName, setPartnerName] = useState('Alex Morgan');
  const [partnerEmail, setPartnerEmail] = useState('alex.trader@gmail.com');
  const [businessName, setBusinessName] = useState('Alpha Traders Group LLC');
  const [taxId, setTaxId] = useState('XX-XXXX912');
  const [country, setCountry] = useState('Thailand');
  const [website, setWebsite] = useState('https://t.me/alphagoldtraders');

  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }, 600);
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#06070a] text-slate-100 select-none">
      <AppHeader
        title={t('Affiliate Partner Profile')}
        subtitle={t(
          'Tax Information, Business Registration & Notification Preferences'
        )}
      />

      <AffiliateNav />

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 md:p-6">
        {success && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3.5 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{t('Partner profile updated successfully!')}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="space-y-5 border-slate-800/80 bg-[#090b14]/90 p-6">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    {t('Partner Identity & Contact')}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {t(
                      'Used for official revenue sharing contracts and Wise compliance.'
                    )}
                  </p>
                </div>
              </div>

              <Badge className="border-emerald-500/40 bg-emerald-500/20 text-[10px] text-emerald-400">
                {t('Verified Partner')}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">
                  {t('Full Legal Name')}
                </Label>
                <Input
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  className="border-slate-800 bg-[#06080e] text-slate-200"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">
                  {t('Email Address')}
                </Label>
                <Input
                  type="email"
                  value={partnerEmail}
                  onChange={(e) => setPartnerEmail(e.target.value)}
                  className="border-slate-800 bg-[#06080e] text-slate-200"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">
                  {t('Business / Entity Name (Optional)')}
                </Label>
                <Input
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="border-slate-800 bg-[#06080e] text-slate-200"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">
                  {t('Tax ID / Social ID')}
                </Label>
                <Input
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  className="border-slate-800 bg-[#06080e] font-mono text-slate-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">
                  {t('Country of Residence')}
                </Label>
                <Input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="border-slate-800 bg-[#06080e] text-slate-200"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">
                  {t('Social Channel / Community URL')}
                </Label>
                <Input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="border-slate-800 bg-[#06080e] text-slate-200"
                />
              </div>
            </div>
          </Card>

          <div className="flex justify-end gap-3">
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-amber-500 px-6 font-bold text-slate-950 hover:bg-amber-400"
            >
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? t('Saving...') : t('Save Profile Details')}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}

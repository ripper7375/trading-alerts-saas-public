'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Sliders,
  Save,
  CheckCircle2,
  AlertTriangle,
  Landmark,
  Calendar,
  DollarSign,
  ShieldCheck,
} from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import { AdminNav } from '@/components/admin/admin-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useLocale } from '@/lib/context/locale-context';

export default function AdminDisbursementConfigPage() {
  const { t } = useLocale();

  const [minThreshold, setMinThreshold] = useState('50.00');
  const [payoutDay, setPayoutDay] = useState('1'); // 1st of month
  const [autoExecute, setAutoExecute] = useState(true);
  const [requireTwoAdminApprovals, setRequireTwoAdminApprovals] =
    useState(false);
  const [wiseApiKeyMasked, setWiseApiKeyMasked] = useState(
    'wise_live_••••••••••••••••'
  );
  const [riseWorksApiKeyMasked, setRiseWorksApiKeyMasked] = useState(
    'rise_prod_••••••••••••••••'
  );

  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setSuccess(t('Disbursement configuration saved successfully.'));
      setTimeout(() => setSuccess(''), 3000);
    }, 500);
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
      <AppHeader
        title={t('Admin Disbursement: Treasury & Payout Rules')}
        subtitle={t(
          'Minimum Payout Thresholds, Automated Cron Execution Schedules & API Keys'
        )}
      />

      <AdminNav />

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 md:p-6">
        {success && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3.5 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <Card className="space-y-5 border-slate-800/80 bg-[#090b14]/90 p-6">
            <h3 className="border-b border-slate-800 pb-3 text-sm font-bold text-slate-100">
              {t('Automated Settlement Parameters')}
            </h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">
                  {t('Minimum Payout Threshold (USD)')}
                </Label>
                <Input
                  type="number"
                  step="1"
                  value={minThreshold}
                  onChange={(e) => setMinThreshold(e.target.value)}
                  className="border-slate-800 bg-[#06080e] font-mono text-slate-200"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">
                  {t('Monthly Disbursement Day')}
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="28"
                  value={payoutDay}
                  onChange={(e) => setPayoutDay(e.target.value)}
                  className="border-slate-800 bg-[#06080e] font-mono text-slate-200"
                  required
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#06080e] p-3.5">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-200">
                    {t('Automated Wise Cron Job Execution')}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {t(
                      'Automatically executes validated batches without manual admin trigger.'
                    )}
                  </p>
                </div>
                <Switch
                  checked={autoExecute}
                  onCheckedChange={setAutoExecute}
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#06080e] p-3.5">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-200">
                    {t(
                      'Dual Admin Multi-Signature Required for Batches > $5,000'
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {t(
                      'High security threshold for large treasury balance withdrawals.'
                    )}
                  </p>
                </div>
                <Switch
                  checked={requireTwoAdminApprovals}
                  onCheckedChange={setRequireTwoAdminApprovals}
                />
              </div>
            </div>
          </Card>

          <Card className="space-y-4 border-slate-800/80 bg-[#090b14]/90 p-6">
            <h3 className="border-b border-slate-800 pb-3 text-sm font-bold text-slate-100">
              {t('API Credentials & Vault Configuration')}
            </h3>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">
                  Wise Business Live API Key
                </Label>
                <Input
                  value={wiseApiKeyMasked}
                  onChange={(e) => setWiseApiKeyMasked(e.target.value)}
                  className="border-slate-800 bg-[#06080e] font-mono text-xs text-slate-400"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">
                  RiseWorks Contractor API Key
                </Label>
                <Input
                  value={riseWorksApiKeyMasked}
                  onChange={(e) => setRiseWorksApiKeyMasked(e.target.value)}
                  className="border-slate-800 bg-[#06080e] font-mono text-xs text-slate-400"
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
              {isSaving ? t('Saving...') : t('Save Disbursement Config')}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}

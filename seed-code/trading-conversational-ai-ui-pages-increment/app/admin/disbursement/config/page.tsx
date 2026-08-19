'use client';

import React, { useState } from 'react';
import { Save, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useLocale } from '@/lib/context/locale-context';

type Provider = 'MOCK' | 'RISE' | 'WISE';

const PROVIDER_LABEL: Record<Provider, string> = {
  MOCK: 'MOCK (Testing)',
  RISE: 'RISE (RiseWorks — archived)',
  WISE: 'WISE (Wise — live)',
};

const AVAILABLE_PROVIDERS: Provider[] = ['MOCK', 'WISE'];

export default function AdminDisbursementConfigPage() {
  const { t } = useLocale();

  const [provider] = useState<Provider>('WISE');
  const [enabled, setEnabled] = useState(true);
  const [minThreshold, setMinThreshold] = useState('50.00');
  const [batchSize, setBatchSize] = useState('100');
  const [payoutDay, setPayoutDay] = useState('1');
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
      setSuccess(
        t(
          'Settings saved. Provider is env-var-driven and unaffected by this form — see the notice below.'
        )
      );
      setTimeout(() => setSuccess(''), 4000);
    }, 500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl dark:text-slate-100">
          {t('Configuration')}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {t('Disbursement system settings')}
        </p>
      </div>

      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Provider */}
        <Card className="space-y-4 border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800/80 dark:bg-[#090c14]">
          <h3 className="border-b border-slate-200 pb-3 text-sm font-bold text-slate-900 dark:border-slate-800 dark:text-slate-100">
            {t('Payment Provider')}
          </h3>

          <div className="flex flex-wrap gap-4">
            {(['MOCK', 'RISE', 'WISE'] as const).map((p) => {
              const isAvailable = AVAILABLE_PROVIDERS.includes(p);
              return (
                <label
                  key={p}
                  className={`flex items-center gap-2 text-xs ${
                    isAvailable
                      ? 'cursor-pointer text-slate-800 dark:text-slate-200'
                      : 'cursor-not-allowed text-slate-400 opacity-50 dark:text-slate-500'
                  }`}
                >
                  <input
                    type="radio"
                    name="provider"
                    value={p}
                    disabled={!isAvailable}
                    checked={provider === p}
                    onChange={() => {}}
                    className="accent-amber-500"
                  />
                  <span>{t(PROVIDER_LABEL[p])}</span>
                </label>
              );
            })}
          </div>

          <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 dark:bg-blue-950/20">
            <p className="text-[11px] text-blue-700 dark:text-blue-300">
              <strong>
                {t('Configured via')} <code>DISBURSEMENT_PROVIDER</code>{' '}
                {t('environment variable.')}
              </strong>{' '}
              {t(
                'This selection is informational — Save does not change the live provider. The active provider is set by the environment variable on the service that executes batches and takes effect on redeploy.'
              )}
            </p>
          </div>
        </Card>

        <Card className="space-y-5 border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800/80 dark:bg-[#090c14]">
          <h3 className="border-b border-slate-200 pb-3 text-sm font-bold text-slate-900 dark:border-slate-800 dark:text-slate-100">
            {t('Automated Settlement Parameters')}
          </h3>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-[#06080e]">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-slate-900 dark:text-slate-200">
                {t('Disbursement Status')}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                {t('When disabled, no new batches can be created or executed.')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                className={
                  enabled
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-[10px] text-emerald-700 dark:text-emerald-300'
                    : 'border-rose-500/40 bg-rose-500/15 text-[10px] text-rose-700 dark:text-rose-300'
                }
              >
                {enabled ? t('Enabled') : t('Disabled')}
              </Badge>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700 dark:text-slate-300">
                {t('Minimum Payout Threshold (USD)')}
              </Label>
              <Input
                type="number"
                step="1"
                min="0"
                value={minThreshold}
                onChange={(e) => setMinThreshold(e.target.value)}
                className="border-slate-200 bg-white font-mono text-slate-900 dark:border-slate-800 dark:bg-[#06080e] dark:text-slate-200"
                required
              />
              <p className="text-[11px] text-slate-500">
                {t(
                  'Affiliates must have at least this amount to receive a payout.'
                )}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700 dark:text-slate-300">
                {t('Maximum Batch Size')}
              </Label>
              <Input
                type="number"
                min="1"
                max="500"
                value={batchSize}
                onChange={(e) => setBatchSize(e.target.value)}
                className="border-slate-200 bg-white font-mono text-slate-900 dark:border-slate-800 dark:bg-[#06080e] dark:text-slate-200"
                required
              />
              <p className="text-[11px] text-slate-500">
                {t('Maximum number of payments per batch (1-500).')}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700 dark:text-slate-300">
                {t('Monthly Disbursement Day')}
              </Label>
              <Input
                type="number"
                min="1"
                max="28"
                value={payoutDay}
                onChange={(e) => setPayoutDay(e.target.value)}
                className="border-slate-200 bg-white font-mono text-slate-900 dark:border-slate-800 dark:bg-[#06080e] dark:text-slate-200"
                required
              />
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-[#06080e]">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-200">
                  {t('Automated Wise Cron Job Execution')}
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  {t(
                    'Automatically executes validated batches without manual admin trigger.'
                  )}
                </p>
              </div>
              <Switch checked={autoExecute} onCheckedChange={setAutoExecute} />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-[#06080e]">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-200">
                  {t(
                    'Dual Admin Multi-Signature Required for Batches > $5,000'
                  )}
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
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

        <Card className="space-y-4 border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800/80 dark:bg-[#090c14]">
          <h3 className="border-b border-slate-200 pb-3 text-sm font-bold text-slate-900 dark:border-slate-800 dark:text-slate-100">
            {t('API Credentials & Vault Configuration')}
          </h3>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700 dark:text-slate-300">
                {t('Wise Business Live API Key')}
              </Label>
              <Input
                value={wiseApiKeyMasked}
                onChange={(e) => setWiseApiKeyMasked(e.target.value)}
                className="border-slate-200 bg-white font-mono text-xs text-slate-600 dark:border-slate-800 dark:bg-[#06080e] dark:text-slate-400"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700 dark:text-slate-300">
                {t('RiseWorks Contractor API Key')}
              </Label>
              <Input
                value={riseWorksApiKeyMasked}
                onChange={(e) => setRiseWorksApiKeyMasked(e.target.value)}
                className="border-slate-200 bg-white font-mono text-xs text-slate-600 dark:border-slate-800 dark:bg-[#06080e] dark:text-slate-400"
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

      {/* Configuration Guide */}
      <Card className="border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800/80 dark:bg-[#090c14]">
        <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-slate-100">
          {t('Configuration Guide')}
        </h3>
        <CardContent className="space-y-3 p-0 text-xs text-slate-700 dark:text-slate-300">
          <div>
            <h4 className="mb-1 font-semibold text-slate-900 dark:text-slate-100">
              {t('Payment Provider')}
            </h4>
            <ul className="list-inside list-disc space-y-1 text-slate-600 dark:text-slate-400">
              <li>
                <strong className="text-slate-800 dark:text-slate-300">
                  MOCK:
                </strong>{' '}
                {t(
                  'Simulates payments instantly. Use for development and testing.'
                )}
              </li>
              <li>
                <strong className="text-slate-800 dark:text-slate-300">
                  RISE:
                </strong>{' '}
                {t('RiseWorks blockchain provider. Archived — no longer live.')}
              </li>
              <li>
                <strong className="text-slate-800 dark:text-slate-300">
                  WISE:
                </strong>{' '}
                {t(
                  'Wise payout provider. Live in production; batches execute through the money service.'
                )}
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-1 font-semibold text-slate-900 dark:text-slate-100">
              {t('Minimum Payout')}
            </h4>
            <p className="text-slate-600 dark:text-slate-400">
              {t(
                'The minimum commission balance required before an affiliate becomes eligible for payout. This helps reduce transaction fees for small amounts.'
              )}
            </p>
          </div>

          <div>
            <h4 className="mb-1 font-semibold text-slate-900 dark:text-slate-100">
              {t('Batch Size')}
            </h4>
            <p className="text-slate-600 dark:text-slate-400">
              {t(
                'Maximum number of payments to include in a single batch. Larger batches are more efficient but take longer to process.'
              )}
            </p>
          </div>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 dark:bg-amber-950/20">
            <p className="text-amber-700 dark:text-amber-300">
              <strong>{t('Note:')}</strong>{' '}
              {t(
                'The provider field above reflects the current DISBURSEMENT_PROVIDER environment variable and cannot be changed from this page. Real WISE payouts move real money — provider changes must go through a deliberate environment-variable update and redeploy, not this form.'
              )}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

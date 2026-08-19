'use client';

import { useState } from 'react';
import { Eye, Download, ShieldCheck, AlertCircle, Check } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useLocale } from '@/lib/context/locale-context';

export default function PrivacySettingsPage() {
  const { t } = useLocale();
  const [visibility, setVisibility] = useState<
    'private' | 'public' | 'connections'
  >('private');
  const [showStats, setShowStats] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleDataExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 4000);
    }, 1500);
  };

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="animate-fade-in space-y-6 select-none">
      <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800/80 dark:bg-[#090c14]">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-900 dark:text-slate-100">
              <Eye className="h-4 w-4 text-amber-600 dark:text-amber-400" />{' '}
              {t('Privacy & Data Protection Settings')}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {t(
                'Control profile visibility, telemetry options, and GDPR data archives'
              )}
            </p>
          </div>
          <Badge className="border-emerald-500/40 bg-emerald-500/10 font-mono text-[9px] text-emerald-700 dark:text-emerald-300">
            {t('ENCRYPTED')}
          </Badge>
        </div>

        {/* Profile Visibility Options */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {t('Profile Visibility Level')}
          </Label>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              {
                value: 'private',
                label: t('Private (Recommended)'),
                desc: t(
                  'Only you can access your chart analysis and alert rules'
                ),
              },
              {
                value: 'connections',
                label: t('Connections Only'),
                desc: t(
                  'Shared only with verified affiliate partners & connections'
                ),
              },
              {
                value: 'public',
                label: t('Public Leaderboard'),
                desc: t(
                  'Display trading stats on public DavinTrade leaderboards'
                ),
              },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setVisibility(opt.value as any)}
                className={cn(
                  'flex cursor-pointer flex-col items-start rounded-xl border p-4 text-left transition-all',
                  visibility === opt.value
                    ? 'border-amber-500/60 bg-amber-500/10 text-amber-700 shadow-md ring-1 ring-amber-500/30 dark:text-amber-300'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-[#06080e] dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-200'
                )}
              >
                <div className="flex w-full items-center justify-between text-xs font-bold">
                  <span>{opt.label}</span>
                  {visibility === opt.value && (
                    <Check className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  )}
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  {opt.desc}
                </p>
              </button>
            ))}
          </div>
        </div>

        <Separator className="bg-slate-100 dark:bg-slate-800" />

        {/* Data Sharing Toggles */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {t('Data Sharing & Telemetry Controls')}
          </Label>

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-[#06080e]">
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {t('Show Trading Statistics')}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t('Display your alert triggers count and chart views')}
                </div>
              </div>
              <Switch checked={showStats} onCheckedChange={setShowStats} />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-[#06080e]">
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {t('Show Email Publicly')}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t('Display primary email on your public profile')}
                </div>
                <p className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                  <AlertCircle className="h-3 w-3" />{' '}
                  {t('Not recommended for security reasons')}
                </p>
              </div>
              <Switch checked={showEmail} onCheckedChange={setShowEmail} />
            </div>
          </div>
        </div>

        <Separator className="bg-slate-100 dark:bg-slate-800" />

        {/* GDPR Data Export */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {t('GDPR Account Data Export')}
          </Label>
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-[#06080e]">
            <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
              {t(
                'Request a full JSON export of all your alert rules, AI chat histories, order flow logs, and invoice payment receipts.'
              )}
            </p>
            <Button
              onClick={handleDataExport}
              disabled={isExporting}
              variant="outline"
              className="h-8 border-slate-200 bg-white text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Download className="mr-1 h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              {isExporting
                ? t('Preparing Data Archive...')
                : t('Request Data Export')}
            </Button>
            {exportSuccess && (
              <p className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5" />{' '}
                {t('Export link generated! Check your email inbox.')}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSave}
            className="h-9 bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-extrabold text-slate-950 hover:from-amber-400 hover:to-amber-500"
          >
            {isSaved
              ? t('Privacy Settings Saved!')
              : t('Save Privacy Controls')}
          </Button>
        </div>
      </div>
    </div>
  );
}

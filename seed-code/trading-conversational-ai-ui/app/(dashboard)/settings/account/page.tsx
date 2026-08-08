'use client';

import { useState } from 'react';
import AppHeader from '@/components/layout/app-header';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useLocale } from '@/lib/context/locale-context';

export default function AccountSettingsPage() {
  const { t } = useLocale();
  const [isRequested, setIsRequested] = useState(false);

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#06070a] select-none">
      <AppHeader
        title={t('settings.nav.account', 'บัญชี & การลบ')}
        subtitle={t(
          'GDPR Data Export & 7-Day Account Grace Period Deletion',
          'การส่งออกข้อมูลตาม GDPR และระยะเวลาผ่อนผันการลบบัญชี 7 วัน'
        )}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-4 md:p-6">
        {/* Data Export Box */}
        <div className="space-y-3 rounded-2xl border border-slate-800/80 bg-[#090c14] p-6 shadow-xl">
          <h2 className="text-sm font-extrabold text-slate-100">
            {t(
              'Download Account Data Package (GDPR)',
              'ดาวน์โหลดแพ็กเกจข้อมูลบัญชี (GDPR)'
            )}
          </h2>
          <p className="text-xs text-slate-400">
            {t(
              'Export all your active alert rules, historical AI prompts, and billing logs in JSON format.'
            )}
          </p>
          <Button
            variant="outline"
            className="border-slate-750 h-8 bg-slate-800 text-xs text-slate-200"
          >
            {t('Request Data Archive', 'ร้องขอคลังข้อมูล')}
          </Button>
        </div>

        {/* Danger Zone: Account Deletion */}
        <div className="space-y-4 rounded-2xl border border-rose-500/40 bg-rose-500/5 p-6 shadow-xl">
          <div className="flex items-center gap-2 border-b border-rose-500/30 pb-3 text-rose-400">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <h2 className="text-sm font-extrabold">
              {t(
                'Danger Zone: Account Deletion',
                'พื้นที่อันตราย: การลบบัญชีผู้ใช้'
              )}
            </h2>
          </div>

          {!isRequested ? (
            <div className="space-y-3 text-xs text-slate-300">
              <p>
                {t(
                  'Initiating account deletion schedules your account for permanent erasure after a'
                )}{' '}
                <strong className="text-amber-400">
                  {t('7-day grace period', 'ระยะเวลาผ่อนผัน 7 วัน')}
                </strong>
                .
              </p>
              <p className="text-slate-400">
                {t(
                  'During this period, you can log in anytime to cancel the deletion request.'
                )}
              </p>

              <Button
                onClick={() => setIsRequested(true)}
                className="h-9 bg-rose-600 text-xs font-extrabold text-white hover:bg-rose-500"
              >
                {t(
                  'Request Account Deletion (7-Day Grace)',
                  'ร้องขอลบบัญชี (ผ่อนผัน 7 วัน)'
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <ShieldAlert className="h-4 w-4" />{' '}
                {t(
                  'Account Scheduled for Deletion',
                  'บัญชีถูกกำหนดเวลารอลบบัญชี'
                )}
              </div>
              <p className="text-slate-300">
                {t('Your account is scheduled to be erased in')}{' '}
                <strong>
                  6 {t('days', 'วัน')}, 23 {t('hours', 'ชั่วโมง')}
                </strong>
                .{' '}
                {t(
                  'All active alert triggers will stop firing upon expiration.'
                )}
              </p>
              <Button
                onClick={() => setIsRequested(false)}
                className="h-8 bg-amber-500 text-xs font-extrabold text-slate-950 hover:bg-amber-400"
              >
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />{' '}
                {t(
                  'Cancel Deletion Request & Keep Account',
                  'ยกเลิกการร้องขอลบ & รักษาบัญชีไว้'
                )}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

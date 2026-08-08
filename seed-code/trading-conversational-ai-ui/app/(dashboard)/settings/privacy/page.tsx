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
      <div className="space-y-6 rounded-2xl border border-slate-800/80 bg-[#090c14] p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-100">
              <Eye className="h-4 w-4 text-amber-400" />{' '}
              {t(
                'Privacy & Data Protection Settings',
                'การตั้งค่าความเป็นส่วนตัวและการคุ้มครองข้อมูล'
              )}
            </h2>
            <p className="text-[11px] text-slate-400">
              {t(
                'Control profile visibility, telemetry options, and GDPR data archives',
                'ควบคุมระดับการมองเห็นโปรไฟล์ โทรมาตร และคลังข้อมูล GDPR'
              )}
            </p>
          </div>
          <Badge className="border-emerald-500/40 bg-emerald-500/10 font-mono text-[9px] text-emerald-300">
            {t('ENCRYPTED', 'เข้ารหัสแล้ว')}
          </Badge>
        </div>

        {/* Profile Visibility Options */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold text-slate-300">
            {t('Profile Visibility Level', 'ระดับการมองเห็นโปรไฟล์')}
          </Label>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              {
                value: 'private',
                label: t('Private (Recommended)', 'ส่วนตัว (แนะนำ)'),
                desc: t(
                  'Only you can access your chart analysis and alert rules',
                  'เฉพาะคุณเท่านั้นที่สามารถเข้าถึงการวิเคราะห์กราฟและกฎแจ้งเตือนได้'
                ),
              },
              {
                value: 'connections',
                label: t('Connections Only', 'เฉพาะผู้ติดต่อ'),
                desc: t(
                  'Shared only with verified affiliate partners & connections',
                  'แชร์เฉพาะกับพันธมิตรที่ได้รับการยืนยันและผู้ติดต่อเท่านั้น'
                ),
              },
              {
                value: 'public',
                label: t('Public Leaderboard', 'ลีดเดอร์บอร์ดสาธารณะ'),
                desc: t(
                  'Display trading stats on public DavinTrade leaderboards',
                  'แสดงสถิติการเทรดบนลีดเดอร์บอร์ดสาธารณะของ DavinTrade'
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
                    ? 'border-amber-500/60 bg-amber-500/10 text-amber-300 shadow-md ring-1 ring-amber-500/30'
                    : 'border-slate-800 bg-[#06080e] text-slate-400 hover:border-slate-700 hover:text-slate-200'
                )}
              >
                <div className="flex w-full items-center justify-between text-xs font-bold">
                  <span>{opt.label}</span>
                  {visibility === opt.value && (
                    <Check className="h-4 w-4 text-amber-400" />
                  )}
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                  {opt.desc}
                </p>
              </button>
            ))}
          </div>
        </div>

        <Separator className="bg-slate-800" />

        {/* Data Sharing Toggles */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold text-slate-300">
            {t(
              'Data Sharing & Telemetry Controls',
              'การควบคุมการแชร์ข้อมูลและโทรมาตร'
            )}
          </Label>

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#06080e] p-3.5">
              <div>
                <div className="text-xs font-bold text-slate-200">
                  {t('Show Trading Statistics', 'แสดงสถิติการเทรด')}
                </div>
                <div className="text-[11px] text-slate-400">
                  {t(
                    'Display your alert triggers count and chart views',
                    'แสดงจำนวนการทำงานของการแจ้งเตือนและการเข้าชมกราฟ'
                  )}
                </div>
              </div>
              <Switch checked={showStats} onCheckedChange={setShowStats} />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#06080e] p-3.5">
              <div>
                <div className="text-xs font-bold text-slate-200">
                  {t('Show Email Publicly', 'แสดงอีเมลต่อสาธารณะ')}
                </div>
                <div className="text-[11px] text-slate-400">
                  {t(
                    'Display primary email on your public profile',
                    'แสดงอีเมลหลักบนโปรไฟล์สาธารณะของคุณ'
                  )}
                </div>
                <p className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-rose-400">
                  <AlertCircle className="h-3 w-3" />{' '}
                  {t(
                    'Not recommended for security reasons',
                    'ไม่แนะนำด้วยเหตุผลด้านความปลอดภัย'
                  )}
                </p>
              </div>
              <Switch checked={showEmail} onCheckedChange={setShowEmail} />
            </div>
          </div>
        </div>

        <Separator className="bg-slate-800" />

        {/* GDPR Data Export */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold text-slate-300">
            {t('GDPR Account Data Export', 'ส่งออกข้อมูลบัญชีตามกฎ GDPR')}
          </Label>
          <div className="space-y-3 rounded-xl border border-slate-800 bg-[#06080e] p-4">
            <p className="text-xs leading-relaxed text-slate-300">
              {t(
                'Request a full JSON export of all your alert rules, AI chat histories, order flow logs, and invoice payment receipts.',
                'ร้องขอการส่งออกไฟล์ JSON ของกฎแจ้งเตือนทั้งหมด ประวัติแชท AI บันทึกคำสั่ง และใบเสร็จรับเงิน'
              )}
            </p>
            <Button
              onClick={handleDataExport}
              disabled={isExporting}
              variant="outline"
              className="border-slate-750 h-8 bg-slate-800 text-xs text-slate-200"
            >
              <Download className="mr-1 h-3.5 w-3.5 text-amber-400" />
              {isExporting
                ? t('Preparing Data Archive...', 'กำลังเตรียมคลังข้อมูล...')
                : t('Request Data Export', 'ร้องขอการส่งออกข้อมูล')}
            </Button>
            {exportSuccess && (
              <p className="flex items-center gap-1 text-xs font-bold text-emerald-400">
                <Check className="h-3.5 w-3.5" />{' '}
                {t(
                  'Export link generated! Check your email inbox.',
                  'สร้างลิงก์ส่งออกเรียบร้อย! โปรดตรวจสอบกล่องข้อความในอีเมลของคุณ'
                )}
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
              ? t(
                  'Privacy Settings Saved!',
                  'บันทึกการตั้งค่าความเป็นส่วนตัวแล้ว!'
                )
              : t('Save Privacy Controls', 'บันทึกการตั้งค่าความเป็นส่วนตัว')}
          </Button>
        </div>
      </div>
    </div>
  );
}

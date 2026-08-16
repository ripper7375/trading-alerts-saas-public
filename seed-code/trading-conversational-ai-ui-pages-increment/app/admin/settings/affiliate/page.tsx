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
  const { t } = useLocale();

  const [defaultRate, setDefaultRate] = useState('30');
  const [cookieDays, setCookieDays] = useState('60');
  const [autoApprovePartners, setAutoApprovePartners] = useState(true);
  const [allowCustomCoupons, setAllowCustomCoupons] = useState(true);
  const [antiFraudProtection, setAntiFraudProtection] = useState(true);

  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setSuccess(
        t(
          'Affiliate global system settings saved successfully.',
          'บันทึกการตั้งค่าระบบพันธมิตรเรียบร้อยแล้ว'
        )
      );
      setTimeout(() => setSuccess(''), 3000);
    }, 500);
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
      <AppHeader
        title={t(
          'Admin Settings: Affiliate Program Engine',
          'ตั้งค่าระบบ: โครงสร้างโปรแกรมพันธมิตร'
        )}
        subtitle={t(
          'Commission Tiers, Attribution Windows, Cookie Life & Anti-Self-Referral Controls',
          'อัตราค่าคอมมิชชัน ระยะเวลาคุกกี้ และการป้องกันการแนะนำตัวเอง'
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
              {t(
                'Attribution & Commission Rules',
                'กฎการระบุที่มาและค่าคอมมิชชัน'
              )}
            </h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">
                  {t(
                    'Default Recurring Commission Rate (%)',
                    'อัตราค่าคอมมิชชันเริ่มต้น (%)'
                  )}
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
                  {t(
                    'Referral Cookie Lifespan (Days)',
                    'อายุของคุกกี้ติดตาม (วัน)'
                  )}
                </Label>
                <Input
                  type="number"
                  value={cookieDays}
                  onChange={(e) => setCookieDays(e.target.value)}
                  className="border-slate-800 bg-[#06080e] font-mono text-slate-200"
                  required
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#06080e] p-3.5">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-200">
                    {t(
                      'Auto-Approve Verified Partner Applications',
                      'อนุมัติการสมัครพันธมิตรอัตโนมัติ'
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {t(
                      'Instantly unlocks referral codes upon email verification.',
                      'เปิดใช้งานรหัสแนะนำทันทีหลังยืนยันอีเมล'
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
                    {t(
                      'Enable Anti-Self-Referral Machine Learning Guardian',
                      'เปิดใช้งานระบบ AI ตรวจจับการแนะนำตัวเอง'
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {t(
                      'Flags credit card fingerprints and IP subnet collisions automatically.',
                      'ตรวจจับลายนิ้วมือบัตรเครดิตและไอพีซ้ำซ้อนอัตโนมัติ'
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
              {isSaving
                ? t('Saving...', 'กำลังบันทึก...')
                : t('Save Global Settings', 'บันทึกการตั้งค่า')}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}

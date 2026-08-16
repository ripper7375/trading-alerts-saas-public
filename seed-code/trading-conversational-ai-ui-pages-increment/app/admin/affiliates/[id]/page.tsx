'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import {
  Share2,
  ArrowLeft,
  ShieldCheck,
  Ban,
  RefreshCw,
  Landmark,
  Percent,
  DollarSign,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Send,
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

interface AdminAffiliateDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function AdminAffiliateDetailPage({
  params,
}: AdminAffiliateDetailPageProps) {
  const resolvedParams = use(params);
  const affiliateId = resolvedParams.id;
  const { t } = useLocale();

  const [status, setStatus] = useState<'ACTIVE' | 'SUSPENDED'>('ACTIVE');
  const [commissionRate, setCommissionRate] = useState('30');
  const [promoCodes, setPromoCodes] = useState(['GOLDPRO20', 'DAVINVIP10']);
  const [newCode, setNewCode] = useState('');
  const [isDistributing, setIsDistributing] = useState(false);
  const [success, setSuccess] = useState('');

  const handleToggleStatus = () => {
    const next = status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setStatus(next);
    setSuccess(
      t(`Partner status updated to ${next}`, `อัปเดตสถานะพันธมิตรเป็น ${next}`)
    );
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleAddCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) return;
    setPromoCodes([...promoCodes, newCode.toUpperCase().trim()]);
    setNewCode('');
    setIsDistributing(false);
    setSuccess(
      t(
        'Promo code allocated to partner!',
        'จัดสรรรหัสโปรโมชันให้พันธมิตรเรียบร้อยแล้ว!'
      )
    );
    setTimeout(() => setSuccess(''), 3000);
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
      <AppHeader
        title={t('Admin Partner Deep Dive', 'รายละเอียดเชิงลึกของพันธมิตร')}
        subtitle={t(
          `Managing Partner ID: ${affiliateId}`,
          `กำลังจัดการข้อมูลพันธมิตรรหัส: ${affiliateId}`
        )}
      />

      <AdminNav />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <Link
            href="/admin/affiliates"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-400"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>
              {t('Back to Affiliates Directory', 'กลับสู่รายชื่อพันธมิตร')}
            </span>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleStatus}
            className={`text-xs ${
              status === 'ACTIVE'
                ? 'border-rose-500/40 text-rose-300 hover:bg-rose-950/40'
                : 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/40'
            }`}
          >
            {status === 'ACTIVE' ? (
              <>
                <Ban className="mr-1.5 h-3.5 w-3.5" />
                {t('Suspend Partner', 'ระงับการเป็นพันธมิตร')}
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                {t('Reactivate Partner', 'เปิดใช้งานพันธมิตร')}
              </>
            )}
          </Button>
        </div>

        {success && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3.5 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Overview Header */}
        <Card className="space-y-6 border-slate-800/80 bg-[#090b14]/90 p-6">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-lg font-bold text-amber-400">
                AM
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-100">
                    Alex Morgan
                  </h3>
                  <Badge
                    className={
                      status === 'ACTIVE'
                        ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-400'
                        : 'border-rose-500/40 bg-rose-500/20 text-rose-400'
                    }
                  >
                    {status}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400">
                  alex.trader@gmail.com • ID: {affiliateId}
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-slate-400">
                {t('Accrued Unpaid Commissions', 'ค่าคอมมิชชันค้างจ่าย')}
              </div>
              <div className="font-mono text-2xl font-extrabold text-emerald-400">
                $617.40
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-[#06080e] p-4">
              <div className="text-xs text-slate-400">
                {t('Total Referrals', 'จำนวนการแนะนำ')}
              </div>
              <div className="mt-1 font-mono text-xl font-bold text-slate-200">
                168 Signups
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#06080e] p-4">
              <div className="text-xs text-slate-400">
                {t('Active PRO Subscribers', 'สมาชิก PRO ปัจจุบัน')}
              </div>
              <div className="mt-1 font-mono text-xl font-bold text-emerald-400">
                42 Traders
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#06080e] p-4">
              <div className="text-xs text-slate-400">
                {t('Lifetime Volume', 'ยอดขายสะสม')}
              </div>
              <div className="mt-1 font-mono text-xl font-bold text-cyan-400">
                $8,232.00
              </div>
            </div>
          </div>

          {/* Assigned Promo Codes */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold tracking-wider text-slate-300 uppercase">
                {t('Assigned Promotional Codes', 'รหัสโปรโมชันที่จัดสรรให้')}
              </h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDistributing(true)}
                className="border-slate-700 bg-[#06080e] text-xs text-amber-400 hover:bg-slate-800"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                {t('Allocate Promo Code', 'จัดสรรรหัสใหม่')}
              </Button>
            </div>

            {isDistributing && (
              <form
                onSubmit={handleAddCode}
                className="flex gap-2 rounded-xl border border-slate-800 bg-[#06080e] p-3"
              >
                <Input
                  placeholder="NEWCODE10"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="border-slate-700 bg-[#090b14] font-mono text-xs uppercase"
                  required
                />
                <Button
                  type="submit"
                  size="sm"
                  className="bg-amber-500 font-bold text-slate-950 hover:bg-amber-400"
                >
                  {t('Add', 'เพิ่ม')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setIsDistributing(false)}
                  className="text-slate-400"
                >
                  {t('Cancel', 'ยกเลิก')}
                </Button>
              </form>
            )}

            <div className="flex flex-wrap gap-2">
              {promoCodes.map((code) => (
                <div
                  key={code}
                  className="flex items-center gap-2 rounded-xl border border-slate-800 bg-[#06080e] px-3 py-1.5 font-mono text-xs font-bold text-amber-400"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  <span>{code}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}

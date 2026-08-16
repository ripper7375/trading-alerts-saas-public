'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  ArrowLeft,
  Save,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Zap,
  TrendingUp,
  TrendingDown,
  Radio,
  Sliders,
  Send,
  Loader2,
} from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLocale } from '@/lib/context/locale-context';

interface EditAlertPageProps {
  params: Promise<{ id: string }>;
}

export default function EditAlertPage({ params }: EditAlertPageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const alertId = resolvedParams.id;
  const { t } = useLocale();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form State
  const [symbol, setSymbol] = useState('XAUUSD');
  const [timeframe, setTimeframe] = useState('M5');
  const [direction, setDirection] = useState<'ABOVE' | 'BELOW' | 'CROSS'>(
    'ABOVE'
  );
  const [targetPrice, setTargetPrice] = useState('2420.50');
  const [fractalFilter, setFractalFilter] = useState(true);
  const [inAppNotify, setInAppNotify] = useState(true);
  const [soundNotify, setSoundNotify] = useState(true);
  const [webhookNotify, setWebhookNotify] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    const fetchAlert = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/alerts/${alertId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.alert) {
            setSymbol(data.alert.symbol || 'XAUUSD');
            setTimeframe(data.alert.timeframe || 'M5');
            setDirection(data.alert.direction || 'ABOVE');
            setTargetPrice(data.alert.targetPrice?.toString() || '2420.50');
            setFractalFilter(data.alert.fractalFilter ?? true);
            setInAppNotify(data.alert.inAppNotify ?? true);
            setSoundNotify(data.alert.soundNotify ?? true);
            setWebhookNotify(Boolean(data.alert.webhookUrl));
            setWebhookUrl(data.alert.webhookUrl || '');
            setIsActive(data.alert.active ?? true);
          }
        }
      } catch (err) {
        console.warn('Using baseline state for alert edit:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAlert();
  }, [alertId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/alerts/${alertId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          timeframe,
          direction,
          targetPrice: parseFloat(targetPrice),
          fractalFilter,
          inAppNotify,
          soundNotify,
          webhookUrl: webhookNotify ? webhookUrl : null,
          active: isActive,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.message ||
            t('Failed to update alert.', 'ไม่สามารถอัปเดตการแจ้งเตือนได้')
        );
      }

      setSuccess(
        t('Alert updated successfully!', 'อัปเดตการแจ้งเตือนเรียบร้อยแล้ว!')
      );
      setTimeout(() => {
        router.push('/alerts');
      }, 1500);
    } catch (err: any) {
      setError(
        err.message || t('Error updating alert.', 'เกิดข้อผิดพลาดในการบันทึก')
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        t(
          'Are you sure you want to delete this alert?',
          'คุณแน่ใจหรือไม่ว่าต้องการลบการแจ้งเตือนนี้?'
        )
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/alerts/${alertId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error(
          t('Failed to delete alert.', 'ไม่สามารถลบการแจ้งเตือนได้')
        );
      }

      router.push('/alerts');
    } catch (err: any) {
      setError(
        err.message || t('Error deleting alert.', 'เกิดข้อผิดพลาดในการลบ')
      );
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
      <AppHeader
        title={t('Edit Quantitative Alert', 'แก้ไขการแจ้งเตือนเชิงปริมาณ')}
        subtitle={t(
          `Configuring Trigger ID: ${alertId}`,
          `กำลังตั้งค่าเงื่อนไขการแจ้งเตือนรหัส: ${alertId}`
        )}
      />

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <Link
            href="/alerts"
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 transition-colors hover:text-amber-400"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>
              {t('Back to Alerts Management', 'กลับสู่การจัดการการแจ้งเตือน')}
            </span>
          </Link>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-rose-400 hover:bg-rose-950/40 hover:text-rose-300"
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            {isDeleting
              ? t('Deleting...', 'กำลังลบ...')
              : t('Delete Alert', 'ลบการแจ้งเตือน')}
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-950/40 p-3.5 text-xs text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3.5 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3 py-20 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-amber-400" />
            <p className="text-xs text-slate-400">
              {t(
                'Loading alert parameters...',
                'กำลังโหลดข้อมูลการแจ้งเตือน...'
              )}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            <Card className="space-y-5 border-slate-800/80 bg-[#090b14]/90 p-6 backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
                    <Sliders className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">
                      {t(
                        'Trigger Conditions & Thresholds',
                        'เงื่อนไขและระดับราคาเป้าหมาย'
                      )}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {t(
                        'Define market price triggers and fractal confirmation filters.',
                        'กำหนดราคาและตัวกรองการยืนยันแฟร็กทัล'
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">
                    {t('Active', 'เปิดใช้งาน')}
                  </span>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">
                    {t('Symbol', 'สินทรัพย์')}
                  </Label>
                  <Select value={symbol} onValueChange={setSymbol}>
                    <SelectTrigger className="border-slate-800 bg-[#06080e] text-slate-200">
                      <SelectValue placeholder="Symbol" />
                    </SelectTrigger>
                    <SelectContent className="border-slate-800 bg-[#090b14]">
                      <SelectItem value="XAUUSD">XAUUSD (Spot Gold)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">
                    {t('Timeframe', 'กรอบเวลา')}
                  </Label>
                  <Select value={timeframe} onValueChange={setTimeframe}>
                    <SelectTrigger className="border-slate-800 bg-[#06080e] text-slate-200">
                      <SelectValue placeholder="Timeframe" />
                    </SelectTrigger>
                    <SelectContent className="border-slate-800 bg-[#090b14]">
                      <SelectItem value="M5">M5 (5 Minutes)</SelectItem>
                      <SelectItem value="M15">M15 (15 Minutes)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">
                    {t('Condition Direction', 'ทิศทางเงื่อนไข')}
                  </Label>
                  <Select
                    value={direction}
                    onValueChange={(v: any) => setDirection(v)}
                  >
                    <SelectTrigger className="border-slate-800 bg-[#06080e] text-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-slate-800 bg-[#090b14]">
                      <SelectItem value="ABOVE">
                        Price Crosses Above (&gt;=)
                      </SelectItem>
                      <SelectItem value="BELOW">
                        Price Crosses Below (&lt;=)
                      </SelectItem>
                      <SelectItem value="CROSS">
                        Fractal Breakout Confirmation
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">
                    {t('Target Price (USD)', 'ราคาเป้าหมาย (USD)')}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    className="border-slate-800 bg-[#06080e] font-mono text-slate-200"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-[#06080e] p-3.5">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-200">
                    {t(
                      'Require 5-Bar Fractal Confirmation',
                      'ต้องมีการยืนยันจากแฟร็กทัล 5 แท่ง'
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {t(
                      'Suppresses false wick spikes during illiquid sessions.',
                      'ช่วยลดสัญญาณหลอกในช่วงตลาดสภาพคล่องต่ำ'
                    )}
                  </p>
                </div>
                <Switch
                  checked={fractalFilter}
                  onCheckedChange={setFractalFilter}
                />
              </div>
            </Card>

            {/* Notification Channels */}
            <Card className="space-y-4 border-slate-800/80 bg-[#090b14]/90 p-6 backdrop-blur-xl">
              <h3 className="text-sm font-bold text-slate-100">
                {t('Notification Delivery Channels', 'ช่องทางการรับแจ้งเตือน')}
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#06080e] p-3">
                  <span className="text-xs text-slate-300">
                    {t('In-App Push & Visual Banner', 'ป๊อปอัปแจ้งเตือนในแอป')}
                  </span>
                  <Switch
                    checked={inAppNotify}
                    onCheckedChange={setInAppNotify}
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#06080e] p-3">
                  <span className="text-xs text-slate-300">
                    {t('Audio Chime / Alert Sound', 'เสียงแจ้งเตือน')}
                  </span>
                  <Switch
                    checked={soundNotify}
                    onCheckedChange={setSoundNotify}
                  />
                </div>

                <div className="space-y-2 rounded-xl border border-slate-800 bg-[#06080e] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-300">
                      {t('Custom Webhook Endpoint', 'Webhook แบบกำหนดเอง')}
                    </span>
                    <Switch
                      checked={webhookNotify}
                      onCheckedChange={setWebhookNotify}
                    />
                  </div>
                  {webhookNotify && (
                    <Input
                      placeholder="https://api.yourdomain.com/webhook"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      className="border-slate-700 bg-[#040508] font-mono text-xs text-slate-200"
                    />
                  )}
                </div>
              </div>
            </Card>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Link href="/alerts">
                <Button
                  variant="outline"
                  type="button"
                  className="border-slate-700 text-slate-300"
                >
                  {t('Cancel', 'ยกเลิก')}
                </Button>
              </Link>
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-amber-500 px-6 font-bold text-slate-950 hover:bg-amber-400"
              >
                <Save className="mr-2 h-4 w-4" />
                {isSaving
                  ? t('Saving Changes...', 'กำลังบันทึก...')
                  : t('Save Alert Changes', 'บันทึกการเปลี่ยนแปลง')}
              </Button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

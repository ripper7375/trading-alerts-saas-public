'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Send,
  Radio,
  Bell,
  Users,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Volume2,
} from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import { AdminNav } from '@/components/admin/admin-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

export default function AdminNotificationsBroadcastPage() {
  const { t } = useLocale();

  const [audience, setAudience] = useState<
    'ALL' | 'PRO' | 'FREE' | 'AFFILIATES'
  >('ALL');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetLink, setTargetLink] = useState('/terminal');
  const [inAppPush, setInAppPush] = useState(true);
  const [playAudioChime, setPlayAudioChime] = useState(true);
  const [emailBlast, setEmailBlast] = useState(false);

  const [isSending, setIsSending] = useState(false);
  const [success, setSuccess] = useState('');

  const handleBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !message) return;

    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setSuccess(t('Global system broadcast successfully delivered!'));
      setTitle('');
      setMessage('');
      setTimeout(() => setSuccess(''), 4000);
    }, 900);
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
      <AppHeader
        title={t('Admin Notification Broadcast Center')}
        subtitle={t(
          'Instant Push Announcements, Sound Chimes & Targeted Audience Messaging'
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

        <form onSubmit={handleBroadcast} className="space-y-6">
          <Card className="space-y-5 border-slate-800/80 bg-[#090b14]/90 p-6">
            <h3 className="border-b border-slate-800 pb-3 text-sm font-bold text-slate-100">
              {t('Broadcast Parameters & Content')}
            </h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">
                  {t('Target Audience')}
                </Label>
                <Select
                  value={audience}
                  onValueChange={(v: any) => setAudience(v)}
                >
                  <SelectTrigger className="border-slate-800 bg-[#06080e] text-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-slate-800 bg-[#090b14]">
                    <SelectItem value="ALL">
                      {t('All Registered Users (1,420 traders)')}
                    </SelectItem>
                    <SelectItem value="PRO">
                      {t('PRO Subscribers Only (280 traders)')}
                    </SelectItem>
                    <SelectItem value="FREE">
                      {t('Free Workspace Users (1,140 traders)')}
                    </SelectItem>
                    <SelectItem value="AFFILIATES">
                      {t('Approved Affiliates Only (45 partners)')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">
                  {t('Action Link (Optional)')}
                </Label>
                <Input
                  value={targetLink}
                  onChange={(e) => setTargetLink(e.target.value)}
                  placeholder="/terminal"
                  className="border-slate-800 bg-[#06080e] text-slate-200"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">
                {t('Broadcast Headline')}
              </Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t(
                  'e.g. Scheduled MT5 Maintenance Completed / New Fractal Models Live'
                )}
                className="border-slate-800 bg-[#06080e] text-slate-200"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">
                {t('Broadcast Body Text')}
              </Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('Type your system announcement message here...')}
                rows={4}
                className="border-slate-800 bg-[#06080e] text-xs text-slate-200"
                required
              />
            </div>

            {/* Channels */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#06080e] p-3">
                <span className="text-xs text-slate-300">
                  {t('In-App Notification Centre Push')}
                </span>
                <Switch checked={inAppPush} onCheckedChange={setInAppPush} />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#06080e] p-3">
                <span className="text-xs text-slate-300">
                  {t('Trigger Audio Chime / Visual Banner on Active Terminals')}
                </span>
                <Switch
                  checked={playAudioChime}
                  onCheckedChange={setPlayAudioChime}
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#06080e] p-3">
                <span className="text-xs text-slate-300">
                  {t('Dispatch Bulk Email Blast via AWS SES')}
                </span>
                <Switch checked={emailBlast} onCheckedChange={setEmailBlast} />
              </div>
            </div>
          </Card>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={isSending}
              className="bg-amber-500 px-6 font-bold text-slate-950 hover:bg-amber-400"
            >
              <Send className="mr-2 h-4 w-4" />
              {isSending
                ? t('Broadcasting...')
                : t('Dispatch Global Broadcast')}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}

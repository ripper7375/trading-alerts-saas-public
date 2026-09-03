'use client';

import { useState } from 'react';
import { Send, Info } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useLocale } from '@/lib/context/locale-context';

type Audience = 'ALL' | 'PRO' | 'FREE' | 'AFFILIATES';

/**
 * Broadcast Composer - Client Component (Row 94, Session 9-8a)
 *
 * Ported from codebase 2's `app/admin/notifications/broadcast/page.tsx`.
 * No real dispatch endpoint exists yet -- ships as an explicit,
 * disabled-dispatch preview per `frontend-swap-route-map.md` §6, pending a
 * real notification pipeline (Phase 10/14). The submit action never claims
 * delivery: it only confirms a preview was composed, matching this
 * codebase's established honesty pattern for undone backends (config-history
 * /jobs/outbox's own honest empty-state disclosures).
 */
export default function AdminNotificationsBroadcastPage(): React.ReactElement {
  const { t } = useLocale();
  const [audience, setAudience] = useState<Audience>('ALL');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetLink, setTargetLink] = useState('/terminal');
  const [inAppPush, setInAppPush] = useState(true);
  const [playAudioChime, setPlayAudioChime] = useState(true);
  const [emailBlast, setEmailBlast] = useState(false);
  const [previewNote, setPreviewNote] = useState('');

  const handlePreview = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!title || !message) return;

    setPreviewNote(
      t(
        'admin.broadcast.preview_only_note',
        'Preview only — dispatch is disabled in this environment. No broadcast was sent.'
      )
    );
    setTimeout(() => setPreviewNote(''), 5000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t('admin.broadcast.title', 'Broadcast Composer')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            'admin.broadcast.subtitle',
            'Instant push announcements, sound chimes & targeted audience messaging.'
          )}
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
        <Info className="h-4 w-4 shrink-0" />
        <span>
          {t(
            'admin.broadcast.preview_mode_notice',
            'Preview mode — dispatch is disabled. No real notification pipeline exists yet (scheduled for Phase 10/14).'
          )}
        </span>
      </div>

      {previewNote && (
        <div className="bg-accent/50 rounded-lg border border-border p-3 text-sm text-foreground">
          {previewNote}
        </div>
      )}

      <form onSubmit={handlePreview} className="space-y-6">
        <Card className="space-y-5 border-border bg-card p-6">
          <h3 className="border-b border-border pb-3 text-sm font-bold text-foreground">
            {t(
              'admin.broadcast.parameters_and_content',
              'Broadcast Parameters & Content'
            )}
          </h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {t('admin.broadcast.target_audience', 'Target Audience')}
              </Label>
              <Select
                value={audience}
                onValueChange={(v: string) => setAudience(v as Audience)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">
                    {t('admin.broadcast.audience_all', 'All Registered Users')}
                  </SelectItem>
                  <SelectItem value="PRO">
                    {t('admin.broadcast.audience_pro', 'PRO Subscribers Only')}
                  </SelectItem>
                  <SelectItem value="FREE">
                    {t('admin.broadcast.audience_free', 'Free Workspace Users')}
                  </SelectItem>
                  <SelectItem value="AFFILIATES">
                    {t(
                      'admin.broadcast.audience_affiliates',
                      'Approved Affiliates Only'
                    )}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {t(
                  'admin.broadcast.action_link_optional',
                  'Action Link (Optional)'
                )}
              </Label>
              <Input
                value={targetLink}
                onChange={(e) => setTargetLink(e.target.value)}
                placeholder="/terminal"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {t('admin.broadcast.headline', 'Broadcast Headline')}
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t(
                'admin.broadcast.headline_placeholder',
                'e.g. Scheduled MT5 Maintenance Completed'
              )}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {t('admin.broadcast.body_text', 'Broadcast Body Text')}
            </Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t(
                'admin.broadcast.body_placeholder',
                'Type your system announcement message here...'
              )}
              rows={4}
              required
            />
          </div>

          {/* Channels */}
          <div className="space-y-3 pt-2">
            <div className="bg-accent/30 flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-xs text-foreground">
                {t(
                  'admin.broadcast.channel_in_app_push',
                  'In-App Notification Centre Push'
                )}
              </span>
              <Switch checked={inAppPush} onCheckedChange={setInAppPush} />
            </div>

            <div className="bg-accent/30 flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-xs text-foreground">
                {t(
                  'admin.broadcast.channel_audio_chime',
                  'Trigger Audio Chime / Visual Banner on Active Terminals'
                )}
              </span>
              <Switch
                checked={playAudioChime}
                onCheckedChange={setPlayAudioChime}
              />
            </div>

            <div className="bg-accent/30 flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-xs text-foreground">
                {t(
                  'admin.broadcast.channel_email_blast',
                  'Dispatch Bulk Email Blast'
                )}
              </span>
              <Switch checked={emailBlast} onCheckedChange={setEmailBlast} />
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Badge className="bg-muted text-muted-foreground hover:bg-muted">
            {t('admin.broadcast.dispatch_disabled', 'Dispatch Disabled')}
          </Badge>
          <Button type="submit" className="px-6 font-bold">
            <Send className="mr-2 h-4 w-4" />
            {t(
              'admin.broadcast.preview_only_dispatch_disabled',
              'Preview Only (Dispatch Disabled)'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

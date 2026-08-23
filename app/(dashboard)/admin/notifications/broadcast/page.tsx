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
      'Preview only — dispatch is disabled in this environment. No broadcast was sent.'
    );
    setTimeout(() => setPreviewNote(''), 5000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Broadcast Composer
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Instant push announcements, sound chimes &amp; targeted audience
          messaging.
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
        <Info className="h-4 w-4 shrink-0" />
        <span>
          Preview mode — dispatch is disabled. No real notification pipeline
          exists yet (scheduled for Phase 10/14).
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
            Broadcast Parameters &amp; Content
          </h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Target Audience
              </Label>
              <Select
                value={audience}
                onValueChange={(v: string) => setAudience(v as Audience)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Registered Users</SelectItem>
                  <SelectItem value="PRO">PRO Subscribers Only</SelectItem>
                  <SelectItem value="FREE">Free Workspace Users</SelectItem>
                  <SelectItem value="AFFILIATES">
                    Approved Affiliates Only
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Action Link (Optional)
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
              Broadcast Headline
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Scheduled MT5 Maintenance Completed"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Broadcast Body Text
            </Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your system announcement message here..."
              rows={4}
              required
            />
          </div>

          {/* Channels */}
          <div className="space-y-3 pt-2">
            <div className="bg-accent/30 flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-xs text-foreground">
                In-App Notification Centre Push
              </span>
              <Switch checked={inAppPush} onCheckedChange={setInAppPush} />
            </div>

            <div className="bg-accent/30 flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-xs text-foreground">
                Trigger Audio Chime / Visual Banner on Active Terminals
              </span>
              <Switch
                checked={playAudioChime}
                onCheckedChange={setPlayAudioChime}
              />
            </div>

            <div className="bg-accent/30 flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-xs text-foreground">
                Dispatch Bulk Email Blast
              </span>
              <Switch checked={emailBlast} onCheckedChange={setEmailBlast} />
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Badge className="bg-muted text-muted-foreground hover:bg-muted">
            Dispatch Disabled
          </Badge>
          <Button type="submit" className="px-6 font-bold">
            <Send className="mr-2 h-4 w-4" />
            Preview Only (Dispatch Disabled)
          </Button>
        </div>
      </form>
    </div>
  );
}

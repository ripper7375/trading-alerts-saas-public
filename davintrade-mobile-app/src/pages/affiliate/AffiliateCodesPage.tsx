import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Tag, Plus, Copy, Check, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function AffiliateCodesPage() {
  const navigate = useNavigate();
  const [newTag, setNewTag] = useState('');

  const [codes, setCodes] = useState([
    {
      code: 'DAVIN_VIP',
      tag: 'Default Main Channel',
      clicks: 1240,
      signups: 42,
      active: true,
    },
    {
      code: 'TELEGRAM_GOLD',
      tag: 'Telegram Trading Group',
      clicks: 450,
      signups: 16,
      active: true,
    },
    {
      code: 'YOUTUBE_FRACTAL',
      tag: 'YouTube Video Description',
      clicks: 152,
      signups: 6,
      active: true,
    },
  ]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTag) return;
    const generated = `DT_${newTag.toUpperCase().replace(/\s+/g, '_')}`;
    setCodes([
      { code: generated, tag: newTag, clicks: 0, signups: 0, active: true },
      ...codes,
    ]);
    setNewTag('');
    toast.success(`Referral code ${generated} created!`);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => navigate(-1)}
          className="h-8 w-8 rounded-xl"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-black text-foreground">Referral Codes</h1>
          <p className="text-xs text-muted-foreground">
            Generate campaign-specific links
          </p>
        </div>
      </div>

      {/* Create New Code Card */}
      <Card className="border-border/80 bg-card shadow-xl">
        <CardContent className="space-y-3 p-4">
          <h3 className="text-xs font-bold text-foreground">
            Create Campaign Link
          </h3>
          <form onSubmit={handleCreate} className="flex gap-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="e.g. TikTok Signals or Instagram"
              className="text-xs"
              required
            />
            <Button
              type="submit"
              className="shrink-0 gap-1 bg-amber-500 font-bold text-slate-950 hover:bg-amber-400"
            >
              <Plus className="h-4 w-4" />
              <span>Create</span>
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Active Codes List */}
      <div className="space-y-2.5">
        <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Active Referral Codes ({codes.length})
        </h2>
        {codes.map((c) => (
          <Card key={c.code} className="border-border/80 bg-card">
            <CardContent className="space-y-2 p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-amber-500">
                    {c.code}
                  </span>
                  <Badge
                    variant="success"
                    className="px-1.5 py-0 text-[9px] font-bold"
                  >
                    ACTIVE
                  </Badge>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `https://app.davintrade.com/?ref=${c.code}`
                    );
                    toast.success('Link copied!');
                  }}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>

              <div className="text-[11px] text-muted-foreground">{c.tag}</div>

              <div className="flex items-center justify-between border-t border-border/60 pt-1 font-mono text-[11px]">
                <span>Clicks: {c.clicks}</span>
                <span className="font-bold text-foreground">
                  Paid Signups: {c.signups}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

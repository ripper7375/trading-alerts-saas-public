import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Tag, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function AffiliateCodeInventoryPage() {
  const navigate = useNavigate();

  const INVENTORY = [
    {
      code: 'DAVIN_VIP',
      name: 'Default VIP Tag',
      created: '2026-01-10',
      totalEarned: '$940.20',
    },
    {
      code: 'TELEGRAM_GOLD',
      name: 'Telegram Broadcast',
      created: '2026-01-22',
      totalEarned: '$382.80',
    },
    {
      code: 'YOUTUBE_FRACTAL',
      name: 'YouTube Channel Bio',
      created: '2026-02-01',
      totalEarned: '$159.50',
    },
  ];

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
          <h1 className="text-lg font-black text-foreground">Code Inventory</h1>
          <p className="text-xs text-muted-foreground">
            Historical referral tag breakdown
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        {INVENTORY.map((item) => (
          <Card key={item.code} className="border-border/80 bg-card">
            <CardContent className="space-y-2 p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-amber-500" />
                  <span className="font-mono text-xs font-bold text-foreground">
                    {item.code}
                  </span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `https://app.davintrade.com/?ref=${item.code}`
                    );
                    toast.success('Link copied!');
                  }}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center justify-between border-t border-border/60 pt-1 text-[11px] text-muted-foreground">
                <span>Created: {item.created}</span>
                <span className="font-mono font-bold text-emerald-500">
                  Earned: {item.totalEarned}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

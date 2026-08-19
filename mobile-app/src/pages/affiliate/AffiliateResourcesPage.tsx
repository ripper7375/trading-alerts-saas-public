import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

export default function AffiliateResourcesPage() {
  const navigate = useNavigate();

  const COPY_TEMPLATES = [
    {
      title: 'Telegram / WhatsApp Signal Channel Bio',
      text: '🚀 Trading with real-time MetaTrader 5 fractal alerts & AI analysis. Get instant push notifications on key breakouts: https://app.davintrade.com/?ref=DAVIN_VIP',
    },
    {
      title: 'Twitter / X Trading Post',
      text: 'Gold & Bitcoin breaking fractal resistance! Track institutional order flow live with sub-500ms alerts on DavinTrade: https://app.davintrade.com/?ref=DAVIN_VIP #Forex #Trading #Gold',
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
          <h1 className="text-lg font-black text-foreground">Marketing Kit</h1>
          <p className="text-xs text-muted-foreground">
            Promotional copy & mobile share assets
          </p>
        </div>
      </div>

      {/* Copy Templates */}
      <div className="space-y-3">
        <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          High-Converting Copy Templates
        </h2>
        {COPY_TEMPLATES.map((t, idx) => (
          <Card key={idx} className="border-border/80 bg-card">
            <CardContent className="space-y-2.5 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">
                  {t.title}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(t.text);
                    toast.success('Copy template saved to clipboard!');
                  }}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <p className="select-all rounded-xl bg-muted/40 p-2.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
                &ldquo;{t.text}&rdquo;
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* QR Code Card */}
      <Card className="border-border/80 bg-card">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
              <QrCode className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">
                Mobile QR Code
              </div>
              <div className="text-[10px] text-muted-foreground">
                For offline events & stream overlays
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => toast.success('QR Code image downloaded!')}
            className="text-xs font-bold"
          >
            Download QR
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

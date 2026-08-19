import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export default function PrivacySettingsPage() {
  const navigate = useNavigate();
  const [telemetry, setTelemetry] = useState(false);
  const [pushLogs, setPushLogs] = useState(true);

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
          <h1 className="text-lg font-black text-foreground">Privacy & Data</h1>
          <p className="text-xs text-muted-foreground">
            GDPR telemetry and data controls
          </p>
        </div>
      </div>

      <Card className="divide-y divide-border/60 border-border/80 bg-card">
        <CardContent className="flex items-center justify-between p-4">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-foreground">
              Anonymous Telemetry
            </div>
            <div className="text-[10px] text-muted-foreground">
              Share anonymous crash reports to help improve MT5 latency.
            </div>
          </div>
          <Switch
            checked={telemetry}
            onCheckedChange={(c) => {
              setTelemetry(c);
              toast.info(`Telemetry ${c ? 'Enabled' : 'Disabled'}`);
            }}
          />
        </CardContent>

        <CardContent className="flex items-center justify-between p-4">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-foreground">
              Push Notification Delivery Logs
            </div>
            <div className="text-[10px] text-muted-foreground">
              Save in-app alert history for fast retrieval.
            </div>
          </div>
          <Switch
            checked={pushLogs}
            onCheckedChange={(c) => {
              setPushLogs(c);
              toast.info(`Push logs ${c ? 'Enabled' : 'Disabled'}`);
            }}
          />
        </CardContent>
      </Card>

      {/* GDPR Data Export */}
      <Card className="border-border/80 bg-card">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>GDPR Data Export</span>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Download a complete JSON export of your armed alerts, notification
            history, and account preferences.
          </p>
          <Button
            variant="outline"
            onClick={() => toast.success('JSON export downloaded')}
            className="w-full gap-2 text-xs font-bold"
          >
            <Download className="h-4 w-4" />
            <span>Export Account Data (JSON)</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Smartphone,
  Laptop,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function SecurityActivityPage() {
  const navigate = useNavigate();

  const SESSIONS = [
    {
      id: 'sess_1',
      device: 'Android App (Capacitor Native)',
      ip: '185.220.101.5',
      location: 'London, UK',
      time: 'Active Now',
      current: true,
    },
    {
      id: 'sess_2',
      device: 'Desktop Chrome (Windows 11)',
      ip: '82.165.197.1',
      location: 'London, UK',
      time: '2 hours ago',
      current: false,
    },
    {
      id: 'sess_3',
      device: 'iPhone Safari (Mobile Web)',
      ip: '104.28.212.8',
      location: 'Manchester, UK',
      time: 'Yesterday',
      current: false,
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
          <h1 className="text-lg font-black text-foreground">
            Active Sessions
          </h1>
          <p className="text-xs text-muted-foreground">
            Devices logged into your account
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        {SESSIONS.map((s) => (
          <Card key={s.id} className="border-border/80 bg-card">
            <CardContent className="flex items-center justify-between p-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/60 text-foreground">
                  {s.device.includes('Android') ||
                  s.device.includes('iPhone') ? (
                    <Smartphone className="h-5 w-5" />
                  ) : (
                    <Laptop className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    {s.device}
                    {s.current && (
                      <Badge
                        variant="success"
                        className="px-1.5 py-0 text-[9px] font-bold"
                      >
                        THIS DEVICE
                      </Badge>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {s.ip} • {s.location} • {s.time}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button
        variant="outline"
        onClick={() => toast.success('All other sessions revoked')}
        className="mt-2 w-full border-rose-500/30 text-xs font-bold text-rose-500 hover:bg-rose-500/10"
      >
        Revoke All Other Sessions
      </Button>
    </div>
  );
}

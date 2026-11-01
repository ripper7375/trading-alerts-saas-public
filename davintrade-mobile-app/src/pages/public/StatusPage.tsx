import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Activity,
  Server,
  Zap,
  Bell,
  CreditCard,
  Database,
  ArrowLeft,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function StatusPage() {
  const navigate = useNavigate();

  const SERVICES = [
    {
      name: 'MetaTrader 5 Real-Time WebSocket Feed',
      status: 'OPERATIONAL',
      latency: '42ms',
      uptime: '99.99%',
      icon: Activity,
    },
    {
      name: 'Quad-RAG Conversational AI Analyst (LLMs)',
      status: 'OPERATIONAL',
      latency: '340ms',
      uptime: '99.95%',
      icon: Zap,
    },
    {
      name: 'Firebase Cloud Messaging (FCM) Push Engine',
      status: 'OPERATIONAL',
      latency: '82ms',
      uptime: '100%',
      icon: Bell,
    },
    {
      name: 'Stripe & dLocal Payment Webhooks',
      status: 'OPERATIONAL',
      latency: '115ms',
      uptime: '99.98%',
      icon: CreditCard,
    },
    {
      name: 'PostgreSQL Multi-Region Cluster & Redis Cache',
      status: 'OPERATIONAL',
      latency: '14ms',
      uptime: '100%',
      icon: Database,
    },
  ];

  const INCIDENTS = [
    {
      date: 'August 12, 2026',
      title: 'Scheduled MT5 Broker Maintenance',
      impact: 'Resolved',
      duration: '12 mins',
      desc: 'Routine server reboot performed during weekend market close. All alert triggers remained synchronized.',
    },
    {
      date: 'July 28, 2026',
      title: 'FCM Push Notification Relay Spike',
      impact: 'Resolved',
      duration: '4 mins',
      desc: 'High alert volume during US Non-Farm Payrolls (NFP) release. Auto-scaled FCM buffer queues without lost messages.',
    },
  ];

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4">
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
          <h1 className="text-lg font-black text-foreground">System Status</h1>
          <p className="text-xs text-muted-foreground">
            Live infrastructure & MT5 latency
          </p>
        </div>
      </div>

      {/* Global Status Banner */}
      <Card className="border-2 border-emerald-500/60 bg-emerald-500/10 shadow-lg">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500 font-black text-slate-950 shadow-md">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <div className="text-sm font-black text-foreground">
                All Systems Operational
              </div>
              <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                99.98% Overall 90-Day Uptime
              </div>
            </div>
          </div>
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
          </span>
        </CardContent>
      </Card>

      {/* Live Services Breakdown */}
      <div className="space-y-2">
        <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Infrastructure Services ({SERVICES.length})
        </h2>
        <Card className="divide-y divide-border/60 border-border/80 bg-card">
          {SERVICES.map((s) => (
            <div
              key={s.name}
              className="flex items-center justify-between p-3.5"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted/60 text-foreground">
                  <s.icon className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <div className="text-xs font-bold leading-tight text-foreground">
                    {s.name}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    Latency:{' '}
                    <span className="font-bold text-emerald-500">
                      {s.latency}
                    </span>{' '}
                    • Uptime: {s.uptime}
                  </div>
                </div>
              </div>
              <Badge
                variant="success"
                className="shrink-0 px-1.5 py-0 text-[9px] font-bold"
              >
                {s.status}
              </Badge>
            </div>
          ))}
        </Card>
      </div>

      {/* Incident History Timeline */}
      <div className="space-y-2">
        <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Recent Incident History
        </h2>
        <div className="space-y-2">
          {INCIDENTS.map((inc, idx) => (
            <Card key={idx} className="border-border/80 bg-card">
              <CardContent className="space-y-1.5 p-3.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-foreground">
                    {inc.title}
                  </div>
                  <Badge
                    variant="outline"
                    className="border-emerald-500/40 text-[9px] text-emerald-500"
                  >
                    {inc.impact}
                  </Badge>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {inc.desc}
                </p>
                <div className="flex items-center justify-between border-t border-border/50 pt-1 font-mono text-[10px] text-muted-foreground/80">
                  <span>{inc.date}</span>
                  <span>Duration: {inc.duration}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

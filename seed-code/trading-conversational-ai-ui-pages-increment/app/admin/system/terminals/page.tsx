'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Terminal,
  Activity,
  Server,
  RefreshCw,
  Power,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Radio,
} from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import { AdminNav } from '@/components/admin/admin-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/lib/context/locale-context';

export default function AdminSystemTerminalsPage() {
  const { t } = useLocale();
  const [restartingId, setRestartingId] = useState<string | null>(null);
  const [success, setSuccess] = useState('');

  const [terminals, setTerminals] = useState([
    {
      id: 'mt5-node-1',
      broker: 'ICMarkets-Live18',
      server: 'Spot Gold XAUUSD Primary',
      ping: '12ms',
      cpu: '14%',
      ram: '240MB',
      uptime: '14d 6h',
      status: 'ONLINE',
    },
    {
      id: 'mt5-node-2',
      broker: 'Pepperstone-Edge04',
      server: 'Spot Gold XAUUSD Fallback',
      ping: '18ms',
      cpu: '8%',
      ram: '190MB',
      uptime: '32d 12h',
      status: 'ONLINE',
    },
    {
      id: 'mt5-node-3',
      broker: 'Exness-Real12',
      server: 'Tick Stream Aggregator',
      ping: '24ms',
      cpu: '11%',
      ram: '210MB',
      uptime: '8d 2h',
      status: 'ONLINE',
    },
  ]);

  const handleRestart = (id: string) => {
    setRestartingId(id);
    setTimeout(() => {
      setRestartingId(null);
      setSuccess(
        t(
          `Terminal instance [${id}] rebooted successfully.`,
          `รีสตาร์ทเทอร์มินัลอินสแตนซ์ [${id}] สำเร็จแล้ว`
        )
      );
      setTimeout(() => setSuccess(''), 3000);
    }, 1500);
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
      <AppHeader
        title={t(
          'Admin System: MetaTrader 5 Terminal Cluster',
          'ระบบ: คลัสเตอร์เทอร์มินัล MetaTrader 5'
        )}
        subtitle={t(
          'Live Socket Nodes, Broker Feed Connections & Sub-Millisecond Heartbeats',
          'โหนดการเชื่อมต่อสด ฟีดราคาจากโบรกเกอร์ และสัญญาณชีพจรความเร็วสูง'
        )}
      />

      <AdminNav />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        {success && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3.5 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {terminals.map((node) => (
            <Card
              key={node.id}
              className="space-y-4 border-slate-800/80 bg-[#090b14]/90 p-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
                    <Terminal className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-100">
                      {node.id}
                    </h4>
                    <p className="font-mono text-[10px] text-slate-400">
                      {node.broker}
                    </p>
                  </div>
                </div>
                <Badge className="border-emerald-500/40 bg-emerald-500/20 text-[10px] text-emerald-400">
                  {node.status}
                </Badge>
              </div>

              <div className="space-y-1.5 border-t border-b border-slate-800/80 py-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    {t('Server Pool', 'กลุ่มเซิร์ฟเวอร์')}:
                  </span>
                  <span className="font-semibold text-slate-200">
                    {node.server}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    {t('Ping Latency', 'ความหน่วง')}:
                  </span>
                  <span className="font-mono font-bold text-emerald-400">
                    {node.ping}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    {t('Resource Load', 'การใช้ทรัพยากร')}:
                  </span>
                  <span className="font-mono text-slate-300">
                    {node.cpu} CPU / {node.ram}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    {t('Node Uptime', 'เวลาทำงานต่อเนื่อง')}:
                  </span>
                  <span className="font-mono text-slate-300">
                    {node.uptime}
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRestart(node.id)}
                disabled={restartingId === node.id}
                className="w-full border-slate-700 bg-[#06080e] text-xs text-rose-300 hover:border-rose-500/40 hover:bg-rose-950/30"
              >
                <Power
                  className={`mr-1.5 h-3.5 w-3.5 ${restartingId === node.id ? 'animate-spin' : ''}`}
                />
                {restartingId === node.id
                  ? t('Restarting Node...', 'กำลังรีสตาร์ท...')
                  : t('Soft Reboot Terminal Node', 'รีสตาร์ทโหนด')}
              </Button>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}

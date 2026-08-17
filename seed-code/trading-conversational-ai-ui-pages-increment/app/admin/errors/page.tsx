'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  AlertOctagon,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Trash2,
  CheckCircle2,
  ChevronRight,
  Code,
  Terminal,
} from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import { AdminNav } from '@/components/admin/admin-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/lib/context/locale-context';

interface ErrorLogItem {
  id: string;
  timestamp: string;
  source: string;
  level: 'ERROR' | 'FATAL' | 'WARN';
  message: string;
  stack: string;
  count: number;
  resolved: boolean;
}

export default function AdminErrorsLogPage() {
  const { t } = useLocale();
  const [search, setSearch] = useState('');
  const [selectedError, setSelectedError] = useState<ErrorLogItem | null>(null);

  const [errors, setErrors] = useState<ErrorLogItem[]>([
    {
      id: 'err-491',
      timestamp: '2026-08-16 14:10:02 UTC',
      source: 'MT5_FEED_ADAPTER',
      level: 'WARN',
      message:
        'Socket reconnect triggered after 3 consecutive heartbeat timeouts on symbol XAUUSD',
      stack:
        'Error: Heartbeat timeout\n  at MT5Client.onTimeout (/services/mt5-feed.ts:142)\n  at Socket.emit (events.js:400:28)',
      count: 3,
      resolved: false,
    },
    {
      id: 'err-490',
      timestamp: '2026-08-16 11:24:19 UTC',
      source: 'PAYMENT_WEBHOOK_STRIPE',
      level: 'ERROR',
      message:
        'Signature verification failed for incoming webhook from IP 54.187.205.79',
      stack:
        'StripeSignatureVerificationError: No signatures found matching the expected signature for payload\n  at Stripe.webhooks.constructEvent (/api/webhooks/stripe/route.ts:42)',
      count: 1,
      resolved: true,
    },
    {
      id: 'err-489',
      timestamp: '2026-08-15 18:45:00 UTC',
      source: 'DAVIN_AI_COPILOT',
      level: 'WARN',
      message:
        'Anthropic rate limit soft-cap reached; fell back to fast inference replica',
      stack:
        'AnthropicRateLimitWarning: Rate limit 429\n  at AIProvider.query (/lib/ai/anthropic.ts:88)',
      count: 12,
      resolved: true,
    },
  ]);

  const handleResolve = (id: string) => {
    setErrors((prev) =>
      prev.map((e) => (e.id === id ? { ...e, resolved: true } : e))
    );
    if (selectedError?.id === id) {
      setSelectedError((prev) => (prev ? { ...prev, resolved: true } : null));
    }
  };

  const filteredErrors = errors.filter((err) => {
    const q = search.toLowerCase();
    return (
      err.source.toLowerCase().includes(q) ||
      err.message.toLowerCase().includes(q) ||
      err.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
      <AppHeader
        title={t('Admin System Exception & Error Logs')}
        subtitle={t(
          'Diagnostic Telemetry, Stack Traces, Gateway Timeouts & Exception Clustering'
        )}
      />

      <AdminNav />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div className="relative max-w-xs">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder={t('Search error logs...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 border-slate-800 bg-[#090b14] pl-9 text-xs text-slate-200"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Error List */}
          <div className="space-y-3 lg:col-span-2">
            {filteredErrors.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                {t('No error logs match your search.')}
              </div>
            ) : (
              filteredErrors.map((err) => (
                <Card
                  key={err.id}
                  onClick={() => setSelectedError(err)}
                  className={`cursor-pointer border p-4 transition-all ${
                    selectedError?.id === err.id
                      ? 'border-amber-500/40 bg-[#0d1020]'
                      : err.resolved
                        ? 'border-slate-800/60 bg-[#070912]/80 opacity-70'
                        : 'border-rose-500/30 bg-[#0a0d18]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          err.level === 'ERROR'
                            ? 'border border-rose-500/40 bg-rose-500/20 text-rose-400'
                            : 'border border-amber-500/40 bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        <AlertOctagon className="h-4 w-4" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-200">
                            {err.source}
                          </span>
                          <Badge
                            className={`py-0 text-[10px] ${err.level === 'ERROR' ? 'bg-rose-950 text-rose-300' : 'bg-amber-950 text-amber-300'}`}
                          >
                            {err.level}
                          </Badge>
                          {err.count > 1 && (
                            <span className="py-0.2 rounded bg-slate-800 px-1.5 font-mono text-[10px] text-slate-400">
                              x{err.count}
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-xs leading-relaxed text-slate-300">
                          {err.message}
                        </p>
                        <div className="font-mono text-[10px] text-slate-500">
                          {err.timestamp}
                        </div>
                      </div>
                    </div>

                    <div>
                      {err.resolved ? (
                        <Badge className="border-emerald-500/40 bg-emerald-500/20 text-[10px] text-emerald-400">
                          Resolved
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResolve(err.id);
                          }}
                          className="text-xs text-emerald-400 hover:bg-emerald-950/30"
                        >
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                          Resolve
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Error Detail Panel */}
          <div>
            <Card className="sticky top-6 space-y-4 border-slate-800/80 bg-[#090b14]/90 p-5">
              <h3 className="text-xs font-bold tracking-wider text-slate-300 uppercase">
                {t('Stack Trace & Diagnostics')}
              </h3>

              {selectedError ? (
                <div className="space-y-3">
                  <div className="font-mono text-xs text-slate-400">
                    <div>
                      Error ID:{' '}
                      <strong className="text-slate-200">
                        {selectedError.id}
                      </strong>
                    </div>
                    <div>
                      Source:{' '}
                      <strong className="text-amber-400">
                        {selectedError.source}
                      </strong>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#040509] p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-rose-300">
                    {selectedError.stack}
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-slate-500">
                  {t(
                    'Select an exception log from the left to inspect full payload.'
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Terminal,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Code,
  Layers,
  Send,
  Loader2,
} from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLocale } from '@/lib/context/locale-context';

export default function TestApiHarnessPage() {
  const { t } = useLocale();

  const [endpoint, setEndpoint] = useState('/api/health');
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>(
    'GET'
  );
  const [requestBody, setRequestBody] = useState('');
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseHeaders, setResponseHeaders] = useState<string>('');
  const [responseBody, setResponseBody] = useState<string>('');
  const [latency, setLatency] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const presets = [
    {
      label: 'Health Check (/api/health)',
      method: 'GET',
      url: '/api/health',
      body: '',
    },
    {
      label: 'Auth Session Check (/api/auth/me)',
      method: 'GET',
      url: '/api/auth/me',
      body: '',
    },
    {
      label: 'Active Alerts List (/api/alerts)',
      method: 'GET',
      url: '/api/alerts',
      body: '',
    },
    {
      label: 'Affiliate Stats (/api/affiliate/dashboard/stats)',
      method: 'GET',
      url: '/api/affiliate/dashboard/stats',
      body: '',
    },
  ];

  const handleSelectPreset = (p: (typeof presets)[0]) => {
    setEndpoint(p.url);
    setMethod(p.method as any);
    setRequestBody(p.body);
  };

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResponseStatus(null);
    setResponseBody('');
    setLatency(null);

    const startTime = performance.now();
    try {
      const res = await fetch(endpoint, {
        method,
        headers: requestBody ? { 'Content-Type': 'application/json' } : {},
        body: method !== 'GET' && requestBody ? requestBody : undefined,
      });

      const endTime = performance.now();
      setLatency(Math.round(endTime - startTime));
      setResponseStatus(res.status);

      const headersObj: Record<string, string> = {};
      res.headers.forEach((val, key) => {
        headersObj[key] = val;
      });
      setResponseHeaders(JSON.stringify(headersObj, null, 2));

      const data = await res.json().catch(() => ({ status: res.statusText }));
      setResponseBody(JSON.stringify(data, null, 2));
    } catch (err: any) {
      const endTime = performance.now();
      setLatency(Math.round(endTime - startTime));
      setResponseStatus(500);
      setResponseBody(JSON.stringify({ error: err.message }, null, 2));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
      <AppHeader
        title={t('Interactive API Test Harness', 'ระบบทดสอบและตรวจสอบ API')}
        subtitle={t(
          'Diagnostic REST Workbench for Platform Developers & QA Engineers',
          'เครื่องมือทดสอบ REST API สำหรับนักพัฒนาและวิศวกรทดสอบระบบ'
        )}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-4 md:p-6">
        {/* Preset quick links */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="mr-1 text-xs font-bold tracking-wider text-slate-400 uppercase">
            {t('Quick Presets', 'ตัวอย่างคำขอ')}:
          </span>
          {presets.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectPreset(p)}
              className="rounded-lg border border-slate-800 bg-[#090b14] px-3 py-1 text-xs whitespace-nowrap text-slate-300 transition-colors hover:border-amber-500/40 hover:text-amber-400"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Request Composer */}
          <Card className="space-y-4 border-slate-800/80 bg-[#090b14]/90 p-5">
            <h3 className="text-xs font-bold tracking-wider text-slate-300 uppercase">
              {t('HTTP Request Details', 'รายละเอียดคำขอ HTTP')}
            </h3>

            <form onSubmit={handleExecute} className="space-y-4">
              <div className="flex gap-2">
                <Select value={method} onValueChange={(v: any) => setMethod(v)}>
                  <SelectTrigger className="w-28 border-slate-800 bg-[#06080e] font-mono text-xs font-bold text-amber-400">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-slate-800 bg-[#090b14]">
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="/api/..."
                  className="border-slate-800 bg-[#06080e] font-mono text-xs text-slate-200"
                  required
                />
              </div>

              {method !== 'GET' && (
                <div className="space-y-1.5">
                  <span className="font-mono text-[11px] text-slate-400">
                    JSON Body Payload:
                  </span>
                  <Textarea
                    value={requestBody}
                    onChange={(e) => setRequestBody(e.target.value)}
                    placeholder='{ "key": "value" }'
                    rows={6}
                    className="border-slate-800 bg-[#06080e] font-mono text-xs text-slate-200"
                  />
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-amber-500 font-bold text-slate-950 hover:bg-amber-400"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4 fill-current" />
                )}
                {t('Send Request', 'ส่งคำขอ')}
              </Button>
            </form>
          </Card>

          {/* Response Inspector */}
          <Card className="flex flex-col space-y-4 border-slate-800/80 bg-[#090b14]/90 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold tracking-wider text-slate-300 uppercase">
                {t(
                  'Server Response Payload',
                  'ผลลัพธ์การตอบกลับจากเซิร์ฟเวอร์'
                )}
              </h3>

              {responseStatus !== null && (
                <div className="flex items-center gap-2 font-mono text-xs">
                  <Badge
                    className={
                      responseStatus >= 200 && responseStatus < 300
                        ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-400'
                        : 'border-rose-500/40 bg-rose-500/20 text-rose-400'
                    }
                  >
                    HTTP {responseStatus}
                  </Badge>
                  {latency !== null && (
                    <span className="text-slate-400">{latency}ms</span>
                  )}
                </div>
              )}
            </div>

            <div className="min-h-[220px] flex-1 overflow-auto rounded-xl border border-slate-800 bg-[#040509] p-3 font-mono text-xs whitespace-pre-wrap text-slate-300">
              {isLoading ? (
                <div className="flex h-full items-center justify-center text-slate-500">
                  <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
                </div>
              ) : responseBody ? (
                responseBody
              ) : (
                <span className="text-slate-600">
                  {t(
                    'No response recorded yet. Send a request above to inspect payloads.',
                    'ยังไม่มีข้อมูลการตอบกลับ กรุณาส่งคำขอด้านซ้ายเพื่อดูผลลัพธ์'
                  )}
                </span>
              )}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}

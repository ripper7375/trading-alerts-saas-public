'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AuditStatusBadge,
  type AuditLogStatus,
} from '@/components/disbursement/status-badge';
import { useLocale } from '@/lib/context/locale-context';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SEED DATA
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  status: AuditLogStatus;
  details: string;
  ip: string;
}

const AUDIT_EVENTS: AuditEvent[] = [
  {
    id: 'AUD-991',
    timestamp: '2026-08-16T14:22:10Z',
    actor: 'admin_sys',
    action: 'BATCH_APPROVAL',
    status: 'SUCCESS',
    details: 'Approved August Wise payout batch',
    ip: '171.96.120.45',
  },
  {
    id: 'AUD-990',
    timestamp: '2026-08-15T09:11:04Z',
    actor: 'system_cron',
    action: 'COMMISSION_ACCRUAL',
    status: 'INFO',
    details: 'Accrued commission to Alex Morgan for renewal',
    ip: '127.0.0.1',
  },
  {
    id: 'AUD-989',
    timestamp: '2026-08-01T00:05:00Z',
    actor: 'wise_webhook',
    action: 'PAYOUT_SETTLED',
    status: 'SUCCESS',
    details: 'Settled July batch via Wise Business',
    ip: '34.240.112.5',
  },
  {
    id: 'AUD-988',
    timestamp: '2026-06-30T00:04:00Z',
    actor: 'wise_webhook',
    action: 'PAYMENT_FAILED',
    status: 'FAILURE',
    details: 'Recipient bank rejected transfer: invalid IBAN checksum',
    ip: '34.240.112.5',
  },
  {
    id: 'AUD-987',
    timestamp: '2026-06-29T18:40:00Z',
    actor: 'admin_sys',
    action: 'CONFIG_UPDATED',
    status: 'WARNING',
    details: 'Minimum payout threshold lowered from $75.00 to $50.00',
    ip: '171.96.120.45',
  },
];

export default function AdminDisbursementAuditPage() {
  const { t, formatDate } = useLocale();
  const [actionFilter, setActionFilter] = useState<string | null>(null);

  const uniqueActions = useMemo(
    () => [...new Set(AUDIT_EVENTS.map((e) => e.action))].sort(),
    []
  );

  const filteredEvents = actionFilter
    ? AUDIT_EVENTS.filter((e) => e.action === actionFilter)
    : AUDIT_EVENTS;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 sm:text-3xl">
          {t('Audit Logs')}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {t('Immutable disbursement activity history & approval signoffs')}
        </p>
      </div>

      {/* Action Filter */}
      <Card className="border-slate-800/80 bg-[#090c14]">
        <CardContent className="flex flex-wrap gap-2 py-4">
          <Button
            size="sm"
            variant={!actionFilter ? 'default' : 'outline'}
            onClick={() => setActionFilter(null)}
            className={
              !actionFilter
                ? 'bg-amber-500 font-bold text-slate-950 hover:bg-amber-400'
                : 'border-slate-800 bg-transparent text-xs text-slate-300 hover:bg-slate-800'
            }
          >
            {t('All Actions')}
          </Button>
          {uniqueActions.map((action) => (
            <Button
              key={action}
              size="sm"
              variant={actionFilter === action ? 'default' : 'outline'}
              onClick={() => setActionFilter(action)}
              className={
                actionFilter === action
                  ? 'bg-amber-500 font-bold text-slate-950 hover:bg-amber-400'
                  : 'border-slate-800 bg-transparent text-xs text-slate-300 hover:bg-slate-800'
              }
            >
              {action}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-slate-800/80 bg-[#090b14]/90 backdrop-blur-xl">
        <CardHeader className="pb-0">
          <CardTitle className="sr-only">{t('Audit Events')}</CardTitle>
          <CardDescription className="text-slate-400">
            {filteredEvents.length} {t('events')}
          </CardDescription>
        </CardHeader>
        <Table>
          <TableHeader className="bg-[#06080e]">
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead className="text-xs font-bold text-slate-300">
                {t('Audit ID')}
              </TableHead>
              <TableHead className="text-xs font-bold text-slate-300">
                {t('Timestamp')}
              </TableHead>
              <TableHead className="text-xs font-bold text-slate-300">
                {t('Actor / Trigger')}
              </TableHead>
              <TableHead className="text-xs font-bold text-slate-300">
                {t('Action Event')}
              </TableHead>
              <TableHead className="text-xs font-bold text-slate-300">
                {t('Status')}
              </TableHead>
              <TableHead className="text-xs font-bold text-slate-300">
                {t('Details')}
              </TableHead>
              <TableHead className="text-right text-xs font-bold text-slate-300">
                {t('IP Source')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEvents.map((ev) => (
              <TableRow
                key={ev.id}
                className="border-slate-800/60 hover:bg-slate-800/30"
              >
                <TableCell className="font-mono text-xs text-slate-400">
                  {ev.id}
                </TableCell>
                <TableCell className="font-mono text-xs text-slate-400">
                  {formatDate(ev.timestamp)}
                </TableCell>
                <TableCell className="font-mono text-xs font-bold text-amber-400">
                  {ev.actor}
                </TableCell>
                <TableCell className="font-mono text-xs font-bold text-slate-200">
                  {ev.action}
                </TableCell>
                <TableCell>
                  <AuditStatusBadge status={ev.status} />
                </TableCell>
                <TableCell className="text-xs text-slate-300">
                  {t(ev.details)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-slate-500">
                  {ev.ip}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

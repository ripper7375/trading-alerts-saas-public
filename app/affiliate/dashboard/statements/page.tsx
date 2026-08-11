/**
 * Affiliate Monthly Statements Page (Session 6-7, B2-19)
 *
 * No dedicated statements endpoint exists (order's own Feeds-on list only
 * covers commissions/payouts/code-inventory/wise-recipients) — per Davin's
 * live CONFIRM-time direction, this is built as client-side aggregation of
 * the already-live GET /api/affiliate/dashboard/commission-report over a
 * 12-month window, grouped by earnedAt's calendar month. CSV export is
 * generated client-side from the same fetched rows — no new backend.
 *
 * @module app/affiliate/dashboard/statements/page
 */

'use client';

import React, { useEffect, useMemo, useState } from 'react';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES — mirrors the real commission-report response shape
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type CommissionStatus = 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED';

interface CommissionRow {
  id: string;
  commissionAmount: string | number;
  status: CommissionStatus;
  earnedAt: string;
  paidAt: string | null;
  affiliateCode: { code: string };
}

interface CommissionReportResponse {
  commissions: CommissionRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface MonthlyStatement {
  monthKey: string; // 'YYYY-MM'
  monthLabel: string;
  rows: CommissionRow[];
  totalEarned: number;
  totalPaid: number;
  totalPending: number;
}

const MAX_PAGES_FETCHED = 5; // up to 500 commissions across the window — far above realistic per-affiliate volume

function monthKeyOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabelOf(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return new Date(year!, (month ?? 1) - 1, 1).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
  });
}

function downloadCsv(filename: string, rows: CommissionRow[]): void {
  const header = ['Code', 'Amount (USD)', 'Status', 'Earned At', 'Paid At'];
  const lines = rows.map((r) =>
    [
      r.affiliateCode.code,
      Number(r.commissionAmount).toFixed(2),
      r.status,
      new Date(r.earnedAt).toISOString(),
      r.paidAt ? new Date(r.paidAt).toISOString() : '',
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(',')
  );
  const csv = [header.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function AffiliateStatementsPage(): React.ReactElement {
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAll = async (): Promise<void> => {
      setLoading(true);
      setError('');

      try {
        const endDate = new Date();
        const startDate = new Date(endDate);
        startDate.setMonth(startDate.getMonth() - 12);

        const all: CommissionRow[] = [];
        let page = 1;
        let totalPages = 1;

        do {
          const params = new URLSearchParams({
            page: String(page),
            limit: '100',
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          });

          const response = await fetch(
            `/api/affiliate/dashboard/commission-report?${params.toString()}`
          );

          if (!response.ok) {
            throw new Error('Failed to load statement data');
          }

          const data: CommissionReportResponse = await response.json();
          all.push(...data.commissions);
          totalPages = data.pagination.totalPages;
          page += 1;
        } while (page <= totalPages && page <= MAX_PAGES_FETCHED);

        setCommissions(all);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load statement data'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  const statements = useMemo<MonthlyStatement[]>(() => {
    const byMonth = new Map<string, CommissionRow[]>();

    for (const row of commissions) {
      const key = monthKeyOf(row.earnedAt);
      const existing = byMonth.get(key) ?? [];
      existing.push(row);
      byMonth.set(key, existing);
    }

    return Array.from(byMonth.entries())
      .map(([monthKey, rows]) => {
        const totalPaid = rows
          .filter((r) => r.status === 'PAID')
          .reduce((sum, r) => sum + Number(r.commissionAmount), 0);
        const totalPending = rows
          .filter((r) => r.status === 'PENDING' || r.status === 'APPROVED')
          .reduce((sum, r) => sum + Number(r.commissionAmount), 0);

        return {
          monthKey,
          monthLabel: monthLabelOf(monthKey),
          rows,
          totalEarned: totalPaid + totalPending,
          totalPaid,
          totalPending,
        };
      })
      .sort((a, b) => (a.monthKey < b.monthKey ? 1 : -1));
  }, [commissions]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Monthly Statements</h1>
        <p className="text-gray-600">
          A month-by-month summary of your commission activity, built from your
          real commission history
        </p>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
        </div>
      ) : statements.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center text-gray-500 shadow-md">
          No commission activity in the last 12 months yet.
        </div>
      ) : (
        <div className="space-y-4">
          {statements.map((statement) => (
            <div
              key={statement.monthKey}
              className="rounded-lg bg-white p-6 shadow-md"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {statement.monthLabel}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {statement.rows.length} commission
                    {statement.rows.length === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex gap-6 text-sm">
                  <div>
                    <p className="text-gray-500">Earned</p>
                    <p className="font-semibold text-gray-900">
                      ${statement.totalEarned.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Paid</p>
                    <p className="font-semibold text-green-600">
                      ${statement.totalPaid.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Pending</p>
                    <p className="font-semibold text-yellow-600">
                      ${statement.totalPending.toFixed(2)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    downloadCsv(
                      `statement-${statement.monthKey}.csv`,
                      statement.rows
                    )
                  }
                  className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  Download CSV
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tax Summary Note */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
        <h3 className="mb-2 font-semibold text-gray-900">Tax Summary Note</h3>
        <p className="text-sm text-gray-600">
          These statements summarize commission activity and are not tax
          documents. Amounts shown are in USD before any local withholding or
          currency-conversion fees applied by our payout provider. Consult a tax
          advisor in your jurisdiction to determine your reporting obligations.
        </p>
      </div>
    </div>
  );
}

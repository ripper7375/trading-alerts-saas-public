'use client';

/**
 * Admin Affiliate Management Page
 *
 * Lists all affiliates with filtering and actions
 *
 * @module app/admin/affiliates/page
 */

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface Affiliate {
  id: string;
  fullName: string;
  country: string;
  status: string;
  paymentMethod: string;
  totalCodesDistributed: number;
  totalCodesUsed: number;
  totalEarnings: number;
  pendingCommissions: number;
  user: {
    email: string;
  };
  affiliateCodes: Array<{
    id: string;
    code: string;
    status: string;
  }>;
}

interface AffiliatesResponse {
  affiliates: Affiliate[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const REPORT_LINKS = [
  {
    href: '/admin/affiliates/reports/profit-loss',
    icon: '📈',
    title: 'P&L Report',
    description: 'Revenue & margins',
  },
  {
    href: '/admin/affiliates/reports/sales-performance',
    icon: '🏆',
    title: 'Sales Performance',
    description: 'Top affiliates',
  },
  {
    href: '/admin/affiliates/reports/commission-owings',
    icon: '💰',
    title: 'Commission Owings',
    description: 'Pending payouts',
  },
  {
    href: '/admin/affiliates/reports/code-inventory',
    icon: '🎟️',
    title: 'Code Inventory',
    description: 'Distribution stats',
  },
  {
    href: '/admin/affiliates/reports/code-flows',
    icon: '🔄',
    title: 'Code Flows',
    description: 'Lifecycle & audit',
  },
] as const;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function AdminAffiliatesPage(): React.ReactElement {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState({
    status: 'ALL',
    country: '',
  });

  const fetchAffiliates = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.status !== 'ALL') params.set('status', filters.status);
      if (filters.country) params.set('country', filters.country);
      params.set('page', pagination.page.toString());
      params.set('limit', pagination.limit.toString());

      const response = await fetch(`/api/admin/affiliates?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch affiliates');
      }

      const data: AffiliatesResponse = await response.json();
      setAffiliates(data.affiliates);
      setPagination((prev) => ({
        ...prev,
        total: data.total,
        totalPages: data.totalPages,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);

  useEffect(() => {
    void fetchAffiliates();
  }, [fetchAffiliates]);

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-500/10 text-green-500 hover:bg-green-500/10';
      case 'PENDING_VERIFICATION':
        return 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/10';
      case 'SUSPENDED':
        return 'bg-red-500/10 text-red-500 hover:bg-red-500/10';
      default:
        return 'bg-muted text-muted-foreground hover:bg-muted';
    }
  };

  const formatCurrency = (
    amount: number | { toNumber?: () => number }
  ): string => {
    const value =
      typeof amount === 'object' && amount.toNumber
        ? amount.toNumber()
        : Number(amount);
    return `$${value.toFixed(2)}`;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          Affiliate Management
        </h1>
        <p className="mt-1 text-muted-foreground">
          Manage affiliates, distribute codes, and view performance
        </p>
      </div>

      {/* Quick Links to Reports */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Affiliate Reports</CardTitle>
          <CardDescription className="text-muted-foreground">
            Program-wide reconciliation, performance and financial reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {REPORT_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="bg-accent/50 rounded-lg border border-border p-4 transition-colors hover:bg-accent"
              >
                <div className="mb-1 text-xl">{link.icon}</div>
                <div className="font-semibold text-foreground">
                  {link.title}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {link.description}
                </p>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="border-border bg-card">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium text-foreground">
                Status
              </label>
              <Select
                value={filters.status}
                onValueChange={(value) =>
                  setFilters({ ...filters, status: value })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="PENDING_VERIFICATION">
                    Pending Verification
                  </SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium text-foreground">
                Country
              </label>
              <Input
                value={filters.country}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFilters({ ...filters, country: e.target.value })
                }
                placeholder="US, UK, etc."
                aria-label="Filter by country"
              />
            </div>

            <Button
              variant="outline"
              onClick={() => setFilters({ status: 'ALL', country: '' })}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {affiliates.length} of {pagination.total} affiliates
        </span>
        <span>
          Page {pagination.page} of {pagination.totalPages || 1}
        </span>
      </div>

      {/* Table */}
      <Card className="border-border bg-card">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          ) : error ? (
            <div className="py-8 text-center">
              <p className="mb-4 text-red-500">{error}</p>
              <Button onClick={() => void fetchAffiliates()}>Retry</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Name / Email
                    </th>
                    <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">
                      Country
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">
                      Codes
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Earnings
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {affiliates.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-12 text-center text-muted-foreground"
                      >
                        No affiliates found
                      </td>
                    </tr>
                  ) : (
                    affiliates.map((affiliate) => (
                      <tr
                        key={affiliate.id}
                        className="border-border/50 hover:bg-accent/30 border-b transition-colors"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/affiliates/${affiliate.id}`}
                            className="font-medium text-foreground transition-colors hover:text-primary"
                          >
                            {affiliate.fullName}
                          </Link>
                          <div className="text-sm text-muted-foreground">
                            {affiliate.user.email}
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                          {affiliate.country}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            className={getStatusBadgeClass(affiliate.status)}
                          >
                            {affiliate.status.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                          {affiliate.totalCodesUsed} /{' '}
                          {affiliate.totalCodesDistributed}
                          <span className="text-muted-foreground/70 ml-1">
                            ({affiliate.affiliateCodes.length} active)
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-foreground">
                            {formatCurrency(affiliate.totalEarnings)}
                          </div>
                          <div className="text-sm text-amber-600 dark:text-amber-400">
                            {formatCurrency(affiliate.pendingCommissions)}{' '}
                            pending
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/admin/affiliates/${affiliate.id}`}>
                              View Details →
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            onClick={() =>
              setPagination((prev) => ({
                ...prev,
                page: Math.max(1, prev.page - 1),
              }))
            }
            disabled={pagination.page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} (
            {pagination.total} total)
          </span>
          <Button
            variant="outline"
            onClick={() =>
              setPagination((prev) => ({
                ...prev,
                page: Math.min(prev.totalPages, prev.page + 1),
              }))
            }
            disabled={pagination.page === pagination.totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

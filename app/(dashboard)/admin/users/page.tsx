'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';

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
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  tier: 'FREE' | 'PRO';
  role: string;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
  alertCount: number;
  watchlistCount: number;
}

interface UsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

type TierFilter = 'ALL' | 'FREE' | 'PRO';
type SortBy = 'createdAt' | 'name' | 'tier';
type SortOrder = 'asc' | 'desc';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// USER MANAGEMENT PAGE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * User Management Page - Client Component
 *
 * Features:
 * - Paginated user list with search
 * - Filter by tier (ALL/FREE/PRO)
 * - Sort by created date, name, tier
 * - User details: Name, Email, Tier, Created, Last Login, Status
 * - Pagination (50 per page)
 */
export default function UsersPage(): React.ReactElement {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Toast notifications
  const { success, error: showError } = useToast();

  // Filters
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortBy>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchUsers = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '50',
        tier: tierFilter,
        sortBy,
        sortOrder,
      });

      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      }

      const response = await fetch(`/api/admin/users?${params.toString()}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch users');
      }

      const data: UsersResponse = await response.json();
      setUsers(data.users);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [page, tierFilter, sortBy, sortOrder, debouncedSearch]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const handleTierChange = (value: string): void => {
    setTierFilter(value as TierFilter);
    setPage(1);
  };

  const handleSortChange = (value: string): void => {
    setSortBy(value as SortBy);
    setPage(1);
  };

  const handleSortOrderToggle = (): void => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    setPage(1);
  };

  const handleExportCSV = async (): Promise<void> => {
    try {
      setIsExporting(true);

      // Build query params with current filters
      const params = new URLSearchParams({
        tier: tierFilter,
        sortBy,
        sortOrder,
      });

      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      }

      const response = await fetch(
        `/api/admin/users/export?${params.toString()}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to export users');
      }

      // Get the CSV blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      success(
        'Export Complete',
        `Successfully exported ${total} users to CSV`
      );
    } catch (err) {
      showError(
        'Export Failed',
        err instanceof Error ? err.message : 'Unknown error'
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            User Management
          </h1>
          <p className="text-gray-400 mt-1">
            View and manage all registered users
          </p>
        </div>
        <Button
          onClick={() => void handleExportCSV()}
          disabled={isExporting || isLoading || users.length === 0}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <Download className="w-4 h-4 mr-2" />
          {isExporting ? 'Exporting...' : 'Export CSV'}
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSearch(e.target.value)
                }
                className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400"
              />
            </div>

            {/* Tier Filter */}
            <Select value={tierFilter} onValueChange={handleTierChange}>
              <SelectTrigger className="w-full sm:w-[140px] bg-gray-700 border-gray-600 text-white">
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                <SelectItem value="ALL">All Tiers</SelectItem>
                <SelectItem value="FREE">FREE</SelectItem>
                <SelectItem value="PRO">PRO</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort By */}
            <Select value={sortBy} onValueChange={handleSortChange}>
              <SelectTrigger className="w-full sm:w-[160px] bg-gray-700 border-gray-600 text-white">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                <SelectItem value="createdAt">Created Date</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="tier">Tier</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort Order Toggle */}
            <Button
              variant="outline"
              onClick={handleSortOrderToggle}
              className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
            >
              {sortOrder === 'desc' ? '↓ Desc' : '↑ Asc'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-gray-400">
        <span>
          Showing {users.length} of {total} users
        </span>
        <span>
          Page {page} of {totalPages}
        </span>
      </div>

      {/* Users Table */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Users</CardTitle>
          <CardDescription className="text-gray-400">
            All registered users with their tier information
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-400 mb-4">{error}</p>
              <Button
                onClick={() => void fetchUsers()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Retry
              </Button>
            </div>
          ) : users.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No users found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">
                      Name
                    </th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">
                      Email
                    </th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">
                      Tier
                    </th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium hidden md:table-cell">
                      Created
                    </th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium hidden lg:table-cell">
                      Alerts
                    </th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium hidden lg:table-cell">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <span className="text-white">
                          {user.name || 'No name'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-gray-300 text-sm">
                          {user.email}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          className={
                            user.tier === 'PRO'
                              ? 'bg-blue-600 hover:bg-blue-600 text-white'
                              : 'bg-gray-600 hover:bg-gray-600 text-white'
                          }
                        >
                          {user.tier}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        <span className="text-gray-400 text-sm">
                          {formatDate(user.createdAt)}
                        </span>
                      </td>
                      <td className="py-3 px-4 hidden lg:table-cell">
                        <span className="text-gray-300 text-sm">
                          {user.alertCount}
                        </span>
                      </td>
                      <td className="py-3 px-4 hidden lg:table-cell">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              user.status === 'active'
                                ? 'bg-green-500'
                                : 'bg-red-500'
                            }`}
                          />
                          <span className="text-gray-400 text-sm capitalize">
                            {user.status}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600 disabled:opacity-50"
          >
            Previous
          </Button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <Button
                  key={pageNum}
                  variant={page === pageNum ? 'default' : 'outline'}
                  onClick={() => setPage(pageNum)}
                  className={
                    page === pageNum
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600'
                  }
                  size="sm"
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>

          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600 disabled:opacity-50"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

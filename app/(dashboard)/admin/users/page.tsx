'use client';

import { useCallback, useEffect, useState } from 'react';
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">
          User Management
        </h1>
        <p className="mt-1 text-gray-400">
          View and manage all registered users
        </p>
      </div>

      {/* Filters */}
      <Card className="border-gray-700 bg-gray-800">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            {/* Search */}
            <div className="flex-1">
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSearch(e.target.value)
                }
                className="border-gray-600 bg-gray-700 text-white placeholder:text-gray-400"
              />
            </div>

            {/* Tier Filter */}
            <Select value={tierFilter} onValueChange={handleTierChange}>
              <SelectTrigger className="w-full border-gray-600 bg-gray-700 text-white sm:w-[140px]">
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent className="border-gray-600 bg-gray-700">
                <SelectItem value="ALL">All Tiers</SelectItem>
                <SelectItem value="FREE">FREE</SelectItem>
                <SelectItem value="PRO">PRO</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort By */}
            <Select value={sortBy} onValueChange={handleSortChange}>
              <SelectTrigger className="w-full border-gray-600 bg-gray-700 text-white sm:w-[160px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="border-gray-600 bg-gray-700">
                <SelectItem value="createdAt">Created Date</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="tier">Tier</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort Order Toggle */}
            <Button
              variant="outline"
              onClick={handleSortOrderToggle}
              className="border-gray-600 bg-gray-700 text-white hover:bg-gray-600"
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
      <Card className="border-gray-700 bg-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Users</CardTitle>
          <CardDescription className="text-gray-400">
            All registered users with their tier information
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500" />
            </div>
          ) : error ? (
            <div className="py-8 text-center">
              <p className="mb-4 text-red-400">{error}</p>
              <Button
                onClick={() => void fetchUsers()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Retry
              </Button>
            </div>
          ) : users.length === 0 ? (
            <p className="py-8 text-center text-gray-400">No users found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="px-4 py-3 text-left font-medium text-gray-400">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-400">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-400">
                      Tier
                    </th>
                    <th className="hidden px-4 py-3 text-left font-medium text-gray-400 md:table-cell">
                      Created
                    </th>
                    <th className="hidden px-4 py-3 text-left font-medium text-gray-400 lg:table-cell">
                      Alerts
                    </th>
                    <th className="hidden px-4 py-3 text-left font-medium text-gray-400 lg:table-cell">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-gray-700/50 transition-colors hover:bg-gray-700/30"
                    >
                      <td className="px-4 py-3">
                        <span className="text-white">
                          {user.name || 'No name'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-300">
                          {user.email}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={
                            user.tier === 'PRO'
                              ? 'bg-blue-600 text-white hover:bg-blue-600'
                              : 'bg-gray-600 text-white hover:bg-gray-600'
                          }
                        >
                          {user.tier}
                        </Badge>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <span className="text-sm text-gray-400">
                          {formatDate(user.createdAt)}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        <span className="text-sm text-gray-300">
                          {user.alertCount}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              user.status === 'active'
                                ? 'bg-green-500'
                                : 'bg-red-500'
                            }`}
                          />
                          <span className="text-sm capitalize text-gray-400">
                            {user.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="text-sm text-blue-400 transition-colors hover:text-blue-300"
                        >
                          View Details
                        </Link>
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
            className="border-gray-600 bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-50"
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
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'border-gray-600 bg-gray-700 text-white hover:bg-gray-600'
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
            className="border-gray-600 bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-50"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

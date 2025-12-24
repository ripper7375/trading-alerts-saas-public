'use client';

import { useEffect, useState, useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import type { RiseWorksKycStatus } from '@/types/disbursement';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface RiseWorksAccount {
  id: string;
  affiliateProfileId: string;
  riseId: string;
  email: string;
  kycStatus: RiseWorksKycStatus;
  kycCompletedAt: string | null;
  invitationSentAt: string | null;
  invitationAcceptedAt: string | null;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CreateAccountForm {
  affiliateProfileId: string;
  riseId: string;
  email: string;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getKycStatusBadge(status: RiseWorksKycStatus): React.ReactElement {
  const statusConfig: Record<RiseWorksKycStatus, { className: string; label: string }> = {
    APPROVED: { className: 'bg-green-600', label: 'Approved' },
    PENDING: { className: 'bg-yellow-600', label: 'Pending' },
    SUBMITTED: { className: 'bg-blue-600', label: 'Submitted' },
    REJECTED: { className: 'bg-red-600', label: 'Rejected' },
    EXPIRED: { className: 'bg-gray-600', label: 'Expired' },
  };

  const config = statusConfig[status];

  return (
    <Badge className={`${config.className} text-white text-xs`}>
      {config.label}
    </Badge>
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RISEWORKS ACCOUNTS PAGE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * RiseWorks Accounts Page - Client Component
 *
 * Features:
 * - List of all RiseWorks accounts
 * - KYC status display
 * - Create new account
 * - Sync accounts with RiseWorks
 *
 * Data fetching:
 * - Fetches from /api/disbursement/riseworks/accounts
 * - Creates via POST /api/disbursement/riseworks/accounts
 * - Syncs via POST /api/disbursement/riseworks/sync
 */
export default function RiseWorksAccountsPage(): React.ReactElement {
  const [accounts, setAccounts] = useState<RiseWorksAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateAccountForm>({
    affiliateProfileId: '',
    riseId: '',
    email: '',
  });

  const fetchAccounts = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/disbursement/riseworks/accounts');

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch accounts');
      }

      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAccounts();
  }, [fetchAccounts]);

  const handleSync = async (): Promise<void> => {
    try {
      setIsSyncing(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch('/api/disbursement/riseworks/sync', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to sync accounts');
      }

      const data = await response.json();
      setSuccessMessage(data.message || 'Accounts synced successfully');
      void fetchAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateAccount = async (): Promise<void> => {
    if (!createForm.affiliateProfileId || !createForm.riseId || !createForm.email) {
      setError('All fields are required');
      return;
    }

    try {
      setIsCreating(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch('/api/disbursement/riseworks/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create account');
      }

      setSuccessMessage('Account created successfully');
      setShowCreateModal(false);
      setCreateForm({ affiliateProfileId: '', riseId: '', email: '' });
      void fetchAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setIsCreating(false);
    }
  };

  // Count by status
  const statusCounts = accounts.reduce(
    (acc, account) => {
      acc[account.kycStatus] = (acc[account.kycStatus] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            RiseWorks Accounts
          </h1>
          <p className="text-gray-400 mt-1">
            Manage affiliate RiseWorks payment accounts
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => void handleSync()}
            variant="outline"
            disabled={isSyncing}
          >
            {isSyncing ? 'Syncing...' : 'Sync All'}
          </Button>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-green-600 hover:bg-green-700"
          >
            Create Account
          </Button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <Card className="bg-red-900/50 border-red-600">
          <CardContent className="py-4">
            <p className="text-red-300">{error}</p>
          </CardContent>
        </Card>
      )}

      {successMessage && (
        <Card className="bg-green-900/50 border-green-600">
          <CardContent className="py-4">
            <p className="text-green-300">{successMessage}</p>
          </CardContent>
        </Card>
      )}

      {/* Status Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-400">Total</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{accounts.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-400">Approved</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">{statusCounts['APPROVED'] || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-400">Pending</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-400">{statusCounts['PENDING'] || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-400">Submitted</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">{statusCounts['SUBMITTED'] || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-400">Rejected</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">{statusCounts['REJECTED'] || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Accounts Table */}
      {accounts.length > 0 ? (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              All Accounts
              <Badge className="bg-gray-600">{accounts.length}</Badge>
            </CardTitle>
            <CardDescription className="text-gray-400">
              RiseWorks blockchain payment accounts for affiliates
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Email</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Rise ID</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">KYC Status</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Invitation</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Last Sync</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr
                      key={account.id}
                      className="border-b border-gray-700/50 hover:bg-gray-700/30"
                    >
                      <td className="py-3 px-4">
                        <span className="text-white">{account.email}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-gray-400 font-mono text-xs">
                          {account.riseId.slice(0, 10)}...{account.riseId.slice(-6)}
                        </span>
                      </td>
                      <td className="py-3 px-4">{getKycStatusBadge(account.kycStatus)}</td>
                      <td className="py-3 px-4">
                        {account.invitationAcceptedAt ? (
                          <Badge className="bg-green-600 text-xs">Accepted</Badge>
                        ) : account.invitationSentAt ? (
                          <Badge className="bg-yellow-600 text-xs">Sent</Badge>
                        ) : (
                          <Badge className="bg-gray-600 text-xs">Not Sent</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-xs">
                        {account.lastSyncAt ? formatDate(account.lastSyncAt) : 'Never'}
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-xs">
                        {formatDate(account.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="py-12 text-center">
            <p className="text-gray-400 mb-4">No RiseWorks accounts found.</p>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              Create First Account
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Account Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="bg-gray-800 border-gray-700 max-w-md w-full">
            <CardHeader>
              <CardTitle className="text-white">Create RiseWorks Account</CardTitle>
              <CardDescription className="text-gray-400">
                Link an affiliate to a RiseWorks wallet
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Affiliate Profile ID
                </label>
                <input
                  type="text"
                  value={createForm.affiliateProfileId}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, affiliateProfileId: e.target.value })
                  }
                  placeholder="clp123abc456def"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Rise ID (Wallet Address)
                </label>
                <input
                  type="text"
                  value={createForm.riseId}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, riseId: e.target.value })
                  }
                  placeholder="0xA35b2F326F07a7C92BedB0D318C237F30948E425"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, email: e.target.value })
                  }
                  placeholder="affiliate@example.com"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateForm({ affiliateProfileId: '', riseId: '', email: '' });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => void handleCreateAccount()}
                  disabled={isCreating}
                >
                  {isCreating ? 'Creating...' : 'Create Account'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Info Card */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">About RiseWorks Accounts</CardTitle>
        </CardHeader>
        <CardContent className="text-gray-300 space-y-3">
          <p className="text-sm text-gray-400">
            RiseWorks accounts link affiliates to blockchain wallets for receiving USDC payments.
          </p>

          <div>
            <h4 className="font-medium text-white mb-1">KYC Status</h4>
            <ul className="list-disc list-inside text-sm text-gray-400 space-y-1">
              <li><strong>PENDING:</strong> Account created, awaiting KYC submission</li>
              <li><strong>SUBMITTED:</strong> KYC documents submitted, under review</li>
              <li><strong>APPROVED:</strong> KYC verified, can receive payments</li>
              <li><strong>REJECTED:</strong> KYC rejected, needs resubmission</li>
              <li><strong>EXPIRED:</strong> KYC expired, needs renewal</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-white mb-1">Sync</h4>
            <p className="text-sm text-gray-400">
              Syncing updates KYC status and account information from RiseWorks API.
              This runs automatically via cron job daily.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

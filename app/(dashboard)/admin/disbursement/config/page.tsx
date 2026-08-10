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
import { formatCurrency } from '@/lib/utils';
import type { DisbursementProvider } from '@/types/disbursement';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface DisbursementConfig {
  provider: {
    default: DisbursementProvider;
    available: DisbursementProvider[];
    riseEnabled: boolean;
    wiseEnabled: boolean;
  };
  enabled: boolean;
  minimumPayout: number;
  batchSize: number;
  environment: string;
}

const PROVIDER_BADGE_CLASS: Record<DisbursementProvider, string> = {
  MOCK: 'bg-gray-600',
  RISE: 'bg-green-600',
  WISE: 'bg-blue-600',
};

const PROVIDER_LABEL: Record<DisbursementProvider, string> = {
  MOCK: 'MOCK (Testing)',
  RISE: 'RISE (RiseWorks — archived)',
  WISE: 'WISE (Wise)',
};

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIGURATION PAGE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Disbursement Configuration Page - Client Component
 *
 * Features:
 * - View current configuration
 * - Update configuration settings
 * - Provider selection (MOCK/RISE/WISE)
 * - Minimum payout and batch size settings
 *
 * Data fetching:
 * - Fetches from /api/disbursement/config
 * - Updates via PATCH /api/disbursement/config
 *
 * The active provider is read-only in practice: it is driven by the
 * `DISBURSEMENT_PROVIDER` environment variable on whichever service actually
 * executes batches (money-service, for WISE — see Session 4A-W7). The Save
 * button below persists `enabled`/`minimumPayout`/`batchSize` only; changing
 * the provider selection and saving does NOT switch the live provider, since
 * `PATCH /api/disbursement/config` is a logging placeholder (no database-
 * backed configuration exists yet). The badge below the provider display
 * makes this explicit rather than implying a live switch happened.
 */
export default function ConfigurationPage(): React.ReactElement {
  const [config, setConfig] = useState<DisbursementConfig | null>(null);
  const [editConfig, setEditConfig] = useState<DisbursementConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const fetchConfig = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/disbursement/config');

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch configuration');
      }

      const data = await response.json();
      setConfig(data.config);
      setEditConfig(data.config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  const handleSave = async (): Promise<void> => {
    if (!editConfig) return;

    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch('/api/disbursement/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: editConfig.enabled,
          minimumPayout: editConfig.minimumPayout,
          batchSize: editConfig.batchSize,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update configuration');
      }

      setSuccessMessage(
        'Settings noted. Provider is env-var-driven and unaffected by this form — see the notice below.'
      );
      setIsEditing(false);
      await fetchConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = (): void => {
    setEditConfig(config);
    setIsEditing(false);
    setError(null);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-green-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            Configuration
          </h1>
          <p className="mt-1 text-gray-400">Disbursement system settings</p>
        </div>
        <div className="flex gap-2">
          {!isEditing ? (
            <Button
              onClick={() => setIsEditing(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              Edit Configuration
            </Button>
          ) : (
            <>
              <Button
                onClick={handleCancel}
                variant="outline"
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleSave()}
                className="bg-green-600 hover:bg-green-700"
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <Card className="border-red-600 bg-red-900/50">
          <CardContent className="py-4">
            <p className="text-red-300">{error}</p>
          </CardContent>
        </Card>
      )}

      {successMessage && (
        <Card className="border-green-600 bg-green-900/50">
          <CardContent className="py-4">
            <p className="text-green-300">{successMessage}</p>
          </CardContent>
        </Card>
      )}

      {/* Current Configuration Display */}
      {!isEditing && config && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-gray-700 bg-gray-800">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400">
                Provider
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Badge className={PROVIDER_BADGE_CLASS[config.provider.default]}>
                {config.provider.default}
              </Badge>
              <p className="text-xs text-gray-500">
                Configured via <code>DISBURSEMENT_PROVIDER</code> env var
              </p>
            </CardContent>
          </Card>

          <Card className="border-gray-700 bg-gray-800">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400">
                Status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Badge className={config.enabled ? 'bg-green-600' : 'bg-red-600'}>
                {config.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </CardContent>
          </Card>

          <Card className="border-gray-700 bg-gray-800">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400">
                Minimum Payout
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {formatCurrency(config.minimumPayout)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-700 bg-gray-800">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400">
                Batch Size
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {config.batchSize}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Form */}
      {isEditing && editConfig && (
        <Card className="border-gray-700 bg-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Edit Configuration</CardTitle>
            <CardDescription className="text-gray-400">
              Update disbursement system settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Provider Selection */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Payment Provider
              </label>
              <div className="flex flex-wrap gap-4">
                {(['MOCK', 'RISE', 'WISE'] as const).map((provider) => {
                  const isAvailable =
                    editConfig.provider.available.includes(provider);
                  return (
                    <label
                      key={provider}
                      className={`flex items-center gap-2 ${
                        isAvailable
                          ? 'cursor-pointer'
                          : 'cursor-not-allowed opacity-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="provider"
                        value={provider}
                        disabled={!isAvailable}
                        checked={editConfig.provider.default === provider}
                        onChange={(e) =>
                          setEditConfig({
                            ...editConfig,
                            provider: {
                              ...editConfig.provider,
                              default: e.target.value as DisbursementProvider,
                            },
                          })
                        }
                        className="text-green-600"
                      />
                      <span className="text-white">
                        {PROVIDER_LABEL[provider]}
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="mt-2 rounded-lg border border-blue-600/50 bg-blue-900/30 p-3">
                <p className="text-xs text-blue-300">
                  <strong>
                    Configured via <code>DISBURSEMENT_PROVIDER</code> env var.
                  </strong>{' '}
                  This selection is informational — Save does not change the
                  live provider. The active provider is set by the environment
                  variable on the service that executes batches (money-service
                  for WISE) and takes effect on redeploy.
                </p>
              </div>
            </div>

            {/* Enabled Toggle */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Disbursement Status
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={editConfig.enabled}
                  onChange={(e) =>
                    setEditConfig({ ...editConfig, enabled: e.target.checked })
                  }
                  className="rounded text-green-600"
                />
                <span className="text-white">Enable disbursements</span>
              </label>
              <p className="mt-1 text-xs text-gray-500">
                When disabled, no new batches can be created or executed.
              </p>
            </div>

            {/* Minimum Payout */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Minimum Payout (USD)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={editConfig.minimumPayout}
                onChange={(e) =>
                  setEditConfig({
                    ...editConfig,
                    minimumPayout: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Affiliates must have at least this amount to receive a payout.
              </p>
            </div>

            {/* Batch Size */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Maximum Batch Size
              </label>
              <input
                type="number"
                min="1"
                max="500"
                value={editConfig.batchSize}
                onChange={(e) =>
                  setEditConfig({
                    ...editConfig,
                    batchSize: parseInt(e.target.value) || 100,
                  })
                }
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Maximum number of payments per batch (1-500).
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration Info */}
      <Card className="border-gray-700 bg-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Configuration Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-gray-300">
          <div>
            <h4 className="mb-1 font-medium text-white">Payment Provider</h4>
            <ul className="list-inside list-disc space-y-1 text-sm text-gray-400">
              <li>
                <strong>MOCK:</strong> Simulates payments instantly. Use for
                development and testing.
              </li>
              <li>
                <strong>RISE:</strong> RiseWorks blockchain provider. Archived
                (Session 4A-W1) — no longer live.
              </li>
              <li>
                <strong>WISE:</strong> Wise payout provider. Live in production
                since Session 4A-W7; batches execute through money-service.
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-1 font-medium text-white">Minimum Payout</h4>
            <p className="text-sm text-gray-400">
              The minimum commission balance required before an affiliate
              becomes eligible for payout. This helps reduce transaction fees
              for small amounts.
            </p>
          </div>

          <div>
            <h4 className="mb-1 font-medium text-white">Batch Size</h4>
            <p className="text-sm text-gray-400">
              Maximum number of payments to include in a single batch. Larger
              batches are more efficient but take longer to process.
            </p>
          </div>

          <div className="rounded-lg border border-yellow-600/50 bg-yellow-900/30 p-3">
            <p className="text-sm text-yellow-400">
              <strong>Note:</strong> The provider field above reflects the
              current <code>DISBURSEMENT_PROVIDER</code> environment variable
              and cannot be changed from this page. Real WISE payouts move real
              money — provider changes must go through a deliberate
              environment-variable update and redeploy, not this form.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

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
  provider: DisbursementProvider;
  enabled: boolean;
  minimumPayout: number;
  batchSize: number;
  environment: 'production' | 'staging';
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIGURATION PAGE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Disbursement Configuration Page - Client Component
 *
 * Features:
 * - View current configuration
 * - Update configuration settings
 * - Provider selection (MOCK/RISE)
 * - Minimum payout and batch size settings
 *
 * Data fetching:
 * - Fetches from /api/disbursement/config
 * - Updates via PATCH /api/disbursement/config
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
        body: JSON.stringify(editConfig),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update configuration');
      }

      const data = await response.json();
      setConfig(data.config);
      setEditConfig(data.config);
      setSuccessMessage('Configuration updated successfully');
      setIsEditing(false);
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
            Configuration
          </h1>
          <p className="text-gray-400 mt-1">
            Disbursement system settings
          </p>
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

      {/* Current Configuration Display */}
      {!isEditing && config && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400">Provider</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge className={config.provider === 'RISE' ? 'bg-green-600' : 'bg-gray-600'}>
                {config.provider}
              </Badge>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400">Status</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge className={config.enabled ? 'bg-green-600' : 'bg-red-600'}>
                {config.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400">Minimum Payout</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {formatCurrency(config.minimumPayout)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400">Batch Size</CardDescription>
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
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Edit Configuration</CardTitle>
            <CardDescription className="text-gray-400">
              Update disbursement system settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Provider Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Payment Provider
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="provider"
                    value="MOCK"
                    checked={editConfig.provider === 'MOCK'}
                    onChange={(e) =>
                      setEditConfig({ ...editConfig, provider: e.target.value as DisbursementProvider })
                    }
                    className="text-green-600"
                  />
                  <span className="text-white">MOCK (Testing)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="provider"
                    value="RISE"
                    checked={editConfig.provider === 'RISE'}
                    onChange={(e) =>
                      setEditConfig({ ...editConfig, provider: e.target.value as DisbursementProvider })
                    }
                    className="text-green-600"
                  />
                  <span className="text-white">RISE (RiseWorks)</span>
                </label>
              </div>
              <p className="text-gray-500 text-xs mt-1">
                MOCK provider simulates payments for testing. RISE uses RiseWorks blockchain.
              </p>
            </div>

            {/* Enabled Toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Disbursement Status
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
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
              <p className="text-gray-500 text-xs mt-1">
                When disabled, no new batches can be created or executed.
              </p>
            </div>

            {/* Minimum Payout */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Minimum Payout (USD)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={editConfig.minimumPayout}
                onChange={(e) =>
                  setEditConfig({ ...editConfig, minimumPayout: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-gray-500 text-xs mt-1">
                Affiliates must have at least this amount to receive a payout.
              </p>
            </div>

            {/* Batch Size */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Maximum Batch Size
              </label>
              <input
                type="number"
                min="1"
                max="500"
                value={editConfig.batchSize}
                onChange={(e) =>
                  setEditConfig({ ...editConfig, batchSize: parseInt(e.target.value) || 100 })
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-gray-500 text-xs mt-1">
                Maximum number of payments per batch (1-500).
              </p>
            </div>

            {/* Environment */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Environment
              </label>
              <select
                value={editConfig.environment}
                onChange={(e) =>
                  setEditConfig({
                    ...editConfig,
                    environment: e.target.value as 'production' | 'staging',
                  })
                }
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>
              <p className="text-gray-500 text-xs mt-1">
                Production environment processes real payments. Use staging for testing.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration Info */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Configuration Guide</CardTitle>
        </CardHeader>
        <CardContent className="text-gray-300 space-y-3">
          <div>
            <h4 className="font-medium text-white mb-1">Payment Provider</h4>
            <ul className="list-disc list-inside text-sm text-gray-400 space-y-1">
              <li><strong>MOCK:</strong> Simulates payments instantly. Use for development and testing.</li>
              <li><strong>RISE:</strong> RiseWorks blockchain provider. Sends USDC to affiliates.</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-white mb-1">Minimum Payout</h4>
            <p className="text-sm text-gray-400">
              The minimum commission balance required before an affiliate becomes eligible for payout.
              This helps reduce transaction fees for small amounts.
            </p>
          </div>

          <div>
            <h4 className="font-medium text-white mb-1">Batch Size</h4>
            <p className="text-sm text-gray-400">
              Maximum number of payments to include in a single batch.
              Larger batches are more efficient but take longer to process.
            </p>
          </div>

          <div className="bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-3">
            <p className="text-yellow-400 text-sm">
              <strong>Warning:</strong> Changing the provider to RISE in production will trigger real
              blockchain transactions. Ensure all RiseWorks API credentials are properly configured.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

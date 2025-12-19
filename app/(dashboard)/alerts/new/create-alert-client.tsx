'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import type { Tier } from '@/lib/tier-config';

/**
 * Props for CreateAlertClient component
 */
interface CreateAlertClientProps {
  userTier: Tier;
  limit: number;
  currentCount: number;
  canCreate: boolean;
  availableSymbols: string[];
  availableTimeframes: string[];
}

/**
 * Condition type options
 */
const CONDITION_TYPES = [
  {
    value: 'price_above',
    label: 'Price Above',
    description: 'Triggers when price goes above target',
  },
  {
    value: 'price_below',
    label: 'Price Below',
    description: 'Triggers when price goes below target',
  },
  {
    value: 'price_equals',
    label: 'Price Equals',
    description: 'Triggers when price equals target (0.5% tolerance)',
  },
] as const;

type ConditionType = (typeof CONDITION_TYPES)[number]['value'];

/**
 * CreateAlertClient Component
 *
 * Client-side form for creating new price alerts.
 */
export function CreateAlertClient({
  userTier,
  limit,
  currentCount,
  canCreate,
  availableSymbols,
  availableTimeframes,
}: CreateAlertClientProps): React.JSX.Element {
  const router = useRouter();

  // Form state
  const [symbol, setSymbol] = useState<string>('');
  const [timeframe, setTimeframe] = useState<string>('');
  const [conditionType, setConditionType] =
    useState<ConditionType>('price_above');
  const [targetValue, setTargetValue] = useState<string>('');
  const [alertName, setAlertName] = useState<string>('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Progress percentage
  const progressPercent = (currentCount / limit) * 100;

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);

    // Validate form
    if (!symbol) {
      setError('Please select a symbol');
      return;
    }
    if (!timeframe) {
      setError('Please select a timeframe');
      return;
    }
    if (!targetValue || parseFloat(targetValue) <= 0) {
      setError('Please enter a valid target price');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          timeframe,
          conditionType,
          targetValue: parseFloat(targetValue),
          name: alertName || `${symbol} ${timeframe} Alert`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create alert');
      }

      // Redirect to alerts list on success
      router.push('/alerts');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create alert');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render upgrade prompt if at limit
  if (!canCreate) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-sm text-gray-500 mb-4">
            Dashboard &gt; Alerts &gt; New Alert
          </div>

          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-8 text-center">
              <div className="text-6xl mb-4">x</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Alert Limit Reached
              </h2>
              <p className="text-gray-600 mb-6">
                You have reached your {userTier} tier limit of {limit} active
                alerts.
                {userTier === 'FREE' && ' Upgrade to PRO for 20 alerts.'}
              </p>
              <div className="flex gap-4 justify-center">
                {userTier === 'FREE' && (
                  <Link href="/pricing">
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                      Upgrade to PRO
                    </Button>
                  </Link>
                )}
                <Link href="/alerts">
                  <Button variant="outline">Manage Existing Alerts</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Breadcrumb */}
        <div className="text-sm text-gray-500 mb-4">
          Dashboard &gt;{' '}
          <Link href="/alerts" className="hover:text-blue-600">
            Alerts
          </Link>{' '}
          &gt; New Alert
        </div>

        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Create Price Alert</h1>
          <p className="text-gray-600">
            Get notified when price reaches your target
          </p>
        </div>

        {/* Alert Limit Progress */}
        <Card
          className={`mb-6 ${progressPercent >= 80 ? 'border-yellow-300' : 'border-gray-200'}`}
        >
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">
                Alert Usage: {currentCount}/{limit}
              </span>
              <span className="text-sm text-gray-500">{userTier} Tier</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            {userTier === 'FREE' && currentCount >= limit - 1 && (
              <p className="text-sm text-yellow-600 mt-2">
                You have {limit - currentCount} alert
                {limit - currentCount !== 1 ? 's' : ''} remaining.{' '}
                <Link href="/pricing" className="underline">
                  Upgrade to PRO
                </Link>{' '}
                for more.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Create Alert Form */}
        <Card>
          <CardHeader>
            <CardTitle>Alert Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              {/* Symbol Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Symbol <span className="text-red-500">*</span>
                </label>
                <Select value={symbol} onValueChange={setSymbol}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a symbol" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSymbols.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  {availableSymbols.length} symbols available on {userTier} tier
                </p>
              </div>

              {/* Timeframe Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Timeframe <span className="text-red-500">*</span>
                </label>
                <Select value={timeframe} onValueChange={setTimeframe}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a timeframe" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTimeframes.map((tf) => (
                      <SelectItem key={tf} value={tf}>
                        {tf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Condition Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Condition Type <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {CONDITION_TYPES.map((type) => (
                    <div
                      key={type.value}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        conditionType === type.value
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                      onClick={() => setConditionType(type.value)}
                    >
                      <div className="flex items-center">
                        <input
                          type="radio"
                          name="conditionType"
                          value={type.value}
                          checked={conditionType === type.value}
                          onChange={() => setConditionType(type.value)}
                          className="h-4 w-4 text-blue-600"
                        />
                        <span className="ml-2 font-medium">{type.label}</span>
                      </div>
                      <p className="ml-6 text-sm text-gray-500">
                        {type.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Target Value */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Price <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    $
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    placeholder="Enter target price"
                    className="pl-8"
                  />
                </div>
                {conditionType === 'price_equals' && (
                  <p className="text-xs text-gray-500 mt-1">
                    Alert will trigger when price is within 0.5% of target
                  </p>
                )}
              </div>

              {/* Alert Name (Optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Alert Name <span className="text-gray-400">(optional)</span>
                </label>
                <Input
                  type="text"
                  value={alertName}
                  onChange={(e) => setAlertName(e.target.value)}
                  placeholder={
                    symbol && timeframe
                      ? `${symbol} ${timeframe} Alert`
                      : 'Enter alert name'
                  }
                  maxLength={100}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Give your alert a memorable name
                </p>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-4 pt-4 border-t">
                <Link href="/alerts" className="flex-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                </Link>
                <Button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Creating...' : 'Create Alert'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

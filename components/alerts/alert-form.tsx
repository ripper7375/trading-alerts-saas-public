'use client';

import { useState } from 'react';

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
 * Alert form data
 */
export interface AlertFormData {
  symbol: string;
  timeframe: string;
  conditionType: ConditionType;
  targetValue: number;
  name: string;
}

/**
 * Props for AlertForm component
 */
interface AlertFormProps {
  availableSymbols: string[];
  availableTimeframes: string[];
  userTier: Tier;
  currentCount: number;
  limit: number;
  initialData?: Partial<AlertFormData>;
  isEditing?: boolean;
  onSubmit: (data: AlertFormData) => Promise<void>;
  onCancel: () => void;
}

/**
 * AlertForm Component
 *
 * Reusable form component for creating and editing price alerts.
 * Includes tier-filtered symbol/timeframe selectors.
 */
export function AlertForm({
  availableSymbols,
  availableTimeframes,
  userTier,
  currentCount,
  limit,
  initialData,
  isEditing = false,
  onSubmit,
  onCancel,
}: AlertFormProps): React.JSX.Element {
  // Form state
  const [symbol, setSymbol] = useState<string>(initialData?.symbol || '');
  const [timeframe, setTimeframe] = useState<string>(
    initialData?.timeframe || ''
  );
  const [conditionType, setConditionType] = useState<ConditionType>(
    initialData?.conditionType || 'price_above'
  );
  const [targetValue, setTargetValue] = useState<string>(
    initialData?.targetValue?.toString() || ''
  );
  const [alertName, setAlertName] = useState<string>(initialData?.name || '');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Progress percentage
  const progressPercent = (currentCount / limit) * 100;
  const canCreate = currentCount < limit || isEditing;

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
      await onSubmit({
        symbol,
        timeframe,
        conditionType,
        targetValue: parseFloat(targetValue),
        name: alertName || `${symbol} ${timeframe} Alert`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save alert');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? 'Edit Alert' : 'Create Alert'}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Alert Limit Progress */}
        {!isEditing && (
          <div
            className={`mb-6 p-4 rounded-lg border ${
              progressPercent >= 80
                ? 'border-yellow-300 bg-yellow-50'
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">
                Alert Usage: {currentCount}/{limit}
              </span>
              <span className="text-sm text-gray-500">{userTier} Tier</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            {!canCreate && (
              <p className="text-sm text-red-600 mt-2">
                You have reached your alert limit. Upgrade to PRO for more.
              </p>
            )}
          </div>
        )}

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
            <Select
              value={symbol}
              onValueChange={setSymbol}
              disabled={isEditing}
            >
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
            <Select
              value={timeframe}
              onValueChange={setTimeframe}
              disabled={isEditing}
            >
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

          {/* Alert Name */}
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
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-4 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isSubmitting || !canCreate}
            >
              {isSubmitting
                ? 'Saving...'
                : isEditing
                  ? 'Save Changes'
                  : 'Create Alert'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

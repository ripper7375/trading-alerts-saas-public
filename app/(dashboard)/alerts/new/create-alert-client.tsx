'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

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
 * Form validation schema
 */
const createAlertFormSchema = z.object({
  symbol: z.string().min(1, 'Please select a symbol'),
  timeframe: z.string().min(1, 'Please select a timeframe'),
  conditionType: z.enum(['price_above', 'price_below', 'price_equals'], {
    required_error: 'Please select a condition type',
  }),
  targetValue: z
    .string()
    .min(1, 'Please enter a target price')
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: 'Target price must be a positive number',
    })
    .refine((val) => parseFloat(val) <= 1000000, {
      message: 'Target price must not exceed 1,000,000',
    }),
  alertName: z
    .string()
    .max(100, 'Alert name must not exceed 100 characters')
    .optional(),
});

type CreateAlertFormData = z.infer<typeof createAlertFormSchema>;

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

  // React Hook Form with Zod validation
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateAlertFormData>({
    resolver: zodResolver(createAlertFormSchema),
    defaultValues: {
      symbol: '',
      timeframe: '',
      conditionType: 'price_above',
      targetValue: '',
      alertName: '',
    },
  });

  // Watch values for dynamic UI
  const symbol = watch('symbol');
  const timeframe = watch('timeframe');
  const conditionType = watch('conditionType');

  // Server error state
  const [serverError, setServerError] = useState<string | null>(null);

  // Progress percentage
  const progressPercent = (currentCount / limit) * 100;

  // Handle form submission
  const onSubmit = async (data: CreateAlertFormData): Promise<void> => {
    setServerError(null);

    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: data.symbol,
          timeframe: data.timeframe,
          conditionType: data.conditionType,
          targetValue: parseFloat(data.targetValue),
          name: data.alertName || `${data.symbol} ${data.timeframe} Alert`,
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to create alert');
      }

      // Redirect to alerts list on success
      router.push('/alerts');
      router.refresh();
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Failed to create alert'
      );
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
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Server Error Message */}
              {serverError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {serverError}
                </div>
              )}

              {/* Symbol Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Symbol <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="symbol"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        className={errors.symbol ? 'border-red-500' : ''}
                      >
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
                  )}
                />
                {errors.symbol && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.symbol.message}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  {availableSymbols.length} symbols available on {userTier} tier
                </p>
              </div>

              {/* Timeframe Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Timeframe <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="timeframe"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        className={errors.timeframe ? 'border-red-500' : ''}
                      >
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
                  )}
                />
                {errors.timeframe && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.timeframe.message}
                  </p>
                )}
              </div>

              {/* Condition Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Condition Type <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="conditionType"
                  control={control}
                  render={({ field }) => (
                    <div className="space-y-2">
                      {CONDITION_TYPES.map((type) => (
                        <div
                          key={type.value}
                          className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            field.value === type.value
                              ? 'border-blue-600 bg-blue-50'
                              : 'border-gray-200 hover:border-blue-300'
                          }`}
                          onClick={() => field.onChange(type.value)}
                        >
                          <div className="flex items-center">
                            <input
                              type="radio"
                              name="conditionType"
                              value={type.value}
                              checked={field.value === type.value}
                              onChange={() => field.onChange(type.value)}
                              className="h-4 w-4 text-blue-600"
                            />
                            <span className="ml-2 font-medium">
                              {type.label}
                            </span>
                          </div>
                          <p className="ml-6 text-sm text-gray-500">
                            {type.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                />
                {errors.conditionType && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.conditionType.message}
                  </p>
                )}
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
                    placeholder="Enter target price"
                    className={`pl-8 ${errors.targetValue ? 'border-red-500' : ''}`}
                    {...register('targetValue')}
                  />
                </div>
                {errors.targetValue && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.targetValue.message}
                  </p>
                )}
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
                  placeholder={
                    symbol && timeframe
                      ? `${symbol} ${timeframe} Alert`
                      : 'Enter alert name'
                  }
                  maxLength={100}
                  className={errors.alertName ? 'border-red-500' : ''}
                  {...register('alertName')}
                />
                {errors.alertName && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.alertName.message}
                  </p>
                )}
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

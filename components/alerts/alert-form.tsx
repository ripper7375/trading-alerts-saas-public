'use client';

import { useEffect, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { SYMBOLS, TIMEFRAMES, type Tier } from '@/lib/tier-config';

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
 * Shape of GET /api/tier/symbols
 */
interface TierSymbolsResponse {
  success: boolean;
  symbols: string[];
}

/**
 * Shape of GET /api/tier/combinations
 */
interface TierCombinationsResponse {
  success: boolean;
  timeframes: Array<{ value: string; label: string; proOnly: boolean }>;
}

/**
 * Shape of GET /api/tier/check/[symbol]
 */
interface TierCheckResponse {
  success: boolean;
  allowed: boolean;
  reason?: string;
}

/**
 * Props for AlertForm component
 */
interface AlertFormProps {
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
 * Symbol/timeframe options and per-symbol access are driven live from
 * `GET /api/tier/symbols`, `GET /api/tier/combinations`, and
 * `GET /api/tier/check/[symbol]` (Session 6-3, A1-11) rather than a
 * hardcoded list — falls back to the same `lib/tier-config.ts` constants
 * those endpoints themselves read from if a fetch fails.
 */
export function AlertForm({
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

  // Tier-endpoint-driven data (A1-11): available symbols/timeframes
  const [availableSymbols, setAvailableSymbols] = useState<string[]>([]);
  const [availableTimeframes, setAvailableTimeframes] = useState<string[]>([]);
  const [tierDataLoading, setTierDataLoading] = useState(true);
  const [tierDataError, setTierDataError] = useState<string | null>(null);

  // Real-time symbol access validation (GET /api/tier/check/[symbol])
  const [symbolCheck, setSymbolCheck] = useState<TierCheckResponse | null>(
    null
  );

  // Fetch available symbols + timeframes from the live tier endpoints
  useEffect(() => {
    let cancelled = false;

    async function loadTierData(): Promise<void> {
      try {
        const [symbolsRes, combosRes] = await Promise.all([
          fetch('/api/tier/symbols'),
          fetch('/api/tier/combinations'),
        ]);
        const symbolsBody: TierSymbolsResponse = await symbolsRes.json();
        const combosBody: TierCombinationsResponse = await combosRes.json();

        if (cancelled) return;

        if (symbolsRes.ok && symbolsBody.success) {
          setAvailableSymbols(symbolsBody.symbols);
        } else {
          setAvailableSymbols([...SYMBOLS]);
        }

        if (combosRes.ok && combosBody.success) {
          setAvailableTimeframes(combosBody.timeframes.map((tf) => tf.value));
        } else {
          setAvailableTimeframes([...TIMEFRAMES]);
        }
      } catch {
        if (cancelled) return;
        // Defensive fallback: these are the same constants the endpoints
        // themselves read from, not invented data.
        setAvailableSymbols([...SYMBOLS]);
        setAvailableTimeframes([...TIMEFRAMES]);
        setTierDataError(
          'Could not load the latest symbol list — showing defaults.'
        );
      } finally {
        if (!cancelled) setTierDataLoading(false);
      }
    }

    void loadTierData();
    return () => {
      cancelled = true;
    };
  }, []);

  // Real-time tier access validation whenever the chosen symbol changes
  useEffect(() => {
    if (!symbol) {
      setSymbolCheck(null);
      return;
    }

    let cancelled = false;

    async function checkAccess(): Promise<void> {
      try {
        const res = await fetch(
          `/api/tier/check/${encodeURIComponent(symbol)}`
        );
        const body: TierCheckResponse = await res.json();
        if (cancelled) return;
        if (res.ok && body.success) {
          setSymbolCheck(body);
        } else {
          setSymbolCheck(null);
        }
      } catch {
        if (!cancelled) setSymbolCheck(null);
      }
    }

    void checkAccess();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  // Progress percentage
  const progressPercent = (currentCount / limit) * 100;
  const canCreate = currentCount < limit || isEditing;
  const symbolDenied = symbolCheck !== null && symbolCheck.allowed === false;

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
    if (symbolDenied) {
      setError(symbolCheck?.reason || 'This symbol is not accessible');
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
    <Card className="border-slate-200 bg-white/90 backdrop-blur-xl dark:border-slate-800/80 dark:bg-[#090b14]/90">
      <CardHeader>
        <CardTitle className="text-slate-900 dark:text-slate-100">
          {isEditing ? 'Edit Alert' : 'Create Alert'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Alert Limit Progress */}
        {!isEditing && (
          <div
            className={`mb-6 rounded-xl border p-4 ${
              progressPercent >= 80
                ? 'border-amber-500/40 bg-amber-500/10'
                : 'bg-muted/50 border-border'
            }`}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                Alert Usage: {currentCount}/{limit}
              </span>
              <span className="text-sm text-muted-foreground">
                {userTier} Tier
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            {!canCreate && (
              <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">
                You have reached your alert limit. Upgrade to PRO for more.
              </p>
            )}
          </div>
        )}

        {isEditing && (
          <p className="mb-6 text-sm text-muted-foreground">
            Symbol, timeframe, and condition type can&apos;t be changed after
            creation — delete and recreate the alert instead.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error Message */}
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/30 bg-rose-50 px-4 py-3 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
            >
              {error}
            </div>
          )}

          {/* Tier data load warning (non-blocking, defensive fallback in use) */}
          {tierDataError && (
            <div
              role="status"
              className="rounded-xl border border-amber-500/30 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
            >
              {tierDataError}
            </div>
          )}

          {/* Symbol access denied banner (GET /api/tier/check/[symbol]) */}
          {symbolDenied && (
            <div
              role="alert"
              className="rounded-xl border border-amber-500/30 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
            >
              {symbolCheck?.reason ||
                'This symbol is not accessible on your tier.'}
            </div>
          )}

          {/* Symbol Selector */}
          <div>
            <label
              htmlFor="alert-symbol"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Symbol <span className="text-rose-500">*</span>
            </label>
            {tierDataLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select
                value={symbol}
                onValueChange={setSymbol}
                disabled={isEditing}
              >
                <SelectTrigger id="alert-symbol" aria-label="Symbol">
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
            <p className="mt-1 text-xs text-gray-500">
              {availableSymbols.length} symbol
              {availableSymbols.length === 1 ? '' : 's'} available on {userTier}{' '}
              tier
            </p>
          </div>

          {/* Timeframe Selector */}
          <div>
            <label
              htmlFor="alert-timeframe"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Timeframe <span className="text-rose-500">*</span>
            </label>
            {tierDataLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select
                value={timeframe}
                onValueChange={setTimeframe}
                disabled={isEditing}
              >
                <SelectTrigger id="alert-timeframe" aria-label="Timeframe">
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
          </div>

          {/* Condition Type */}
          <fieldset disabled={isEditing}>
            <legend className="mb-2 block text-sm font-medium text-foreground">
              Condition Type <span className="text-rose-500">*</span>
            </legend>
            <div className="space-y-2">
              {CONDITION_TYPES.map((type) => (
                <div
                  key={type.value}
                  className={`rounded-xl border-2 p-4 transition-all ${
                    isEditing
                      ? 'cursor-not-allowed opacity-60'
                      : 'cursor-pointer'
                  } ${
                    conditionType === type.value
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-border hover:border-amber-500/40'
                  }`}
                  onClick={() => !isEditing && setConditionType(type.value)}
                >
                  <div className="flex items-center">
                    <input
                      type="radio"
                      name="conditionType"
                      id={`condition-${type.value}`}
                      value={type.value}
                      checked={conditionType === type.value}
                      onChange={() => setConditionType(type.value)}
                      disabled={isEditing}
                      className="h-4 w-4 text-amber-600"
                    />
                    <label
                      htmlFor={`condition-${type.value}`}
                      className="ml-2 font-medium text-foreground"
                    >
                      {type.label}
                    </label>
                  </div>
                  <p className="ml-6 text-sm text-muted-foreground">
                    {type.description}
                  </p>
                </div>
              ))}
            </div>
          </fieldset>

          {/* Target Value */}
          <div>
            <label
              htmlFor="alert-target-value"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Target Price <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="alert-target-value"
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
              <p className="mt-1 text-xs text-muted-foreground">
                Alert will trigger when price is within 0.5% of target
              </p>
            )}
          </div>

          {/* Alert Name */}
          <div>
            <label
              htmlFor="alert-name"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Alert Name{' '}
              <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="alert-name"
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
          <div className="flex gap-4 border-t border-border pt-4">
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
              className="flex-1 bg-amber-500 font-bold text-slate-950 hover:bg-amber-400"
              disabled={isSubmitting || !canCreate || tierDataLoading}
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

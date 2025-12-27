'use client';

/**
 * Alert Form Hook with React Hook Form + Zod Validation
 *
 * Provides form state management, validation, and submission handling
 * for creating and editing price alerts.
 *
 * @module hooks/use-alert-form
 */

import { useForm, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCallback, useMemo } from 'react';

import {
  FREE_SYMBOLS,
  FREE_TIMEFRAMES,
  PRO_SYMBOLS,
  PRO_TIMEFRAMES,
  type Tier,
} from '@/lib/tier-config';

/**
 * Condition types for alerts
 */
export const CONDITION_TYPES = [
  'price_above',
  'price_below',
  'price_equals',
  'price_crosses_above',
  'price_crosses_below',
] as const;

export type ConditionType = (typeof CONDITION_TYPES)[number];

/**
 * Alert form values
 */
export interface AlertFormValues {
  symbol: string;
  timeframe: string;
  conditionType: ConditionType;
  targetValue: number;
  name: string;
  notes?: string;
  notifyEmail: boolean;
  notifyPush: boolean;
}

/**
 * Create alert form schema with tier-based validation
 *
 * @param tier - User's subscription tier
 * @returns Zod schema for alert form validation
 */
export function createAlertFormSchema(tier: Tier) {
  const allowedSymbols = tier === 'PRO' ? [...PRO_SYMBOLS] : [...FREE_SYMBOLS];
  const allowedTimeframes =
    tier === 'PRO' ? [...PRO_TIMEFRAMES] : [...FREE_TIMEFRAMES];

  return z.object({
    symbol: z
      .string()
      .min(1, 'Symbol is required')
      .refine((value) => allowedSymbols.includes(value as never), {
        message: `Symbol not available for ${tier} tier. Upgrade to PRO for more symbols.`,
      }),
    timeframe: z
      .string()
      .min(1, 'Timeframe is required')
      .refine((value) => allowedTimeframes.includes(value as never), {
        message: `Timeframe not available for ${tier} tier. Upgrade to PRO for more timeframes.`,
      }),
    conditionType: z.enum(CONDITION_TYPES, {
      required_error: 'Condition type is required',
      invalid_type_error: 'Invalid condition type',
    }),
    targetValue: z
      .number({
        required_error: 'Target price is required',
        invalid_type_error: 'Target price must be a number',
      })
      .positive('Target price must be positive')
      .max(10000000, 'Target price exceeds maximum allowed value'),
    name: z
      .string()
      .max(100, 'Alert name must not exceed 100 characters')
      .default(''),
    notes: z
      .string()
      .max(500, 'Notes must not exceed 500 characters')
      .optional(),
    notifyEmail: z.boolean().default(true),
    notifyPush: z.boolean().default(true),
  });
}

export type AlertFormSchema = ReturnType<typeof createAlertFormSchema>;

/**
 * Alert form hook options
 */
export interface UseAlertFormOptions {
  tier: Tier;
  initialData?: Partial<AlertFormValues>;
  isEditing?: boolean;
  onSubmit: (data: AlertFormValues) => Promise<void>;
  onCancel?: () => void;
}

/**
 * Alert form hook return type
 */
export interface UseAlertFormReturn {
  form: UseFormReturn<AlertFormValues>;
  schema: AlertFormSchema;
  isSubmitting: boolean;
  submitError: string | null;
  handleSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  handleCancel: () => void;
  reset: () => void;
  availableSymbols: readonly string[];
  availableTimeframes: readonly string[];
  conditionTypes: typeof CONDITION_TYPES;
  isEditing: boolean;
  canSubmit: boolean;
}

/**
 * useAlertForm Hook
 *
 * Provides complete form management for alert creation/editing
 * with React Hook Form and Zod validation.
 *
 * @param options - Form options including tier, initial data, and callbacks
 * @returns Form state and handlers
 */
export function useAlertForm({
  tier,
  initialData,
  isEditing = false,
  onSubmit,
  onCancel,
}: UseAlertFormOptions): UseAlertFormReturn {
  // Create tier-specific schema
  const schema = useMemo(() => createAlertFormSchema(tier), [tier]);

  // Get available symbols and timeframes for tier
  const availableSymbols = tier === 'PRO' ? PRO_SYMBOLS : FREE_SYMBOLS;
  const availableTimeframes = tier === 'PRO' ? PRO_TIMEFRAMES : FREE_TIMEFRAMES;

  // Default values
  const defaultValues: AlertFormValues = {
    symbol: initialData?.symbol || '',
    timeframe: initialData?.timeframe || '',
    conditionType: initialData?.conditionType || 'price_above',
    targetValue: initialData?.targetValue || 0,
    name: initialData?.name || '',
    notes: initialData?.notes || '',
    notifyEmail: initialData?.notifyEmail ?? true,
    notifyPush: initialData?.notifyPush ?? true,
  };

  // Initialize form with React Hook Form
  const form = useForm<AlertFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onBlur', // Validate on blur for better UX
  });

  const {
    handleSubmit: rhfHandleSubmit,
    formState: { isSubmitting, errors, isValid, isDirty },
    reset,
  } = form;

  // Track submission errors
  const submitError = useMemo(() => {
    // Return first error message if any
    const errorKeys = Object.keys(errors);
    if (errorKeys.length > 0) {
      const firstErrorKey = errorKeys[0] as keyof AlertFormValues;
      return errors[firstErrorKey]?.message || null;
    }
    return null;
  }, [errors]);

  // Submit handler
  const handleSubmit = useCallback(
    async (e?: React.BaseSyntheticEvent) => {
      await rhfHandleSubmit(async (data) => {
        try {
          // Generate default name if not provided
          const alertData: AlertFormValues = {
            ...data,
            name: data.name || `${data.symbol} ${data.timeframe} Alert`,
          };
          await onSubmit(alertData);
        } catch (error) {
          // Error handling is done in the component
          throw error;
        }
      })(e);
    },
    [rhfHandleSubmit, onSubmit]
  );

  // Cancel handler
  const handleCancel = useCallback(() => {
    reset(defaultValues);
    onCancel?.();
  }, [reset, defaultValues, onCancel]);

  // Can submit check
  const canSubmit = useMemo(() => {
    if (isEditing) {
      return isDirty && isValid && !isSubmitting;
    }
    return isValid && !isSubmitting;
  }, [isEditing, isDirty, isValid, isSubmitting]);

  return {
    form,
    schema,
    isSubmitting,
    submitError,
    handleSubmit,
    handleCancel,
    reset: () => reset(defaultValues),
    availableSymbols,
    availableTimeframes,
    conditionTypes: CONDITION_TYPES,
    isEditing,
    canSubmit,
  };
}

/**
 * Condition type display info
 */
export const CONDITION_TYPE_INFO: Record<
  ConditionType,
  { label: string; description: string }
> = {
  price_above: {
    label: 'Price Above',
    description: 'Triggers when price goes above target',
  },
  price_below: {
    label: 'Price Below',
    description: 'Triggers when price goes below target',
  },
  price_equals: {
    label: 'Price Equals',
    description: 'Triggers when price equals target (0.5% tolerance)',
  },
  price_crosses_above: {
    label: 'Price Crosses Above',
    description: 'Triggers when price crosses above target from below',
  },
  price_crosses_below: {
    label: 'Price Crosses Below',
    description: 'Triggers when price crosses below target from above',
  },
};

/**
 * Get symbol category for display
 */
export function getSymbolCategory(
  symbol: string
): 'crypto' | 'forex' | 'index' | 'commodity' | 'unknown' {
  if (['BTCUSD', 'ETHUSD'].includes(symbol)) return 'crypto';
  if (
    ['EURUSD', 'USDJPY', 'GBPUSD', 'AUDUSD', 'NZDUSD', 'USDCAD', 'USDCHF', 'AUDJPY', 'GBPJPY'].includes(
      symbol
    )
  )
    return 'forex';
  if (['US30', 'NDX100'].includes(symbol)) return 'index';
  if (['XAUUSD', 'XAGUSD'].includes(symbol)) return 'commodity';
  return 'unknown';
}

/**
 * Format symbol for display
 */
export function formatSymbol(symbol: string): string {
  const category = getSymbolCategory(symbol);
  const categoryIcons: Record<string, string> = {
    crypto: '',
    forex: '',
    index: '',
    commodity: '',
    unknown: '',
  };
  return `${categoryIcons[category]} ${symbol}`.trim();
}

'use client';

/**
 * Discount Code Input Component
 *
 * Input field for discount codes with:
 * - Real-time validation via API
 * - Visual feedback (valid/invalid)
 * - Only available for monthly plan
 * - Disabled for 3-day plan
 *
 * @module components/payments/DiscountCodeInput
 */

import { useState, useCallback } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import type { PlanType } from '@/types/dlocal';
import { cn } from '@/lib/utils';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface DiscountCodeInputProps {
  /** Current discount code value */
  value: string;
  /** Callback when code changes */
  onChange: (code: string) => void;
  /** Current plan type */
  planType: PlanType;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Callback when validation result changes */
  onValidationChange?: (isValid: boolean, discountPercent?: number) => void;
}

interface ValidationResult {
  valid: boolean;
  discountPercent?: number;
  message?: string;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function DiscountCodeInput({
  value,
  onChange,
  planType,
  disabled = false,
  onValidationChange,
}: DiscountCodeInputProps): React.ReactElement {
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  const validateCode = useCallback(
    async (code: string): Promise<void> => {
      if (!code || planType === 'THREE_DAY') {
        setValidation(null);
        onValidationChange?.(false);
        return;
      }

      setValidating(true);

      try {
        const res = await fetch('/api/payments/dlocal/validate-discount', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, planType }),
        });

        const data = await res.json();

        const result: ValidationResult = {
          valid: data.valid === true,
          discountPercent: data.discountPercent,
          message: data.message,
        };

        setValidation(result);
        onValidationChange?.(result.valid, result.discountPercent);
      } catch (error) {
        console.error('Failed to validate discount code:', error);
        setValidation({ valid: false, message: 'Failed to validate code' });
        onValidationChange?.(false);
      } finally {
        setValidating(false);
      }
    },
    [planType, onValidationChange]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const newCode = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    onChange(newCode);
    setValidation(null); // Reset validation on change
  };

  const handleBlur = (): void => {
    if (value && value.length >= 3) {
      validateCode(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && value && value.length >= 3) {
      e.preventDefault();
      validateCode(value);
    }
  };

  // 3-Day plan doesn't support discount codes
  if (planType === 'THREE_DAY') {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">
          Discount code
        </label>
        <p className="text-sm text-muted-foreground">
          Discount codes are not available for the 3-day plan.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label htmlFor="discount-code" className="text-sm font-medium">
        Discount code (optional)
      </label>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            id="discount-code"
            type="text"
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={disabled || validating}
            placeholder="Enter code"
            maxLength={20}
            className={cn(
              'w-full rounded-lg border bg-background p-3 pr-10 text-sm uppercase',
              'ring-offset-background transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              validation?.valid === true && 'border-green-500',
              validation?.valid === false && 'border-red-500'
            )}
            aria-describedby={validation ? 'discount-code-status' : undefined}
          />

          {/* Status icon */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {validating && (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            )}
            {!validating && validation?.valid === true && (
              <Check className="h-5 w-5 text-green-600" aria-hidden="true" />
            )}
            {!validating && validation?.valid === false && (
              <X className="h-5 w-5 text-red-600" aria-hidden="true" />
            )}
          </div>
        </div>
      </div>

      {/* Validation message */}
      {validation && (
        <p
          id="discount-code-status"
          className={cn(
            'text-sm',
            validation.valid ? 'text-green-600' : 'text-red-600'
          )}
        >
          {validation.valid
            ? `${validation.discountPercent}% discount will be applied!`
            : validation.message || 'Invalid discount code'}
        </p>
      )}

      {/* Hint text */}
      {!validation && (
        <p className="text-xs text-muted-foreground">
          Have an affiliate referral code? Enter it here for a discount.
        </p>
      )}
    </div>
  );
}

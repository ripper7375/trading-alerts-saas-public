'use client';

/**
 * Payment Button Component
 *
 * Submit button for payment with:
 * - Loading state handling
 * - Disabled state when form is incomplete
 * - Error handling
 *
 * @module components/payments/PaymentButton
 */

import { useState } from 'react';
import { Loader2, ArrowRight, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface PaymentButtonProps {
  /** Click handler that returns a promise */
  onClick: () => Promise<void>;
  /** Whether the button should be disabled */
  disabled?: boolean;
  /** Button content */
  children: React.ReactNode;
  /** Optional class name */
  className?: string;
  /** Show security lock icon */
  showSecurityIcon?: boolean;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function PaymentButton({
  onClick,
  disabled = false,
  children,
  className,
  showSecurityIcon = true,
}: PaymentButtonProps): React.ReactElement {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async (): Promise<void> => {
    if (disabled || loading) return;

    setLoading(true);
    setError(null);

    try {
      await onClick();
    } catch (err) {
      console.error('Payment button error:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'An error occurred. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || loading}
        className={cn(
          'flex w-full items-center justify-center gap-2',
          'rounded-lg bg-blue-600 p-4 text-white',
          'font-medium transition-colors',
          'hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        aria-busy={loading}
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            <span>Processing...</span>
          </>
        ) : (
          <>
            {showSecurityIcon && (
              <Lock className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{children}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </>
        )}
      </button>

      {/* Error message */}
      {error && (
        <p className="text-center text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {/* Security notice */}
      <p className="text-center text-xs text-muted-foreground">
        <Lock className="mr-1 inline h-3 w-3" aria-hidden="true" />
        Secured by dLocal. Your payment info is encrypted.
      </p>
    </div>
  );
}

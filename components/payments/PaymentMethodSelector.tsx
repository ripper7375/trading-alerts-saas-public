'use client';

/**
 * Payment Method Selector Component
 *
 * Displays available payment methods for a country with:
 * - Dynamic loading from API
 * - Icon representation for each method
 * - Processing time badges
 * - Selection state management
 *
 * Business logic extracted from seed component:
 * seed-code/v0-components/part-18-payment-method-selector
 *
 * @module components/payments/PaymentMethodSelector
 */

import { useState, useEffect } from 'react';
import {
  CreditCard,
  Building,
  Smartphone,
  QrCode,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import type { DLocalCountry } from '@/types/dlocal';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface PaymentMethodSelectorProps {
  /** Selected country */
  country: DLocalCountry;
  /** Currently selected payment method */
  value: string | null;
  /** Callback when payment method is selected */
  onChange: (method: string) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
}

interface PaymentMethodInfo {
  id: string;
  name: string;
  icon: 'card' | 'bank' | 'mobile' | 'qr';
  processingTime: 'Instant' | '1-2 hours';
  sublabel?: string;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PAYMENT METHOD CONFIGURATIONS (from seed component)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PAYMENT_METHODS_BY_COUNTRY: Record<DLocalCountry, PaymentMethodInfo[]> = {
  IN: [
    { id: 'UPI', name: 'UPI', icon: 'mobile', processingTime: 'Instant' },
    {
      id: 'Paytm',
      name: 'Paytm Wallet',
      icon: 'mobile',
      processingTime: 'Instant',
    },
    { id: 'PhonePe', name: 'PhonePe', icon: 'mobile', processingTime: 'Instant' },
    {
      id: 'Net Banking',
      name: 'Net Banking',
      icon: 'bank',
      processingTime: '1-2 hours',
    },
  ],
  NG: [
    {
      id: 'Bank Transfer',
      name: 'Bank Transfer',
      icon: 'bank',
      processingTime: '1-2 hours',
    },
    { id: 'USSD', name: 'USSD', icon: 'mobile', processingTime: 'Instant' },
    { id: 'Paystack', name: 'Paystack', icon: 'card', processingTime: 'Instant' },
  ],
  PK: [
    { id: 'JazzCash', name: 'JazzCash', icon: 'mobile', processingTime: 'Instant' },
    {
      id: 'Easypaisa',
      name: 'Easypaisa',
      icon: 'mobile',
      processingTime: 'Instant',
    },
  ],
  VN: [
    { id: 'VNPay', name: 'VNPay', icon: 'card', processingTime: 'Instant' },
    { id: 'MoMo', name: 'MoMo', icon: 'mobile', processingTime: 'Instant' },
    { id: 'ZaloPay', name: 'ZaloPay', icon: 'mobile', processingTime: 'Instant' },
  ],
  ID: [
    { id: 'GoPay', name: 'GoPay', icon: 'mobile', processingTime: 'Instant' },
    { id: 'OVO', name: 'OVO', icon: 'mobile', processingTime: 'Instant' },
    { id: 'Dana', name: 'Dana', icon: 'mobile', processingTime: 'Instant' },
    {
      id: 'ShopeePay',
      name: 'ShopeePay',
      icon: 'mobile',
      processingTime: 'Instant',
    },
  ],
  TH: [
    {
      id: 'TrueMoney',
      name: 'TrueMoney',
      icon: 'mobile',
      processingTime: 'Instant',
    },
    {
      id: 'Rabbit LINE Pay',
      name: 'Rabbit LINE Pay',
      icon: 'mobile',
      processingTime: 'Instant',
    },
    { id: 'Thai QR', name: 'Thai QR', icon: 'qr', processingTime: 'Instant' },
  ],
  ZA: [
    {
      id: 'Instant EFT',
      name: 'Instant EFT',
      icon: 'bank',
      processingTime: 'Instant',
    },
    { id: 'EFT', name: 'EFT', icon: 'bank', processingTime: '1-2 hours' },
  ],
  TR: [
    {
      id: 'Bank Transfer',
      name: 'Bank Transfer',
      icon: 'bank',
      processingTime: '1-2 hours',
    },
    {
      id: 'Local Cards',
      name: 'Turkish Cards',
      icon: 'card',
      processingTime: 'Instant',
    },
  ],
};

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getMethodIcon(
  type: PaymentMethodInfo['icon']
): React.ReactElement {
  const iconProps = { className: 'h-8 w-8' };

  switch (type) {
    case 'card':
      return <CreditCard {...iconProps} />;
    case 'bank':
      return <Building {...iconProps} />;
    case 'qr':
      return <QrCode {...iconProps} />;
    case 'mobile':
    default:
      return <Smartphone {...iconProps} />;
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function PaymentMethodSelector({
  country,
  value,
  onChange,
  disabled = false,
}: PaymentMethodSelectorProps): React.ReactElement {
  const [methods, setMethods] = useState<PaymentMethodInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch payment methods from API or use fallback
  useEffect(() => {
    if (!country) return;

    const fetchMethods = async (): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        // Try to get from API first
        const res = await fetch(`/api/payments/dlocal/methods?country=${country}`);

        if (res.ok) {
          const data = await res.json();
          // Map API response to our format
          const apiMethods = data.methods.map((methodName: string) => {
            const localConfig = PAYMENT_METHODS_BY_COUNTRY[country]?.find(
              (m) => m.id === methodName || m.name === methodName
            );
            return (
              localConfig || {
                id: methodName,
                name: methodName,
                icon: 'card' as const,
                processingTime: 'Instant' as const,
              }
            );
          });
          setMethods(apiMethods);

          // Auto-select first method if none selected
          if (!value && apiMethods.length > 0 && apiMethods[0]) {
            onChange(apiMethods[0].id);
          }
        } else {
          // Fallback to local config
          const fallbackMethods = PAYMENT_METHODS_BY_COUNTRY[country] || [];
          setMethods(fallbackMethods);

          if (!value && fallbackMethods.length > 0 && fallbackMethods[0]) {
            onChange(fallbackMethods[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch payment methods:', err);
        // Use fallback
        const fallbackMethods = PAYMENT_METHODS_BY_COUNTRY[country] || [];
        setMethods(fallbackMethods);

        if (!value && fallbackMethods.length > 0 && fallbackMethods[0]) {
          onChange(fallbackMethods[0].id);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchMethods();
  }, [country, value, onChange]);

  const handleKeyDown = (
    event: React.KeyboardEvent,
    methodId: string
  ): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!disabled) {
        onChange(methodId);
      }
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium">Payment method</label>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading payment methods...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium">Payment method</label>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (methods.length === 0) {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium">Payment method</label>
        <p className="text-sm text-muted-foreground">
          No payment methods available for this country.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">Payment method</label>
      <p className="text-sm text-muted-foreground">
        Select your preferred local payment option
      </p>

      <div
        className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4"
        role="radiogroup"
        aria-label="Select payment method"
      >
        {methods.map((method) => {
          const isSelected = value === method.id;

          return (
            <Card
              key={method.id}
              className={cn(
                'relative cursor-pointer transition-all duration-200',
                'hover:scale-[1.02] hover:shadow-md',
                'focus-within:outline focus-within:outline-2 focus-within:outline-ring',
                isSelected
                  ? 'border-2 border-blue-600 bg-blue-50'
                  : 'border border-border bg-background hover:shadow-sm',
                disabled && 'cursor-not-allowed opacity-50'
              )}
              onClick={() => !disabled && onChange(method.id)}
              onKeyDown={(e) => handleKeyDown(e, method.id)}
              tabIndex={disabled ? -1 : 0}
              role="radio"
              aria-checked={isSelected}
              aria-disabled={disabled}
              aria-label={`${method.name}, ${method.processingTime}${method.sublabel ? `, ${method.sublabel}` : ''}`}
            >
              {isSelected && (
                <CheckCircle
                  className="absolute right-2 top-2 h-5 w-5 text-green-600"
                  aria-hidden="true"
                />
              )}

              <CardContent className="flex flex-col items-center p-4 text-center">
                <div className="mb-2 text-muted-foreground" aria-hidden="true">
                  {getMethodIcon(method.icon)}
                </div>
                <p className="mb-1 text-sm font-semibold">{method.name}</p>
                {method.sublabel && (
                  <p className="mb-2 text-xs text-muted-foreground">
                    {method.sublabel}
                  </p>
                )}
                <Badge
                  variant="secondary"
                  className={cn(
                    'text-xs',
                    method.processingTime === 'Instant'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  )}
                >
                  {method.processingTime}
                </Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

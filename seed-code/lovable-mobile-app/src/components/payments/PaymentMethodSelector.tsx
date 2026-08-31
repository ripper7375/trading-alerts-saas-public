/**
 * Payment Method Selector (mobile reference)
 *
 * Mobile version of the monolith's
 * components/payments/PaymentMethodSelector.tsx -- shows the local payment
 * methods available for a chosen dLocal country (e.g. UAE: Local Cards /
 * Apple Pay / Bank Transfer). Static config only, no API call.
 */

import {
  Building,
  CheckCircle,
  CreditCard,
  QrCode,
  Smartphone,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { DLocalCountry } from '@/types/dlocal';
import { PAYMENT_METHODS } from '@/lib/dlocal/constants';
import { cn } from '@/lib/utils';

interface PaymentMethodSelectorProps {
  country: DLocalCountry;
  value: string | null;
  onChange: (method: string) => void;
}

type IconType = 'card' | 'bank' | 'mobile' | 'qr';

const METHOD_ICON: Record<string, IconType> = {
  UPI: 'mobile',
  Paytm: 'mobile',
  PhonePe: 'mobile',
  'Net Banking': 'bank',
  'Bank Transfer': 'bank',
  USSD: 'mobile',
  Paystack: 'card',
  JazzCash: 'mobile',
  Easypaisa: 'mobile',
  VNPay: 'card',
  MoMo: 'mobile',
  ZaloPay: 'mobile',
  GoPay: 'mobile',
  OVO: 'mobile',
  Dana: 'mobile',
  ShopeePay: 'mobile',
  TrueMoney: 'mobile',
  'Rabbit LINE Pay': 'mobile',
  'Thai QR': 'qr',
  'Instant EFT': 'bank',
  EFT: 'bank',
  'Local Cards': 'card',
  'Apple Pay': 'mobile',
};

const INSTANT_METHODS = new Set([
  'UPI',
  'Paytm',
  'PhonePe',
  'USSD',
  'Paystack',
  'JazzCash',
  'Easypaisa',
  'VNPay',
  'MoMo',
  'ZaloPay',
  'GoPay',
  'OVO',
  'Dana',
  'ShopeePay',
  'TrueMoney',
  'Rabbit LINE Pay',
  'Thai QR',
  'Instant EFT',
  'Local Cards',
  'Apple Pay',
]);

function getMethodIcon(name: string) {
  const type = METHOD_ICON[name] ?? 'card';
  const props = { className: 'h-6 w-6' };
  switch (type) {
    case 'bank':
      return <Building {...props} />;
    case 'qr':
      return <QrCode {...props} />;
    case 'mobile':
      return <Smartphone {...props} />;
    default:
      return <CreditCard {...props} />;
  }
}

export function PaymentMethodSelector({
  country,
  value,
  onChange,
}: PaymentMethodSelectorProps) {
  const methods = PAYMENT_METHODS[country] || [];

  if (methods.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Payment method</p>
      <p className="text-xs text-muted-foreground">
        Select your preferred local payment option
      </p>

      <div className="grid grid-cols-2 gap-2">
        {methods.map((method) => {
          const isSelected = value === method;
          const isInstant = INSTANT_METHODS.has(method);

          return (
            <Card
              key={method}
              className={cn(
                'relative cursor-pointer transition-all',
                isSelected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'hover:border-primary/50'
              )}
              onClick={() => onChange(method)}
            >
              {isSelected && (
                <CheckCircle className="absolute right-2 top-2 h-4 w-4 text-primary" />
              )}
              <CardContent className="flex flex-col items-center p-3 text-center">
                <div className="mb-1 text-muted-foreground">
                  {getMethodIcon(method)}
                </div>
                <p className="mb-1 text-xs font-semibold">{method}</p>
                <Badge
                  variant="secondary"
                  className={cn(
                    'text-[10px]',
                    isInstant
                      ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                      : 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400'
                  )}
                >
                  {isInstant ? 'Instant' : '1-2 hours'}
                </Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

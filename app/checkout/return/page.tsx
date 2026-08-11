'use client';

/**
 * Checkout Return Landing Page
 *
 * dLocal redirects the customer back here after they complete (or abandon)
 * payment on dLocal's own hosted page. Fetches the real payment record from
 * GET /api/payments/dlocal/[paymentId] and renders its live status — no
 * status is inferred from the URL alone.
 *
 * @module app/checkout/return/page
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  RotateCcw,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDateTime } from '@/lib/utils/formatters';
import { COUNTRY_NAMES } from '@/lib/dlocal/constants';
import type { DLocalCountry, PaymentStatus } from '@/types/dlocal';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface PaymentDetails {
  id: string;
  paymentId: string;
  status: PaymentStatus;
  providerStatus: string;
  amount: {
    local: string;
    usd: string;
    currency: string;
  };
  country: string | null;
  paymentMethod: string | null;
  planType: string | null;
  duration: number | null;
  createdAt: string;
  updatedAt: string;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STATUS PRESENTATION
//
// Real vocabulary (types/dlocal.ts's PaymentStatus, matches the Payment
// model's own `status` field comment): PENDING | COMPLETED | FAILED |
// CANCELLED | REFUNDED. This is deliberately NOT the PAID/PENDING/
// REJECTED/CANCELLED list this order's own draft text used -- verified
// against the real type/schema before writing this, per the Data Contract
// (dial LOW) rule.
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const STATUS_PRESENTATION: Record<
  PaymentStatus,
  {
    label: string;
    description: string;
    icon: typeof CheckCircle2;
    badgeClassName: string;
    iconClassName: string;
  }
> = {
  COMPLETED: {
    label: 'Payment Successful',
    description: 'Your PRO subscription is now active. Welcome aboard!',
    icon: CheckCircle2,
    badgeClassName: 'bg-green-100 text-green-700',
    iconClassName: 'text-green-600',
  },
  PENDING: {
    label: 'Payment Pending',
    description:
      "We're still waiting for confirmation from your payment method. This can take a few minutes for some local payment methods.",
    icon: Clock,
    badgeClassName: 'bg-yellow-100 text-yellow-700',
    iconClassName: 'text-yellow-600',
  },
  FAILED: {
    label: 'Payment Failed',
    description:
      'Your payment could not be completed. No charge was made. You can try again with the same or a different payment method.',
    icon: XCircle,
    badgeClassName: 'bg-red-100 text-red-700',
    iconClassName: 'text-red-600',
  },
  CANCELLED: {
    label: 'Payment Cancelled',
    description:
      'This payment was cancelled before it completed. No charge was made.',
    icon: Ban,
    badgeClassName: 'bg-muted text-muted-foreground',
    iconClassName: 'text-muted-foreground',
  },
  REFUNDED: {
    label: 'Payment Refunded',
    description: 'This payment has been refunded.',
    icon: RotateCcw,
    badgeClassName: 'bg-blue-100 text-blue-700',
    iconClassName: 'text-blue-600',
  },
};

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CHECKOUT RETURN CONTENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function CheckoutReturnContent(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [payment, setPayment] = useState<PaymentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // dLocal's own callback convention uses `payment_id`; support the
  // camelCase form too since this codebase's own create-payment response
  // (app/api/payments/dlocal/create/route.ts) calls the same field
  // `paymentId`.
  const paymentId =
    searchParams.get('payment_id') || searchParams.get('paymentId');

  const fetchPayment = useCallback(async (): Promise<void> => {
    if (!paymentId) {
      setError('No payment reference was provided in the return URL.');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const res = await fetch(
        `/api/payments/dlocal/${encodeURIComponent(paymentId)}`
      );

      if (res.status === 401) {
        router.push(
          `/login?callbackUrl=${encodeURIComponent(
            `/checkout/return?payment_id=${paymentId}`
          )}`
        );
        return;
      }

      if (res.status === 404) {
        setError('We could not find a payment matching this reference.');
        setLoading(false);
        return;
      }

      if (res.status === 403) {
        setError('This payment does not belong to your account.');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error('Failed to load payment status');
      }

      const data: PaymentDetails = await res.json();
      setPayment(data);
    } catch (err) {
      console.error('Failed to fetch payment status:', err);
      setError('Failed to load your payment status. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [paymentId, router]);

  useEffect(() => {
    fetchPayment();
  }, [fetchPayment]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">
            Checking your payment status...
          </p>
        </div>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="bg-muted/30 flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-4 p-6 text-center">
            <AlertTriangle
              className="mx-auto h-10 w-10 text-yellow-600"
              aria-hidden="true"
            />
            <div role="alert" aria-live="assertive">
              <p className="font-medium">Unable to show payment status</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            </div>
            <div className="flex justify-center gap-3">
              <Button asChild variant="outline">
                <Link href="/checkout">Back to Checkout</Link>
              </Button>
              <Button asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const presentation = STATUS_PRESENTATION[payment.status];
  const StatusIcon = presentation.icon;
  const countryName = payment.country
    ? COUNTRY_NAMES[payment.country as DLocalCountry] || payment.country
    : null;

  return (
    <div className="bg-muted/30 flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="text-center">
          <StatusIcon
            className={`mx-auto mb-2 h-12 w-12 ${presentation.iconClassName}`}
            aria-hidden="true"
          />
          <CardTitle className="text-2xl" role="status" aria-live="polite">
            {presentation.label}
          </CardTitle>
          <Badge
            className={`mx-auto mt-2 w-fit ${presentation.badgeClassName}`}
          >
            {payment.status}
          </Badge>
        </CardHeader>

        <CardContent className="space-y-6">
          <p className="text-center text-muted-foreground">
            {presentation.description}
          </p>

          {/* Order summary */}
          <div className="bg-muted/30 space-y-2 rounded-lg border p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium">
                {payment.planType === 'THREE_DAY'
                  ? '3-Day Trial'
                  : payment.planType === 'MONTHLY'
                    ? 'Monthly PRO'
                    : payment.planType || '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium">
                {formatCurrency(
                  parseFloat(payment.amount.local),
                  payment.amount.currency
                )}{' '}
                <span className="text-muted-foreground">
                  (≈ {formatCurrency(parseFloat(payment.amount.usd), 'USD')})
                </span>
              </span>
            </div>
            {countryName && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Country</span>
                <span className="font-medium">{countryName}</span>
              </div>
            )}
            {payment.paymentMethod && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Payment method</span>
                <span className="font-medium">{payment.paymentMethod}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Reference</span>
              <span className="font-mono text-xs">{payment.paymentId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">
                {formatDateTime(payment.createdAt)}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            {payment.status === 'FAILED' || payment.status === 'CANCELLED' ? (
              <Button asChild variant="outline">
                <Link href="/checkout">Try Again</Link>
              </Button>
            ) : null}
            <Button asChild>
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN EXPORT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function CheckoutReturnPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <CheckoutReturnContent />
    </Suspense>
  );
}

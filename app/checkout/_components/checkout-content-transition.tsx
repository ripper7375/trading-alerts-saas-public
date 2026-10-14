'use client';

import React, { ViewTransition } from 'react';
import { usePathname } from 'next/navigation';

interface CheckoutContentTransitionProps {
  children: React.ReactNode;
}

/**
 * CheckoutContentTransition
 *
 * Wraps Checkout & Payment sub-pages (/checkout, /checkout/stripe, /checkout/dlocal, /checkout/return)
 * with React 19.3 `<ViewTransition>` keyed on `pathname`.
 * Provides an 80ms micro-fade during payment provider selection and return screens,
 * delivering a calm, reassuring, and premium financial checkout flow without perceptual lag.
 */
export function CheckoutContentTransition({
  children,
}: CheckoutContentTransitionProps): React.ReactElement {
  const pathname = usePathname();

  return (
    <ViewTransition
      key={pathname}
      name="checkout-page-content"
      enter="auto"
      exit="auto"
      default="auto"
    >
      {children}
    </ViewTransition>
  );
}

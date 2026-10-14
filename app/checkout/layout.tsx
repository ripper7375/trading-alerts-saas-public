import React from 'react';
import { CheckoutContentTransition } from './_components/checkout-content-transition';

interface CheckoutLayoutProps {
  children: React.ReactNode;
}

/**
 * Checkout Layout
 *
 * Wraps all payment & checkout pages (/checkout, /checkout/stripe, /checkout/dlocal, /checkout/return)
 * with CheckoutContentTransition, providing a snappy 80ms micro-fade across checkout steps.
 */
export default function CheckoutLayout({
  children,
}: CheckoutLayoutProps): React.ReactElement {
  return <CheckoutContentTransition>{children}</CheckoutContentTransition>;
}

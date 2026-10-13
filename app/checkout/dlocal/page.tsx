import { Suspense } from 'react';
import {
  CheckoutAccess,
  CheckoutFallback,
} from '@/components/payments/checkout-access';
import { ProviderCheckout } from '@/components/payments/provider-checkout';
export default function CheckoutPage(): React.ReactElement {
  return (
    <Suspense fallback={<CheckoutFallback />}>
      <CheckoutAccess>
        <ProviderCheckout provider="dlocal" />
      </CheckoutAccess>
    </Suspense>
  );
}

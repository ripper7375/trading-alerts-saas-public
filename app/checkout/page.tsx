import { Suspense } from 'react';
import {
  CheckoutAccess,
  CheckoutFallback,
} from '@/components/payments/checkout-access';
import { PaymentProviderChoice } from '@/components/payments/payment-provider-choice';
export default function CheckoutPage(): React.ReactElement {
  return (
    <Suspense fallback={<CheckoutFallback />}>
      <CheckoutAccess>
        <PaymentProviderChoice />
      </CheckoutAccess>
    </Suspense>
  );
}

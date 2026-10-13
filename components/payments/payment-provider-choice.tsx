'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CreditCard, Globe } from 'lucide-react';
import { useLocale } from '@/lib/context/locale-context';
import {
  COUNTRY_NAMES,
  DLOCAL_SUPPORTED_COUNTRIES,
} from '@/lib/dlocal/constants';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCheckoutHref } from './checkout-navigation';

export function PaymentProviderChoice(): React.ReactElement {
  const { t } = useLocale();
  const checkoutHref = useCheckoutHref();
  const [open, setOpen] = useState(true);
  const reopenButton = useRef<HTMLButtonElement>(null);
  return (
    <main className="bg-muted/30 min-h-screen py-8">
      <div className="container mx-auto max-w-3xl px-4">
        <Link
          href="/pricing"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('checkout.back_to_pricing', 'Back to Pricing')}
        </Link>
        <h1 className="text-3xl font-bold">
          {t('checkout.complete_purchase', 'Complete Your Purchase')}
        </h1>
        <Card className="mt-8 p-6 text-center">
          <p className="mb-4 text-muted-foreground">
            {t(
              'checkout.choose_to_continue',
              'Choose a payment method to continue.'
            )}
          </p>
          <Button ref={reopenButton} onClick={() => setOpen(true)}>
            {t(
              'checkout.choose_payment_method',
              'Choose your preferred payment method'
            )}
          </Button>
        </Card>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            reopenButton.current?.focus();
          }}
          className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-xl p-5 sm:p-8"
        >
          <DialogHeader className="pr-6 text-start">
            <DialogTitle className="text-2xl">
              {t('checkout.select_provider_title', 'Choose how to pay')}
            </DialogTitle>
            <DialogDescription className="pt-2 leading-relaxed">
              {t(
                'checkout.select_provider_description',
                'Choose one of two payment options for your PRO purchase. You only need to use one.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <section
              className="flex flex-col rounded-lg border border-border p-5"
              aria-labelledby="stripe-option"
            >
              <CreditCard
                className="mb-4 h-7 w-7 text-primary"
                aria-hidden="true"
              />
              <h2 id="stripe-option" className="text-xl font-semibold">
                Stripe
              </h2>
              <p className="mt-1 text-sm font-medium">
                {t('checkout.international_payment', 'International Payment')}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {t(
                  'checkout.stripe_suitability',
                  'Choose Stripe to pay with an international debit or credit card, or a supported digital wallet.'
                )}
              </p>
              <p className="mb-6 mt-3 text-xs leading-relaxed text-muted-foreground">
                {t(
                  'checkout.stripe_currency_note',
                  'Payments are charged in USD. Available wallets depend on your country and device.'
                )}
              </p>
              <Button asChild className="mt-auto w-full whitespace-normal">
                <Link href={checkoutHref('/checkout/stripe')}>
                  {t('checkout.continue_stripe', 'Continue with Stripe')}
                  <ArrowRight
                    className="ms-2 h-4 w-4 shrink-0 rtl:rotate-180"
                    aria-hidden="true"
                  />
                </Link>
              </Button>
            </section>
            <section
              className="flex flex-col rounded-lg border border-border p-5"
              aria-labelledby="dlocal-option"
            >
              <Globe className="mb-4 h-7 w-7 text-primary" aria-hidden="true" />
              <h2 id="dlocal-option" className="text-xl font-semibold">
                dLocal
              </h2>
              <p className="mt-1 text-sm font-medium">
                {t('checkout.local_payment_methods', 'Local Payment Methods')}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {t(
                  'checkout.dlocal_suitability',
                  'Choose dLocal to pay in local currency with bank transfers, local cards, or e-wallets.'
                )}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {t(
                  'checkout.dlocal_availability',
                  'Available in selected countries. Payment methods vary by country.'
                )}
              </p>
              <p className="mb-6 mt-2 text-xs leading-relaxed text-muted-foreground">
                {DLOCAL_SUPPORTED_COUNTRIES.map((code) =>
                  t(COUNTRY_NAMES[code])
                ).join(', ')}
              </p>
              <Button asChild className="mt-auto w-full whitespace-normal">
                <Link href={checkoutHref('/checkout/dlocal')}>
                  {t('checkout.continue_dlocal', 'Continue with dLocal')}
                  <ArrowRight
                    className="ms-2 h-4 w-4 shrink-0 rtl:rotate-180"
                    aria-hidden="true"
                  />
                </Link>
              </Button>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

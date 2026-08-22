import { Suspense } from 'react';

import { TickerTape } from '@/components/landing/ticker-tape';
import { LandingHero } from '@/components/landing/landing-hero';
import { LandingFeatures } from '@/components/landing/landing-features';
import { LandingPricing } from '@/components/landing/landing-pricing';

// Force dynamic rendering -- LandingPricing reads useSearchParams() for the
// ?ref= affiliate code.
export const dynamic = 'force-dynamic';

export default function LandingPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      }
    >
      <TickerTape />
      <LandingHero />
      <LandingFeatures />
      <LandingPricing />
    </Suspense>
  );
}

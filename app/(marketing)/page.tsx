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
    <>
      {/*
       * Deliberately OUTSIDE the Suspense boundary below. Only LandingPricing
       * actually needs it (it reads useSearchParams() for ?ref=). Saving a
       * theme change calls cookies().set() inside a Server Action, which
       * Next.js treats as cause to refresh the route -- that re-suspends the
       * boundary and remounts everything inside it. TickerTape embeds a
       * third-party TradingView iframe that is unreliable when re-embedded
       * mid-session (see its own doc comment), so it must not be remounted by
       * an unrelated component's suspension.
       */}
      <TickerTape />
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        }
      >
        <LandingHero />
        <LandingFeatures />
        <LandingPricing />
      </Suspense>
    </>
  );
}

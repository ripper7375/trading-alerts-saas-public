import { Suspense } from 'react';

import { TickerTape } from '@/components/landing/ticker-tape';
import { LandingHero } from '@/components/landing/landing-hero';
import { LandingFeatures } from '@/components/landing/landing-features';
import { LandingPricing } from '@/components/landing/landing-pricing';

// Force dynamic rendering -- LandingPricing reads useSearchParams() for the
// ?ref= affiliate code.
export const dynamic = 'force-dynamic';

/**
 * Held while the pricing section streams in. It keeps the section's anchor
 * (`#pricing`, linked from the navbar) and its background, and enough height
 * that the footer does not jump up and back down.
 */
function LandingPricingFallback(): React.ReactElement {
  return (
    <section
      id="pricing"
      aria-busy="true"
      className="relative flex min-h-[40rem] items-center justify-center bg-slate-50 py-20 dark:bg-[#06070a]"
    >
      <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
    </section>
  );
}

export default function LandingPage(): React.ReactElement {
  return (
    <>
      {/*
       * Only LandingPricing needs a Suspense boundary: it is the one component
       * here that reads useSearchParams() (for ?ref=). The hero and the
       * features section are in the first paint instead of waiting behind it.
       * Saving a theme change calls cookies().set() inside a Server Action,
       * which Next.js treats as cause to refresh the route -- that re-suspends
       * a boundary and remounts everything inside it, so the boundary is kept
       * as small as possible. TickerTape embeds a third-party TradingView
       * iframe that is unreliable when re-embedded mid-session (see its own
       * doc comment); it must not be remounted by an unrelated component's
       * suspension.
       */}
      <TickerTape />
      <LandingHero />
      <LandingFeatures />
      <Suspense fallback={<LandingPricingFallback />}>
        <LandingPricing />
      </Suspense>
    </>
  );
}

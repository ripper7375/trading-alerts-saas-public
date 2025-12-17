import { Suspense } from 'react';

import LandingPageContent from './landing-content';

// Force dynamic rendering due to useSearchParams in child component
export const dynamic = 'force-dynamic';

export default function LandingPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      }
    >
      <LandingPageContent />
    </Suspense>
  );
}

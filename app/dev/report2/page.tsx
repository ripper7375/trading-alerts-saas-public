import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactElement } from 'react';

import { PreviewClient } from './preview-client';
import { SCENARIOS } from './scenarios';

/**
 * Development preview of Report 2 (build step 5, part 7; plan decision D9 (a)):
 * the Trade Setup modal and the Report 2 card, fixture-driven, in the browser.
 *
 * It exists only outside a production build: Vercel builds and previews run with
 * NODE_ENV=production, so the route answers 404 there, and its server actions
 * refuse too. Local development servers show it at /dev/report2. Nothing on it is
 * recorded or sent anywhere.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Report 2 preview (development)',
  robots: { index: false, follow: false },
};

export default function Report2PreviewPage(): ReactElement {
  if (process.env.NODE_ENV === 'production') notFound();
  return <PreviewClient scenarios={[...SCENARIOS]} />;
}

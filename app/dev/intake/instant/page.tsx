import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactElement } from 'react';

import { InstantPreview } from './instant-preview';

/**
 * Development preview of the Panel C instant prompt buttons (build step 6, part 10; plan decision
 * D10): the real button, overlay and press hook in a stand-in chart pane, in every state, in any
 * interface language, at the narrow widths.
 *
 * Like its parent `/dev/intake`, it exists only outside a production build (Vercel builds and
 * previews run with NODE_ENV=production, so the route answers 404 there). The route the buttons
 * call is replaced by a stand-in: no network call, no model, nothing is recorded or sent.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Panel C instant prompts (development)',
  robots: { index: false, follow: false },
};

export default function InstantPreviewPage(): ReactElement {
  if (process.env.NODE_ENV === 'production') notFound();
  return <InstantPreview />;
}

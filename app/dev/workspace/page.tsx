import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactElement } from 'react';

import { WorkspacePreview } from './workspace-preview';

/**
 * Development preview of the three connected panels (build step 7, part 9): Panel A's thread list,
 * Panel B's conversation and Panel C's two Market Context badges, in the REAL workspace, sharing the one
 * chat above them, over a stand-in for the chat routes that plays answers RECORDED from the real message
 * route (`app/dev/chat/recorded.json`).
 *
 * It exists only outside a production build: Vercel builds and previews run with NODE_ENV=production, so
 * the route answers 404 there. Local development servers show it at /dev/workspace. It calls no model, no
 * database and no route of the app (the chart's price socket will fail to connect, which only leaves the
 * canvases empty), and nothing on it is recorded or sent anywhere. The two models and the balance are TEST
 * values.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Workspace preview (development)',
  robots: { index: false, follow: false },
};

export default function WorkspacePreviewPage(): ReactElement {
  if (process.env.NODE_ENV === 'production') notFound();
  return <WorkspacePreview />;
}

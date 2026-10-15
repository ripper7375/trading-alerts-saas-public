import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactElement } from 'react';

import { ChatPreview } from './chat-preview';

/**
 * Development preview of Panel B, the live AI copilot (build step 7, part 8): every state of the
 * panel, over the REAL panel components and the real reducer, fed with answers RECORDED from the real
 * message route (`recorded.json`).
 *
 * It exists only outside a production build: Vercel builds and previews run with NODE_ENV=production,
 * so the route answers 404 there. Local development servers show it at /dev/chat. It calls no model, no
 * database and no route of the app: a stand-in plays recorded answers, and nothing on it is recorded or
 * sent anywhere. The two models in the picker and the balance are TEST values.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Chat panel preview (development)',
  robots: { index: false, follow: false },
};

export default function ChatPreviewPage(): ReactElement {
  if (process.env.NODE_ENV === 'production') notFound();
  return <ChatPreview />;
}

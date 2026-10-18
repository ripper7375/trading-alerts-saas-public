'use client';

import { useState } from 'react';

/**
 * Whether a modal that is closed until someone asks for it has ever been
 * open. Render the modal only while this is true: it is then fetched the first
 * time it opens (when it is loaded with `next/dynamic`), and stays mounted
 * afterwards so closing it still plays its exit animation and keeps its state.
 */
export function useMountedOnceOpen(open: boolean): boolean {
  const [mounted, setMounted] = useState(open);
  // Adjusting state while rendering is React's own pattern for a value derived
  // from props (no effect, no extra paint): this render is simply redone.
  if (open && !mounted) setMounted(true);
  return mounted || open;
}

'use client';

import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';

/**
 * A sentence of a Server Component page that quotes the live commission rate.
 * The server translates the sentence and leaves `{percent}` in it; this leaf
 * fills the number in from `useAffiliateConfig()` (SystemConfig, refreshed
 * from the browser), as the pages did when they were Client Components, so
 * the rest of the page stays on the server.
 */
export function CommissionPercentText({
  template,
}: {
  /** The translated sentence, with `{percent}` where the rate belongs. */
  template: string;
}): React.ReactElement {
  const { commissionPercent } = useAffiliateConfig();
  return <>{template.replace('{percent}', String(commissionPercent))}</>;
}

import type { Metadata } from 'next';

import { getDictionary } from '@/lib/i18n/get-dictionary';
import { getServerLanguage } from '@/lib/i18n/server-locale';

/**
 * Page metadata (tab title, description) in the visitor's language.
 * A static `export const metadata` is rendered once in English; pages use
 * this from `generateMetadata()` instead. The English text is the fallback
 * when the key is missing.
 */
export async function localizedMetadata(
  title: { key: string; fallback: string },
  description?: { key: string; fallback: string }
): Promise<Metadata> {
  const dict = getDictionary(await getServerLanguage());
  return {
    title: dict[title.key] ?? title.fallback,
    ...(description && {
      description: dict[description.key] ?? description.fallback,
    }),
  };
}

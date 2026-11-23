/**
 * The fixed reply to a refusal, in a locale (architecture 4.3, plan part 3 and part 5).
 *
 * The English is the registry's (`lib/intake/text.ts`); the 19 translations are the
 * `intake.refusal.*` keys of the dictionaries, read from a small generated copy of just those
 * keys (`lib/i18n/intake-refusal-messages.json`: 10 keys in 19 locales, about 20 KB). It does NOT
 * read `lib/i18n/get-dictionary.ts`: that file holds all 19 dictionaries (6.5 MB), and Turbopack
 * gave every group of route handlers that reached it its own 7.8 MB chunk plus a 7.7 MB source
 * map (four copies, 62 MB of `.next` on 2026-11-23). After a change to a dictionary, regenerate
 * the copy with `node scripts/i18n/generate-intake-refusal-messages.cjs`; a test fails until
 * you do.
 *
 * A locale that has no text for a key (it cannot happen while the dictionaries are held to the
 * registry key for key, but a gap must not become an empty reply) gets the English. A locale the
 * copy does not know reads en-GB, as `getDictionary()` does. `{name}` placeholders are filled by
 * the caller.
 *
 * Its own file, apart from `access.ts`, so the development preview can use it without pulling in
 * the session and the database.
 *
 * @module lib/intake/server/reply
 */

import 'server-only';

import messages from '@/lib/i18n/intake-refusal-messages.json';

import type { RefusalCode } from '../refusal';
import {
  INTAKE_TEXT,
  fillText,
  refusalTextKey,
  type TextParams,
} from '../text';

const REFUSAL_MESSAGES: Record<string, Record<string, unknown>> = messages;

export function replyText(
  code: RefusalCode,
  locale: string,
  params?: TextParams
): string {
  const key = refusalTextKey(code);
  const translated: unknown = (REFUSAL_MESSAGES[locale] ||
    REFUSAL_MESSAGES['en-GB'])?.[key];
  return fillText(
    typeof translated === 'string' && translated !== ''
      ? translated
      : INTAKE_TEXT[key],
    params
  );
}

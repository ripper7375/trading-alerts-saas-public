/**
 * The fixed reply to a refusal, in a locale (architecture 4.3, plan part 3 and part 5).
 *
 * The English is the registry's (`lib/intake/text.ts`); the 19 translations are the
 * `intake.refusal.*` keys of the dictionaries. A locale that has no text for a key (it cannot
 * happen while the dictionaries are held to the registry key for key, but a gap must not become
 * an empty reply) gets the English. `{name}` placeholders are filled by the caller.
 *
 * Its own file, apart from `access.ts`, so the development preview can use it without pulling in
 * the session and the database.
 *
 * @module lib/intake/server/reply
 */

import { getDictionary } from '@/lib/i18n/get-dictionary';

import type { RefusalCode } from '../refusal';
import {
  INTAKE_TEXT,
  fillText,
  refusalTextKey,
  type TextParams,
} from '../text';

export function replyText(
  code: RefusalCode,
  locale: string,
  params?: TextParams
): string {
  const key = refusalTextKey(code);
  const translated: unknown = getDictionary(locale)[key];
  return fillText(
    typeof translated === 'string' && translated !== ''
      ? translated
      : INTAKE_TEXT[key],
    params
  );
}

'use client';

/**
 * The one hook every Report 2 component reads its words and figures through
 * (build step 5, part 7). It sits on `useLocale()`: `t()` for the words, the
 * viewer's date and time formats for a time, and the language for the digits.
 *
 * `tr(key, params)` is the text of a key with its `{placeholders}` filled;
 * `fig(shown)` is a figure dressed for the viewer; `say(described)` is a message
 * of `messages.ts` with its figures dressed and filled in. In a right-to-left
 * language every figure inside a sentence is isolated, so a price or a level name
 * keeps its own direction.
 *
 * @module components/report2/use-report2
 */

import { useCallback, useMemo } from 'react';

import { useLocale } from '@/lib/context/locale-context';
import { textDirection } from '@/lib/i18n/languages';
import type { Described } from '@/lib/engine4/templates/messages';
import type { Shown } from '@/lib/engine4/templates/report2';
import {
  REPORT2_TEXT,
  fillText,
  type Report2Key,
  type TextParams,
} from '@/lib/engine4/templates/text';

import { formatFigure, isolate } from './format';

export interface Report2Words {
  language: string;
  dir: 'ltr' | 'rtl';
  /** the translated text of a key; `params` fill its placeholders with ready text */
  tr: (key: Report2Key, params?: TextParams) => string;
  /** a figure, dressed for the viewer */
  fig: (shown: Shown) => string;
  /** a message with its figures, dressed and filled in */
  say: (described: Described) => string;
}

export function useReport2(): Report2Words {
  const { t, language, formatDateTime } = useLocale();
  const dir = textDirection(language);

  const tr = useCallback(
    (key: Report2Key, params?: TextParams): string =>
      fillText(t(key, REPORT2_TEXT[key]), params),
    [t]
  );

  const fig = useCallback(
    (shown: Shown): string => formatFigure(shown, { language, formatDateTime }),
    [language, formatDateTime]
  );

  const say = useCallback(
    (described: Described): string => {
      const filled: Record<string, string> = {};
      for (const [name, shown] of Object.entries(described.params)) {
        const text = formatFigure(shown, { language, formatDateTime });
        filled[name] = dir === 'rtl' ? isolate(text) : text;
      }
      return tr(described.key, filled);
    },
    [dir, language, formatDateTime, tr]
  );

  return useMemo(
    () => ({ language, dir, tr, fig, say }),
    [language, dir, tr, fig, say]
  );
}

'use client';

/**
 * The one hook every chat component reads its words and figures through (build step 7 part 8). It sits
 * on `useLocale()`: `t()` for the words, the viewer's date and time formats for a time, the language
 * for the marks of a number. In a right-to-left language every figure that goes INTO a sentence is
 * isolated, so a price, a time or a sensor id keeps its own direction inside Arabic or Urdu text.
 *
 * @module components/chat/use-chat-words
 */

import { useCallback, useMemo } from 'react';

import { useLocale } from '@/lib/context/locale-context';
import { textDirection } from '@/lib/i18n/languages';

import {
  formatCount,
  formatPercent,
  formatPrice,
  formatRatio,
  isolate,
} from './format';
import { CHAT_TEXT, fillText, type ChatKey, type TextParams } from './text';

export interface ChatWords {
  language: string;
  dir: 'ltr' | 'rtl';
  /** the translated text of a key; `params` fill its placeholders with ready text */
  tr: (key: ChatKey, params?: TextParams) => string;
  /** a price or a dollar distance */
  price: (value: number) => string;
  ratio: (value: number) => string;
  count: (value: number) => string;
  percent: (share: number) => string;
  /** a moment (ISO text or a cycle slot such as `2026-09-18T20:55Z`) in the viewer's zone and format */
  time: (moment: string) => string;
  /** a figure or a code that goes inside a sentence: isolated when the sentence runs right to left */
  inline: (text: string) => string;
}

export function useChatWords(): ChatWords {
  const { t, language, formatDateTime } = useLocale();
  const dir = textDirection(language);

  const tr = useCallback(
    (key: ChatKey, params?: TextParams): string =>
      fillText(t(key, CHAT_TEXT[key]), params),
    [t]
  );

  const inline = useCallback(
    (text: string): string => (dir === 'rtl' ? isolate(text) : text),
    [dir]
  );

  const time = useCallback(
    (moment: string): string => {
      const parsed = new Date(moment);
      return Number.isNaN(parsed.getTime()) ? moment : formatDateTime(parsed);
    },
    [formatDateTime]
  );

  return useMemo(
    () => ({
      language,
      dir,
      tr,
      price: (value: number) => formatPrice(value, language),
      ratio: (value: number) => formatRatio(value, language),
      count: (value: number) => formatCount(value, language),
      percent: (share: number) => formatPercent(share, language),
      time,
      inline,
    }),
    [language, dir, tr, time, inline]
  );
}

'use client';

/**
 * Where the Free tier's recorded example comes from (build step 7 parts 8 and 10; ADR-072, plan
 * decision D19).
 *
 * The recording is a real golden-scenario conversation replayed from storage (`config/reply/demo/`,
 * one file per locale, made by `scripts/reply/record-demo.js` from a RECORDED RUN), so a view costs
 * nothing and calls no model. The renderer (`demo-replay.tsx`) draws it with the same cards the live
 * panel uses and a banner that says it is a recording.
 *
 * WHEN A TRADER IS SHOWN ONE. Only when both of these hold, and `loadDemo` returns null (the panel
 * then says the example is not available yet) when either does not:
 *
 *   1. a person has APPROVED the recordings (`config/reply/demo/approval.json`): the 19 languages
 *      are the model's words and nobody reads them for the trader otherwise;
 *   2. the recordings come from a LIVE run: a STAND-IN run's sentences are the test harness's, and
 *      a replayed picture of the market with made-up words must never reach a trader, approved or
 *      not.
 *
 * `__tests__/lib/reply/eval/demo-freshness.test.ts` holds each file to what the pipeline makes of the
 * recorded run's replies again, and `__tests__/components/chat/demo-recordings.test.tsx` holds the
 * files to `scripts/reply/record-demo.js check` (so an approval is only worth anything if it is for
 * the files that are here), to the result contract, and to the two rules above. A preview or a test that wants to LOOK at an unapproved
 * recording says so, by `includeUnapproved` or by the `DemoPolicyContext` (the dev previews do);
 * no page of the product does.
 *
 * @module components/chat/demo-source
 */

import { createContext, useContext, useMemo } from 'react';

import approval from '@/config/reply/demo/approval.json';
import ar from '@/config/reply/demo/ar.json';
import de from '@/config/reply/demo/de.json';
import enGB from '@/config/reply/demo/en-GB.json';
import enUS from '@/config/reply/demo/en-US.json';
import es from '@/config/reply/demo/es.json';
import fr from '@/config/reply/demo/fr.json';
import hi from '@/config/reply/demo/hi.json';
import id from '@/config/reply/demo/id.json';
import it from '@/config/reply/demo/it.json';
import ja from '@/config/reply/demo/ja.json';
import ko from '@/config/reply/demo/ko.json';
import ptBR from '@/config/reply/demo/pt-BR.json';
import pt from '@/config/reply/demo/pt.json';
import th from '@/config/reply/demo/th.json';
import tr from '@/config/reply/demo/tr.json';
import ur from '@/config/reply/demo/ur.json';
import vi from '@/config/reply/demo/vi.json';
import zhTW from '@/config/reply/demo/zh-TW.json';
import zh from '@/config/reply/demo/zh.json';

import type { DemoRecording } from './types';

/** One recording file as `scripts/reply/record-demo.js` writes it. */
export interface DemoFile {
  schema: 'demo-recording/1';
  locale: string;
  /** which kind of run the words come from */
  source: {
    kind: 'STAND_IN' | 'LIVE';
    run_id: string;
    fingerprint_sha256: string;
    scenario: string;
    trader: string;
    pass: number;
  };
  recording: DemoRecording;
}

/** The files by locale. The JSON is checked against the result contract by a test, not here. */
const FILES: Readonly<Record<string, DemoFile>> = {
  'en-US': enUS as unknown as DemoFile,
  'en-GB': enGB as unknown as DemoFile,
  es: es as unknown as DemoFile,
  de: de as unknown as DemoFile,
  pt: pt as unknown as DemoFile,
  'pt-BR': ptBR as unknown as DemoFile,
  it: it as unknown as DemoFile,
  ja: ja as unknown as DemoFile,
  ar: ar as unknown as DemoFile,
  fr: fr as unknown as DemoFile,
  ko: ko as unknown as DemoFile,
  zh: zh as unknown as DemoFile,
  'zh-TW': zhTW as unknown as DemoFile,
  ur: ur as unknown as DemoFile,
  hi: hi as unknown as DemoFile,
  vi: vi as unknown as DemoFile,
  id: id as unknown as DemoFile,
  th: th as unknown as DemoFile,
  tr: tr as unknown as DemoFile,
};

/** The locale shown when the trader's own has no recording. */
const FALLBACK_LOCALE = 'en-US';

export interface DemoPolicy {
  /** show a recording that is not approved, or that comes from a stand-in run (previews and tests only) */
  includeUnapproved: boolean;
}

export const DemoPolicyContext = createContext<DemoPolicy>({
  includeUnapproved: false,
});

/** The files a trader could be shown: every one of them must pass `shownToTraders`. */
export function demoFileFor(language: string): DemoFile | null {
  return FILES[language] ?? FILES[FALLBACK_LOCALE] ?? null;
}

/** Does this recording pass the two rules above (approved, and from a live run)? */
export function shownToTraders(file: DemoFile): boolean {
  return approval.status === 'APPROVED' && file.source.kind === 'LIVE';
}

/**
 * The recorded example for a locale (English when the locale has none), or null when it may not be
 * shown yet. Pure and synchronous: the files are part of the page.
 */
export function loadDemo(
  language: string,
  policy: DemoPolicy = { includeUnapproved: false }
): DemoRecording | null {
  const file = demoFileFor(language);
  if (file === null) return null;
  return policy.includeUnapproved || shownToTraders(file)
    ? file.recording
    : null;
}

/** `loadDemo` under the policy of the nearest `DemoPolicyContext`: what the two Free panels call. */
export function useDemo(language: string): DemoRecording | null {
  const policy = useContext(DemoPolicyContext);
  const includeUnapproved = policy.includeUnapproved;
  return useMemo(
    () => loadDemo(language, { includeUnapproved }),
    [language, includeUnapproved]
  );
}

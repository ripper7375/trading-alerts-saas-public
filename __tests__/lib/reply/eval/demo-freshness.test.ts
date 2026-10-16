/**
 * @jest-environment node
 */

/**
 * The Free recording is what the recorded run it names makes of its replies (build step 7 part 10;
 * ADR-099 D19).
 *
 * `demo-recordings.test.tsx` holds the files to the result contract, to the review tool and to the
 * rule that decides when a trader sees one. This file holds them to their SOURCE: each file says which
 * run it was made from (its id and fingerprint), that run must be on disk, and playing the run's
 * recorded replies of scenario M01 through the real pipeline again must give the recording, field for
 * field. A recording that was made from an older run than the one committed, or edited by hand, fails
 * here and says which locale.
 */

jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));

import { readFileSync } from 'fs';
import { join } from 'path';

import { scenarioById } from '@/lib/reply/eval/scenarios';
import type { Scenario } from '@/lib/reply/eval/scenarios';

import { runCellFull } from './helpers/harness';
import { ROOT, loadRuns } from './helpers/runs';

const LOCALES = [
  'en-US',
  'en-GB',
  'es',
  'de',
  'pt',
  'pt-BR',
  'it',
  'ja',
  'ar',
  'fr',
  'ko',
  'zh',
  'zh-TW',
  'ur',
  'hi',
  'vi',
  'id',
  'th',
  'tr',
];

const file = (locale: string): any =>
  JSON.parse(
    readFileSync(
      join(ROOT, 'config', 'reply', 'demo', `${locale}.json`),
      'utf8'
    )
  );

describe('the Free recording and its run', () => {
  const runs = loadRuns();
  const source = file('en-US').source;
  const run = runs.find((candidate) => candidate.id === source.run_id);

  it('names a run that is on disk, with the fingerprint and the kind the file says', () => {
    expect(run).toBeDefined();
    expect(run!.fingerprint.sha256).toBe(source.fingerprint_sha256);
    expect(run!.kind).toBe(source.kind);
  });

  it.each(LOCALES)(
    "%s is the result the pipeline makes of the run's recorded replies of M01",
    async (locale) => {
      const recording = file(locale);
      expect(recording.source).toEqual(source);
      const cell = run!.cells.find(
        (c) => c.id === `M01.DAY_TRADER.${locale}.1`
      );
      expect(cell).toBeDefined();
      const { out } = await runCellFull(
        scenarioById('M01') as Scenario,
        { scenario: 'M01', trader: 'DAY_TRADER', locale, pass: 1 },
        { replies: cell!.calls.map((call) => call.text) }
      );
      expect(out.kind).toBe('REPLY');
      const result = (out as { result: unknown }).result;
      expect(recording.recording.turns[0].result).toEqual(result);
      expect(recording.recording.as_of).toBe(
        (result as { stamp: { as_of: string } }).stamp.as_of
      );
    },
    60_000
  );
});

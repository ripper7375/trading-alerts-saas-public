/**
 * The Free tier's recorded example (build step 7 part 10; ADR-072, decision D19): the 19 files of
 * `config/reply/demo/`, the rule that decides when a trader may be shown one, and the real cards
 * drawing them in every language.
 *
 * WHAT THE FILES ARE. Today they come from a STAND-IN run: the sentences are the test harness's, not a
 * model's. They prove the Free tier can replay a stored conversation in 19 languages for nothing. The
 * rule (`shownToTraders`) is that a trader sees one only when a person has approved the files AND they
 * come from a LIVE run, so nothing here is shown to anybody until S2 and S5 of the runbook are done.
 * `LESSONS-LEARNED.md` L40: `LocaleProvider` wraps every render and no test uses fake timers.
 */

import { screen, within } from '@testing-library/react';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

import ChatPanel from '@/components/chat-panel';
import { DemoReplay } from '@/components/chat/demo-replay';
import {
  DemoPolicyContext,
  demoFileFor,
  loadDemo,
  shownToTraders,
  type DemoFile,
} from '@/components/chat/demo-source';
import { ThreadList } from '@/components/chat/thread-list';
import { validateReplyResult } from '@/lib/reply/contracts/result';
import type { Report1Result } from '@/lib/reply/contracts/result';

import { plain, renderIn, waitForLanguage } from '../report2/helpers/render';

jest.mock('next/navigation', () => ({
  usePathname: () => '/dev/chat',
}));

const ROOT = resolve(__dirname, '..', '..', '..');
const DIR = join(ROOT, 'config', 'reply', 'demo');
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

const tool = require('../../../scripts/reply/record-demo.js') as {
  check: (
    root: string,
    o?: { requireApproved?: boolean }
  ) => { problems: string[]; status: string | null };
  FILES: { review: string; approval: string };
  fileOf: (locale: string) => string;
};

const fileOnDisk = (locale: string): DemoFile =>
  JSON.parse(readFileSync(join(DIR, `${locale}.json`), 'utf8')) as DemoFile;
const approvalOnDisk = (): { status: string } =>
  JSON.parse(readFileSync(join(DIR, 'approval.json'), 'utf8')) as {
    status: string;
  };

describe('the 19 recordings on disk', () => {
  it('are one file per locale, a Report 1 of the 18 Sep cycle answering an M5 instant prompt, each valid under the result contract', () => {
    const names = readdirSync(DIR).filter(
      (n) => n.endsWith('.json') && n !== 'approval.json'
    );
    expect(names.sort()).toEqual(LOCALES.map((l) => `${l}.json`).sort());
    for (const locale of LOCALES) {
      const file = fileOnDisk(locale);
      expect(file.schema).toBe('demo-recording/1');
      expect(file.locale).toBe(locale);
      expect(file.recording.locale).toBe(locale);
      expect(file.recording.as_of).toBe('2026-09-18T20:55Z');
      expect(file.recording.turns).toHaveLength(1);
      const turn = file.recording.turns[0]!;
      expect(turn).toMatchObject({
        question: null,
        instant: 'INSTANT_M5_INSPECT',
      });
      const verdict = validateReplyResult(turn.result);
      expect([locale, verdict.ok]).toEqual([locale, true]);
      expect(turn.result.kind).toBe('REPORT1');
      expect(turn.result.reply_locale).toBe(locale);
      expect(turn.result.stamp.as_of).toBe('2026-09-18T20:55Z');
    }
  });

  it("say the same thing about the market in every language: the direction, the zones and the numbers are the engines', only the words differ", () => {
    const reports = LOCALES.map(
      (l) => fileOnDisk(l).recording.turns[0]!.result as Report1Result
    );
    const first = reports[0]!;
    for (const report of reports) {
      expect(report.report.direction).toEqual(first.report.direction);
      expect(report.report.zones).toEqual(first.report.zones);
      expect(report.report.levels).toEqual(first.report.levels);
      expect(report.report.alignment.channels).toEqual(
        first.report.alignment.channels
      );
      expect(report.stamp).toEqual(first.stamp);
    }
    // and the words are the language's: the headlines are all different between languages that are
    expect(
      new Set(reports.map((r) => r.report.headline)).size
    ).toBeGreaterThanOrEqual(15);
  });

  it('carry no equity and no commission anywhere (ADR-077)', () => {
    for (const locale of LOCALES) {
      expect(readFileSync(join(DIR, `${locale}.json`), 'utf8')).not.toMatch(
        /equity|commission/i
      );
    }
  });

  it('say where they came from: one run, its kind, its fingerprint, and the scenario', () => {
    const sources = LOCALES.map((l) => JSON.stringify(fileOnDisk(l).source));
    expect(new Set(sources).size).toBe(1);
    const source = fileOnDisk('en-US').source;
    expect(source).toMatchObject({
      scenario: 'M01',
      trader: 'DAY_TRADER',
      pass: 1,
    });
    expect(['STAND_IN', 'LIVE']).toContain(source.kind);
    expect(source.fingerprint_sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('the review tool holds the files, the sheet and the approval together', () => {
  it('finds nothing wrong with the files as they are, whoever has signed', () => {
    expect(tool.check(ROOT).problems).toEqual([]);
  });

  describe('on a copy', () => {
    let tree: string;
    beforeEach(() => {
      tree = mkdtempSync(join(tmpdir(), 'demo-tool-'));
      mkdirSync(join(tree, 'config/reply/demo'), { recursive: true });
      for (const name of readdirSync(DIR))
        copyFileSync(join(DIR, name), join(tree, 'config/reply/demo', name));
    });
    afterEach(() => {
      rmSync(tree, { recursive: true, force: true });
    });
    const edit = (locale: string, change: (f: any) => void): void => {
      const path = join(tree, tool.fileOf(locale));
      const f = JSON.parse(readFileSync(path, 'utf8'));
      change(f);
      writeFileSync(path, `${JSON.stringify(f, null, 2)}\n`);
    };

    it('is clean on an untouched copy', () => {
      expect(tool.check(tree).problems).toEqual([]);
    });

    it('keeps the gate closed while PENDING, and for a stand-in recording even when signed', () => {
      expect(
        tool.check(tree, { requireApproved: true }).problems.join('\n')
      ).toContain('PENDING');
      const approval = JSON.parse(
        readFileSync(join(tree, tool.FILES.approval), 'utf8')
      );
      writeFileSync(
        join(tree, tool.FILES.approval),
        JSON.stringify({
          ...approval,
          status: 'APPROVED',
          approved_by: 'Davin',
          approved_on: '2026-10-17',
        })
      );
      const problems = tool
        .check(tree, { requireApproved: true })
        .problems.join('\n');
      if (fileOnDisk('en-US').source.kind === 'STAND_IN') {
        expect(problems).toContain('STAND-IN');
        expect(problems).not.toContain('PENDING');
      } else {
        expect(problems).toBe('');
      }
    });

    it.each([
      [
        'a recording with the wrong locale',
        (f: any) => {
          f.locale = 'fr';
        },
        'locale must be',
      ],
      [
        'a recording with two turns',
        (f: any) => {
          f.recording.turns.push(f.recording.turns[0]);
        },
        'exactly one turn',
      ],
      [
        'a turn that is a typed question',
        (f: any) => {
          f.recording.turns[0].question = 'x';
          f.recording.turns[0].instant = null;
        },
        'an INSTANT_M5_INSPECT prompt',
      ],
      [
        'a result that is not a Report 1',
        (f: any) => {
          f.recording.turns[0].result.kind = 'ANSWER';
        },
        'a Report 1',
      ],
      [
        'a result in another language',
        (f: any) => {
          f.recording.turns[0].result.reply_locale = 'fr';
        },
        'result.reply_locale must be',
      ],
      [
        'a stamp with another time',
        (f: any) => {
          f.recording.turns[0].result.stamp.as_of = '2026-09-18T21:00Z';
        },
        "the stamp's time is the recording's",
      ],
      [
        'a source from another scenario',
        (f: any) => {
          f.source.scenario = 'G01';
        },
        'the recording is of M01',
      ],
      [
        'a source kind that is neither',
        (f: any) => {
          f.source.kind = 'HUMAN';
        },
        'source.kind must be',
      ],
      [
        'a key that names equity',
        (f: any) => {
          f.recording.turns[0].result.equity = 1;
        },
        'equity or commission',
      ],
    ])('refuses %s', (_name, change, words) => {
      edit('de', change);
      expect(tool.check(tree).problems.join('\n')).toContain(words);
    });

    it('refuses recordings from two different runs', () => {
      edit('de', (f) => {
        f.source.run_id = 'standin-000000000000';
      });
      expect(tool.check(tree).problems.join('\n')).toContain(
        'not all from one run'
      );
    });

    it('notices a missing file, a stale sheet and an approval for other recordings', () => {
      rmSync(join(tree, tool.fileOf('tr')));
      expect(() => tool.check(tree)).toThrow(/tr\.json is missing/);
      copyFileSync(join(DIR, 'tr.json'), join(tree, tool.fileOf('tr')));

      edit('es', (f) => {
        f.recording.turns[0].result.report.headline += ' !';
      });
      const problems = tool.check(tree).problems.join('\n');
      expect(problems).toContain('differs from a fresh run');
      expect(problems).toContain('written for other recordings');
    });
  });
});

describe('when a trader may be shown the recording (loadDemo)', () => {
  const approved = approvalOnDisk().status === 'APPROVED';

  it('shows nothing to a trader unless the files are approved AND come from a live run', () => {
    for (const locale of LOCALES) {
      const file = demoFileFor(locale)!;
      const expected = approved && file.source.kind === 'LIVE';
      expect([locale, shownToTraders(file)]).toEqual([locale, expected]);
      expect([locale, loadDemo(locale) !== null]).toEqual([locale, expected]);
    }
  });

  it('shows a preview or a test every recording, in its own locale, when it asks to', () => {
    for (const locale of LOCALES) {
      const recording = loadDemo(locale, { includeUnapproved: true });
      expect(recording).not.toBeNull();
      expect(recording!.locale).toBe(locale);
    }
  });

  it('falls back to English for a locale it has no recording for, and for nothing else', () => {
    expect(loadDemo('xx', { includeUnapproved: true })!.locale).toBe('en-US');
    expect(demoFileFor('xx')!.locale).toBe('en-US');
    expect(demoFileFor('')!.locale).toBe('en-US');
  });

  describe('the two rules, with the approval and the source changed', () => {
    const load = (status: string, kind: 'LIVE' | 'STAND_IN') => {
      let loaded!: typeof import('@/components/chat/demo-source');
      jest.isolateModules(() => {
        jest.doMock('@/config/reply/demo/approval.json', () => ({
          __esModule: true,
          default: { status },
        }));
        jest.doMock('@/config/reply/demo/en-US.json', () => ({
          __esModule: true,
          default: {
            ...fileOnDisk('en-US'),
            source: { ...fileOnDisk('en-US').source, kind },
          },
        }));

        loaded = require('@/components/chat/demo-source');
      });
      return loaded;
    };
    afterEach(() => {
      jest.dontMock('@/config/reply/demo/approval.json');
      jest.dontMock('@/config/reply/demo/en-US.json');
    });

    it.each([
      ['PENDING', 'LIVE', false],
      ['PENDING', 'STAND_IN', false],
      ['APPROVED', 'STAND_IN', false],
      ['APPROVED', 'LIVE', true],
    ] as const)('%s and %s: shown to a trader = %s', (status, kind, shown) => {
      const source = load(status, kind);
      expect(source.loadDemo('en-US') !== null).toBe(shown);
      // a preview can always look
      expect(
        source.loadDemo('en-US', { includeUnapproved: true })
      ).not.toBeNull();
    });
  });
});

describe('the real cards draw each recording in its language', () => {
  it.each(LOCALES)(
    '%s: a banner that says it is recorded and when its data is from, the Report 1 card, no Trade Setup button',
    async (locale) => {
      const recording = loadDemo(locale, { includeUnapproved: true })!;
      renderIn(<DemoReplay demo={recording} />, locale);
      await waitForLanguage(locale);
      expect(screen.getByRole('note')).toBeInTheDocument();
      expect(screen.getByTestId('demo-label').textContent).toMatch(
        /2026|20:55|18/
      );
      const turn = screen.getByTestId('demo-turn');
      expect(within(turn).getByTestId('user-bubble')).toBeInTheDocument();
      const card = within(turn).getByTestId('report1-card');
      const headline = (recording.turns[0]!.result as Report1Result).report
        .headline;
      expect(plain(card.textContent)).toContain(plain(headline));
      expect(
        screen.queryByRole('button', { name: /trade setup/i })
      ).not.toBeInTheDocument();
    }
  );

  it('is drawn from the recording the panel was given, in Panel B and in Panel A (one thread, labelled)', async () => {
    renderIn(
      <DemoPolicyContext.Provider value={{ includeUnapproved: true }}>
        <ChatPanel tier="FREE" />
      </DemoPolicyContext.Provider>
    );
    expect(await screen.findByTestId('demo-replay')).toBeInTheDocument();
    expect(screen.getByTestId('report1-card')).toBeInTheDocument();
    expect(screen.queryByTestId('demo-empty')).not.toBeInTheDocument();
  });

  it('is not drawn when the policy does not allow an unapproved recording: the panel says the example is not available yet', () => {
    // the product's own state: nothing is shown until the files are approved and live
    const expectedShown =
      approvalOnDisk().status === 'APPROVED' &&
      fileOnDisk('en-US').source.kind === 'LIVE';
    renderIn(<ChatPanel tier="FREE" />);
    expect(screen.queryByTestId('demo-empty') === null).toBe(expectedShown);
  });

  it("puts the recorded conversation in Panel A as the Free tier's one thread", async () => {
    const recording = loadDemo('en-US', { includeUnapproved: true })!;
    renderIn(<ThreadList collapsed={false} tier="FREE" demo={recording} />);
    const list = await screen.findByTestId('threads-demo');
    expect(within(list).getByTestId('thread-item')).toHaveAttribute(
      'data-demo',
      'true'
    );
    expect(screen.queryByTestId('threads-demo-empty')).not.toBeInTheDocument();
  });
});

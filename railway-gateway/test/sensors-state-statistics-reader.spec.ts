import { spawnSync } from 'child_process';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  InvalidStatisticsQuery,
  StateStatisticsReader,
  StatisticsReading,
  StoredStatistics,
  interpretRow,
  provisionalWords,
} from '../src/sensors/state-statistics.reader';
import {
  MIN_SAMPLE,
  seriesKeyOf,
} from '../src/sensors/state-statistics.series';
import { ENGINE_DIR } from './helpers/cycle-fixtures';
import {
  CONFIG_KEY,
  FIGURES,
  provisionalRow,
  readOnlyPrisma,
  row,
} from './helpers/state-statistics-world';

/**
 * The reader (build step 3 part 6), the only code that reads `state_statistics`: below n = 30 it
 * answers in words, at n = 30 and above it answers with the figures AND the n, and it finds the
 * series from the reading itself. The database CHECK and the writer make a bad row impossible; here
 * the reader is shown to hold the gate on its own, on rows the table should never contain.
 */

const stored = (over: Partial<StoredStatistics> = {}): StoredStatistics => ({
  n: 30,
  forward_move_median: 1.25,
  forward_move_q1: -0.5,
  forward_move_q3: 3,
  opposing_level_rate: null,
  adverse_excursion_median: 2.5,
  adverse_excursion_q3: 4,
  series_notes: 'FORMING_BAR_FIT: UNVERIFIED',
  ...over,
});

const reading = {
  mcdId: 'MCD2',
  evaluatorVersion: '2.0.1',
  configHash: { best_fit_a: 'h1' },
  stateCode: 'MCD2_CHANNEL_UP',
  horizonHours: 2,
};

function readerOver(rows: Array<ReturnType<typeof row>>) {
  const { prisma, reads } = readOnlyPrisma(rows as never);
  return {
    reader: new StateStatisticsReader(prisma as unknown as PrismaService),
    reads,
  };
}

/** Every number anywhere in a reading, with its path. */
function numbersIn(value: unknown, at = ''): Array<[string, number]> {
  if (typeof value === 'number') return [[at, value]];
  if (value && typeof value === 'object')
    return Object.entries(value).flatMap(([k, v]) =>
      numbersIn(v, `${at}.${k}`)
    );
  return [];
}

describe('interpretRow: the gate', () => {
  it('n = 29 is provisional, with the n and no figure', () => {
    const answer = interpretRow(
      stored({
        n: 29,
        forward_move_median: null,
        forward_move_q1: null,
        forward_move_q3: null,
        adverse_excursion_median: null,
        adverse_excursion_q3: null,
      }),
      2
    );
    expect(answer).toMatchObject({
      status: 'PROVISIONAL',
      reason: 'BELOW_MIN_SAMPLE',
      n: 29,
      min_sample: 30,
      horizon_hours: 2,
    });
    expect(Object.keys(answer)).not.toContain('forward_move');
    expect(Object.keys(answer)).not.toContain('adverse_excursion');
  });

  it('n = 29 WITH figures in the row (a table made without the CHECK) is still provisional and the figures are dropped', () => {
    const answer = interpretRow(stored({ n: 29 }), 2);
    expect(answer.status).toBe('PROVISIONAL');
    expect(JSON.stringify(answer)).not.toContain('1.25');
    expect(JSON.stringify(answer)).not.toContain('forward_move');
    // the only numbers are n, the minimum and the horizon
    expect(
      numbersIn(answer)
        .map(([, v]) => v)
        .sort((a, b) => a - b)
    ).toEqual([2, 29, 30]);
  });

  it('n = 30 is measured, with the figures and the n together', () => {
    const answer = interpretRow(stored({ n: 30 }), 2);
    expect(answer).toEqual({
      status: 'MEASURED',
      n: 30,
      min_sample: 30,
      horizon_hours: 2,
      forward_move: { median: 1.25, q1: -0.5, q3: 3 },
      adverse_excursion: { median: 2.5, q3: 4 },
      opposing_level_rate: null,
      series_notes: 'FORMING_BAR_FIT: UNVERIFIED',
    });
  });

  it('n = 31 and a large n are measured and carry their own n', () => {
    for (const n of [31, 87, 100000]) {
      const answer = interpretRow(stored({ n }), 12);
      expect(answer).toMatchObject({
        status: 'MEASURED',
        n,
        horizon_hours: 12,
      });
    }
  });

  it('every measured answer carries n and the minimum, whatever the row', () => {
    for (const n of [30, 45, 900]) {
      const answer = interpretRow(stored({ n }), 2);
      expect(answer.status).toBe('MEASURED');
      expect(answer.n).toBe(n);
      expect(answer.min_sample).toBe(MIN_SAMPLE);
    }
  });

  it('no row is NO_HISTORY with n = 0', () => {
    expect(interpretRow(null, 12)).toMatchObject({
      status: 'PROVISIONAL',
      reason: 'NO_HISTORY',
      n: 0,
      horizon_hours: 12,
    });
  });

  it('n = 0 in a row is below the minimum, not "no history"', () => {
    expect(
      interpretRow(
        stored({
          n: 0,
          forward_move_median: null,
          forward_move_q1: null,
          forward_move_q3: null,
          adverse_excursion_median: null,
          adverse_excursion_q3: null,
        }),
        2
      )
    ).toMatchObject({
      reason: 'BELOW_MIN_SAMPLE',
      n: 0,
    });
  });

  it('a row whose n is not a whole number is unusable', () => {
    for (const n of [-1, 30.5, NaN, Infinity]) {
      expect(interpretRow(stored({ n }), 2)).toMatchObject({
        status: 'PROVISIONAL',
        reason: 'ROW_UNUSABLE',
        n: 0,
      });
    }
  });

  it.each(FIGURES)(
    'a row at n = 30 with %s missing is unusable, not measured with a hole',
    (field) => {
      const answer = interpretRow(stored({ [field]: null }), 2);
      expect(answer).toMatchObject({
        status: 'PROVISIONAL',
        reason: 'ROW_UNUSABLE',
        n: 30,
      });
    }
  );

  it('a figure that is not a finite number makes the row unusable', () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      for (const field of FIGURES)
        expect(interpretRow(stored({ [field]: bad }), 2)).toMatchObject({
          reason: 'ROW_UNUSABLE',
        });
    }
  });

  it('quartiles out of order, a negative excursion or a median above its quartile make the row unusable', () => {
    expect(
      interpretRow(stored({ forward_move_q1: 2, forward_move_median: 1 }), 2)
    ).toMatchObject({ reason: 'ROW_UNUSABLE' });
    expect(
      interpretRow(stored({ forward_move_median: 4, forward_move_q3: 3 }), 2)
    ).toMatchObject({ reason: 'ROW_UNUSABLE' });
    expect(
      interpretRow(stored({ adverse_excursion_median: -1 }), 2)
    ).toMatchObject({ reason: 'ROW_UNUSABLE' });
    expect(
      interpretRow(
        stored({ adverse_excursion_median: 5, adverse_excursion_q3: 4 }),
        2
      )
    ).toMatchObject({ reason: 'ROW_UNUSABLE' });
  });

  it('equal quartiles and a zero excursion are usable', () => {
    const answer = interpretRow(
      stored({
        forward_move_q1: 1,
        forward_move_median: 1,
        forward_move_q3: 1,
        adverse_excursion_median: 0,
        adverse_excursion_q3: 0,
      }),
      2
    );
    expect(answer.status).toBe('MEASURED');
  });

  it('the opposing-level rate is passed through when it is a fraction, and refused when it is not', () => {
    expect(interpretRow(stored({ opposing_level_rate: 0 }), 2)).toMatchObject({
      status: 'MEASURED',
      opposing_level_rate: 0,
    });
    expect(interpretRow(stored({ opposing_level_rate: 0.4 }), 2)).toMatchObject(
      { opposing_level_rate: 0.4 }
    );
    expect(interpretRow(stored({ opposing_level_rate: 1 }), 2)).toMatchObject({
      opposing_level_rate: 1,
    });
    for (const bad of [-0.1, 1.1, 40, NaN]) {
      expect(
        interpretRow(stored({ opposing_level_rate: bad }), 2)
      ).toMatchObject({ reason: 'ROW_UNUSABLE' });
    }
  });

  it('says which horizon it answers for, measured or provisional', () => {
    for (const horizon of [2, 12]) {
      expect(interpretRow(stored({ n: 40 }), horizon)).toMatchObject({
        status: 'MEASURED',
        horizon_hours: horizon,
      });
      expect(
        interpretRow(
          stored({
            n: 7,
            forward_move_median: null,
            forward_move_q1: null,
            forward_move_q3: null,
            adverse_excursion_median: null,
            adverse_excursion_q3: null,
          }),
          horizon
        )
      ).toMatchObject({
        status: 'PROVISIONAL',
        horizon_hours: horizon,
        words: expect.stringContaining(`${horizon}-hour horizon`),
      });
    }
  });

  it("a measured answer's figures are copies of the row's, each in its own place", () => {
    const answer = interpretRow(
      stored({
        forward_move_median: 11,
        forward_move_q1: 10,
        forward_move_q3: 12,
        adverse_excursion_median: 21,
        adverse_excursion_q3: 22,
      }),
      2
    );
    expect(answer).toMatchObject({
      forward_move: { median: 11, q1: 10, q3: 12 },
      adverse_excursion: { median: 21, q3: 22 },
    });
  });
});

describe('StateStatisticsReader: which row it reads', () => {
  it("reads the one row of the reading's series, state and horizon, by its exact key", async () => {
    const { reader, reads } = readerOver([row()]);
    const answer = await reader.read(reading);
    expect(answer.status).toBe('MEASURED');
    expect(reads).toEqual([
      {
        mcd_id: 'MCD2',
        evaluator_version_series: '2.0',
        config_hash_key: CONFIG_KEY,
        state_code: 'MCD2_CHANNEL_UP',
        horizon_hours: 2,
      },
    ]);
  });

  it('reads a stored 12-hour row and answers for 12 hours', async () => {
    const { reader, reads } = readerOver([
      row({
        horizon_hours: 12,
        n: 44,
        forward_move_median: 7.5,
        forward_move_q3: 9,
      }),
      provisionalRow(8, { horizon_hours: 12, state_code: 'MCD2_CHANNEL_DOWN' }),
    ]);
    const measured = await reader.read({ ...reading, horizonHours: 12 });
    expect(measured).toMatchObject({
      status: 'MEASURED',
      n: 44,
      horizon_hours: 12,
      forward_move: { median: 7.5 },
    });
    const provisional = await reader.read({
      ...reading,
      horizonHours: 12,
      stateCode: 'MCD2_CHANNEL_DOWN',
    });
    expect(provisional).toMatchObject({
      status: 'PROVISIONAL',
      n: 8,
      horizon_hours: 12,
    });
    expect(reads.map((r) => r['horizon_hours'])).toEqual([12, 12]);
  });

  it('a patch release reads the same row', async () => {
    const { reader } = readerOver([row()]);
    for (const evaluatorVersion of ['2.0.0', '2.0.1', '2.0.9'])
      expect((await reader.read({ ...reading, evaluatorVersion })).status).toBe(
        'MEASURED'
      );
  });

  it("a minor release starts at nothing: the old series' figures are not borrowed", async () => {
    const { reader } = readerOver([row()]);
    const answer = await reader.read({ ...reading, evaluatorVersion: '2.1.0' });
    expect(answer).toMatchObject({
      status: 'PROVISIONAL',
      reason: 'NO_HISTORY',
      n: 0,
    });
  });

  it('a changed config_hash starts at nothing', async () => {
    const { reader } = readerOver([row()]);
    const answer = await reader.read({
      ...reading,
      configHash: { best_fit_a: 'h2' },
    });
    expect(answer).toMatchObject({
      status: 'PROVISIONAL',
      reason: 'NO_HISTORY',
    });
  });

  it('another state, MCD or horizon is another row', async () => {
    const { reader } = readerOver([row()]);
    expect((await reader.read({ ...reading, horizonHours: 12 })).status).toBe(
      'PROVISIONAL'
    );
    expect(
      (await reader.read({ ...reading, stateCode: 'MCD2_CHANNEL_DOWN' })).status
    ).toBe('PROVISIONAL');
    expect(
      (await reader.read({ ...reading, mcdId: 'MCD1', stateCode: 'MCD1_X' }))
        .status
    ).toBe('PROVISIONAL');
  });

  it('the config_hash can be given in any key order', async () => {
    const two = { best_fit_a: 'h1', non_b: 'h9' };
    const { reader } = readerOver([
      row({ ...seriesKeyOf({ ...reading, configHash: two }) }),
    ]);
    const reversed = { non_b: 'h9', best_fit_a: 'h1' };
    expect(
      (await reader.read({ ...reading, configHash: reversed })).status
    ).toBe('MEASURED');
  });

  it('asks for one row by one exact key and uses no other method of the table', async () => {
    // readOnlyPrisma has findUnique and nothing else: any other call would throw "is not a function"
    const { reader, reads } = readerOver([
      row(),
      provisionalRow(12, { horizon_hours: 12 }),
    ]);
    await reader.read(reading);
    await reader.read({ ...reading, horizonHours: 12 });
    expect(reads).toHaveLength(2);
  });

  it('answers with what the row says: n = 29 in the table is provisional', async () => {
    const { reader } = readerOver([provisionalRow(29)]);
    expect(await reader.read(reading)).toMatchObject({
      status: 'PROVISIONAL',
      reason: 'BELOW_MIN_SAMPLE',
      n: 29,
    });
  });

  it('n = 29 WITH numbers in the table gives words and no number', async () => {
    const { reader } = readerOver([row({ n: 29 })]);
    const answer = await reader.read(reading);
    expect(answer.status).toBe('PROVISIONAL');
    expect(
      numbersIn(answer)
        .map(([k]) => k)
        .sort()
    ).toEqual(['.horizon_hours', '.min_sample', '.n']);
  });

  it('n = 30 in the table gives the figures and the n', async () => {
    const { reader } = readerOver([row({ n: 30 })]);
    const answer = await reader.read(reading);
    expect(answer).toMatchObject({
      status: 'MEASURED',
      n: 30,
      forward_move: { median: 1.25 },
    });
  });
});

describe("StateStatisticsReader: a bad query is the caller's mistake", () => {
  it.each([
    [{ ...reading, evaluatorVersion: '2.0' }],
    [{ ...reading, evaluatorVersion: 'latest' }],
    [{ ...reading, configHash: null as unknown as Record<string, string> }],
    [{ ...reading, configHash: { a: 1 } as unknown as Record<string, string> }],
    [{ ...reading, mcdId: 'MCD99' }],
    [{ ...reading, stateCode: 'channel up' }],
    [{ ...reading, stateCode: 'MCD1_CHANNEL_UP' }],
    [{ ...reading, horizonHours: 6 }],
    [{ ...reading, horizonHours: '2' as unknown as number }],
  ])(
    'throws InvalidStatisticsQuery for %j and does not touch the table',
    async (query) => {
      const { reader, reads } = readerOver([row()]);
      await expect(reader.read(query)).rejects.toBeInstanceOf(
        InvalidStatisticsQuery
      );
      expect(reads).toEqual([]);
    }
  );

  it('says what is wrong', async () => {
    const { reader } = readerOver([]);
    await expect(reader.read({ ...reading, horizonHours: 6 })).rejects.toThrow(
      /horizon_hours must be 2 or 12/
    );
    await expect(
      reader.read({ ...reading, evaluatorVersion: '2.0' })
    ).rejects.toThrow(/MAJOR\.MINOR\.PATCH/);
  });
});

// ---------------------------------------------------------------- the words

const PYTHON = process.env['SENSOR_PYTHON'] ?? 'python';
const childEnv = {
  ...process.env,
  PYTHONDONTWRITEBYTECODE: '1',
  PYTHONIOENCODING: 'utf-8',
};
const wordingAvailable =
  spawnSync(PYTHON, ['-B', '-c', 'from mcd_common import wording'], {
    cwd: ENGINE_DIR,
    env: childEnv,
    timeout: 60_000,
  }).status === 0;

/** The kit's own wording check (banned words, a percent sign, advice words) on each text. */
function kitProblems(texts: string[]): string[][] {
  const run = spawnSync(
    PYTHON,
    [
      '-B',
      '-c',
      'import json, sys\nfrom mcd_common import wording\nprint(json.dumps([wording.check_text("words", t) for t in json.load(sys.stdin)]))',
    ],
    {
      cwd: ENGINE_DIR,
      env: childEnv,
      input: JSON.stringify(texts),
      encoding: 'utf8',
      timeout: 60_000,
    }
  );
  if (run.status !== 0)
    throw new Error(`the kit's wording check failed: ${run.stderr}`);
  return JSON.parse(run.stdout) as string[][];
}

describe('the words of a provisional answer', () => {
  const sentences: string[] = [];
  for (const horizon of [2, 12])
    for (const [reason, n] of [
      ['NO_HISTORY', 0],
      ['BELOW_MIN_SAMPLE', 0],
      ['BELOW_MIN_SAMPLE', 1],
      ['BELOW_MIN_SAMPLE', 29],
      ['ROW_UNUSABLE', 0],
      ['ROW_UNUSABLE', 40],
    ] as const)
      sentences.push(provisionalWords(reason, n, horizon));

  it('say the n and the minimum for a count below it, and no other number but the horizon', () => {
    const words = provisionalWords('BELOW_MIN_SAMPLE', 29, 2);
    expect(words).toContain('29 of the 30 needed');
    expect(words).toContain('2-hour horizon');
    expect(words.match(/\d+/g)).toEqual(['2', '29', '30']);
  });

  it('say nothing numeric when there is no history', () => {
    expect(provisionalWords('NO_HISTORY', 0, 12).match(/\d+/g)).toEqual(['12']);
    expect(provisionalWords('ROW_UNUSABLE', 40, 12).match(/\d+/g)).toEqual([
      '12',
    ]);
  });

  it('tell the model to describe in words and not to quote a figure', () => {
    for (const text of sentences) expect(text).toMatch(/in words only/);
  });

  it('have no percent sign, whatever the sentence', () => {
    for (const text of sentences) expect(text).not.toContain('%');
  });

  it('are different sentences for the three reasons', () => {
    const three = (
      ['NO_HISTORY', 'BELOW_MIN_SAMPLE', 'ROW_UNUSABLE'] as const
    ).map((r) => provisionalWords(r, 5, 2));
    expect(new Set(three).size).toBe(3);
  });

  (wordingAvailable ? it : it.skip)(
    "pass the kit's own wording check: no banned word, no percent sign, no advice word",
    () => {
      expect(kitProblems(sentences)).toEqual(sentences.map(() => []));
    }
  );

  (wordingAvailable ? it : it.skip)(
    "the kit's check does flag a banned word, so a pass above means something",
    () => {
      expect(
        kitProblems(['A high probability, 40%, so buy.'])[0].length
      ).toBeGreaterThanOrEqual(2);
    }
  );

  it('are what the reader returns', async () => {
    const { reader } = readerOver([provisionalRow(12)]);
    const answer = (await reader.read(reading)) as Extract<
      StatisticsReading,
      { status: 'PROVISIONAL' }
    >;
    expect(answer.words).toBe(provisionalWords('BELOW_MIN_SAMPLE', 12, 2));
  });
});

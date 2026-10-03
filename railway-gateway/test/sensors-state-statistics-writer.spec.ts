import { PrismaService } from '../src/prisma/prisma.service';
import {
  StateStatisticsRefused,
  StateStatisticsWriter,
} from '../src/sensors/state-statistics.writer';
import {
  SERIES_NOTES,
  configHashKeyOf,
  evaluatorSeriesOf,
  seriesKeyOf,
} from '../src/sensors/state-statistics.series';
import {
  CONFIG_KEY,
  FIGURES,
  FakeStatsPrisma,
  provisionalRow,
  readGolden,
  row,
} from './helpers/state-statistics-world';

/**
 * The writer (build step 3 part 6): an upsert per series, state and horizon, in one transaction, with
 * the n >= 30 gate checked before the database sees a row. The database's own CHECK is asked in
 * `sensors-state-statistics.pg.spec.ts`; here a Prisma that is lazy, transactional and refuses what
 * the CHECK refuses shows what the writer sends.
 */

function make() {
  const prisma = new FakeStatsPrisma();
  const writer = new StateStatisticsWriter(prisma as unknown as PrismaService);
  return { prisma, writer };
}

describe('StateStatisticsWriter: what it writes', () => {
  it("writes the engine's own rows, all of them, in one transaction", async () => {
    const { prisma, writer } = make();
    const golden = readGolden().result.rows;
    const summary = await writer.writeRows(golden);
    expect(summary).toEqual({ rows: golden.length });
    expect(prisma.rows.size).toBe(golden.length);
    expect(prisma.transactions).toHaveLength(1);
    expect(prisma.transactions[0].committed).toBe(true);
    expect(prisma.transactions[0].ops).toEqual(
      golden.map(() => 'stateStatistic.upsert')
    );
    expect(prisma.autocommitted).toEqual([]);
  });

  it('stores every column of a row, with the series notes added', async () => {
    const { prisma, writer } = make();
    await writer.writeRows([row()]);
    expect(prisma.stored(row())).toEqual({
      mcd_id: 'MCD2',
      evaluator_version_series: '2.0',
      config_hash_key: CONFIG_KEY,
      state_code: 'MCD2_CHANNEL_UP',
      horizon_hours: 2,
      n: 30,
      forward_move_median: 1.25,
      forward_move_q1: -0.5,
      forward_move_q3: 3,
      opposing_level_rate: null,
      adverse_excursion_median: 2.5,
      adverse_excursion_q3: 4,
      series_notes: 'FORMING_BAR_FIT: UNVERIFIED',
    });
  });

  it('puts the forming-bar note on every row, whatever it is given', async () => {
    const { prisma, writer } = make();
    const rows = readGolden().result.rows;
    await writer.writeRows(rows);
    for (const r of prisma.rows.values())
      expect(r['series_notes']).toBe(SERIES_NOTES);
    // a caller cannot send its own: the field is not part of a row
    await expect(
      writer.writeRows([{ ...row(), series_notes: 'all verified' } as never])
    ).rejects.toThrow(/unknown fields: series_notes/);
  });

  it('a row at n = 29 is written as a count with no number', async () => {
    const { prisma, writer } = make();
    await writer.writeRows([provisionalRow(29)]);
    const stored = prisma.stored(row())!;
    expect(stored['n']).toBe(29);
    for (const field of FIGURES) expect(stored[field]).toBeNull();
    expect(stored['opposing_level_rate']).toBeNull();
  });

  it('a row at n = 30 is written with its figures', async () => {
    const { prisma, writer } = make();
    await writer.writeRows([row({ n: 30 })]);
    expect(prisma.stored(row())!['forward_move_median']).toBe(1.25);
  });

  it('the opposing-level rate is written as null on create and on update', async () => {
    const { prisma, writer } = make();
    await writer.writeRows([row()]);
    expect(prisma.stored(row())!['opposing_level_rate']).toBeNull();
    // something else put a number there (the database CHECK would only mind below n = 30)
    prisma.stored(row())!['opposing_level_rate'] = 0.5;
    await writer.writeRows([row({ n: 31 })]);
    expect(prisma.stored(row())!['opposing_level_rate']).toBeNull();
  });

  it('writes nothing and opens no transaction for an empty list', async () => {
    const { prisma, writer } = make();
    expect(await writer.writeRows([])).toEqual({ rows: 0 });
    expect(prisma.transactions).toHaveLength(0);
    expect(prisma.rows.size).toBe(0);
  });

  it('never reads the table', async () => {
    const { prisma, writer } = make();
    await writer.writeRows(readGolden().result.rows);
    await writer.writeRows(readGolden().result.rows);
    expect(prisma.reads).toEqual([]);
  });
});

describe('StateStatisticsWriter: recomputing in place', () => {
  it('a second run of the same rows updates them: no row is added', async () => {
    const { prisma, writer } = make();
    const golden = readGolden().result.rows;
    await writer.writeRows(golden);
    await writer.writeRows(golden);
    expect(prisma.rows.size).toBe(golden.length);
    expect(prisma.log.filter((l) => l.op === 'created')).toHaveLength(
      golden.length
    );
    expect(prisma.log.filter((l) => l.op === 'updated')).toHaveLength(
      golden.length
    );
  });

  it('new figures replace the old ones on the same key', async () => {
    const { prisma, writer } = make();
    await writer.writeRows([row({ n: 30, forward_move_median: 1.25 })]);
    await writer.writeRows([
      row({ n: 45, forward_move_median: 2.5, forward_move_q3: 6 }),
    ]);
    const stored = prisma.stored(row())!;
    expect([
      stored['n'],
      stored['forward_move_median'],
      stored['forward_move_q3'],
    ]).toEqual([45, 2.5, 6]);
  });

  it('a row that falls back below 30 loses its numbers: they are cleared, not left behind', async () => {
    const { prisma, writer } = make();
    await writer.writeRows([row({ n: 35 })]);
    expect(prisma.stored(row())!['forward_move_median']).toBe(1.25);
    // the history was cut: 12 outcomes now. Left alone, the old numbers would break the gate (the fake refuses it, as Postgres does).
    await writer.writeRows([provisionalRow(12)]);
    const stored = prisma.stored(row())!;
    expect(stored['n']).toBe(12);
    for (const field of FIGURES) expect(stored[field]).toBeNull();
  });

  it('a row that climbs from 29 to 30 gains its numbers', async () => {
    const { prisma, writer } = make();
    await writer.writeRows([provisionalRow(29)]);
    await writer.writeRows([row({ n: 30 })]);
    const stored = prisma.stored(row())!;
    expect(stored['n']).toBe(30);
    expect(stored['forward_move_q1']).toBe(-0.5);
  });

  it('asks for the series by its five-column key and updates only n, the figures and the notes', async () => {
    const { prisma, writer } = make();
    const upserts: Array<{
      where: unknown;
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    }> = [];
    const original = prisma.stateStatistic.upsert;
    prisma.stateStatistic.upsert = ((args: never) => {
      upserts.push(args);
      return original(args);
    }) as never;
    await writer.writeRows([row()]);
    expect(upserts).toHaveLength(1);
    expect(upserts[0].where).toEqual({
      mcd_id_evaluator_version_series_config_hash_key_state_code_horizon_hours:
        {
          mcd_id: 'MCD2',
          evaluator_version_series: '2.0',
          config_hash_key: CONFIG_KEY,
          state_code: 'MCD2_CHANNEL_UP',
          horizon_hours: 2,
        },
    });
    expect(Object.keys(upserts[0].update).sort()).toEqual(
      ['n', ...FIGURES, 'opposing_level_rate', 'series_notes'].sort()
    );
    expect(upserts[0].create['mcd_id']).toBe('MCD2');
    expect(upserts[0].create['state_code']).toBe('MCD2_CHANNEL_UP');
    expect(upserts[0].create['series_notes']).toBe(SERIES_NOTES);
  });
});

describe('StateStatisticsWriter: series are kept apart', () => {
  const reading = {
    mcdId: 'MCD2',
    evaluatorVersion: '2.0.1',
    configHash: { best_fit_a: 'h1' },
    stateCode: 'MCD2_CHANNEL_UP',
    horizonHours: 2,
  };
  const rowFor = (over: Partial<typeof reading>, n = 40) =>
    n >= 30
      ? row({ ...seriesKeyOf({ ...reading, ...over }), n })
      : provisionalRow(n, seriesKeyOf({ ...reading, ...over }));

  it('a patch release writes to the same row', async () => {
    const { prisma, writer } = make();
    await writer.writeRows([rowFor({ evaluatorVersion: '2.0.1' }, 30)]);
    await writer.writeRows([rowFor({ evaluatorVersion: '2.0.7' }, 33)]);
    expect(prisma.rows.size).toBe(1);
    expect([...prisma.rows.values()][0]['n']).toBe(33);
  });

  it('a minor release starts a new row and leaves the old one as it was', async () => {
    const { prisma, writer } = make();
    await writer.writeRows([rowFor({ evaluatorVersion: '2.0.1' }, 40)]);
    await writer.writeRows([rowFor({ evaluatorVersion: '2.1.0' }, 5)]);
    expect(prisma.rows.size).toBe(2);
    const old = prisma.stored(rowFor({ evaluatorVersion: '2.0.1' }))!;
    const fresh = prisma.stored(rowFor({ evaluatorVersion: '2.1.0' }))!;
    expect(old['n']).toBe(40);
    expect(old['forward_move_median']).toBe(1.25);
    expect(fresh['n']).toBe(5);
    expect(fresh['forward_move_median']).toBeNull();
  });

  it('a changed config_hash starts a new row', async () => {
    const { prisma, writer } = make();
    await writer.writeRows([
      rowFor({}, 40),
      rowFor({ configHash: { best_fit_a: 'h2' } }, 31),
    ]);
    expect(prisma.rows.size).toBe(2);
    expect(prisma.stored(rowFor({}))!['n']).toBe(40);
    expect(
      prisma.stored(rowFor({ configHash: { best_fit_a: 'h2' } }))!['n']
    ).toBe(31);
  });

  it('the two horizons, two states and two MCDs are separate rows', async () => {
    const { prisma, writer } = make();
    await writer.writeRows([
      rowFor({}),
      rowFor({ horizonHours: 12 }),
      rowFor({ stateCode: 'MCD2_CHANNEL_DOWN' }),
      rowFor({ mcdId: 'MCD1', stateCode: 'MCD1_TREND_UP' }),
    ]);
    expect(prisma.rows.size).toBe(4);
  });

  it('the same config_hash written in another order is the same row', async () => {
    const { prisma, writer } = make();
    const a = row({
      config_hash_key: configHashKeyOf({ best_fit_a: 'h1', non_b: 'h9' }),
    });
    const b = row({
      config_hash_key: configHashKeyOf({ non_b: 'h9', best_fit_a: 'h1' }),
      n: 31,
    });
    await writer.writeRows([a]);
    await writer.writeRows([b]);
    expect(prisma.rows.size).toBe(1);
  });

  it('a series text that is not MAJOR.MINOR is refused: a full version would split a series on every patch', async () => {
    const { writer } = make();
    await expect(
      writer.writeRows([row({ evaluator_version_series: '2.0.1' })])
    ).rejects.toThrow(/MAJOR\.MINOR/);
    expect(evaluatorSeriesOf('2.0.1')).toBe('2.0');
  });

  it('a config_hash text that is not the canonical one is refused: two spellings would split a series', async () => {
    const { writer } = make();
    await expect(
      writer.writeRows([row({ config_hash_key: '{"best_fit_a": "h1"}' })])
    ).rejects.toThrow(/canonical/);
  });
});

describe('StateStatisticsWriter: the gate, before the database', () => {
  it('refuses n = 29 with numbers and writes nothing', async () => {
    const { prisma, writer } = make();
    const error = await writer
      .writeRows([row({ n: 29 })])
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(StateStatisticsRefused);
    expect((error as StateStatisticsRefused).problems.join()).toContain(
      'n = 29 is below 30'
    );
    expect(prisma.transactions).toHaveLength(0);
    expect(prisma.rows.size).toBe(0);
  });

  it('refuses n = 30 with a figure missing', async () => {
    const { prisma, writer } = make();
    await expect(
      writer.writeRows([row({ n: 30, forward_move_q3: null })])
    ).rejects.toBeInstanceOf(StateStatisticsRefused);
    expect(prisma.rows.size).toBe(0);
  });

  it('accepts n = 29 with no number and n = 30 with numbers in one batch', async () => {
    const { prisma, writer } = make();
    await writer.writeRows([
      provisionalRow(29),
      row({ n: 30, state_code: 'MCD2_CHANNEL_DOWN' }),
    ]);
    expect(prisma.rows.size).toBe(2);
  });

  it('one bad row refuses the whole batch: not even the good rows are written', async () => {
    const { prisma, writer } = make();
    const error = await writer
      .writeRows([
        row({ state_code: 'MCD2_A' }),
        row({ state_code: 'MCD2_B', n: 29 }),
        row({ state_code: 'MCD2_C' }),
      ])
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(StateStatisticsRefused);
    const problems = (error as StateStatisticsRefused).problems;
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^row 1: /);
    expect(prisma.rows.size).toBe(0);
    expect(prisma.transactions).toHaveLength(0);
  });

  it('names every problem of every row', async () => {
    const { writer } = make();
    const problems = writer.problems([
      row({ n: 29 }),
      row({ mcd_id: 'MCD99' }),
      provisionalRow(5, { opposing_level_rate: 0.2 }),
      'not a row',
    ]);
    expect(problems.some((p) => p.startsWith('row 0: '))).toBe(true);
    expect(problems.some((p) => p.startsWith('row 1: '))).toBe(true);
    expect(problems.some((p) => p.startsWith('row 2: '))).toBe(true);
    expect(problems.some((p) => p.startsWith('row 3: '))).toBe(true);
  });

  it('a bad row is reported for what is wrong with it, not also as a duplicate', () => {
    const { writer } = make();
    const problems = writer.problems([
      row({ n: 29 }),
      row({ n: 29 }),
      'not a row',
      'not a row',
    ]);
    expect(problems.some((p) => p.includes('the same series'))).toBe(false);
    expect(problems.filter((p) => p.startsWith('row 0: '))).toHaveLength(1);
    expect(problems.filter((p) => p.startsWith('row 1: '))).toHaveLength(1);
    expect(problems).toContain('row 2: the row is not an object');
    expect(problems).toContain('row 3: the row is not an object');
  });

  it('refuses two rows for the same series, state and horizon in one batch', async () => {
    const { prisma, writer } = make();
    const error = await writer
      .writeRows([row(), row({ n: 31 })])
      .catch((e: unknown) => e);
    expect((error as StateStatisticsRefused).problems[0]).toMatch(
      /row 1: the same series, state and horizon as row 0/
    );
    expect(prisma.rows.size).toBe(0);
  });

  it('refuses a list that is not a list', async () => {
    const { writer } = make();
    expect(writer.problems(null)).toEqual(['the rows are not a list']);
    expect(writer.problems({})).toEqual(['the rows are not a list']);
  });

  it('refuses NaN and infinity before the database', async () => {
    const { writer } = make();
    for (const bad of [NaN, Infinity, -Infinity]) {
      await expect(
        writer.writeRows([row({ forward_move_median: bad })])
      ).rejects.toBeInstanceOf(StateStatisticsRefused);
    }
  });
});

describe('StateStatisticsWriter: a failure rolls the batch back', () => {
  it("a statement that fails leaves none of the batch's rows", async () => {
    const { prisma, writer } = make();
    await writer.writeRows([row({ state_code: 'MCD2_OLD' })]);
    prisma.failStatement(2); // the 2nd statement of the next batch (0-based, counting the first batch's one)
    await expect(
      writer.writeRows([
        row({ state_code: 'MCD2_A' }),
        row({ state_code: 'MCD2_B' }),
        row({ state_code: 'MCD2_C' }),
      ])
    ).rejects.toThrow('injected failure');
    expect(prisma.rows.size).toBe(1);
    expect(prisma.transactions.map((t) => t.committed)).toEqual([true, false]);
  });

  it("a row the database would refuse (the fake's CHECK) rolls the batch back and the error is the database's", async () => {
    // the writer's own check should make this impossible; the fake shows what would happen if something slipped past it
    const { prisma, writer } = make();
    const gate = jest.spyOn(writer, 'problems').mockReturnValue([]);
    await expect(
      writer.writeRows([
        row({ state_code: 'MCD2_A' }),
        row({ state_code: 'MCD2_B', n: 29 }),
      ])
    ).rejects.toThrow(/state_statistics_n_gate/);
    gate.mockRestore();
    expect(prisma.rows.size).toBe(0);
  });
});

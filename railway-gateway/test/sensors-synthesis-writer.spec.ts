import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { EnvelopeValidator } from '../src/sensors/envelope-validator';
import { McdOutputsWriter } from '../src/sensors/mcd-outputs.writer';
import { SynReadingValidator } from '../src/sensors/syn-validator';
import { SynthesisWriter, refusalLine } from '../src/sensors/synthesis.writer';
import { sha256 } from '../src/sensors/synthesis-rows';
import { FIXTURE_SLOTS, FixtureSlot } from './helpers/cycle-fixtures';
import {
  FakeSensorPrisma,
  STUB_BUNDLE_TEXT,
  unitResult,
  unitResultWithSynthesis,
} from './helpers/sensors-worker-world';
import {
  Doc,
  contextOf,
  storedReadingRow,
  zoneRowFrom,
} from './helpers/synthesis-rows';

/**
 * The SYN part of the writer (build step 4 part 5): which SYN rows of a cycle may join the sensors’ transaction, what is logged
 * about the ones that may not, and that the transaction stays ONE (decision 3 of the part 4 hand-off, option (a)).
 * The database itself (CHECKs, rollback) is asked in `sensors-synthesis.pg.spec.ts`; here a Prisma that is lazy and
 * transactional like the real one shows what the writer sends.
 */

const [v1, v3, v4] = FIXTURE_SLOTS;

function make() {
  const prisma = new FakeSensorPrisma();
  const synthesis = new SynthesisWriter(new SynReadingValidator());
  const writer = new McdOutputsWriter(
    prisma as unknown as PrismaService,
    new EnvelopeValidator(),
    synthesis
  );
  return { prisma, writer, synthesis };
}

const write = (
  fixture: FixtureSlot,
  result = unitResultWithSynthesis(fixture)
) => ({
  symbol: 'XAUUSD',
  slot: fixture.slot,
  result,
  evaluatedAt: fixture.slot + 31,
});

let error: jest.SpyInstance;
let warn: jest.SpyInstance;
beforeEach(() => {
  error = jest
    .spyOn(Logger.prototype, 'error')
    .mockImplementation(() => undefined);
  warn = jest
    .spyOn(Logger.prototype, 'warn')
    .mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

/** Change the zone rows of a profile result, keeping its text and hash consistent. */
function rewriteZones(profile: Doc, change: (zone: Doc) => void): void {
  const zones = JSON.parse(profile['zones_json']) as Doc[];
  zones.forEach(change);
  profile['zones_json'] = JSON.stringify(zones);
  profile['zones_sha256'] = sha256(profile['zones_json']);
}

describe('the transaction of a cycle', () => {
  it('with the SYN flag off is the three statements of the sensors and nothing more, and the summary says nothing of synthesis', async () => {
    const { prisma, writer } = make();
    const summary = await writer.writeCycle(write(v1, unitResult(v1)));
    expect(summary).toEqual({
      outputsInserted: 4,
      outputsExisting: 0,
      inputsInserted: true,
      inputsDeleted: 0,
    });
    expect(summary).not.toHaveProperty('synthesis');
    expect(prisma.transactions).toEqual([
      {
        ops: [
          'mcdOutput.createMany',
          'marketCycleInput.createMany',
          'marketCycleInput.deleteMany',
        ],
        committed: true,
      },
    ]);
    expect(prisma.synthesisReadings).toEqual([]);
    expect(prisma.entryZones).toEqual([]);
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('with the SYN flag on adds the readings and the zones to the SAME transaction: five statements, one commit, nothing outside it', async () => {
    const { prisma, writer } = make();
    const summary = await writer.writeCycle(write(v1));
    expect(prisma.transactions).toHaveLength(1);
    expect(prisma.transactions[0]).toEqual({
      ops: [
        'mcdOutput.createMany',
        'marketCycleInput.createMany',
        'marketCycleInput.deleteMany',
        'synthesisReading.createMany',
        'entryZone.createMany',
      ],
      committed: true,
    });
    expect(prisma.autocommitted).toEqual([]);
    expect(summary).toEqual({
      outputsInserted: 4,
      outputsExisting: 0,
      inputsInserted: true,
      inputsDeleted: 0,
      synthesis: {
        readingsInserted: 2,
        readingsExisting: 0,
        zonesInserted: 4,
        zonesExisting: 0,
        refused: [],
        error: null,
      },
    });
  });

  it('stores the rows the stored files map to, key for key', async () => {
    const { prisma, writer } = make();
    await writer.writeCycle(write(v1));
    const ctx = contextOf(v1);
    expect(prisma.synthesisReadings).toEqual(
      ctx.synthesis.readings.map((r) => ({
        ...storedReadingRow(ctx, r.profile),
        // the stub runner result hashes a stand-in bundle text; every other column is the stored file's
        inputs_sha256: sha256(STUB_BUNDLE_TEXT),
      }))
    );
    expect(prisma.entryZones).toEqual(
      ctx.synthesis.readings.flatMap((r) =>
        (JSON.parse(r.zones_json) as Doc[]).map((z) => zoneRowFrom(z))
      )
    );
  });

  it('a cycle with no zones (28 Sep 14:15) writes its two readings and no zone statement at all', async () => {
    const { prisma, writer } = make();
    const summary = await writer.writeCycle(write(v3));
    expect(prisma.transactions[0].ops).toEqual([
      'mcdOutput.createMany',
      'marketCycleInput.createMany',
      'marketCycleInput.deleteMany',
      'synthesisReading.createMany',
    ]);
    expect(summary.synthesis).toMatchObject({
      readingsInserted: 2,
      zonesInserted: 0,
      zonesExisting: 0,
    });
    expect(prisma.entryZones).toEqual([]);
  });

  it('delivering the cycle again writes nothing new and keeps the first rows', async () => {
    const { prisma, writer } = make();
    await writer.writeCycle(write(v4));
    const first = JSON.stringify([
      prisma.outputs,
      prisma.synthesisReadings,
      prisma.entryZones,
    ]);
    const again = await writer.writeCycle(
      write(v4, { ...unitResultWithSynthesis(v4), runner_version: '9.9.9' })
    );
    expect(again).toMatchObject({
      outputsInserted: 0,
      outputsExisting: 4,
      synthesis: {
        readingsInserted: 0,
        readingsExisting: 2,
        zonesInserted: 0,
        zonesExisting: 4,
      },
    });
    expect(
      JSON.stringify([
        prisma.outputs,
        prisma.synthesisReadings,
        prisma.entryZones,
      ])
    ).toBe(first);
  });

  it('the SYN flag turned on later adds just the SYN rows to a cycle whose sensor rows exist', async () => {
    const { prisma, writer } = make();
    await writer.writeCycle(write(v1, unitResult(v1)));
    const later = await writer.writeCycle(write(v1));
    expect(later).toMatchObject({
      outputsInserted: 0,
      outputsExisting: 4,
      synthesis: { readingsInserted: 2, zonesInserted: 4 },
    });
    expect(prisma.synthesisReadings).toHaveLength(2);
  });

  it('a failure of the SYN statement undoes the sensors’ rows too: it is one transaction (which is why the rows are judged first)', async () => {
    const { prisma, writer } = make();
    prisma.failOn('entryZone.createMany', new Error('check violation'));
    await expect(writer.writeCycle(write(v1))).rejects.toThrow(
      'check violation'
    );
    expect(prisma.outputs).toEqual([]);
    expect(prisma.inputs).toEqual([]);
    expect(prisma.synthesisReadings).toEqual([]);
    expect(prisma.entryZones).toEqual([]);
    expect(prisma.transactions).toEqual([
      expect.objectContaining({ committed: false }),
    ]);
  });
});

describe('what is left out, and what that costs the cycle (nothing)', () => {
  it('a zone the database would refuse never reaches the transaction: that trader type is left out, the other and the sensors are written', async () => {
    const { prisma, writer } = make();
    const result = unitResultWithSynthesis(v1, (section) => {
      rewriteZones(section.readings[0] as unknown as Doc, (z) => {
        z['invalidation_price'] = Number(
          (z['reference_price'] - 12.99).toFixed(2)
        );
        z['stop_distance'] = 12.99;
      });
    });
    const summary = await writer.writeCycle(write(v1, result));
    expect(prisma.outputs).toHaveLength(4);
    expect(prisma.inputs).toHaveLength(1);
    expect(prisma.synthesisReadings.map((r) => r['profile'])).toEqual([
      'SCALPER',
    ]);
    expect(prisma.entryZones.map((z) => z['profile'])).toEqual([
      'SCALPER',
      'SCALPER',
    ]);
    expect(summary.synthesis?.refused).toHaveLength(1);
    expect(summary.synthesis?.refused[0]).toMatchObject({
      profile: 'DAY_TRADER',
      source: 'GATEWAY',
    });
    expect(summary.synthesis?.refused[0].problems.join('\n')).toContain(
      'entry_zones_stop_distance_is_at_least_13'
    );
    expect(prisma.transactions[0].committed).toBe(true);
  });

  it('a reading the engine withheld leaves its trader type out and is logged with the engine’s reasons', async () => {
    const { prisma, writer } = make();
    const result = unitResultWithSynthesis(v1, (section) => {
      section.readings[1].reading_json = null;
      section.readings[1].reading_sha256 = null;
      section.readings[1].guard_problems = ['SCHEMA: zones: too many'];
    });
    const summary = await writer.writeCycle(write(v1, result));
    expect(prisma.synthesisReadings.map((r) => r['profile'])).toEqual([
      'DAY_TRADER',
    ]);
    expect(summary.synthesis?.refused).toEqual([
      {
        profile: 'SCALPER',
        source: 'ENGINE',
        problems: [
          'SCALPER: the engine withheld the reading',
          'SCHEMA: zones: too many',
        ],
      },
    ]);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toBe(
      'Slot ' +
        v1.slot +
        ': SYN_READING_REFUSED SCALPER (ENGINE): SCALPER: the engine withheld the reading; SCHEMA: zones: too many'
    );
  });

  it('an engine error writes the sensors’ rows and no SYN row, and says so', async () => {
    const { prisma, writer } = make();
    const result = unitResultWithSynthesis(v1, (section) => {
      section.error = 'SYNTHESIS_ERROR';
      section.readings = [];
    });
    const summary = await writer.writeCycle(write(v1, result));
    expect(prisma.outputs).toHaveLength(4);
    expect(prisma.synthesisReadings).toEqual([]);
    expect(prisma.transactions[0].ops).toHaveLength(3);
    expect(summary.synthesis).toEqual({
      readingsInserted: 0,
      readingsExisting: 0,
      zonesInserted: 0,
      zonesExisting: 0,
      refused: [],
      error: 'SYNTHESIS_ERROR',
    });
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).toContain(
      'SYN_ENGINE_ERROR synthesis raised in the engine (SYNTHESIS_ERROR)'
    );
  });

  it('a synthesis section that is not the shape it must be is refused whole, as ALL, and costs the sensors nothing', async () => {
    const { prisma, writer } = make();
    const result = unitResultWithSynthesis(v1);
    (result as unknown as Doc)['synthesis'] = { flag: 'shadow' };
    const summary = await writer.writeCycle(write(v1, result));
    expect(prisma.outputs).toHaveLength(4);
    expect(prisma.synthesisReadings).toEqual([]);
    expect(summary.synthesis?.refused).toHaveLength(1);
    expect(summary.synthesis?.refused[0]).toMatchObject({
      profile: 'ALL',
      source: 'GATEWAY',
    });
  });

  it('a refusal of the SENSORS’ rows is still the cycle’s refusal: nothing is written and no SYN line is logged', async () => {
    const { prisma, writer } = make();
    const result = unitResultWithSynthesis(v1);
    result.results[0] = {
      ...result.results[0],
      envelope_sha256: 'f'.repeat(64),
    };
    await expect(writer.writeCycle(write(v1, result))).rejects.toThrow(
      /cycle refused, nothing written/
    );
    expect(prisma.transactions).toEqual([]);
    expect(error).not.toHaveBeenCalled();
  });
});

describe('the wiring', () => {
  it('Nest injects the registered SynthesisWriter into the writer (the default is only for a writer built by hand)', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: PrismaService, useValue: new FakeSensorPrisma() },
        EnvelopeValidator,
        SynReadingValidator,
        SynthesisWriter,
        McdOutputsWriter,
      ],
    }).compile();
    const writer = moduleRef.get(McdOutputsWriter);
    const registered = moduleRef.get(SynthesisWriter);
    expect((writer as unknown as { synthesis: unknown }).synthesis).toBe(
      registered
    );
    expect((registered as unknown as { validator: unknown }).validator).toBe(
      moduleRef.get(SynReadingValidator)
    );
  });

  it('a writer built by hand with two arguments still works and judges the SYN rows with its own', async () => {
    const prisma = new FakeSensorPrisma();
    const writer = new McdOutputsWriter(
      prisma as unknown as PrismaService,
      new EnvelopeValidator()
    );
    const summary = await writer.writeCycle(write(v1));
    expect(summary.synthesis?.readingsInserted).toBe(2);
  });
});

describe('the SYN tables are not there (the migration is not applied)', () => {
  it('the SYN rows are not offered to the transaction, the sensors’ rows are written, and the summary and the log say why', async () => {
    const { prisma, writer } = make();
    prisma.synthesisTablesExist = false;
    const summary = await writer.writeCycle(write(v1));
    expect(prisma.outputs).toHaveLength(4);
    expect(prisma.inputs).toHaveLength(1);
    expect(prisma.synthesisReadings).toEqual([]);
    expect(prisma.entryZones).toEqual([]);
    expect(prisma.transactions[0].ops).toEqual([
      'mcdOutput.createMany',
      'marketCycleInput.createMany',
      'marketCycleInput.deleteMany',
    ]);
    expect(summary.synthesis).toMatchObject({
      readingsInserted: 0,
      zonesInserted: 0,
      error: 'SYN_TABLES_MISSING',
    });
    expect(
      error.mock.calls.filter((c) =>
        String(c[0]).includes('SYN_TABLES_MISSING')
      )
    ).toHaveLength(1);
  });

  it('asks again on the next cycle, and writes the SYN rows as soon as the answer is yes', async () => {
    const { prisma, writer } = make();
    prisma.synthesisTablesExist = false;
    await writer.writeCycle(write(v1));
    prisma.synthesisTablesExist = true;
    const later = await writer.writeCycle(write(v1));
    expect(later.synthesis).toMatchObject({
      readingsInserted: 2,
      zonesInserted: 4,
      error: null,
    });
    expect(prisma.tableChecks).toBe(2);
  });

  it('stops asking once the tables have been seen: one question per process, not per cycle', async () => {
    const { prisma, writer } = make();
    await writer.writeCycle(write(v1));
    await writer.writeCycle(write(v3));
    await writer.writeCycle(write(v4));
    expect(prisma.tableChecks).toBe(1);
  });

  it('does not ask when there is nothing to write (the SYN flag is off, or every reading was refused)', async () => {
    const { prisma, writer } = make();
    await writer.writeCycle(write(v1, unitResult(v1)));
    await writer.writeCycle(
      write(
        v3,
        unitResultWithSynthesis(v3, (section) => {
          section.error = 'SYNTHESIS_ERROR';
          section.readings = [];
        })
      )
    );
    expect(prisma.tableChecks).toBe(0);
  });

  it('a question that cannot be answered is a no: the SYN rows are left out, the sensors are written, and the failure is logged', async () => {
    const { prisma, writer } = make();
    prisma.tableCheckError = new Error('connection reset');
    const summary = await writer.writeCycle(write(v1));
    expect(prisma.outputs).toHaveLength(4);
    expect(prisma.synthesisReadings).toEqual([]);
    expect(summary.synthesis?.error).toBe('SYN_TABLES_MISSING');
    expect(
      error.mock.calls.some(
        (c) =>
          String(c[0]).includes('SYN_TABLES_CHECK_FAILED') &&
          String(c[0]).includes('connection reset')
      )
    ).toBe(true);
  });
});

describe('what is logged', () => {
  it('nothing, when the result has no synthesis section', () => {
    const { synthesis } = make();
    synthesis.prepare(write(v1, unitResult(v1)));
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('a refused reading, as one error line with a stable prefix the measurement kit can count: slot, SYN_READING_REFUSED, trader type, source', () => {
    const { synthesis } = make();
    synthesis.prepare(
      write(
        v1,
        unitResultWithSynthesis(v1, (section) => {
          section.readings[0].zones_sha256 = '0'.repeat(64);
          section.readings[1].zones_sha256 = '0'.repeat(64);
        })
      )
    );
    expect(error).toHaveBeenCalledTimes(2);
    for (const call of error.mock.calls) {
      expect(String(call[0])).toMatch(
        /^Slot \d+: SYN_READING_REFUSED (DAY_TRADER|SCALPER) \(GATEWAY\): /
      );
      expect(String(call[0])).toContain(
        'zones_json does not hash to zones_sha256'
      );
    }
  });

  it('a saved reading whose zones the engine dropped is a warning, and the reading is written', async () => {
    const { prisma, writer } = make();
    const result = unitResultWithSynthesis(v3, (section) => {
      section.readings[0].guard_problems = [
        'ZONES: Z1: the stop distance is under 13',
      ];
    });
    await writer.writeCycle(write(v3, result));
    expect(prisma.synthesisReadings).toHaveLength(2);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain(
      'SYN_ZONES_DROPPED DAY_TRADER reading written, some zones dropped by the engine: ZONES: Z1'
    );
  });

  it('at most ten problems of a refusal are shown, and the rest are counted', () => {
    const problems = Array.from({ length: 13 }, (_, i) => `problem ${i}`);
    const line = refusalLine(7, {
      profile: 'DAY_TRADER',
      source: 'GATEWAY',
      problems,
    });
    expect(line).toContain('problem 9');
    expect(line).not.toContain('problem 10');
    expect(line).toMatch(/\(and 3 more\)$/);
  });

  it('never throws: a validator that fails is a refusal of the section, not a lost cycle', async () => {
    const prisma = new FakeSensorPrisma();
    const broken = {
      check: () => {
        throw new Error('ajv exploded');
      },
    } as unknown as SynReadingValidator;
    const writer = new McdOutputsWriter(
      prisma as unknown as PrismaService,
      new EnvelopeValidator(),
      new SynthesisWriter(broken)
    );
    const summary = await writer.writeCycle(write(v1));
    expect(prisma.outputs).toHaveLength(4);
    expect(prisma.synthesisReadings).toEqual([]);
    expect(summary.synthesis?.refused[0].problems[0]).toContain('ajv exploded');
    expect(summary.synthesis?.refused[0]).toMatchObject({
      profile: 'ALL',
      source: 'GATEWAY',
    });
    expect(String(error.mock.calls[0][0])).toContain('SYN_READING_REFUSED ALL');
  });
});

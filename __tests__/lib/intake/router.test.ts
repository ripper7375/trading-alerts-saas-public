/**
 * @jest-environment node
 */

/**
 * The router (`lib/intake/router.ts`, architecture 4.5, ADR-036, ADR-040, ADR-041, plan
 * decisions D2 and D10): M* = ALWAYS ∪ EXTRA(intent).
 *
 * What is held here:
 *  1. architecture 4.11 item 2, on golden 01: only MCD3 says stand aside, and its full
 *     envelope is in M* (and in the packet) for every intent that gives readings;
 *  2. each selector of the matrix at its boundary, on small worlds written by hand;
 *  3. properties over random boards of up to 15 sensors: the primary sensor and every
 *     warning are always in M*, nothing that is not live ever is, and the route is a
 *     function of its input;
 *  4. the primary sensor is READ from the roster's rung and never named in the router;
 *  5. the matrix review tool and the router agree on every cell: see matrix-parity.test.ts.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  DISPATCH_MATRIX,
  GLOSSARY,
  INTENTS,
  ROUTING_VERSION,
  SENSOR_ROSTER,
  findWarnings,
  matrixRow,
  parseRoster,
  route,
  type Intent,
  type Roster,
  type RouteInput,
  type SensorFacts,
  type SynthesisFacts,
  type Timeframe,
  type TraderType,
} from '@/lib/intake';

import { runWorld } from './helpers/assemble';
import { clone } from './helpers/packets';
import { makeRng, randomWorld } from './helpers/random';
import { goldenWorlds, storedWorlds, type World } from './helpers/world';

const WORLDS = [...goldenWorlds(), ...storedWorlds()];
const TRADERS: TraderType[] = ['DAY_TRADER', 'SCALPER'];
const READING_INTENTS = INTENTS.filter(
  (intent) => intent !== 'REPORT_2' && intent !== 'OUT_OF_SCOPE'
);

const world = (prefix: string): World => {
  const found = WORLDS.find((w) => w.name.startsWith(prefix));
  if (found === undefined) throw new Error(`no world ${prefix}`);
  return found;
};

// ---------------------------------------------------------------------------------------
// 4.11 item 2
// ---------------------------------------------------------------------------------------

describe('4.11 item 2: a test where only MCD3 says stand aside still delivers MCD3’s full reading', () => {
  const golden01 = world('01-');

  it('is the case: MCD1 and MCD2 say LONG with the synthesis, MCD3 alone says STAND_ASIDE', async () => {
    const run = await runWorld(golden01, 'DAY_TRADER', 'DIRECTION');
    expect(run.board.board.sensors.map((l) => [l.mcd_id, l.bias])).toEqual([
      ['MCD1', 'LONG'],
      ['MCD2', 'LONG'],
      ['MCD3', 'STAND_ASIDE'],
    ]);
    expect(run.board.board.syn.bias).toBe('LONG');
    expect(run.route.warnings).toEqual([
      { mcd_id: 'MCD3', kind: 'STAND_ASIDE' },
    ]);
  });

  const cases = TRADERS.flatMap((t) =>
    READING_INTENTS.map((i) => [`${t} ${i}`, t, i] as const)
  );
  it.each(cases)(
    '%s: MCD3 is in M* and its whole envelope is in the packet',
    async (_n, traderType, intent) => {
      const run = await runWorld(golden01, traderType, intent);
      expect(run.route.m_star).toContain('MCD3');
      const given = run.packet!.readings.sensors.find(
        (s) => s.mcd_id === 'MCD3'
      );
      const stored = golden01.sensors.find((s) => s.mcd_id === 'MCD3')!;
      expect(given).toBeDefined();
      // the envelope as the worker stored it, byte for byte once parsed, and its stored hash
      expect(given!.envelope).toEqual(JSON.parse(stored.envelope_json));
      expect(given!.envelope_sha256).toBe(stored.envelope_sha256);
      expect(run.validation?.ok).toBe(true);
    }
  );

  it.each(TRADERS)(
    '%s: Report 2 gives no readings and Out of scope runs nothing',
    async (traderType) => {
      const report = await runWorld(golden01, traderType, 'REPORT_2');
      expect(report.route.m_star).toEqual([]);
      expect(report.packet!.readings).toEqual({
        m_star: [],
        sensors: [],
        synthesis: null,
      });
      const out = await runWorld(golden01, traderType, 'OUT_OF_SCOPE');
      expect(out.route.m_star).toEqual([]);
      expect(out.packet).toBeNull();
    }
  );
});

// ---------------------------------------------------------------------------------------
// Whole worlds
// ---------------------------------------------------------------------------------------

describe('every stored world, both trader types, every intent', () => {
  it('always has the primary sensor and every warning in M*, and only live sensors with a reading', async () => {
    let checked = 0;
    for (const w of WORLDS) {
      for (const traderType of TRADERS) {
        for (const intent of INTENTS) {
          const run = await runWorld(w, traderType, intent, {
            termIds: ['uoedt'],
            timeframes: ['M5'],
          });
          const available = new Set(Object.keys(run.snapshot.rows));
          for (const id of run.route.m_star)
            expect(available.has(id)).toBe(true);
          const gives = matrixRow(intent).always;
          if (gives) {
            for (const id of run.route.primary) {
              if (available.has(id)) expect(run.route.m_star).toContain(id);
            }
            for (const warning of run.route.warnings) {
              expect(run.route.m_star).toContain(warning.mcd_id);
            }
          } else {
            expect(run.route.m_star).toEqual([]);
          }
          expect(run.route.routing_version).toBe(ROUTING_VERSION);
          checked += 1;
        }
      }
    }
    expect(checked).toBe(19 * 2 * 10);
  });

  it('finds the primary sensor of each trader type in the registry rung: MCD1 and MCD2', async () => {
    const run = await runWorld(world('04-'), 'DAY_TRADER', 'DIRECTION');
    expect(run.route.primary).toEqual(['MCD1']);
    const scalper = await runWorld(world('04-'), 'SCALPER', 'DIRECTION');
    expect(scalper.route.primary).toEqual(['MCD2']);
  });

  it('names an opposing sensor a warning: golden 07, opposite spikes', async () => {
    // the Day Trader’s synthesis is a SHORT snapback of the M15 spike up, so MCD1, which
    // reports the trend side (LONG), opposes it; for the Scalper the synthesis is a LONG
    // snapback of the M5 spike down, and MCD2 (SHORT) opposes it. MCD3 stands aside for both.
    const dt = await runWorld(world('07-'), 'DAY_TRADER', 'DIRECTION');
    const sc = await runWorld(world('07-'), 'SCALPER', 'DIRECTION');
    expect(dt.board.board.syn.bias).toBe('SHORT');
    expect(sc.board.board.syn.bias).toBe('LONG');
    expect(dt.route.warnings).toEqual([
      { mcd_id: 'MCD1', kind: 'OPPOSES_SYNTHESIS' },
      { mcd_id: 'MCD3', kind: 'STAND_ASIDE' },
    ]);
    expect(sc.route.warnings).toEqual([
      { mcd_id: 'MCD2', kind: 'OPPOSES_SYNTHESIS' },
      { mcd_id: 'MCD3', kind: 'STAND_ASIDE' },
    ]);
  });

  it('gives an opposing sensor that is not the primary one in full: golden 06, Scalper', async () => {
    // the Scalper’s primary sensor is MCD2 (flat, NEUTRAL); MCD1 reports LONG against a SHORT synthesis
    const run = await runWorld(world('06-'), 'SCALPER', 'RISK_SIZING');
    expect(run.route.primary).toEqual(['MCD2']);
    expect(run.route.warnings).toEqual([
      { mcd_id: 'MCD1', kind: 'OPPOSES_SYNTHESIS' },
      { mcd_id: 'MCD3', kind: 'STAND_ASIDE' },
    ]);
    // the Risk intent has no extra sensor, and still delivers both warnings and the primary sensor
    expect(run.route.extra).toEqual([]);
    expect(run.route.m_star).toEqual(['MCD1', 'MCD2', 'MCD3']);
  });

  it('gives nothing in full from a sensor that is not live: golden 16 has only MCD2', async () => {
    for (const traderType of TRADERS) {
      for (const intent of READING_INTENTS) {
        const run = await runWorld(world('16-'), traderType, intent, {
          termIds: ['uoedt'],
          timeframes: ['M15'],
        });
        expect(run.route.m_star.every((id) => id === 'MCD2')).toBe(true);
      }
    }
  });

  it('gives the STALE primary sensor in full, with its reasons (golden 14)', async () => {
    const run = await runWorld(world('14-'), 'DAY_TRADER', 'DIRECTION');
    expect(run.route.m_star).toEqual(['MCD1']);
    const envelope = run.packet!.readings.sensors[0]!.envelope;
    expect(envelope['status']).toBe('STALE');
    expect(envelope['status_reasons']).toEqual(['NO_STATS_AT_SLOT']);
    expect(run.validation?.ok).toBe(true);
  });

  it('cannot give an ABSENT primary sensor: it says so in the notes, and the board lists it', async () => {
    const w = world('04-');
    const without = {
      ...w,
      sensors: w.sensors.filter((s) => s.mcd_id !== 'MCD1'),
    };
    // MCD1 has no row and is not configured live, so it has no line at all; make it live by configuration
    const roster = clone(SENSOR_ROSTER);
    roster.sensors.find((s) => s.mcd_id === 'MCD1')!.flag = 'live';
    const run = await runWorld(without, 'DAY_TRADER', 'DIRECTION', { roster });
    expect(run.board.board.sensors[0]).toMatchObject({
      mcd_id: 'MCD1',
      status: 'ABSENT',
    });
    expect(run.route.m_star).not.toContain('MCD1');
    expect(run.route.notes).toContain('PRIMARY_UNAVAILABLE:MCD1');
    expect(run.validation?.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------
// The selectors, on small worlds
// ---------------------------------------------------------------------------------------

function facts(id: string, over: Partial<SensorFacts> = {}): SensorFacts {
  return {
    mcd_id: id,
    status: 'VALID',
    state_code: `${id}_STATE`,
    bias: 'LONG',
    summary: 'a reading',
    reasons: [],
    levels: [],
    ...over,
  };
}

function syn(over: Partial<SynthesisFacts> = {}): SynthesisFacts {
  return {
    profile: 'DAY_TRADER',
    status: 'VALID',
    rule_id: 'R3_TREND_CONTINUATION',
    bias: 'LONG',
    trend_relation: 'WITH_TREND',
    summary: 'Trend continuation, LONG',
    reference_price: 100,
    zone_sources: [],
    entry_price: 100,
    ...over,
  };
}

function input(over: Partial<RouteInput> = {}): RouteInput {
  return {
    intent: 'DIRECTION',
    traderType: 'DAY_TRADER',
    liveIds: ['MCD1', 'MCD2', 'MCD3'],
    sensors: { MCD1: facts('MCD1'), MCD2: facts('MCD2'), MCD3: facts('MCD3') },
    synthesis: syn(),
    ...over,
  };
}

describe('DIRECTION and RISK_SIZING and NEWS: the always set and nothing more', () => {
  it.each(['DIRECTION', 'RISK_SIZING', 'NEWS'] as const)('%s', (intent) => {
    const routed = route(input({ intent }));
    expect(routed.extra).toEqual([]);
    expect(routed.always).toEqual(['MCD1']);
    expect(routed.m_star).toEqual(['MCD1']);
  });

  it('adds every warning to the primary sensor', () => {
    const routed = route(
      input({
        sensors: {
          MCD1: facts('MCD1'),
          MCD2: facts('MCD2', { bias: 'SHORT' }), // opposes a LONG synthesis
          MCD3: facts('MCD3', { bias: 'STAND_ASIDE' }),
        },
      })
    );
    expect(routed.always).toEqual(['MCD1', 'MCD2', 'MCD3']);
    expect(routed.warnings).toEqual([
      { mcd_id: 'MCD2', kind: 'OPPOSES_SYNTHESIS' },
      { mcd_id: 'MCD3', kind: 'STAND_ASIDE' },
    ]);
  });

  it('passes the knowledge of the row through, with the playbooks of M* only', () => {
    const routed = route(input({ intent: 'DIRECTION' }));
    expect(routed.domains).toEqual(['D3', 'D5']);
    expect(routed.playbooks).toEqual(routed.m_star);
    const risk = route(input({ intent: 'RISK_SIZING' }));
    expect(risk.domains).toEqual(['D4', 'D5']);
    expect(risk.playbooks).toEqual([]);
  });
});

describe('ENTRY_TIMING: the sensors that supplied the zones', () => {
  it('adds the sources that are live and have a reading', () => {
    const routed = route(
      input({
        intent: 'ENTRY_TIMING',
        synthesis: syn({ zone_sources: ['MCD2', 'MCD3'] }),
      })
    );
    expect(routed.extra).toEqual(['MCD2', 'MCD3']);
    expect(routed.m_star).toEqual(['MCD1', 'MCD2', 'MCD3']);
  });

  it('adds nothing for a source that is not live, or has no reading', () => {
    const routed = route(
      input({
        intent: 'ENTRY_TIMING',
        liveIds: ['MCD1', 'MCD2'],
        sensors: {
          MCD1: facts('MCD1'),
          MCD2: facts('MCD2'),
          MCD3: facts('MCD3'),
        },
        synthesis: syn({ zone_sources: ['MCD3'] }),
      })
    );
    expect(routed.extra).toEqual([]);
    const absent = route(
      input({
        intent: 'ENTRY_TIMING',
        sensors: { MCD1: facts('MCD1'), MCD2: facts('MCD2') },
        synthesis: syn({ zone_sources: ['MCD3'] }),
      })
    );
    expect(absent.extra).toEqual([]);
  });

  it('adds nothing when there are no zones or no synthesis', () => {
    expect(
      route(
        input({ intent: 'ENTRY_TIMING', synthesis: syn({ zone_sources: [] }) })
      ).extra
    ).toEqual([]);
    expect(
      route(input({ intent: 'ENTRY_TIMING', synthesis: null })).extra
    ).toEqual([]);
  });
});

describe('EXIT_TARGETS: the sensors with a level beyond the entry on the target side', () => {
  const sensors = (levels: Record<string, number[]>) =>
    Object.fromEntries(
      Object.entries(levels).map(([id, l]) => [id, facts(id, { levels: l })])
    );

  it('a LONG looks above the entry, strictly', () => {
    const routed = route(
      input({
        intent: 'EXIT_TARGETS',
        sensors: sensors({
          MCD1: [90, 100],
          MCD2: [90, 100.01],
          MCD3: [99.99, 80],
        }),
        synthesis: syn({ bias: 'LONG', entry_price: 100 }),
      })
    );
    expect(routed.extra).toEqual(['MCD2']);
  });

  it('a SHORT looks below the entry, strictly', () => {
    const routed = route(
      input({
        intent: 'EXIT_TARGETS',
        sensors: sensors({
          MCD1: [100, 110],
          MCD2: [99.99, 110],
          MCD3: [100.01],
        }),
        synthesis: syn({ bias: 'SHORT', entry_price: 100 }),
      })
    );
    expect(routed.extra).toEqual(['MCD2']);
  });

  it('takes the entry from the first zone, and from the close of the reading when there is no zone', () => {
    const noZone = route(
      input({
        intent: 'EXIT_TARGETS',
        sensors: sensors({ MCD1: [105], MCD2: [95], MCD3: [] }),
        synthesis: syn({
          bias: 'LONG',
          entry_price: null,
          reference_price: 100,
        }),
      })
    );
    expect(noZone.extra).toEqual(['MCD1']);
    expect(noZone.notes).toEqual([]);
  });

  it.each(['NEUTRAL', 'STAND_ASIDE'] as const)(
    'adds nothing for a %s synthesis, and says why',
    (bias) => {
      const routed = route(
        input({
          intent: 'EXIT_TARGETS',
          sensors: sensors({ MCD1: [90], MCD2: [110], MCD3: [120] }),
          synthesis: syn({ bias, entry_price: null }),
        })
      );
      expect(routed.extra).toEqual([]);
      expect(routed.notes).toContain('NO_TARGET_SIDE');
    }
  );

  it('adds nothing without a synthesis, or without any entry price', () => {
    expect(
      route(input({ intent: 'EXIT_TARGETS', synthesis: null })).notes
    ).toContain('NO_TARGET_SIDE');
    const noPrice = route(
      input({
        intent: 'EXIT_TARGETS',
        sensors: sensors({ MCD2: [150] }),
        synthesis: syn({ entry_price: null, reference_price: null }),
      })
    );
    expect(noPrice.extra).toEqual([]);
    expect(noPrice.notes).toContain('NO_ENTRY_PRICE');
  });

  it('ignores the levels of a sensor that is unavailable', () => {
    const routed = route(
      input({
        intent: 'EXIT_TARGETS',
        sensors: {
          MCD1: facts('MCD1'),
          MCD2: facts('MCD2', {
            status: 'STALE',
            state_code: null,
            bias: null,
            reasons: ['X'],
            levels: [500],
          }),
          MCD3: facts('MCD3', { levels: [500] }),
        },
        synthesis: syn({ bias: 'LONG', entry_price: 100 }),
      })
    );
    expect(routed.extra).toEqual(['MCD3']);
  });
});

describe('EXPLAIN: the owner of the term', () => {
  const explain = (over: Partial<RouteInput>) =>
    route(input({ intent: 'EXPLAIN', ...over }));

  it('gives the one sensor that owns a term', () => {
    expect(explain({ termIds: ['momentum'] }).extra).toEqual(['MCD3']);
    expect(explain({ termIds: ['breakout'] }).extra).toEqual(['MCD1']);
    expect(
      explain({ termIds: ['pullback'], traderType: 'SCALPER' }).extra
    ).toEqual(['MCD2']);
  });

  it('gives, for a term all the channel sensors own, the primary sensor and no other without a timeframe', () => {
    expect(explain({ termIds: ['uoedt'] }).extra).toEqual(['MCD1']);
    expect(
      explain({ termIds: ['uoedt'], traderType: 'SCALPER' }).extra
    ).toEqual(['MCD2']);
  });

  it('adds the sensor of the timeframe the question names', () => {
    expect(explain({ termIds: ['uoedt'], timeframes: ['M5'] }).extra).toEqual([
      'MCD1',
      'MCD2',
    ]);
    expect(explain({ termIds: ['uoedt'], timeframes: ['M15'] }).extra).toEqual([
      'MCD1',
    ]);
    expect(
      explain({
        termIds: ['uoedt'],
        traderType: 'SCALPER',
        timeframes: ['M15'],
      }).extra
    ).toEqual(['MCD1', 'MCD2']);
    expect(
      explain({ termIds: ['uoedt'], timeframes: ['M5', 'M15'] }).extra
    ).toEqual(['MCD1', 'MCD2']);
  });

  it('never gives the sensor that reads both timeframes as “the sensor of the timeframe”', () => {
    for (const tf of ['M5', 'M15'] as Timeframe[]) {
      expect(
        explain({ termIds: ['uoedt'], timeframes: [tf] }).extra
      ).not.toContain('MCD3');
    }
  });

  it('gives the owners of several terms together', () => {
    expect(explain({ termIds: ['momentum', 'breakout'] }).extra).toEqual([
      'MCD1',
      'MCD3',
    ]);
  });

  it('gives no sensor for a term the synthesis or a domain explains', () => {
    for (const termId of [
      'stand_aside',
      'entry',
      'gold',
      'news_blackout',
      'support',
    ]) {
      expect(explain({ termIds: [termId] }).extra).toEqual([]);
    }
  });

  it('says so when there is no term or the term is not in the glossary, and goes on', () => {
    expect(explain({}).notes).toContain('NO_TERM');
    expect(explain({ termIds: [] }).notes).toContain('NO_TERM');
    const unknown = explain({ termIds: ['nonsense'] });
    expect(unknown.notes).toContain('UNKNOWN_TERM:nonsense');
    expect(unknown.m_star).toEqual(['MCD1']);
  });

  it('gives only a sensor that is live and has a reading', () => {
    const routed = explain({
      termIds: ['momentum'],
      liveIds: ['MCD1', 'MCD2'],
      sensors: {
        MCD1: facts('MCD1'),
        MCD2: facts('MCD2'),
        MCD3: facts('MCD3'),
      },
    });
    expect(routed.extra).toEqual([]);
  });

  it('reads the owners from the glossary it is handed, not from a list of its own', () => {
    const glossary = clone(GLOSSARY);
    glossary.terms.find((t) => t.id === 'momentum')!.owners = ['MCD2'];
    expect(
      route(input({ intent: 'EXPLAIN', termIds: ['momentum'], glossary })).extra
    ).toEqual(['MCD2']);
  });

  it('counts a term once however often it is named', () => {
    expect(explain({ termIds: ['momentum', 'momentum'] }).extra).toEqual([
      'MCD3',
    ]);
  });
});

describe('the instant prompts: the sensors that read the channel', () => {
  it('INSTANT_M5_INSPECT adds the sensors that read the M5 channel (D10 b)', () => {
    const routed = route(input({ intent: 'INSTANT_M5_INSPECT' }));
    expect(routed.extra).toEqual(['MCD2', 'MCD3']);
    expect(routed.m_star).toEqual(['MCD1', 'MCD2', 'MCD3']);
  });

  it('INSTANT_M15_INSPECT adds the sensors that read the M15 channel (D10 b)', () => {
    const routed = route(
      input({ intent: 'INSTANT_M15_INSPECT', traderType: 'SCALPER' })
    );
    expect(routed.extra).toEqual(['MCD1', 'MCD3']);
    expect(routed.m_star).toEqual(['MCD1', 'MCD2', 'MCD3']);
  });

  it('takes the timeframe from the label, not from the question', () => {
    const routed = route(
      input({ intent: 'INSTANT_M5_INSPECT', timeframes: ['M15'] })
    );
    expect(routed.extra).toEqual(['MCD2', 'MCD3']);
  });

  it('knows the knowledge of D10 b: D1 and D3, and the playbooks of M*', () => {
    for (const intent of [
      'INSTANT_M5_INSPECT',
      'INSTANT_M15_INSPECT',
    ] as const) {
      const routed = route(input({ intent }));
      expect(routed.domains).toEqual(['D1', 'D3']);
      expect(routed.playbooks).toEqual(routed.m_star);
    }
  });
});

describe('Report 2 and Out of scope', () => {
  it.each(['REPORT_2', 'OUT_OF_SCOPE'] as const)(
    '%s gives no reading and looks nothing up',
    (intent) => {
      const routed = route(
        input({
          intent,
          sensors: {
            MCD1: facts('MCD1', { bias: 'STAND_ASIDE' }),
            MCD2: facts('MCD2'),
            MCD3: facts('MCD3'),
          },
        })
      );
      expect(routed.m_star).toEqual([]);
      expect(routed.always).toEqual([]);
      expect(routed.extra).toEqual([]);
      expect(routed.domains).toEqual([]);
      expect(routed.playbooks).toEqual([]);
      // the warnings are still known: the board lists them
      expect(routed.warnings).toEqual([
        { mcd_id: 'MCD1', kind: 'STAND_ASIDE' },
      ]);
    }
  );
});

describe('the primary sensor is read from the roster, never named', () => {
  const draft = (edit: (sensors: any[]) => void): Roster => {
    const raw = clone(SENSOR_ROSTER) as unknown as { sensors: any[] };
    edit(raw.sensors);
    const parsed = parseRoster(raw);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    return parsed.roster;
  };

  it('does not name a sensor anywhere in the router', () => {
    const source = readFileSync(
      join(__dirname, '..', '..', '..', 'lib', 'intake', 'router.ts'),
      'utf8'
    );
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/\bMCD\d/);
    expect(code).not.toMatch(/DAY_TRADER|SCALPER/);
  });

  it('follows the rung when a registry changes it: MCD3 becomes the Scalper’s primary sensor', () => {
    const roster = draft((sensors) => {
      const find = (id: string) => sensors.find((s) => s.mcd_id === id)!;
      find('MCD2').rung.SCALPER = 'oscillators';
      find('MCD2').primary_for = [];
      find('MCD3').rung.SCALPER = 'primary_structure';
      find('MCD3').primary_for = ['SCALPER'];
    });
    const routed = route(input({ traderType: 'SCALPER', roster }));
    expect(routed.primary).toEqual(['MCD3']);
    expect(routed.m_star).toEqual(['MCD3']);
  });

  it('gives a future sensor its line and its place: MCD4 as the Day Trader’s primary sensor', () => {
    const roster = draft((sensors) => {
      sensors.push({
        mcd_id: 'MCD4',
        name: 'A future sensor',
        kind: 'independent',
        timeframes: ['M15'],
        depends_on: [],
        uses_channel: ['M15'],
        rung: { DAY_TRADER: 'primary_structure', SCALPER: 'oscillators' },
        primary_for: ['DAY_TRADER'],
        on_board: true,
        flag: 'live',
        owned_terms: [],
        state_codes: ['MCD4_UP'],
      });
      const mcd1 = sensors.find((s) => s.mcd_id === 'MCD1')!;
      mcd1.rung.DAY_TRADER = 'trendlines_channels';
      mcd1.primary_for = [];
    });
    const routed = route(
      input({
        roster,
        liveIds: ['MCD1', 'MCD2', 'MCD3', 'MCD4'],
        sensors: {
          MCD1: facts('MCD1'),
          MCD2: facts('MCD2'),
          MCD3: facts('MCD3'),
          MCD4: facts('MCD4'),
        },
      })
    );
    expect(routed.primary).toEqual(['MCD4']);
    expect(routed.m_star).toEqual(['MCD4']);
    // and the instant prompt for M15 picks it up through the channel it reads
    const instant = route(
      input({
        intent: 'INSTANT_M15_INSPECT',
        roster,
        liveIds: ['MCD1', 'MCD2', 'MCD3', 'MCD4'],
        sensors: {
          MCD1: facts('MCD1'),
          MCD2: facts('MCD2'),
          MCD3: facts('MCD3'),
          MCD4: facts('MCD4'),
        },
      })
    );
    expect(instant.extra).toEqual(['MCD1', 'MCD3', 'MCD4']);
  });

  it('says so when a roster being drafted has two candidates, and gives both', () => {
    const roster = clone(SENSOR_ROSTER);
    roster.sensors.find((s) => s.mcd_id === 'MCD2')!.primary_for = [
      'DAY_TRADER',
      'SCALPER',
    ];
    const routed = route(input({ roster }));
    expect(routed.primary).toEqual(['MCD1', 'MCD2']);
    expect(routed.notes).toContain('PRIMARY_COUNT:2');
    expect(routed.m_star).toEqual(['MCD1', 'MCD2']);
  });
});

describe('the matrix is data', () => {
  it('routes by the matrix it is given: an edited row changes the route and nothing else does', () => {
    const matrix = clone(DISPATCH_MATRIX);
    matrix.intents.DIRECTION.extra = 'TIMEFRAME_CHANNEL';
    const edited = route(
      input({ intent: 'DIRECTION', matrix, timeframes: ['M5'] })
    );
    expect(edited.extra).toEqual(['MCD2', 'MCD3']);
    const untouched = route(input({ intent: 'NEWS', matrix }));
    expect(untouched.m_star).toEqual(['MCD1']);
    expect(edited.routing_version).toBe(matrix.version);
  });

  it('can take the always set away from an intent', () => {
    const matrix = clone(DISPATCH_MATRIX);
    matrix.intents.NEWS.always = false;
    expect(route(input({ intent: 'NEWS', matrix })).m_star).toEqual([]);
  });

  it('names the version of the matrix that routed the request', () => {
    expect(route(input()).routing_version).toBe(ROUTING_VERSION);
  });
});

// ---------------------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------------------

describe('properties over random boards of up to 15 sensors', () => {
  const SEEDS = Array.from({ length: 300 }, (_, i) => BigInt(i + 1));
  const TIMEFRAME_SETS: Timeframe[][] = [[], ['M5'], ['M15'], ['M5', 'M15']];
  const TERMS = ['uoedt', 'momentum', 'breakout', 'stand_aside', 'nonsense'];

  function routes(seed: bigint) {
    const w = randomWorld(seed);
    const rng = makeRng(seed + 7n);
    const termIds = TERMS.filter(() => rng.chance(40n));
    const timeframes = rng.pick(TIMEFRAME_SETS);
    return INTENTS.map((intent) => ({
      intent,
      w,
      termIds,
      timeframes,
      routed: route({
        intent,
        traderType: w.traderType,
        liveIds: w.liveIds,
        sensors: w.sensors,
        synthesis: w.synthesis,
        termIds,
        timeframes,
        roster: w.roster,
      }),
    }));
  }

  it('puts the primary sensor and every warning in M*, for every intent that gives readings', () => {
    let withWarnings = 0;
    for (const seed of SEEDS) {
      for (const { intent, w, routed } of routes(seed)) {
        if (!matrixRow(intent).always) continue;
        const available = new Set(
          w.liveIds.filter((id) => w.sensors[id] !== undefined)
        );
        for (const id of routed.primary) {
          if (available.has(id)) expect(routed.m_star).toContain(id);
        }
        const warnings = findWarnings(
          [...available].map((id) => w.sensors[id]!),
          w.synthesis?.bias ?? null
        );
        for (const warning of warnings)
          expect(routed.m_star).toContain(warning.mcd_id);
        if (warnings.length > 0) withWarnings += 1;
      }
    }
    // the property is not vacuous: many of the random boards have a warning
    expect(withWarnings).toBeGreaterThan(300);
  });

  it('never gives a sensor that is not live or has no reading', () => {
    for (const seed of SEEDS) {
      for (const { w, routed } of routes(seed)) {
        const available = new Set(
          w.liveIds.filter((id) => w.sensors[id] !== undefined)
        );
        for (const id of routed.m_star) expect(available.has(id)).toBe(true);
        for (const id of routed.extra) expect(available.has(id)).toBe(true);
      }
    }
  });

  it('gives nothing for Report 2 and Out of scope', () => {
    for (const seed of SEEDS) {
      for (const { intent, routed } of routes(seed)) {
        if (intent === 'REPORT_2' || intent === 'OUT_OF_SCOPE') {
          expect(routed.m_star).toEqual([]);
          expect(routed.playbooks).toEqual([]);
        }
      }
    }
  });

  it('is M* = ALWAYS ∪ EXTRA, sorted by the MCD number, without repeats', () => {
    for (const seed of SEEDS) {
      for (const { routed } of routes(seed)) {
        const union = new Set([...routed.always, ...routed.extra]);
        expect(new Set(routed.m_star)).toEqual(union);
        expect(new Set(routed.m_star).size).toBe(routed.m_star.length);
        const numbers = routed.m_star.map((id) => Number(id.slice(3)));
        expect([...numbers].sort((a, b) => a - b)).toEqual(numbers);
        expect(routed.playbooks.every((id) => routed.m_star.includes(id))).toBe(
          true
        );
      }
    }
  });

  it('is a function of its input: the same twice, and in any order of the live sensors', () => {
    for (const seed of SEEDS) {
      const rng = makeRng(seed + 99n);
      for (const { intent, w, termIds, timeframes, routed } of routes(seed)) {
        const shuffled = [...w.liveIds].sort(() => (rng.chance(50n) ? 1 : -1));
        const again = route({
          intent,
          traderType: w.traderType,
          liveIds: shuffled,
          sensors: clone(w.sensors),
          synthesis: clone(w.synthesis),
          termIds: [...termIds].reverse(),
          timeframes: [...timeframes].reverse(),
          roster: w.roster,
        });
        expect(again).toEqual(routed);
      }
    }
  });

  it('is not changed by the facts of a sensor that is not live', () => {
    for (const seed of SEEDS.slice(0, 100)) {
      const base = routes(seed);
      const w = base[0]!.w;
      const stranger = Array.from({ length: 15 }, (_, i) => `MCD${i + 1}`).find(
        (id) => !w.liveIds.includes(id)
      );
      if (stranger === undefined) continue;
      const loud = {
        ...w.sensors,
        [stranger]: facts(stranger, {
          bias: 'STAND_ASIDE',
          levels: [1, 1_000_000],
        }),
      };
      for (const { intent, termIds, timeframes, routed } of base) {
        expect(
          route({
            intent,
            traderType: w.traderType,
            liveIds: w.liveIds,
            sensors: loud,
            synthesis: w.synthesis,
            termIds,
            timeframes,
            roster: w.roster,
          })
        ).toEqual(routed);
      }
    }
  });

  it('knows the ten intents of the matrix and routes each', () => {
    const seen = new Set<Intent>();
    for (const { intent } of routes(1n)) seen.add(intent);
    expect([...seen]).toEqual([...INTENTS]);
  });
});

describe('EXPLAIN: other shapes of ownership', () => {
  const explain = (over: Partial<RouteInput>) =>
    route(input({ intent: 'EXPLAIN', ...over }));

  it('gives the two sensors that own a term between them, by trader type and timeframe', () => {
    // uptrend: owned by MCD1 (M15) and MCD2 (M5); MCD1 is the Day Trader’s primary, MCD2 the Scalper’s
    expect(explain({ termIds: ['uptrend'] }).extra).toEqual(['MCD1']);
    expect(explain({ termIds: ['uptrend'], timeframes: ['M5'] }).extra).toEqual(
      ['MCD1', 'MCD2']
    );
    expect(
      explain({ termIds: ['uptrend'], timeframes: ['M15'] }).extra
    ).toEqual(['MCD1']);
    expect(
      explain({ termIds: ['uptrend'], traderType: 'SCALPER' }).extra
    ).toEqual(['MCD2']);
    expect(
      explain({
        termIds: ['uptrend'],
        traderType: 'SCALPER',
        timeframes: ['M15'],
      }).extra
    ).toEqual(['MCD1', 'MCD2']);
    expect(
      explain({
        termIds: ['uptrend'],
        traderType: 'SCALPER',
        timeframes: ['M5'],
      }).extra
    ).toEqual(['MCD2']);
  });

  it('does not say a term is missing when it was named', () => {
    expect(explain({ termIds: ['momentum'] }).notes).toEqual([]);
    expect(explain({ termIds: ['uptrend', 'momentum'] }).notes).toEqual([]);
  });

  it('counts a term owned by one sensor and by a domain as a term one sensor owns', () => {
    const glossary = clone(GLOSSARY);
    glossary.terms.find((t) => t.id === 'momentum')!.owners = ['MCD3', 'D1'];
    // MCD3 is not the Day Trader’s primary and reads both timeframes: only “one sensor owns it” gives it
    expect(
      route(input({ intent: 'EXPLAIN', termIds: ['momentum'], glossary })).extra
    ).toEqual(['MCD3']);
    glossary.terms.find((t) => t.id === 'momentum')!.owners = [
      'SYN',
      'MCD3',
      'D4',
    ];
    expect(
      route(
        input({
          intent: 'EXPLAIN',
          termIds: ['momentum'],
          timeframes: ['M5'],
          glossary,
        })
      ).extra
    ).toEqual(['MCD3']);
  });
});

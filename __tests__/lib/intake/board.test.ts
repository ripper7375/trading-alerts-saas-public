/**
 * @jest-environment node
 */

/**
 * The sensor board (`lib/intake/board.ts`, architecture 4.4, ADR-040, decisions D7 and D8).
 *
 * The board is built from what the reader returns, so these tests run each stored world
 * through the real reader (a fake database made from the signed-off golden files and the
 * three stored cycles) and then the board. They hold:
 *  - the board of every one of the 16 golden scenarios and the three stored cycles, for both
 *    trader types: one line per live sensor plus the synthesis line and the data line, the
 *    packet built on it accepted by the validator of part 1;
 *  - hand-written expected text for the stored cycles and for the cases that matter (a
 *    sensor that is STALE, INVALID or ABSENT is LISTED; a board with nothing live says so);
 *  - the cap of 800 tokens with 15 sensors (a character-based proxy, assumption A6);
 *  - properties over random boards: nothing dropped, nothing invented, order and
 *    determinism.
 */

import {
  BOARD_TOKEN_CAP,
  CHARS_PER_TOKEN,
  SENSOR_ROSTER,
  SYN_NOT_RUNNING_NO_READING,
  SYN_NOT_RUNNING_NO_SENSOR,
  boardSensors,
  buildBoard,
  estimateTokens,
  liveSensorIds,
  type BoardInput,
  type SensorFacts,
  type TraderType,
} from '@/lib/intake';

import { runWorld, type Run } from './helpers/assemble';
import { clone } from './helpers/packets';
import { makeRng, randomFacts, randomWorld } from './helpers/random';
import {
  goldenWorlds,
  rosterWith,
  storedWorlds,
  type World,
} from './helpers/world';

const GOLDEN = goldenWorlds();
const STORED = storedWorlds();
const WORLDS = [...GOLDEN, ...STORED];
const TRADERS: TraderType[] = ['DAY_TRADER', 'SCALPER'];
const GATE = new Set(
  SENSOR_ROSTER.sensors.filter((s) => !s.on_board).map((s) => s.mcd_id)
);

/** The board columns, written out: the id to 5, the status to 11, one space after each. */
const col = (id: string, status: string, rest: string): string =>
  `${id.padEnd(5)} ${status.padEnd(11)} ${rest}`;

const world = (prefix: string): World => {
  const found = WORLDS.find((w) => w.name.startsWith(prefix));
  if (found === undefined) throw new Error(`no world ${prefix}`);
  return found;
};

// ---------------------------------------------------------------------------------------
// Every stored world, both trader types
// ---------------------------------------------------------------------------------------

describe('the board of every stored world', () => {
  const cases = WORLDS.flatMap((w) =>
    TRADERS.map((t) => [`${w.name} ${t}`, w, t] as const)
  );

  it('covers 16 golden scenarios and 3 stored cycles for 2 trader types', () => {
    expect(GOLDEN).toHaveLength(16);
    expect(STORED).toHaveLength(3);
    expect(cases).toHaveLength(38);
  });

  it.each(cases)('%s', async (_name, w, traderType) => {
    const run = await runWorld(w, traderType, 'DIRECTION');
    const expectedIds = w.sensors
      .map((s) => s.mcd_id)
      .filter((id) => !GATE.has(id));

    // one line per live sensor, nothing dropped, in the order of the MCD number
    expect(run.board.board.sensors.map((l) => l.mcd_id)).toEqual(expectedIds);
    // the body is the live sensors plus two: the synthesis line and the data line
    expect(run.board.lines.length - 1).toBe(expectedIds.length + 2);
    expect(run.board.lines).toHaveLength(run.snapshot.live_ids.length + 3);
    expect(run.board.sensorsNotLive).toBe(false);

    // each line says what the stored sensor said
    for (const line of run.board.board.sensors) {
      const stored = w.sensors.find((s) => s.mcd_id === line.mcd_id)!;
      expect(line.status).toBe(stored.status);
      const envelope = JSON.parse(stored.envelope_json) as Record<
        string,
        unknown
      >;
      expect(line.state_code).toBe(envelope['state_code']);
      expect(line.bias).toBe(envelope['bias']);
      expect(line.summary).toBe(envelope['summary_line']);
      expect(line.reasons).toEqual(envelope['status_reasons']);
    }

    // the synthesis line says what the stored reading of this trader type said
    const reading = JSON.parse(
      w.synthesis.find((s) => s.profile === traderType)!.reading_json
    ) as Record<string, unknown>;
    expect(run.board.board.syn).toEqual({
      state: 'RUNNING',
      status: reading['status'],
      rule_id: reading['rule_id'],
      bias: reading['bias'],
      trend_relation: reading['trend_relation'],
      summary: reading['summary_line'],
    });

    // the data line: the close of the last closed M5 bar of the stored reading (D8)
    const price = w.synthesis[0]!.reference_price!;
    expect(run.board.lines[run.board.lines.length - 1]).toContain(
      `last price ${price.toFixed(2)} (close of the `
    );

    // and the packet built on this board is one the validator accepts, whatever the
    // sensor's status: a line that disagreed with its envelope would be refused here
    expect(run.validation).toEqual({ ok: true, packet: expect.any(Object) });
  });

  it('every packet of every intent is accepted: 19 worlds x 2 trader types x 9 intents', async () => {
    const intents = [
      'DIRECTION',
      'ENTRY_TIMING',
      'EXIT_TARGETS',
      'RISK_SIZING',
      'EXPLAIN',
      'NEWS',
      'REPORT_2',
      'INSTANT_M5_INSPECT',
      'INSTANT_M15_INSPECT',
    ] as const;
    let checked = 0;
    for (const w of WORLDS) {
      for (const traderType of TRADERS) {
        for (const intent of intents) {
          const run = await runWorld(w, traderType, intent);
          if (run.validation === null || !run.validation.ok) {
            throw new Error(
              `${w.name} ${traderType} ${intent}: ${JSON.stringify(run.validation)}`
            );
          }
          checked += 1;
        }
      }
    }
    expect(checked).toBe(19 * 2 * 9);
  });
});

// ---------------------------------------------------------------------------------------
// The text, written out by hand
// ---------------------------------------------------------------------------------------

describe('the board text of the stored cycles', () => {
  it('18 Sep 20:55, Day Trader, character for character', async () => {
    const run = await runWorld(
      world('2026-09-18T2055Z'),
      'DAY_TRADER',
      'DIRECTION'
    );
    expect(run.board.lines).toEqual([
      'SENSOR BOARD · XAUUSD · 18 SEP 20:55 · DAY TRADER',
      'SYN   CAUTIONARY  R1_MACRO_COUNTER_TREND_RALLY · LONG · COUNTER_TREND · Counter-trend rally, LONG',
      'MCD1  CAUTIONARY  MCD1_DOWN_UPPER_BREAKOUT · LONG · M15 downtrend, sustained close above the corridor',
      'MCD2  CAUTIONARY  MCD2_UP_IN_CORRIDOR · LONG · M5 uptrend, inside the corridor',
      'MCD3  CAUTIONARY  MCD3_NON_CONSOLIDATED_TREND_CONFLICT · STAND_ASIDE · M15 and M5 trends differ, no consolidated trend',
      'DATA  FRESH       cycle 20:55 · last price 4378.31 (close of the 20:50 M5 bar)',
    ]);
  });

  it('18 Sep 20:55, Scalper: the same sensors, the Scalper’s synthesis line', async () => {
    const run = await runWorld(
      world('2026-09-18T2055Z'),
      'SCALPER',
      'DIRECTION'
    );
    expect(run.board.lines[0]).toBe(
      'SENSOR BOARD · XAUUSD · 18 SEP 20:55 · SCALPER'
    );
    expect(run.board.lines[1]).toBe(
      col(
        'SYN',
        'CAUTIONARY',
        'R3S_TREND_CONTINUATION_M5 · LONG · WITH_TREND · M5 trend continuation, LONG'
      )
    );
    expect(run.board.lines.slice(2, 5)).toEqual([
      col(
        'MCD1',
        'CAUTIONARY',
        'MCD1_DOWN_UPPER_BREAKOUT · LONG · M15 downtrend, sustained close above the corridor'
      ),
      col(
        'MCD2',
        'CAUTIONARY',
        'MCD2_UP_IN_CORRIDOR · LONG · M5 uptrend, inside the corridor'
      ),
      col(
        'MCD3',
        'CAUTIONARY',
        'MCD3_NON_CONSOLIDATED_TREND_CONFLICT · STAND_ASIDE · M15 and M5 trends differ, no consolidated trend'
      ),
    ]);
  });

  it('28 Sep 14:15: a snapback, MCD3 neutral', async () => {
    const run = await runWorld(
      world('2026-09-28T1415Z'),
      'DAY_TRADER',
      'DIRECTION'
    );
    expect(run.board.lines).toEqual([
      'SENSOR BOARD · XAUUSD · 28 SEP 14:15 · DAY TRADER',
      col(
        'SYN',
        'CAUTIONARY',
        'R2_EXHAUSTION_SNAPBACK · LONG · COUNTER_TREND · Snapback after a spike down, LONG'
      ),
      col(
        'MCD1',
        'CAUTIONARY',
        'MCD1_DOWN_LOWER_BREAKDOWN · SHORT · M15 downtrend, latest close below the corridor'
      ),
      col(
        'MCD2',
        'CAUTIONARY',
        'MCD2_DOWN_LOWER_BREAKDOWN · SHORT · M5 downtrend, below the corridor'
      ),
      col(
        'MCD3',
        'CAUTIONARY',
        'MCD3_BEAR_BOTTOM · NEUTRAL · Consolidated downtrend, lower zone of the M15 corridor'
      ),
      col(
        'DATA',
        'FRESH',
        'cycle 14:15 · last price 4138.78 (close of the 14:10 M5 bar)'
      ),
    ]);
  });

  it('28 Sep 23:15: a downtrend continuation, Scalper', async () => {
    const run = await runWorld(
      world('2026-09-28T2315Z'),
      'SCALPER',
      'DIRECTION'
    );
    expect(run.board.lines).toEqual([
      'SENSOR BOARD · XAUUSD · 28 SEP 23:15 · SCALPER',
      col(
        'SYN',
        'CAUTIONARY',
        'R3S_TREND_CONTINUATION_M5 · SHORT · WITH_TREND · M5 trend continuation, SHORT'
      ),
      col(
        'MCD1',
        'CAUTIONARY',
        'MCD1_DOWN_IN_CORRIDOR · SHORT · M15 downtrend, no sustained break of the corridor'
      ),
      col(
        'MCD2',
        'CAUTIONARY',
        'MCD2_DOWN_IN_CORRIDOR · SHORT · M5 downtrend, inside the corridor'
      ),
      col(
        'MCD3',
        'CAUTIONARY',
        'MCD3_NON_CONSOLIDATED_OVERFLOW · STAND_ASIDE · Trends agree, M5 corridor often outside the M15 corridor'
      ),
      col(
        'DATA',
        'FRESH',
        'cycle 23:15 · last price 4125.32 (close of the 23:10 M5 bar)'
      ),
    ]);
  });

  it('a clean uptrend: three VALID lines and a VALID synthesis', async () => {
    const run = await runWorld(world('04-'), 'DAY_TRADER', 'DIRECTION');
    expect(run.board.lines.slice(1, 5)).toEqual([
      col(
        'SYN',
        'VALID',
        'R3_TREND_CONTINUATION · LONG · WITH_TREND · Trend continuation, LONG'
      ),
      col(
        'MCD1',
        'VALID',
        'MCD1_UP_IN_CORRIDOR · LONG · Golden scenario reading'
      ),
      col(
        'MCD2',
        'VALID',
        'MCD2_UP_IN_CORRIDOR · LONG · Golden scenario reading'
      ),
      col('MCD3', 'VALID', 'MCD3_BULL_MID · LONG · Golden scenario reading'),
    ]);
  });
});

describe('unavailable is said out loud (ADR-040)', () => {
  it('lists a STALE primary sensor and a sensor that is STALE because of it', async () => {
    const run = await runWorld(world('14-'), 'DAY_TRADER', 'DIRECTION');
    expect(run.board.lines).toEqual([
      'SENSOR BOARD · XAUUSD · 09 OCT 10:30 · DAY TRADER',
      col(
        'SYN',
        'STALE',
        'R0_DATA_CHECK · STAND_ASIDE · Stand aside, primary sensor unavailable'
      ),
      col('MCD1', 'STALE', 'unavailable · NO_STATS_AT_SLOT'),
      col(
        'MCD2',
        'VALID',
        'MCD2_UP_IN_CORRIDOR · LONG · Golden scenario reading'
      ),
      col('MCD3', 'STALE', 'unavailable · UPSTREAM_STALE:MCD1'),
      col(
        'DATA',
        'FRESH',
        'cycle 10:30 · last price 4402.20 (close of the 10:25 M5 bar)'
      ),
    ]);
    expect(
      run.board.board.sensors.map((l) => [
        l.mcd_id,
        l.status,
        l.state_code,
        l.bias,
      ])
    ).toEqual([
      ['MCD1', 'STALE', null, null],
      ['MCD2', 'VALID', 'MCD2_UP_IN_CORRIDOR', 'LONG'],
      ['MCD3', 'STALE', null, null],
    ]);
  });

  it('lists an INVALID sensor with its reasons', async () => {
    const run = await runWorld(world('15-'), 'DAY_TRADER', 'DIRECTION');
    expect(run.board.lines.slice(2, 5)).toEqual([
      col(
        'MCD1',
        'VALID',
        'MCD1_UP_IN_CORRIDOR · LONG · Golden scenario reading'
      ),
      col('MCD2', 'INVALID', 'unavailable · INSUFFICIENT_BARS'),
      col('MCD3', 'INVALID', 'unavailable · UPSTREAM_UNAVAILABLE:MCD2'),
    ]);
  });

  it('shows only the sensors that are running when only one is (golden 16)', async () => {
    const run = await runWorld(world('16-'), 'SCALPER', 'DIRECTION');
    expect(run.board.board.sensors.map((l) => l.mcd_id)).toEqual(['MCD2']);
    expect(run.board.lines).toHaveLength(4);
  });

  it('lists a live sensor with no row for the cycle as ABSENT', async () => {
    const live = rosterWith({ MCD1: 'live', MCD2: 'live', MCD3: 'live' });
    const w = world('04-');
    const without = {
      ...w,
      sensors: w.sensors.filter((s) => s.mcd_id !== 'MCD3'),
    };
    const run = await runWorld(without, 'DAY_TRADER', 'DIRECTION', {
      roster: live,
    });
    expect(run.board.board.sensors.map((l) => [l.mcd_id, l.status])).toEqual([
      ['MCD1', 'VALID'],
      ['MCD2', 'VALID'],
      ['MCD3', 'ABSENT'],
    ]);
    expect(run.board.lines[4]).toBe(
      col('MCD3', 'ABSENT', 'unavailable · no reading for this cycle')
    );
    expect(run.board.board.sensors[2]).toEqual({
      mcd_id: 'MCD3',
      status: 'ABSENT',
      state_code: null,
      bias: null,
      summary: null,
      reasons: [],
    });
    // the line count still equals the live sensors plus two
    expect(run.board.lines.length - 1).toBe(3 + 2);
    // and the packet built on it is accepted: ABSENT is a status the contract knows
    expect(run.validation?.ok).toBe(true);
  });

  it('lists a sensor whose stored row cannot be believed as ABSENT, not as what it claims', async () => {
    const w = world('04-');
    const run = await runWorld(w, 'DAY_TRADER', 'DIRECTION', {
      mcd: (rows) =>
        rows.map((row) =>
          row.mcd_id === 'MCD2'
            ? { ...row, envelope_sha256: '0'.repeat(64) }
            : row
        ),
    });
    expect(run.board.board.sensors.map((l) => [l.mcd_id, l.status])).toEqual([
      ['MCD1', 'VALID'],
      ['MCD2', 'ABSENT'],
      ['MCD3', 'VALID'],
    ]);
    expect(run.snapshot.problems.map((p) => p.code)).toEqual([
      'ROW_UNREADABLE',
    ]);
  });
});

describe('a board with nothing live (D7)', () => {
  it('says so in words and flags it, with the committed configuration', async () => {
    // every sensor is `off` in the committed configuration: the reader finds no live row
    const run = await runWorld(world('04-'), 'DAY_TRADER', 'DIRECTION', {
      mcd: () => [],
    });
    expect(run.board.sensorsNotLive).toBe(true);
    expect(run.board.board.sensors).toEqual([]);
    expect(run.board.board.syn).toEqual({
      state: 'NOT_RUNNING',
      status: null,
      rule_id: null,
      bias: null,
      trend_relation: null,
      summary: SYN_NOT_RUNNING_NO_SENSOR,
    });
    expect(run.board.lines).toEqual([
      'SENSOR BOARD · XAUUSD · 05 OCT 14:30 · DAY TRADER',
      col(
        'SYN',
        'NOT RUNNING',
        'No sensor is live, so there are no readings (SENSORS_NOT_LIVE)'
      ),
      col('DATA', 'FRESH', 'cycle 14:30 · last price unavailable'),
    ]);
    expect(run.snapshot.data.flags).toEqual(['SENSORS_NOT_LIVE']);
    // the body is still the live sensors plus two
    expect(run.board.lines.length - 1).toBe(0 + 2);
    // and the packet says so and carries no reading
    expect(run.route.m_star).toEqual([]);
    expect(run.validation?.ok).toBe(true);
  });

  it('does not let a synthesis row run without a sensor to have read', () => {
    const facts = {
      profile: 'DAY_TRADER' as const,
      status: 'VALID' as const,
      rule_id: 'R3_TREND_CONTINUATION',
      bias: 'LONG' as const,
      trend_relation: 'WITH_TREND' as const,
      summary: 'Trend continuation, LONG',
      reference_price: 4390.4,
      zone_sources: [],
      entry_price: null,
    };
    const result = buildBoard({
      traderType: 'DAY_TRADER',
      liveIds: [],
      sensors: {},
      synthesis: facts,
      data: {
        status: 'FRESH',
        retuning: false,
        cycle_slot: '2026-10-05T14:30Z',
        last_price: null,
      },
    });
    expect(result.board.syn.state).toBe('NOT_RUNNING');
    expect(result.sensorsNotLive).toBe(true);
  });

  it('says the synthesis is not running when sensors are live and its row is not', async () => {
    const run = await runWorld(world('04-'), 'DAY_TRADER', 'DIRECTION', {
      synthesis: () => [],
    });
    expect(run.board.board.syn.state).toBe('NOT_RUNNING');
    expect(run.board.board.syn.summary).toBe(SYN_NOT_RUNNING_NO_READING);
    expect(run.board.lines[1]).toBe(
      col('SYN', 'NOT RUNNING', SYN_NOT_RUNNING_NO_READING)
    );
    expect(run.board.sensorsNotLive).toBe(false);
    expect(run.board.board.sensors).toHaveLength(3);
    expect(run.snapshot.data.last_price).toBeNull();
    expect(run.validation?.ok).toBe(true);
  });
});

describe('shadow rows never reach the board', () => {
  it('leaves a shadow sensor off the board and asks for live rows only', async () => {
    const w = world('04-');
    const shadowed = {
      ...w,
      sensors: w.sensors.map((s) =>
        s.mcd_id === 'MCD3' ? { ...s, flag: 'shadow' } : s
      ),
    };
    const run = await runWorld(shadowed, 'DAY_TRADER', 'DIRECTION');
    expect(run.board.board.sensors.map((l) => l.mcd_id)).toEqual([
      'MCD1',
      'MCD2',
    ]);
    expect(run.snapshot.live_ids).toEqual(['MCD1', 'MCD2']);
  });

  it('does not believe a row that is not live even if the database answered it', async () => {
    const w = world('04-');
    const shadowed = {
      ...w,
      sensors: w.sensors.map((s) =>
        s.mcd_id === 'MCD3' ? { ...s, flag: 'shadow' } : s
      ),
    };
    const run = await runWorld(shadowed, 'DAY_TRADER', 'DIRECTION', {
      ignoreFlagFilter: true,
    });
    expect(run.board.board.sensors.map((l) => l.mcd_id)).toEqual([
      'MCD1',
      'MCD2',
    ]);
  });

  it('does not show a shadow synthesis reading', async () => {
    const w = world('04-');
    const shadowed = {
      ...w,
      synthesis: w.synthesis.map((s) => ({ ...s, flag: 'shadow' })),
    };
    const run = await runWorld(shadowed, 'DAY_TRADER', 'DIRECTION');
    expect(run.board.board.syn.state).toBe('NOT_RUNNING');
    expect(run.board.board.sensors).toHaveLength(3);
  });
});

describe('the data line', () => {
  it('carries each data status, the slot and the retuning mark', async () => {
    const w = world('04-');
    for (const status of [
      'FRESH',
      'DELAYED',
      'STALE',
      'MARKET_CLOSED',
    ] as const) {
      const run = await runWorld(w, 'DAY_TRADER', 'DIRECTION', {
        gateway: status,
      });
      expect(run.board.lines.at(-1)).toBe(
        col(
          'DATA',
          status,
          'cycle 14:30 · last price 4390.40 (close of the 14:25 M5 bar)'
        )
      );
      expect(run.snapshot.data.status).toBe(status);
    }
    const retuning = await runWorld(w, 'DAY_TRADER', 'DIRECTION', {
      retuning: true,
    });
    expect(retuning.board.lines.at(-1)).toBe(
      col(
        'DATA',
        'FRESH',
        'cycle 14:30 · last price 4390.40 (close of the 14:25 M5 bar) · RETUNING'
      )
    );
    expect(retuning.snapshot.data.retuning).toBe(true);
  });

  it('says UNKNOWN when the gateway cannot be asked, and still shows the board', async () => {
    const run = await runWorld(world('04-'), 'DAY_TRADER', 'DIRECTION', {
      gateway: 'THROWS',
    });
    expect(run.board.lines.at(-1)).toContain('UNKNOWN');
    expect(run.snapshot.data.flags).toEqual(['GATEWAY_UNREACHABLE']);
    expect(run.board.board.sensors).toHaveLength(3);
    expect(run.validation?.ok).toBe(true);
  });

  it('says there is no cycle when there is none to read', async () => {
    const run = await runWorld(world('04-'), 'DAY_TRADER', 'DIRECTION', {
      noCycle: true,
    });
    expect(run.board.lines[0]).toBe(
      'SENSOR BOARD · XAUUSD · NO CYCLE · DAY TRADER'
    );
    expect(run.board.lines.at(-1)).toContain(
      'no cycle · last price unavailable'
    );
  });

  it('labels the price with the bar it is the close of, not with the cycle', async () => {
    const run = await runWorld(world('01-'), 'DAY_TRADER', 'DIRECTION');
    expect(run.snapshot.data.cycle_slot).toBe('2026-09-18T20:55Z');
    expect(run.snapshot.data.last_price).toEqual({
      price: 4378.31,
      timeframe: 'M5',
      bar: '2026-09-18T20:50Z',
    });
  });
});

// ---------------------------------------------------------------------------------------
// liveSensorIds
// ---------------------------------------------------------------------------------------

describe('liveSensorIds', () => {
  it('is empty for the committed configuration (every sensor is off) and no row', () => {
    expect(liveSensorIds([])).toEqual([]);
  });

  it('takes the sensors that have a live row', () => {
    expect(liveSensorIds(['MCD3', 'MCD1'])).toEqual(['MCD1', 'MCD3']);
  });

  it('takes the sensors the configuration marks live, row or no row', () => {
    expect(liveSensorIds([], rosterWith({ MCD2: 'live' }))).toEqual(['MCD2']);
    expect(liveSensorIds(['MCD1'], rosterWith({ MCD2: 'live' }))).toEqual([
      'MCD1',
      'MCD2',
    ]);
  });

  it('does not take a shadow or an off sensor, and never the gate', () => {
    const roster = rosterWith({
      MCD0: 'live',
      MCD1: 'shadow',
      MCD2: 'off',
      MCD3: 'live',
    });
    expect(liveSensorIds([], roster)).toEqual(['MCD3']);
    expect(liveSensorIds(['MCD0'], roster)).toEqual(['MCD3']);
  });

  it('ignores a row of a sensor the roster does not know', () => {
    expect(liveSensorIds(['MCD9', 'MCD1'])).toEqual(['MCD1']);
  });

  it('lists a sensor once', () => {
    expect(
      liveSensorIds(['MCD1', 'MCD1'], rosterWith({ MCD1: 'live' }))
    ).toEqual(['MCD1']);
  });
});

// ---------------------------------------------------------------------------------------
// The token cap
// ---------------------------------------------------------------------------------------

describe('the token cap (4.4: 600 to 800 tokens for 15 sensors)', () => {
  /** Fifteen board sensors, each with the longest state code and summary the stored cycles have. */
  function fifteen(): BoardInput {
    const longestState = SENSOR_ROSTER.sensors
      .flatMap((s) => s.state_codes)
      .reduce((a, b) => (b.length > a.length ? b : a));
    const longestSummary = WORLDS.flatMap((w) =>
      w.sensors.map(
        (s) =>
          (JSON.parse(s.envelope_json) as { summary_line: string }).summary_line
      )
    ).reduce((a, b) => (b.length > a.length ? b : a));
    const ids = Array.from({ length: 15 }, (_, i) => `MCD${i + 1}`);
    const sensors: Record<string, SensorFacts> = {};
    for (const id of ids) {
      sensors[id] = {
        mcd_id: id,
        status: 'CAUTIONARY',
        state_code: longestState,
        bias: 'STAND_ASIDE',
        summary: longestSummary,
        reasons: ['MCD0_DEFECT_M5'],
        levels: [],
      };
    }
    return {
      traderType: 'DAY_TRADER',
      liveIds: ids,
      sensors,
      synthesis: {
        profile: 'DAY_TRADER',
        status: 'CAUTIONARY',
        rule_id: 'R1_MACRO_COUNTER_TREND_RALLY',
        bias: 'LONG',
        trend_relation: 'COUNTER_TREND',
        summary: 'Counter-trend rally, LONG',
        reference_price: 4378.31,
        zone_sources: [],
        entry_price: null,
      },
      data: {
        status: 'MARKET_CLOSED',
        retuning: true,
        cycle_slot: '2026-09-18T20:55Z',
        last_price: {
          price: 4378.31,
          timeframe: 'M5',
          bar: '2026-09-18T20:50Z',
        },
      },
    };
  }

  it('keeps 15 sensors with the longest real lines within 800 tokens', () => {
    const result = buildBoard(fifteen());
    expect(result.board.sensors).toHaveLength(15);
    const tokens = estimateTokens(result.lines.join('\n'));
    expect(tokens).toBeLessThanOrEqual(BOARD_TOKEN_CAP);
    // and it is not a vacuous bound: the board is well past a third of the cap
    expect(tokens).toBeGreaterThan(BOARD_TOKEN_CAP / 3);
  });

  it('keeps every real board of the stored worlds far below it', async () => {
    for (const w of WORLDS) {
      const run = await runWorld(w, 'DAY_TRADER', 'DIRECTION');
      expect(estimateTokens(run.board.lines.join('\n'))).toBeLessThan(
        BOARD_TOKEN_CAP / 2
      );
    }
  });

  it('counts three characters to a token and rounds up', () => {
    expect(CHARS_PER_TOKEN).toBe(3);
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('a')).toBe(1);
    expect(estimateTokens('abc')).toBe(1);
    expect(estimateTokens('abcd')).toBe(2);
  });
});

// ---------------------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------------------

describe('properties over random boards', () => {
  const SEEDS = Array.from({ length: 300 }, (_, i) => BigInt(i + 1));

  const boardOf = (w: ReturnType<typeof randomWorld>) =>
    buildBoard({
      traderType: w.traderType,
      liveIds: w.liveIds,
      sensors: w.sensors,
      synthesis: w.synthesis,
      data: {
        status: 'FRESH',
        retuning: false,
        cycle_slot: '2026-09-18T20:55Z',
        last_price: null,
      },
    });

  it('has one line per live sensor, plus the synthesis line and the data line', () => {
    for (const seed of SEEDS) {
      const w = randomWorld(seed);
      const result = boardOf(w);
      expect(result.board.sensors.length).toBe(w.liveIds.length);
      expect(result.lines.length - 1).toBe(w.liveIds.length + 2);
    }
  });

  it('lists exactly the live sensors, once each, in the order of the MCD number', () => {
    for (const seed of SEEDS) {
      const w = randomWorld(seed);
      const ids = boardOf(w).board.sensors.map((l) => l.mcd_id);
      expect(ids).toEqual(
        [...w.liveIds].sort((a, b) => Number(a.slice(3)) - Number(b.slice(3)))
      );
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('never lists a sensor that is not live, even one that has facts', () => {
    let checked = 0;
    for (const seed of SEEDS) {
      const w = randomWorld(seed);
      const stranger = Array.from({ length: 15 }, (_, i) => `MCD${i + 1}`).find(
        (id) => !w.liveIds.includes(id)
      );
      if (stranger === undefined) continue;
      const result = buildBoard({
        traderType: w.traderType,
        liveIds: w.liveIds,
        sensors: {
          ...w.sensors,
          [stranger]: randomFacts(makeRng(seed), stranger),
        },
        synthesis: w.synthesis,
        data: {
          status: 'FRESH',
          retuning: false,
          cycle_slot: null,
          last_price: null,
        },
      });
      expect(result.board.sensors.some((l) => l.mcd_id === stranger)).toBe(
        false
      );
      checked += 1;
    }
    expect(checked).toBeGreaterThan(250);
  });

  it('marks a sensor ABSENT exactly when it is live and has no facts', () => {
    for (const seed of SEEDS) {
      const w = randomWorld(seed);
      for (const line of boardOf(w).board.sensors) {
        expect(line.status === 'ABSENT').toBe(
          w.sensors[line.mcd_id] === undefined
        );
      }
    }
  });

  it('is a function of its input: shuffled live ids and a clone give the same board', () => {
    for (const seed of SEEDS) {
      const w = randomWorld(seed);
      const first = boardOf(w);
      const rng = makeRng(seed + 1000n);
      const shuffled = [...w.liveIds].sort(() => (rng.chance(50n) ? 1 : -1));
      expect(
        boardOf({ ...clone(w), liveIds: shuffled, roster: w.roster })
      ).toEqual(first);
    }
  });

  it('flags “not live” exactly when there is no live sensor', () => {
    for (const seed of SEEDS) {
      const w = randomWorld(seed);
      const result = boardOf(w);
      expect(result.sensorsNotLive).toBe(w.liveIds.length === 0);
      if (w.liveIds.length === 0)
        expect(result.board.syn.state).toBe('NOT_RUNNING');
    }
  });

  it('fits a random board of up to 15 sensors in the packet’s own line bounds', () => {
    for (const seed of SEEDS) {
      const w = randomWorld(seed);
      for (const line of boardOf(w).board.sensors) {
        expect((line.summary ?? '').length).toBeLessThanOrEqual(80);
        expect((line.state_code ?? '').length).toBeLessThanOrEqual(48);
      }
    }
  });
});

describe('what the board never includes', () => {
  it('the committed roster has three sensors on the board and a gate that is not one', () => {
    expect(boardSensors().map((s) => s.mcd_id)).toEqual([
      'MCD1',
      'MCD2',
      'MCD3',
    ]);
  });

  it('puts no gate on the board even when the gate has a live row', async () => {
    const run = await runWorld(world('01-'), 'DAY_TRADER', 'DIRECTION');
    expect(run.snapshot.live_ids).toEqual(['MCD1', 'MCD2', 'MCD3']);
    expect(run.board.lines.join('\n')).not.toContain('MCD0');
    expect(run.snapshot.problems).toEqual([]);
  });
});

// keep Run in use for readers of the file
export type _Run = Run;

describe('the words of the board, written out', () => {
  const facts = (over: Partial<SensorFacts> = {}): SensorFacts => ({
    mcd_id: 'MCD1',
    status: 'STALE',
    state_code: null,
    bias: null,
    summary: 'Stale data',
    reasons: ['NO_STATS_AT_SLOT'],
    levels: [],
    ...over,
  });
  const data = {
    status: 'FRESH' as const,
    retuning: false,
    cycle_slot: '2026-09-18T20:55Z',
    last_price: {
      price: 4378.31,
      timeframe: 'M5' as const,
      bar: '2026-09-18T20:50Z',
    },
  };

  it('caps the board at 800 tokens', () => {
    expect(BOARD_TOKEN_CAP).toBe(800);
  });

  it('says in these words that nothing is live and that the synthesis has no reading', () => {
    expect(SYN_NOT_RUNNING_NO_SENSOR).toBe(
      'No sensor is live, so there are no readings (SENSORS_NOT_LIVE)'
    );
    expect(SYN_NOT_RUNNING_NO_READING).toBe(
      'No live synthesis reading for this cycle'
    );
  });

  it('lists every reason of an unavailable sensor, separated by commas', () => {
    const result = buildBoard({
      traderType: 'DAY_TRADER',
      liveIds: ['MCD1'],
      sensors: {
        MCD1: facts({ reasons: ['NO_STATS_AT_SLOT', 'UPSTREAM_STALE:MCD2'] }),
      },
      synthesis: null,
      data,
    });
    expect(result.lines[2]).toBe(
      col(
        'MCD1',
        'STALE',
        'unavailable · NO_STATS_AT_SLOT, UPSTREAM_STALE:MCD2'
      )
    );
  });

  it('says the synthesis has no reading, not that no sensor is live, when exactly one sensor is', () => {
    const result = buildBoard({
      traderType: 'DAY_TRADER',
      liveIds: ['MCD1'],
      sensors: { MCD1: facts() },
      synthesis: null,
      data,
    });
    expect(result.board.syn.summary).toBe(SYN_NOT_RUNNING_NO_READING);
    expect(result.sensorsNotLive).toBe(false);
  });

  it('leaves out the bar label when the bar is not a slot, and keeps the price', () => {
    const result = buildBoard({
      traderType: 'DAY_TRADER',
      liveIds: [],
      sensors: {},
      synthesis: null,
      data: { ...data, last_price: { ...data.last_price, bar: 'not a slot' } },
    });
    expect(result.lines.at(-1)).toBe(
      col('DATA', 'FRESH', 'cycle 20:55 · last price 4378.31')
    );
  });

  it('says there is no cycle when the slot is not a slot', () => {
    const result = buildBoard({
      traderType: 'SCALPER',
      liveIds: [],
      sensors: {},
      synthesis: null,
      data: { ...data, cycle_slot: '2026-02-30T10:00Z', last_price: null },
    });
    expect(result.lines[0]).toBe('SENSOR BOARD · XAUUSD · NO CYCLE · SCALPER');
    expect(result.lines.at(-1)).toBe(
      col('DATA', 'FRESH', 'no cycle · last price unavailable')
    );
  });
});

/**
 * Random worlds for the property tests of the board and the router: a roster of up to 15
 * sensors (the board's own bound, 4.4), which sensors are live, what each live one says,
 * and a synthesis reading. Seeded, so a failure repeats; no market data is invented beyond
 * what the properties need (status, bias, state code, prices).
 */

import {
  parseRoster,
  type Bias,
  type Roster,
  type SensorFacts,
  type SensorStatus,
  type SynthesisFacts,
  type TraderType,
} from '@/lib/intake';

import { makeRng, type Rng } from '../../engine4/helpers/rng';

export { makeRng };
export type { Rng };

const BIASES: Bias[] = ['LONG', 'SHORT', 'NEUTRAL', 'STAND_ASIDE'];
const STATUSES: SensorStatus[] = ['VALID', 'CAUTIONARY', 'INVALID', 'STALE'];
const TIMEFRAMES = [['M5'], ['M15'], ['M5', 'M15']] as const;

/** A roster of `count` sensors on the board (MCD1..MCDcount) and the gate MCD0. */
export function randomRoster(rng: Rng, count: number): Roster {
  const ids = Array.from({ length: count }, (_, i) => `MCD${i + 1}`);
  const primary: Record<TraderType, string> = {
    DAY_TRADER: rng.pick(ids),
    SCALPER: rng.pick(ids),
  };
  const sensors = [
    {
      mcd_id: 'MCD0',
      name: 'Gate',
      kind: 'gate' as const,
      timeframes: ['M5', 'M15'] as ('M5' | 'M15')[],
      depends_on: [] as string[],
      uses_channel: [] as ('M5' | 'M15')[],
      rung: {},
      primary_for: [] as TraderType[],
      on_board: false,
      flag: 'off' as const,
      owned_terms: [] as string[],
      state_codes: ['MCD0_ALL_QUALIFIED'],
    },
    ...ids.map((id) => {
      const timeframes = [...rng.pick(TIMEFRAMES)] as ('M5' | 'M15')[];
      const primaryFor = (['DAY_TRADER', 'SCALPER'] as const).filter(
        (t) => primary[t] === id
      );
      return {
        mcd_id: id,
        name: `Sensor ${id}`,
        kind: 'independent' as const,
        timeframes,
        depends_on: [] as string[],
        uses_channel: [...timeframes],
        rung: {
          DAY_TRADER:
            primary.DAY_TRADER === id ? 'primary_structure' : 'oscillators',
          SCALPER: primary.SCALPER === id ? 'primary_structure' : 'oscillators',
        },
        primary_for: primaryFor as TraderType[],
        on_board: true,
        flag: rng.pick(['off', 'shadow', 'live'] as const),
        owned_terms: [] as string[],
        state_codes: [`${id}_UP`, `${id}_DOWN`],
      };
    }),
  ];
  const parsed = parseRoster({
    schema: 'sensor-roster/1',
    synthesis: { flag: 'off', rules_version: 'draft-1' },
    sensors,
  });
  if (!parsed.ok) {
    throw new Error(
      `the random roster is not valid: ${JSON.stringify(parsed.issues)}`
    );
  }
  return parsed.roster;
}

export function randomFacts(rng: Rng, id: string): SensorFacts {
  const status = rng.pick(STATUSES);
  const usable = status === 'VALID' || status === 'CAUTIONARY';
  return {
    mcd_id: id,
    status,
    state_code: usable ? `${id}_${rng.pick(['UP', 'DOWN'])}` : null,
    bias: usable ? rng.pick(BIASES) : null,
    summary: usable ? `${id} says something` : `${id} has no reading`,
    reasons: status === 'VALID' ? [] : ['SOME_REASON'],
    levels: Array.from(
      { length: Number(rng.int(0n, 4n)) },
      () => Number(rng.int(430000n, 450000n)) / 100
    ),
  };
}

export function randomSynthesis(
  rng: Rng,
  traderType: TraderType
): SynthesisFacts | null {
  if (rng.chance(20n)) return null;
  const bias = rng.pick(BIASES);
  const directional = bias === 'LONG' || bias === 'SHORT';
  const price = Number(rng.int(430000n, 450000n)) / 100;
  return {
    profile: traderType,
    status: rng.pick(['VALID', 'CAUTIONARY'] as const),
    rule_id: 'R3_TREND_CONTINUATION',
    bias,
    trend_relation: directional
      ? rng.pick(['WITH_TREND', 'COUNTER_TREND'] as const)
      : null,
    summary: 'A random reading',
    reference_price: rng.chance(90n) ? price : null,
    zone_sources: [],
    entry_price: directional && rng.chance(70n) ? price : null,
  };
}

export interface RandomWorld {
  roster: Roster;
  traderType: TraderType;
  liveIds: string[];
  sensors: Record<string, SensorFacts>;
  synthesis: SynthesisFacts | null;
}

export function randomWorld(seed: bigint, maxSensors = 15): RandomWorld {
  const rng = makeRng(seed);
  const roster = randomRoster(rng, Number(rng.int(1n, BigInt(maxSensors))));
  const traderType = rng.pick(['DAY_TRADER', 'SCALPER'] as const);
  const liveIds = roster.sensors
    .filter((s) => s.on_board && rng.chance(70n))
    .map((s) => s.mcd_id);
  const sensors: Record<string, SensorFacts> = {};
  for (const id of liveIds) {
    // about one live sensor in eight has no reading for the cycle (ABSENT)
    if (!rng.chance(12n)) sensors[id] = randomFacts(rng, id);
  }
  return {
    roster,
    traderType,
    liveIds,
    sensors,
    synthesis: randomSynthesis(rng, traderType),
  };
}

/**
 * @jest-environment node
 */

/**
 * The edges of `parseRoster`, found by the mutation check of build step 6 part 1: limits that
 * hold at exactly their value, patterns anchored at both ends, items of the wrong kind, and what
 * happens when the committed roster file cannot be read as a roster.
 */

import {
  SENSOR_ROSTER,
  parseRoster,
  type Roster,
  type RosterSensor,
} from '@/lib/intake';

import type { Any } from './helpers/walk';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** The committed roster with MCD1 changed. */
function withMcd1(change: (sensor: Any) => void): Roster {
  const roster = clone(SENSOR_ROSTER);
  change(roster.sensors[1]);
  return roster;
}

function problems(value: unknown): string[] {
  const result = parseRoster(value);
  if (result.ok) throw new Error('the roster was accepted');
  return result.issues.map((issue) => `${issue.path} ${issue.code}`);
}

function accepted(value: unknown): void {
  const result = parseRoster(value);
  if (!result.ok) {
    throw new Error(
      result.issues.map((i) => `${i.path} ${i.message}`).join('; ')
    );
  }
}

/** A roster of the gate and `count` - 1 sensors: MCD1 and MCD2 are the primary ones. */
function roster(count: number): Roster {
  const base = SENSOR_ROSTER.sensors;
  const [gate, one, two, three] = base as [
    RosterSensor,
    RosterSensor,
    RosterSensor,
    RosterSensor,
  ];
  const sensors: RosterSensor[] = [clone(gate), clone(one), clone(two)];
  for (let i = 3; i < count; i += 1) {
    sensors.push({
      ...clone(three),
      mcd_id: `MCD${i}`,
      depends_on: [],
      state_codes: [`MCD${i}_UP`],
    });
  }
  return { ...clone(SENSOR_ROSTER), sensors: sensors.slice(0, count) };
}

describe('the limits of a roster hold at their value and not one more', () => {
  it('has 1 to 16 sensors', () => {
    accepted(roster(16));
    expect(
      roster(16)
        .sensors.map((s) => s.mcd_id)
        .at(-1)
    ).toBe('MCD15');
    const seventeen = roster(16);
    seventeen.sensors.push(clone(seventeen.sensors[15] as RosterSensor));
    expect(problems(seventeen)).toEqual(['sensors TOO_MANY']);
    // a roster of one sensor is too few for a primary sensor, but not too short to be a list
    const one = {
      ...clone(SENSOR_ROSTER),
      sensors: [clone(SENSOR_ROSTER.sensors[0])],
    };
    expect(problems(one)).not.toContain('sensors TOO_SHORT');
  });

  it('has a name of 80 characters at most', () => {
    accepted(withMcd1((s) => (s.name = 'x'.repeat(80))));
    expect(problems(withMcd1((s) => (s.name = 'x'.repeat(81))))).toEqual([
      'sensors[1].name TOO_LONG',
    ]);
    expect(problems(withMcd1((s) => (s.name = '')))).toEqual([
      'sensors[1].name TOO_SHORT',
    ]);
  });

  it('has at least one timeframe, and a list of 16 dependencies at most', () => {
    expect(problems(withMcd1((s) => (s.timeframes = [])))).toEqual([
      'sensors[1].timeframes TOO_SHORT',
    ]);
    accepted(withMcd1((s) => (s.timeframes = ['M5', 'M15'])));
    accepted(
      withMcd1((s) => (s.depends_on = Array.from({ length: 16 }, () => 'MCD2')))
    );
    expect(
      problems(
        withMcd1(
          (s) => (s.depends_on = Array.from({ length: 17 }, () => 'MCD2'))
        )
      )
    ).toEqual(['sensors[1].depends_on TOO_MANY']);
  });

  it('has a rung name of 60 characters at most', () => {
    accepted(withMcd1((s) => (s.rung.SCALPER = 'a'.repeat(60))));
    expect(
      problems(withMcd1((s) => (s.rung.SCALPER = 'a'.repeat(61))))
    ).toEqual(['sensors[1].rung.SCALPER TOO_LONG']);
  });

  it('has up to 32 owned terms of 40 characters, and up to 64 state codes of 48', () => {
    accepted(
      withMcd1(
        (s) => (s.owned_terms = Array.from({ length: 32 }, (_, i) => `T${i}`))
      )
    );
    expect(
      problems(
        withMcd1(
          (s) => (s.owned_terms = Array.from({ length: 33 }, (_, i) => `T${i}`))
        )
      )
    ).toEqual(['sensors[1].owned_terms TOO_MANY']);
    accepted(withMcd1((s) => (s.owned_terms = ['x'.repeat(40)])));
    expect(
      problems(withMcd1((s) => (s.owned_terms = ['x'.repeat(41)])))
    ).toEqual(['sensors[1].owned_terms[0] TOO_LONG']);

    const codes = (n: number) =>
      Array.from({ length: n }, (_, i) => `MCD1_S${i}`);
    accepted(withMcd1((s) => (s.state_codes = codes(64))));
    expect(problems(withMcd1((s) => (s.state_codes = codes(65))))).toEqual([
      'sensors[1].state_codes TOO_MANY',
    ]);
    accepted(withMcd1((s) => (s.state_codes = codes(1))));
    expect(problems(withMcd1((s) => (s.state_codes = [])))).toEqual([
      'sensors[1].state_codes TOO_SHORT',
    ]);
    accepted(withMcd1((s) => (s.state_codes = [`MCD1_${'A'.repeat(43)}`])));
    expect(
      problems(withMcd1((s) => (s.state_codes = [`MCD1_${'A'.repeat(44)}`])))
    ).toEqual(['sensors[1].state_codes[0] TOO_LONG']);
  });

  it('has a rules version of 40 characters at most', () => {
    const make = (version: string) => ({
      ...clone(SENSOR_ROSTER),
      synthesis: { flag: 'off', rules_version: version },
    });
    accepted(make('a'.repeat(40)));
    expect(problems(make('a'.repeat(41)))).toEqual([
      'synthesis.rules_version TOO_LONG',
    ]);
    expect(problems(make(''))).toEqual(['synthesis.rules_version TOO_SHORT']);
  });
});

describe('the patterns of a roster are anchored at both ends', () => {
  it('for an MCD id', () => {
    for (const id of ['xMCD1', 'MCD1x', 'MCD1 ', ' MCD1', 'MCD01']) {
      expect(problems(withMcd1((s) => (s.mcd_id = id)))).toContain(
        'sensors[1].mcd_id BAD_FORMAT'
      );
    }
  });

  it('for a state code', () => {
    for (const code of ['xMCD1_A', 'MCD1_A!', 'MCD1_a']) {
      expect(problems(withMcd1((s) => (s.state_codes = [code])))).toContain(
        'sensors[1].state_codes[0] BAD_FORMAT'
      );
    }
  });

  it('for a rules version', () => {
    for (const version of ['draft-1!', '!draft-1', 'Draft-1', '-draft']) {
      expect(
        problems({
          ...clone(SENSOR_ROSTER),
          synthesis: { flag: 'off', rules_version: version },
        })
      ).toEqual(['synthesis.rules_version BAD_FORMAT']);
    }
  });

  it('for a rung name', () => {
    for (const rung of ['!x', 'x!', ' x', 'x y']) {
      expect(problems(withMcd1((s) => (s.rung.SCALPER = rung)))).toContain(
        'sensors[1].rung.SCALPER BAD_FORMAT'
      );
    }
  });
});

describe('items of the wrong kind in a roster', () => {
  it('are reported at the item and never throw', () => {
    for (const bad of [5, null, 'x', [], true]) {
      const value = clone(SENSOR_ROSTER) as Any;
      value.sensors[1] = bad;
      expect(() => parseRoster(value)).not.toThrow();
      expect(problems(value)).toContain('sensors[1] WRONG_TYPE');
    }
    // the sensors around it are still looked at in order, and one that is not an object has no id
    const value = clone(SENSOR_ROSTER) as Any;
    value.sensors.splice(1, 0, 5);
    expect(problems(value)).toContain('sensors[1] WRONG_TYPE');
    expect(
      problems(value).filter((line) => line.endsWith('NOT_SORTED'))
    ).toEqual([]);
  });

  it('are not taken for a repeat of one another when there are two of them', () => {
    const value = clone(SENSOR_ROSTER) as Any;
    value.sensors.splice(1, 0, 5, 6);
    const found = problems(value);
    expect(found).toContain('sensors[1] WRONG_TYPE');
    expect(found).toContain('sensors[2] WRONG_TYPE');
    expect(found.filter((line) => line.endsWith('DUPLICATE'))).toEqual([]);
  });

  it('are reported once when they are values of a list that must be one of a few', () => {
    expect(problems(withMcd1((s) => (s.timeframes = ['H1', 'H1'])))).toEqual([
      'sensors[1].timeframes[0] NOT_ONE_OF',
      'sensors[1].timeframes[1] NOT_ONE_OF',
    ]);
    expect(problems(withMcd1((s) => (s.timeframes = ['M5', 'M5'])))).toEqual([
      'sensors[1].timeframes[1] DUPLICATE',
    ]);
    expect(
      problems(withMcd1((s) => (s.primary_for = ['DAY_TRADER', 'DAY_TRADER'])))
    ).toContain('sensors[1].primary_for[1] DUPLICATE');
  });

  it('refuse a primary_for of the right length that names the wrong trader type', () => {
    expect(problems(withMcd1((s) => (s.primary_for = ['SCALPER'])))).toEqual(
      expect.arrayContaining(['sensors[1].primary_for INCONSISTENT'])
    );
  });
});

describe('the committed roster file, when it is not a roster', () => {
  /** Load `lib/intake/roster.ts` with `file` standing in for config/intake/sensor-roster.json. */
  function loadWith(file: unknown): () => unknown {
    return () => {
      let loaded: unknown;
      jest.isolateModules(() => {
        jest.doMock('@/config/intake/sensor-roster.json', () => file);
        loaded = require('@/lib/intake/roster');
      });
      jest.dontMock('@/config/intake/sensor-roster.json');
      return loaded;
    };
  }

  const REBUILD = 'Rebuild it: python scripts/intake/build_roster.py';

  it('loads when it is the committed file', () => {
    expect(loadWith(clone(SENSOR_ROSTER))).not.toThrow();
  });

  it('stops the module with the first five problems and how to rebuild the file', () => {
    const broken = clone(SENSOR_ROSTER) as Any;
    broken.schema = 'sensor-roster/9';
    broken.synthesis = { flag: 'on', rules_version: 'Draft 1' };
    broken.sensors[0].kind = 'oracle';
    broken.sensors[1].flag = 'maybe';
    broken.sensors[2].name = '';
    const issues = (
      parseRoster(broken) as { issues: { path: string; message: string }[] }
    ).issues;
    expect(issues.length).toBeGreaterThan(5);
    const first5 = issues
      .slice(0, 5)
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join('; ');
    expect(loadWith(broken)).toThrow(
      `config/intake/sensor-roster.json is not a valid roster (${first5}). ${REBUILD}`
    );
    // and not the sixth
    const sixth = issues[5] as { path: string; message: string };
    let message = '';
    try {
      loadWith(broken)();
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toContain(`${sixth.path}: ${sixth.message}`);
  });

  it('names the root of a file that is not an object', () => {
    expect(loadWith(5)).toThrow(
      `config/intake/sensor-roster.json is not a valid roster ((root): must be an object). ${REBUILD}`
    );
  });
});

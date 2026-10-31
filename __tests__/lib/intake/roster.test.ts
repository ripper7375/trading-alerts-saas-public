/**
 * @jest-environment node
 */

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
import { join } from 'path';

import {
  PRIMARY_RUNG,
  SENSOR_ROSTER,
  TRADER_TYPES,
  boardSensors,
  parseRoster,
  primarySensor,
  primarySensors,
  sensorById,
  type Roster,
  type RosterSensor,
} from '@/lib/intake';

import { GOLDENS } from './helpers/packets';
import { describePython, REPO_ROOT, runPython } from './helpers/python';

const ENGINE = join(REPO_ROOT, 'davintrade-stack-d-and-e', 'engine-1-5-new');
const TOOL = join('scripts', 'intake', 'build_roster.py');
const ROSTER_FILE = join(REPO_ROOT, 'config', 'intake', 'sensor-roster.json');
const CODES_FILE = join(
  REPO_ROOT,
  'knowledge-service',
  'config',
  'registry-codes.json'
);

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** A sensor as a registry row would become, for a drafted roster. */
function fakeSensor(patch: Partial<RosterSensor> = {}): RosterSensor {
  return {
    mcd_id: 'MCD4',
    name: 'Test sensor',
    kind: 'independent',
    timeframes: ['M5'],
    depends_on: [],
    uses_channel: ['M5'],
    rung: { DAY_TRADER: 'oscillators', SCALPER: 'oscillators' },
    primary_for: [],
    on_board: true,
    flag: 'off',
    owned_terms: ['UOEDT'],
    state_codes: ['MCD4_ONE', 'MCD4_TWO'],
    ...patch,
  };
}

function withSensor(sensor: RosterSensor): Roster {
  const roster = clone(SENSOR_ROSTER);
  roster.sensors.push(sensor);
  return roster;
}

function problems(value: unknown): { path: string; code: string }[] {
  const result = parseRoster(value);
  if (result.ok) throw new Error('the roster was accepted');
  return result.issues.map((issue) => ({ path: issue.path, code: issue.code }));
}

describe('the committed roster', () => {
  it('has the four sensors the registries describe', () => {
    expect(SENSOR_ROSTER.schema).toBe('sensor-roster/1');
    expect(SENSOR_ROSTER.sensors.map((s) => s.mcd_id)).toEqual([
      'MCD0',
      'MCD1',
      'MCD2',
      'MCD3',
    ]);
    expect(SENSOR_ROSTER.sensors.map((s) => s.kind)).toEqual([
      'gate',
      'independent',
      'independent',
      'derived',
    ]);
    expect(SENSOR_ROSTER.sensors.map((s) => s.state_codes.length)).toEqual([
      4, 9, 9, 10,
    ]);
    expect(SENSOR_ROSTER.sensors.map((s) => s.timeframes)).toEqual([
      ['M5', 'M15'],
      ['M15'],
      ['M5'],
      ['M15', 'M5'],
    ]);
    // Stage B1 promoted every sensor and the synthesis to shadow
    expect(SENSOR_ROSTER.sensors.every((s) => s.flag === 'shadow')).toBe(true);
    expect(SENSOR_ROSTER.synthesis).toEqual({
      flag: 'shadow',
      rules_version: 'draft-1',
    });
  });

  it('keeps MCD0 off the board: it is a gate with no rung and no primary role', () => {
    const gate = sensorById('MCD0');
    expect(gate).toMatchObject({
      kind: 'gate',
      on_board: false,
      rung: {},
      primary_for: [],
      depends_on: [],
      owned_terms: [],
    });
    expect(boardSensors().map((s) => s.mcd_id)).toEqual([
      'MCD1',
      'MCD2',
      'MCD3',
    ]);
  });

  it('takes the primary sensor from the rung, not from a name', () => {
    expect(primarySensor('DAY_TRADER').mcd_id).toBe('MCD1');
    expect(primarySensor('SCALPER').mcd_id).toBe('MCD2');
    for (const traderType of TRADER_TYPES) {
      expect(primarySensors(traderType)).toHaveLength(1);
      expect(primarySensor(traderType).rung[traderType]).toBe(PRIMARY_RUNG);
    }
    expect(sensorById('MCD3')).toMatchObject({
      kind: 'derived',
      rung: { DAY_TRADER: 'oscillators', SCALPER: 'oscillators' },
      primary_for: [],
      depends_on: ['MCD1', 'MCD2'],
    });
    expect(sensorById('MCD1')?.rung).toEqual({
      DAY_TRADER: 'primary_structure',
      SCALPER: 'trendlines_channels',
    });
    expect(sensorById('MCD2')?.rung).toEqual({
      DAY_TRADER: 'trendlines_channels',
      SCALPER: 'primary_structure',
    });
  });

  it('lists the level names the channel sensors report', () => {
    for (const id of ['MCD1', 'MCD2', 'MCD3']) {
      expect(sensorById(id)?.owned_terms).toEqual([
        'UOEDT',
        'baseline',
        'LOEDT',
      ]);
    }
  });

  it('knows every state code the golden cycles report, and only real ones', () => {
    const known = new Map<string, Set<string>>();
    for (const sensor of SENSOR_ROSTER.sensors) {
      known.set(sensor.mcd_id, new Set(sensor.state_codes));
    }
    let seen = 0;
    for (const golden of GOLDENS) {
      for (const stored of golden.sensors) {
        const stateCode = (
          JSON.parse(stored.envelope_json) as { state_code: string | null }
        ).state_code;
        if (stateCode === null) continue;
        expect(known.get(stored.mcd_id)?.has(stateCode)).toBe(true);
        seen += 1;
      }
    }
    expect(seen).toBeGreaterThan(40);
  });

  it('answers undefined for a sensor it does not have', () => {
    expect(sensorById('MCD9')).toBeUndefined();
    expect(sensorById('')).toBeUndefined();
  });
});

describe('parseRoster', () => {
  it('accepts the committed file and a copy of it', () => {
    expect(parseRoster(clone(SENSOR_ROSTER)).ok).toBe(true);
  });

  it('refuses a missing key, one by one, with one report each', () => {
    for (const key of ['schema', 'synthesis', 'sensors']) {
      const roster = clone(SENSOR_ROSTER) as unknown as Record<string, unknown>;
      delete roster[key];
      expect(problems(roster)).toEqual([{ path: key, code: 'REQUIRED' }]);
    }
    const base = clone(SENSOR_ROSTER);
    const firstSensor = base.sensors[1] as unknown as Record<string, unknown>;
    for (const key of Object.keys(firstSensor)) {
      const roster = clone(SENSOR_ROSTER);
      delete (roster.sensors[1] as unknown as Record<string, unknown>)[key];
      const found = problems(roster);
      expect(
        found.some(
          (p) => p.path === `sensors[1].${key}` && p.code === 'REQUIRED'
        )
      ).toBe(true);
    }
  });

  it('refuses an unknown key and a wrong schema id', () => {
    const roster = clone(SENSOR_ROSTER) as unknown as Record<string, unknown>;
    roster['extra'] = 1;
    expect(problems(roster)).toEqual([{ path: 'extra', code: 'UNKNOWN_KEY' }]);
    expect(
      problems({ ...clone(SENSOR_ROSTER), schema: 'sensor-roster/2' })
    ).toEqual([{ path: 'schema', code: 'NOT_ONE_OF' }]);
  });

  it('refuses things that are not a roster', () => {
    for (const value of [
      null,
      undefined,
      [],
      'x',
      3,
      { schema: 'sensor-roster/1' },
    ]) {
      expect(parseRoster(value).ok).toBe(false);
    }
    expect(problems({ ...clone(SENSOR_ROSTER), sensors: [] })[0]).toMatchObject(
      {
        path: 'sensors',
        code: 'TOO_SHORT',
      }
    );
  });

  it('refuses sensors out of order, repeated, or with a bad id', () => {
    const swapped = clone(SENSOR_ROSTER);
    swapped.sensors.reverse();
    expect(problems(swapped).some((p) => p.code === 'NOT_SORTED')).toBe(true);
    const twice = clone(SENSOR_ROSTER);
    twice.sensors.push(clone(twice.sensors[3] as RosterSensor));
    expect(problems(twice).some((p) => p.code === 'DUPLICATE')).toBe(true);
    const bad = clone(SENSOR_ROSTER);
    (bad.sensors[2] as RosterSensor).mcd_id = 'MCD16';
    expect(
      problems(bad).some(
        (p) => p.path === 'sensors[2].mcd_id' && p.code === 'BAD_FORMAT'
      )
    ).toBe(true);
  });

  it('refuses a kind, flag, timeframe or rung that does not exist', () => {
    const roster = clone(SENSOR_ROSTER);
    const sensor = roster.sensors[1] as unknown as Record<string, unknown>;
    sensor['kind'] = 'oracle';
    sensor['flag'] = 'on';
    sensor['timeframes'] = ['H1'];
    expect(problems(roster).map((p) => p.path)).toEqual(
      expect.arrayContaining([
        'sensors[1].kind',
        'sensors[1].flag',
        'sensors[1].timeframes[0]',
      ])
    );
    const rung = clone(SENSOR_ROSTER);
    (rung.sensors[1] as RosterSensor).rung = {
      DAY_TRADER: 'a b',
      SCALPER: 'x',
    };
    expect(problems(rung)[0]).toMatchObject({
      path: 'sensors[1].rung.DAY_TRADER',
      code: 'BAD_FORMAT',
    });
  });

  it('refuses a gate with a rung and a sensor without one', () => {
    const gate = clone(SENSOR_ROSTER);
    (gate.sensors[0] as RosterSensor).rung = { DAY_TRADER: 'oscillators' };
    expect(problems(gate)).toContainEqual({
      path: 'sensors[0].rung',
      code: 'INCONSISTENT',
    });
    const voter = clone(SENSOR_ROSTER);
    delete (voter.sensors[3] as RosterSensor).rung.SCALPER;
    expect(problems(voter)).toContainEqual({
      path: 'sensors[3].rung.SCALPER',
      code: 'WRONG_TYPE',
    });
    const unknown = clone(SENSOR_ROSTER);
    (unknown.sensors[3] as RosterSensor).rung = {
      ...(unknown.sensors[3] as RosterSensor).rung,
      SWING: 'x',
    } as RosterSensor['rung'];
    expect(problems(unknown)).toContainEqual({
      path: 'sensors[3].rung.SWING',
      code: 'UNKNOWN_KEY',
    });
  });

  it('refuses a primary_for that is not what the rung says', () => {
    const roster = clone(SENSOR_ROSTER);
    (roster.sensors[1] as RosterSensor).primary_for = [];
    expect(problems(roster)).toEqual(
      expect.arrayContaining([
        { path: 'sensors[1].primary_for', code: 'INCONSISTENT' },
        { path: 'sensors', code: 'INCONSISTENT' },
      ])
    );
  });

  it('refuses a roster where a trader type has no primary sensor, or two', () => {
    const none = clone(SENSOR_ROSTER);
    (none.sensors[2] as RosterSensor).rung = {
      DAY_TRADER: 'trendlines_channels',
      SCALPER: 'trendlines_channels',
    };
    (none.sensors[2] as RosterSensor).primary_for = [];
    expect(problems(none)).toEqual([{ path: 'sensors', code: 'INCONSISTENT' }]);
    const two = withSensor(
      fakeSensor({
        rung: { DAY_TRADER: 'oscillators', SCALPER: PRIMARY_RUNG },
        primary_for: ['SCALPER'],
      })
    );
    expect(problems(two)).toEqual([{ path: 'sensors', code: 'INCONSISTENT' }]);
  });

  it('refuses on_board that disagrees with the kind', () => {
    const roster = clone(SENSOR_ROSTER);
    (roster.sensors[0] as RosterSensor).on_board = true;
    expect(problems(roster)).toContainEqual({
      path: 'sensors[0].on_board',
      code: 'INCONSISTENT',
    });
    const off = clone(SENSOR_ROSTER);
    (off.sensors[3] as RosterSensor).on_board = false;
    expect(problems(off)).toContainEqual({
      path: 'sensors[3].on_board',
      code: 'INCONSISTENT',
    });
    (off.sensors[3] as unknown as Record<string, unknown>)['on_board'] = 'yes';
    expect(problems(off)).toContainEqual({
      path: 'sensors[3].on_board',
      code: 'WRONG_TYPE',
    });
  });

  it('refuses state codes of another sensor, repeated, or in the wrong form', () => {
    const roster = clone(SENSOR_ROSTER);
    (roster.sensors[1] as RosterSensor).state_codes = [
      'MCD2_UP_IN_CORRIDOR',
      'MCD1_A',
      'MCD1_A',
      'mcd1_b',
    ];
    const found = problems(roster);
    expect(found).toContainEqual({
      path: 'sensors[1].state_codes[0]',
      code: 'INCONSISTENT',
    });
    expect(found).toContainEqual({
      path: 'sensors[1].state_codes[2]',
      code: 'DUPLICATE',
    });
    expect(found).toContainEqual({
      path: 'sensors[1].state_codes[3]',
      code: 'BAD_FORMAT',
    });
    const empty = clone(SENSOR_ROSTER);
    (empty.sensors[1] as RosterSensor).state_codes = [];
    expect(problems(empty)).toContainEqual({
      path: 'sensors[1].state_codes',
      code: 'TOO_SHORT',
    });
  });

  it('refuses a dependency on a sensor the roster does not have, or on itself', () => {
    const roster = clone(SENSOR_ROSTER);
    (roster.sensors[3] as RosterSensor).depends_on = ['MCD1', 'MCD9', 'MCD3'];
    const found = problems(roster);
    expect(found).toContainEqual({
      path: 'sensors[3].depends_on[1]',
      code: 'NOT_ONE_OF',
    });
    expect(found).toContainEqual({
      path: 'sensors[3].depends_on[2]',
      code: 'INCONSISTENT',
    });
  });

  it('refuses a synthesis block that is wrong', () => {
    expect(
      problems({
        ...clone(SENSOR_ROSTER),
        synthesis: { flag: 'on', rules_version: 'Draft 1' },
      })
    ).toEqual([
      { path: 'synthesis.flag', code: 'NOT_ONE_OF' },
      { path: 'synthesis.rules_version', code: 'BAD_FORMAT' },
    ]);
  });
});

describe('a registry row added later (a drafted MCD4)', () => {
  it('becomes a board line, and is not primary when its rung says otherwise', () => {
    const roster = withSensor(fakeSensor());
    expect(parseRoster(roster).ok).toBe(true);
    expect(boardSensors(roster).map((s) => s.mcd_id)).toEqual([
      'MCD1',
      'MCD2',
      'MCD3',
      'MCD4',
    ]);
    expect(primarySensor('DAY_TRADER', roster).mcd_id).toBe('MCD1');
    expect(primarySensor('SCALPER', roster).mcd_id).toBe('MCD2');
    expect(sensorById('MCD4', roster)?.state_codes).toEqual([
      'MCD4_ONE',
      'MCD4_TWO',
    ]);
  });

  it('is a primary-sensor candidate when its rung is primary_structure, and the roster is then refused until someone decides', () => {
    const roster = withSensor(
      fakeSensor({
        rung: { DAY_TRADER: 'oscillators', SCALPER: PRIMARY_RUNG },
        primary_for: ['SCALPER'],
      })
    );
    expect(primarySensors('SCALPER', roster).map((s) => s.mcd_id)).toEqual([
      'MCD2',
      'MCD4',
    ]);
    expect(parseRoster(roster).ok).toBe(false);
    expect(() => primarySensor('SCALPER', roster)).toThrow(
      /exactly one primary sensor/
    );
    // the other trader type is unaffected
    expect(primarySensors('DAY_TRADER', roster).map((s) => s.mcd_id)).toEqual([
      'MCD1',
    ]);
  });

  it('may be the only primary if the old one is demoted', () => {
    const roster = withSensor(
      fakeSensor({
        rung: { DAY_TRADER: 'oscillators', SCALPER: PRIMARY_RUNG },
        primary_for: ['SCALPER'],
      })
    );
    (roster.sensors[2] as RosterSensor).rung = {
      DAY_TRADER: 'trendlines_channels',
      SCALPER: 'trendlines_channels',
    };
    (roster.sensors[2] as RosterSensor).primary_for = [];
    expect(parseRoster(roster).ok).toBe(true);
    expect(primarySensor('SCALPER', roster).mcd_id).toBe('MCD4');
  });

  it('throws for a roster with no primary sensor at all', () => {
    const empty = clone(SENSOR_ROSTER);
    for (const sensor of empty.sensors) sensor.primary_for = [];
    expect(() => primarySensor('DAY_TRADER', empty)).toThrow(
      /exactly one primary sensor/
    );
  });
});

describePython('scripts/intake/build_roster.py', () => {
  /** A copy of the registries and the worker configuration, to change and build from. */
  function engineCopy(): { dir: string; out: (name: string) => string } {
    const dir = mkdtempSync(join(tmpdir(), 'roster-'));
    for (const name of readdirSync(ENGINE)) {
      if (!/^mcd\d+$/.test(name)) continue;
      mkdirSync(join(dir, name));
      copyFileSync(
        join(ENGINE, name, `${name}_registry.yaml`),
        join(dir, name, `${name}_registry.yaml`)
      );
    }
    mkdirSync(join(dir, 'mcd_worker'));
    copyFileSync(
      join(ENGINE, 'mcd_worker', 'worker_config.yaml'),
      join(dir, 'mcd_worker', 'worker_config.yaml')
    );
    return { dir, out: (name) => join(dir, name) };
  }

  const FAKE_REGISTRY = (extra = '', rung = 'oscillators'): string =>
    [
      'mcd_id: MCD4',
      'name: Test sensor',
      'kind: independent',
      'timeframes: [M5]',
      'depends_on: []',
      'uses_channel: [M5]',
      'rung:',
      `  DAY_TRADER: ${rung}`,
      `  SCALPER: ${rung}`,
      "flag: 'off'",
      'states:',
      '  - code: MCD4_ONE',
      '    levels: [UOEDT, Extra]',
      '  - code: MCD4_TWO',
      '    levels: []',
      extra,
      '',
    ].join('\n');

  function addFake(dir: string, registry: string, withFlag = true): void {
    mkdirSync(join(dir, 'mcd4'));
    writeFileSync(join(dir, 'mcd4', 'mcd4_registry.yaml'), registry);
    if (withFlag) {
      const config = join(dir, 'mcd_worker', 'worker_config.yaml');
      writeFileSync(
        config,
        readFileSync(config, 'utf8').replace(
          /^ {2}SYN: .*$/m,
          (line) => `  MCD4: 'off'\n${line}`
        )
      );
    }
  }

  function build(dir: string, ...extra: string[]) {
    return runPython([
      TOOL,
      '--engine-dir',
      dir,
      '--roster',
      join(dir, 'roster.json'),
      '--codes',
      join(dir, 'codes.json'),
      ...extra,
    ]);
  }

  const cleanup = (dir: string): void =>
    rmSync(dir, { recursive: true, force: true });

  it('says the committed files equal a rebuild from the registries', () => {
    const run = runPython([TOOL, '--check']);
    expect(run.stderr).toBe('');
    expect(run.stdout).toMatch(/equal \(4 sensors, 32 state codes\)/);
    expect(run.status).toBe(0);
  });

  it('writes exactly what the TypeScript reads, and the codes file the knowledge service reads', () => {
    const { dir } = engineCopy();
    try {
      const run = build(dir);
      expect(run.status).toBe(0);
      const roster = JSON.parse(
        readFileSync(join(dir, 'roster.json'), 'utf8')
      ) as unknown;
      expect(roster).toEqual(JSON.parse(readFileSync(ROSTER_FILE, 'utf8')));
      expect(roster).toEqual(SENSOR_ROSTER);
      const codes = JSON.parse(
        readFileSync(join(dir, 'codes.json'), 'utf8')
      ) as Record<string, unknown>;
      expect(codes).toEqual(JSON.parse(readFileSync(CODES_FILE, 'utf8')));
      expect(codes).toEqual({
        schema: 'registry-codes/1',
        mcd_ids: SENSOR_ROSTER.sensors.map((s) => s.mcd_id),
        board_mcd_ids: boardSensors().map((s) => s.mcd_id),
        state_codes: Object.fromEntries(
          SENSOR_ROSTER.sensors.map((s) => [s.mcd_id, s.state_codes])
        ),
        timeframes: ['M5', 'M15'],
      });
      // LF endings and a final newline, whatever the platform
      const bytes = readFileSync(join(dir, 'roster.json'));
      expect(bytes.includes(Buffer.from('\r\n'))).toBe(false);
      expect(bytes[bytes.length - 1]).toBe(10);
    } finally {
      cleanup(dir);
    }
  });

  it('exits 1 on --check when the file differs or is missing, and 0 after it is written', () => {
    const { dir } = engineCopy();
    try {
      expect(build(dir, '--check').status).toBe(1); // nothing written yet
      expect(build(dir).status).toBe(0);
      expect(build(dir, '--check').status).toBe(0);
      const roster = JSON.parse(
        readFileSync(join(dir, 'roster.json'), 'utf8')
      ) as RosterShape;
      roster.sensors[1]!.name = 'Changed';
      writeFileSync(join(dir, 'roster.json'), JSON.stringify(roster));
      const run = build(dir, '--check');
      expect(run.status).toBe(1);
      expect(run.stdout).toContain('differs from a rebuild');
      // a formatting change alone is not a difference
      writeFileSync(
        join(dir, 'roster.json'),
        JSON.stringify(JSON.parse(readFileSync(ROSTER_FILE, 'utf8')))
      );
      expect(build(dir, '--check').status).toBe(0);
    } finally {
      cleanup(dir);
    }
  });

  it('adds a sensor when a registry file and its flag are added', () => {
    const { dir } = engineCopy();
    try {
      addFake(dir, FAKE_REGISTRY());
      const run = build(dir);
      expect(run.stderr).toBe('');
      expect(run.status).toBe(0);
      const roster = JSON.parse(
        readFileSync(join(dir, 'roster.json'), 'utf8')
      ) as Roster;
      expect(parseRoster(roster).ok).toBe(true);
      expect(boardSensors(roster).map((s) => s.mcd_id)).toEqual([
        'MCD1',
        'MCD2',
        'MCD3',
        'MCD4',
      ]);
      expect(sensorById('MCD4', roster)).toMatchObject({
        on_board: true,
        primary_for: [],
        owned_terms: ['UOEDT', 'Extra'],
        state_codes: ['MCD4_ONE', 'MCD4_TWO'],
      });
      const codes = JSON.parse(
        readFileSync(join(dir, 'codes.json'), 'utf8')
      ) as { mcd_ids: string[] };
      expect(codes.mcd_ids).toEqual(['MCD0', 'MCD1', 'MCD2', 'MCD3', 'MCD4']);
    } finally {
      cleanup(dir);
    }
  });

  it('refuses to write when two sensors claim to be the primary one', () => {
    const { dir } = engineCopy();
    try {
      addFake(dir, FAKE_REGISTRY('', 'primary_structure'));
      const run = build(dir);
      expect(run.status).toBe(2);
      expect(run.stderr).toMatch(/exactly one primary sensor/);
      expect(() => readFileSync(join(dir, 'roster.json'))).toThrow();
    } finally {
      cleanup(dir);
    }
  });

  it.each([
    [
      'a registry with no flag in the worker configuration',
      'no flag for MCD4',
      () => [FAKE_REGISTRY(), false] as const,
    ],
    [
      'a registry flag that differs from the worker configuration',
      'differs from worker_config.yaml',
      () =>
        [
          FAKE_REGISTRY().replace("flag: 'off'", "flag: 'shadow'"),
          true,
        ] as const,
    ],
    [
      'a flag written without quotes (YAML reads it as false)',
      'quote it',
      () =>
        [FAKE_REGISTRY().replace("flag: 'off'", 'flag: off'), true] as const,
    ],
    [
      'a state code of another sensor',
      'does not start with MCD4_',
      () => [FAKE_REGISTRY().replace('MCD4_TWO', 'MCD3_TWO'), true] as const,
    ],
    [
      'a state code written twice',
      'appears twice',
      () => [FAKE_REGISTRY().replace('MCD4_TWO', 'MCD4_ONE'), true] as const,
    ],
    [
      'a sensor with a rung for one trader type only',
      'rung needs exactly',
      () =>
        [
          FAKE_REGISTRY().replace('  SCALPER: oscillators\n', ''),
          true,
        ] as const,
    ],
    [
      'a timeframe that does not exist',
      'timeframes must be',
      () => [FAKE_REGISTRY().replace('[M5]', '[H1]'), true] as const,
    ],
    [
      'a dependency with no registry',
      'depends on MCD9',
      () =>
        [
          FAKE_REGISTRY().replace('depends_on: []', 'depends_on: [MCD9]'),
          true,
        ] as const,
    ],
    [
      'a kind that does not exist',
      'kind must be one of',
      () =>
        [
          FAKE_REGISTRY().replace('kind: independent', 'kind: oracle'),
          true,
        ] as const,
    ],
  ])('exits 2 and writes nothing for %s', (_name, message, make) => {
    const { dir } = engineCopy();
    try {
      const [registry, withFlag] = make();
      addFake(dir, registry, withFlag);
      const run = build(dir);
      expect(run.status).toBe(2);
      expect(run.stderr).toContain(message);
      expect(() => readFileSync(join(dir, 'roster.json'))).toThrow();
      expect(() => readFileSync(join(dir, 'codes.json'))).toThrow();
    } finally {
      cleanup(dir);
    }
  });

  it('exits 2 for a worker flag with no registry file, a gate with a rung, and a folder with the wrong number', () => {
    const { dir } = engineCopy();
    try {
      const config = join(dir, 'mcd_worker', 'worker_config.yaml');
      writeFileSync(
        config,
        readFileSync(config, 'utf8').replace(
          /^ {2}SYN: .*$/m,
          (line) => `  MCD7: 'off'\n${line}`
        )
      );
      const run = build(dir);
      expect(run.status).toBe(2);
      expect(run.stderr).toContain('MCD7, which has no registry file');
    } finally {
      cleanup(dir);
    }
    const second = engineCopy();
    try {
      const file = join(second.dir, 'mcd0', 'mcd0_registry.yaml');
      writeFileSync(
        file,
        readFileSync(file, 'utf8').replace(
          'rung: {}',
          'rung: {DAY_TRADER: x, SCALPER: y}'
        )
      );
      const run = build(second.dir);
      expect(run.status).toBe(2);
      expect(run.stderr).toContain('a gate has no rung');
    } finally {
      cleanup(second.dir);
    }
    const third = engineCopy();
    try {
      const file = join(third.dir, 'mcd2', 'mcd2_registry.yaml');
      writeFileSync(
        file,
        readFileSync(file, 'utf8').replace('mcd_id: MCD2', 'mcd_id: MCD3')
      );
      const run = build(third.dir);
      expect(run.status).toBe(2);
      expect(run.stderr).toContain('does not match the folder');
    } finally {
      cleanup(third.dir);
    }
  });

  it('exits 2 with no registry at all', () => {
    const dir = mkdtempSync(join(tmpdir(), 'roster-'));
    try {
      mkdirSync(join(dir, 'mcd_worker'));
      copyFileSync(
        join(ENGINE, 'mcd_worker', 'worker_config.yaml'),
        join(dir, 'mcd_worker', 'worker_config.yaml')
      );
      const run = build(dir);
      expect(run.status).toBe(2);
      expect(run.stderr).toContain('no registry file');
    } finally {
      cleanup(dir);
    }
  });
});

interface RosterShape {
  sensors: { name: string }[];
}

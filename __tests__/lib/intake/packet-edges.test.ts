/**
 * @jest-environment node
 */

/**
 * The edges of `validatePacket`, found by the mutation check of build step 6 part 1: a pattern
 * that is anchored at both ends, a limit that holds at exactly its value and not one more,
 * a list with an item of the wrong kind, and a single fault that is reported once and does not
 * start a cascade of second reports.
 */

import {
  SENSOR_ROSTER,
  validatePacket,
  type IntakePacket,
  type Roster,
} from '@/lib/intake';

import { clone, packetFromGolden } from './helpers/packets';
import {
  BASE,
  broken,
  expectAccepted,
  expectRefused,
  golden,
  issuesOf,
  summary,
  variant,
} from './helpers/validate';
import { at, setAt, retrace, type Any } from './helpers/walk';

const REPORT_2 = packetFromGolden(golden('01'), { intent: 'REPORT_2' });
const NO_ZONES = packetFromGolden(golden('02'));
const STALE = packetFromGolden(golden('14'), { traderType: 'DAY_TRADER' });

const without = (value: unknown, path: string, code: string): boolean =>
  !issuesOf(value).some((i) => i.path === path && i.code === code);

// ---------------------------------------------------------------------------------------

describe('every pattern is anchored at both ends', () => {
  interface Field {
    name: string;
    base: IntakePacket;
    path: string;
    setup?: (packet: Any) => void;
  }

  const FIELDS: Field[] = [
    { name: 'cycle slot', base: REPORT_2, path: 'data.cycle_slot' },
    { name: 'bar of the last price', base: BASE, path: 'data.last_price.bar' },
    {
      name: 'hash of an envelope',
      base: BASE,
      path: 'readings.sensors[0].envelope_sha256',
    },
    {
      name: 'hash of the SYN reading',
      base: BASE,
      path: 'readings.synthesis.reading_sha256',
    },
    {
      name: 'hash of the zones',
      base: BASE,
      path: 'readings.synthesis.zones_sha256',
    },
    {
      name: 'reason for no zones',
      base: NO_ZONES,
      path: 'readings.synthesis.zones_reason',
    },
    {
      name: 'flag of the understanding step',
      base: BASE,
      path: 'question.flags[0]',
      setup: (p) => (p.question.flags = ['TERM_DROPPED']),
    },
    {
      name: 'reason on the board',
      base: BASE,
      path: 'board.sensors[0].reasons[0]',
    },
    {
      name: 'state code on the board',
      base: BASE,
      path: 'board.sensors[0].state_code',
    },
    { name: 'rule of the SYN line', base: BASE, path: 'board.syn.rule_id' },
    { name: 'time of an event', base: BASE, path: 'events.items[0].time' },
    {
      name: 'currency of an event',
      base: BASE,
      path: 'events.items[0].currency',
    },
    {
      name: 'importance of an event',
      base: BASE,
      path: 'events.items[0].importance',
    },
    {
      name: 'id of a zone',
      base: BASE,
      path: 'readings.synthesis.zones[0].zone_id',
    },
    { name: 'id of a chunk', base: BASE, path: 'knowledge.chunks[0].id' },
    {
      name: 'version of a chunk',
      base: BASE,
      path: 'knowledge.chunks[0].version',
    },
    {
      name: 'state code of a chunk',
      base: BASE,
      path: 'knowledge.chunks[0].state_codes[0]',
    },
    {
      name: 'build of the index',
      base: BASE,
      path: 'knowledge.index_build_id',
    },
    {
      name: 'thread',
      base: BASE,
      path: 'thread_id',
      setup: (p) => (p.thread_id = 'abc_DEF-123'),
    },
    {
      name: 'risk figure of the profile',
      base: BASE,
      path: 'profile.max_risk_pct',
    },
  ];

  it.each(FIELDS)(
    '$name ($path): garbage before or after the valid text is refused as a bad format',
    ({ base, path, setup }) => {
      const start = variant((p) => setup?.(p), base);
      expectAccepted(start);
      const valid = at(start, path) as string;
      expect(typeof valid).toBe('string');
      for (const garbage of [`!${valid}`, `${valid}!`]) {
        const packet = variant((p) => {
          setup?.(p);
          setAt(p, path, garbage);
        }, base);
        expectRefused(packet, [path, 'BAD_FORMAT']);
      }
    }
  );
});

// ---------------------------------------------------------------------------------------

describe('every limit holds at its value and not one more', () => {
  /** `apply(packet, n)` puts a value of size n in the packet; n = max must pass, max + 1 must not. */
  function edge(
    name: string,
    base: IntakePacket,
    apply: (packet: Any, size: number) => void,
    max: number,
    code: 'TOO_LONG' | 'TOO_MANY'
  ): void {
    it(name, () => {
      expectAccepted(variant((p) => apply(p, max), base));
      const issues = issuesOf(variant((p) => apply(p, max + 1), base));
      expect(issues.some((issue) => issue.code === code)).toBe(true);
      // one below is no problem either
      expectAccepted(variant((p) => apply(p, max - 1), base));
    });
  }

  edge(
    'the summary of the SYN line is 120 characters at most',
    BASE,
    (p, n) => (p.board.syn.summary = 'x'.repeat(n)),
    120,
    'TOO_LONG'
  );
  edge(
    'the rule id of the SYN line is 60 characters at most',
    BASE,
    (p, n) => {
      const rule = `R1_${'A'.repeat(n - 3)}`;
      p.board.syn.rule_id = rule;
      p.readings.synthesis.reading.rule_id = rule;
    },
    60,
    'TOO_LONG'
  );
  edge(
    'the summary of an available sensor is 80 characters at most',
    BASE,
    (p, n) => {
      p.board.sensors[0].summary = 'x'.repeat(n);
      p.readings.sensors[0].envelope.summary_line = 'x'.repeat(n);
    },
    80,
    'TOO_LONG'
  );
  edge(
    'the summary of an unavailable sensor is 80 characters at most',
    STALE,
    (p, n) => {
      p.board.sensors[0].summary = 'x'.repeat(n);
      p.readings.sensors[0].envelope.summary_line = 'x'.repeat(n);
    },
    80,
    'TOO_LONG'
  );
  edge(
    'a reason on the board is 60 characters at most',
    BASE,
    (p, n) => (p.board.sensors[0].reasons = ['A'.repeat(n)]),
    60,
    'TOO_LONG'
  );
  edge(
    'a figure of the profile is 20 characters at most',
    BASE,
    (p, n) => (p.profile.max_risk_pct = `1.${'5'.repeat(n - 2)}`),
    20,
    'TOO_LONG'
  );
  edge(
    'the name of an event is 120 characters at most',
    BASE,
    (p, n) => (p.events.items[0].name = 'x'.repeat(n)),
    120,
    'TOO_LONG'
  );
  edge(
    'a state code of a chunk is 48 characters at most',
    BASE,
    (p, n) =>
      (p.knowledge.chunks[0].state_codes = [`MCD1_${'A'.repeat(n - 5)}`]),
    48,
    'TOO_LONG'
  );

  edge(
    'a question has 8 flags at most',
    BASE,
    (p, n) => (p.question.flags = Array.from({ length: n }, (_, i) => `F${i}`)),
    8,
    'TOO_MANY'
  );
  edge(
    'a sensor on the board has 12 reasons at most',
    BASE,
    (p, n) =>
      (p.board.sensors[0].reasons = Array.from(
        { length: n },
        (_, i) => `R${i}`
      )),
    12,
    'TOO_MANY'
  );
  edge(
    'a chunk has 16 state codes at most',
    BASE,
    (p, n) =>
      (p.knowledge.chunks[0].state_codes = Array.from(
        { length: n },
        (_, i) => `MCD1_S${i}`
      )),
    16,
    'TOO_MANY'
  );
  edge(
    'a reading has 5 zones at most',
    BASE,
    (p, n) => {
      const slot = p.data.cycle_slot as string;
      const ids = Array.from({ length: n }, (_, i) => `Z${(i % 5) + 1}`);
      p.readings.synthesis.zones = ids.map((zone_id) => ({
        zone_id,
        cycle_slot: slot,
        profile: 'DAY_TRADER',
      }));
      p.readings.synthesis.reading.zones = ids;
    },
    5,
    'TOO_MANY'
  );

  it('a state code on the board is 48 characters at most, if the roster has it', () => {
    const roster = clone(SENSOR_ROSTER);
    const long48 = `MCD1_${'A'.repeat(43)}`;
    const long49 = `${long48}A`;
    roster.sensors[1]?.state_codes.push(long48, long49);
    const make = (code: string) =>
      variant((p) => {
        p.board.sensors[0].state_code = code;
        p.readings.sensors[0].envelope.state_code = code;
      });
    expectAccepted(make(long48), roster);
    expect(
      issuesOf(make(long49), roster).some((i) => i.code === 'TOO_LONG')
    ).toBe(true);
  });

  describe('the board of 15 sensors, the most there can be', () => {
    /** A roster of the gate and sensors MCD1 to MCD15, and a packet with all of them, in full. */
    function fifteen(count = 15): { roster: Roster; packet: Any } {
      const roster = clone(SENSOR_ROSTER);
      const template = SENSOR_ROSTER.sensors[1];
      if (template === undefined) throw new Error('no template sensor');
      roster.sensors = [
        clone(SENSOR_ROSTER.sensors[0]!),
        ...Array.from({ length: 15 }, (_, i) => ({
          ...clone(template),
          mcd_id: `MCD${i + 1}`,
          state_codes: [`MCD${i + 1}_UP`],
          primary_for: [],
        })),
      ];
      const ids = Array.from(
        { length: count },
        (_, i) => `MCD${Math.min(i + 1, 15)}`
      );
      const packet = variant((p) => {
        p.board.sensors = ids.map((id) => ({
          mcd_id: id,
          status: 'VALID',
          state_code: `${id}_UP`,
          bias: 'LONG',
          summary: 'Up',
          reasons: [],
        }));
        p.readings.m_star = ids;
        p.readings.sensors = ids.map((id) => ({
          mcd_id: id,
          envelope_sha256: 'a'.repeat(64),
          envelope: {
            schema_version: 'mcd-output/1',
            mcd_id: id,
            cycle_slot: p.data.cycle_slot,
            status: 'VALID',
            state_code: `${id}_UP`,
            bias: 'LONG',
            summary_line: 'Up',
          },
        }));
      });
      return { roster, packet };
    }

    it('is valid with all 15 sensors on the board and in full', () => {
      const { roster, packet } = fifteen();
      expect(packet.board.sensors).toHaveLength(15);
      expectAccepted(packet, roster);
    });

    it('is refused with a 16th line, in the board, in M* and in the readings', () => {
      const { roster, packet } = fifteen(16);
      expect(packet.board.sensors).toHaveLength(16);
      const found = issuesOf(packet, roster).map((i) => `${i.path} ${i.code}`);
      expect(found).toEqual(
        expect.arrayContaining([
          'board.sensors TOO_MANY',
          'readings.m_star TOO_MANY',
          'readings.sensors TOO_MANY',
        ])
      );
    });
  });
});

// ---------------------------------------------------------------------------------------

describe('a list whose item is not the right kind', () => {
  const LISTS = [
    'question.flags',
    'board.sensors',
    'board.sensors[0].reasons',
    'readings.m_star',
    'readings.sensors',
    'readings.synthesis.zones',
    'knowledge.chunks',
    'knowledge.chunks[0].state_codes',
    'knowledge.expansions',
    'events.items',
    'data.flags',
  ];

  it.each(LISTS)('%s: it is reported at the item and never throws', (path) => {
    for (const bad of [5, null, 'x', [], true]) {
      const packet = clone(BASE) as Any;
      const list = at(packet, path) as unknown[];
      if (list.length === 0) list.push(bad);
      else list[0] = bad;
      let result: ReturnType<typeof validatePacket> | undefined;
      expect(() => {
        result = validatePacket(packet);
      }).not.toThrow();
      expect(result?.ok).toBe(false);
      if (result !== undefined && !result.ok) {
        expect(result.issues.some((issue) => issue.path === `${path}[0]`)).toBe(
          true
        );
      }
    }
  });

  it('is reported at the item when the item of a reading is not an object, or its envelope is not', () => {
    expectRefused(
      broken((p) => (p.readings.sensors[0].mcd_id = 5)),
      ['readings.sensors[0].mcd_id', 'WRONG_TYPE']
    );
    // a reading without a usable id still has its envelope looked at
    const noId = broken((p) => {
      p.readings.sensors[0].mcd_id = 5;
      p.readings.sensors[0].envelope = 'not an envelope';
    });
    expectRefused(noId, ['readings.sensors[0].envelope', 'WRONG_TYPE']);
  });
});

// ---------------------------------------------------------------------------------------

describe('one fault is reported once', () => {
  const only = (value: unknown): string[] => summary(value);

  it('says a source that is not one of the two once', () => {
    expect(only(variant((p) => (p.question.source = 'VOICE')))).toEqual([
      'question.source NOT_ONE_OF',
    ]);
  });

  it('says a SYN state that is not one of the two once', () => {
    expect(only(variant((p) => (p.board.syn.state = 'PAUSED')))).toEqual([
      'board.syn.state NOT_ONE_OF',
    ]);
  });

  it('says a board status that does not exist once, and does not blame the other fields of that line', () => {
    expect(only(variant((p) => (p.board.sensors[0].status = 'BAD')))).toEqual([
      'board.sensors[0].status NOT_ONE_OF',
    ]);
  });

  it('says a scope that does not exist once, and does not compare it with the intent', () => {
    expect(only(variant((p) => (p.events.scope = 'TODAY')))).toEqual([
      'events.scope NOT_ONE_OF',
    ]);
    expect(
      only(
        variant(
          (p) => (p.events.scope = 'TODAY'),
          packetFromGolden(golden('04'), { intent: 'NEWS' })
        )
      )
    ).toEqual(['events.scope NOT_ONE_OF']);
  });

  it('says a version that is not a version once, and compares nothing else of the trace', () => {
    expect(
      only(broken((p) => (p.trace.intake_version = 'bad version')))
    ).toEqual(['trace.intake_version BAD_FORMAT']);
    expect(
      only(broken((p) => (p.trace.routing_version = 'bad version')))
    ).toEqual(['trace.routing_version BAD_FORMAT']);
    expect(
      only(
        broken(
          (p) => ((p.trace.language = 'th'), (p.trace.routing_version = ''))
        )
      )
    ).toEqual(['trace.routing_version TOO_SHORT']);
  });

  it('says a knowledge status that does not exist once, whatever chunks come with it', () => {
    expect(only(variant((p) => (p.knowledge.status = 'PARTIAL')))).toEqual([
      'knowledge.status NOT_ONE_OF',
    ]);
  });

  it('says an intent that does not exist once, and does not ask for a knowledge pack because of it', () => {
    const noIntent = broken((p) => {
      p.intent = 'BUY';
      p.knowledge = null;
    });
    expect(without(noIntent, 'knowledge', 'REQUIRED')).toBe(true);
    expect(only(noIntent)).toEqual(['intent NOT_ONE_OF']);
  });

  it('does not call two equally bad items a repeat', () => {
    const items: [string, Any][] = [
      ['data.flags[1]', variant((p) => (p.data.flags = ['bad', 'bad']))],
      [
        'question.flags[1]',
        variant((p) => (p.question.flags = ['bad', 'bad'])),
      ],
      [
        'readings.m_star[1]',
        variant((p) => (p.readings.m_star = ['bad', 'bad'])),
      ],
      [
        'knowledge.chunks[1]',
        variant(
          (p) =>
            (p.knowledge.chunks[0].id = p.knowledge.chunks[1].id = 'bad id')
        ),
      ],
      [
        'readings.synthesis.zones[1]',
        variant(
          (p) =>
            (p.readings.synthesis.zones[0].zone_id =
              p.readings.synthesis.zones[1].zone_id =
                'bad')
        ),
      ],
      [
        'board.sensors[1]',
        variant(
          (p) => (p.board.sensors[0].mcd_id = p.board.sensors[1].mcd_id = 'bad')
        ),
      ],
    ];
    for (const [path, packet] of items) {
      const found = issuesOf(packet);
      expect({
        path,
        repeat: found.some((i) => i.path === path && i.code === 'DUPLICATE'),
      }).toEqual({ path, repeat: false });
      expect(found.length).toBeGreaterThan(0);
    }
  });

  it('keeps a time that is not a time out of the ordering of the events', () => {
    const item = (time: string) => ({
      event_id: 'E',
      name: 'N',
      time,
      currency: 'USD',
      importance: 'HIGH',
      approximate: false,
      tier1: false,
    });
    const packet = variant(
      (p) =>
        (p.events.items = [
          item('2026-09-18T22:00:00Z'),
          item('bad'),
          item('2026-09-18T21:00:00Z'),
        ])
    );
    expect(summary(packet)).toEqual([
      'events.items[1].time BAD_FORMAT',
      'events.items[2].time NOT_SORTED',
    ]);
  });

  it('does not blame the envelope of a reading whose id cannot be used', () => {
    const noId = broken((p) => (p.readings.sensors[0].mcd_id = 5));
    expect(
      without(noId, 'readings.sensors[0].envelope.mcd_id', 'INCONSISTENT')
    ).toBe(true);
    expect(without(noId, 'readings.sensors[0].envelope', 'WRONG_TYPE')).toBe(
      true
    );
    expect(
      without(noId, 'readings.sensors[0].envelope.status', 'INCONSISTENT')
    ).toBe(true);
  });

  it('says a list that is not a list once, and adds no rule between fields to it', () => {
    expect(summary(variant((p) => (p.readings.sensors = 5), REPORT_2))).toEqual(
      ['readings.sensors WRONG_TYPE']
    );
    const knowledge = (status: string, change: (k: Any) => void) =>
      variant((p) => {
        p.knowledge = {
          status,
          index_build_id: status === 'UNAVAILABLE' ? null : 'build-1',
          chunks: [],
          expansions: [],
        };
        change(p.knowledge);
      });
    const chunk = clone(BASE.knowledge?.chunks[0]);
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ ...clone(chunk), id: `C${i}` }));
    expect(summary(knowledge('EMPTY', (k) => (k.chunks = many(5))))).toEqual([
      'knowledge.chunks TOO_MANY',
    ]);
    expect(
      summary(knowledge('UNAVAILABLE', (k) => (k.expansions = many(9))))
    ).toEqual(['knowledge.expansions TOO_MANY']);
    const unavailable = variant((p) => {
      const item = {
        event_id: 'E',
        name: 'N',
        time: '2026-09-18T22:00:00Z',
        currency: 'USD',
        importance: 'HIGH',
        approximate: false,
        tier1: false,
      };
      p.events = {
        status: 'UNAVAILABLE',
        calendar_age_seconds: null,
        scope: 'NEXT_24H_HIGH',
        items: Array.from({ length: 51 }, () => item),
      };
    });
    expect(summary(unavailable)).toEqual(['events.items TOO_MANY']);
  });

  it('refuses a trace value that is not JSON, instead of calling it equal', () => {
    for (const bad of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      () => 'en',
      Symbol('en'),
      10n,
    ]) {
      const packet = broken((p) => (p.trace.language = bad));
      expectRefused(packet, ['trace.language', 'INCONSISTENT']);
    }
    expectRefused(
      broken((p) => (p.trace.m_star = ['MCD1', Number.NaN])),
      ['trace.m_star', 'INCONSISTENT']
    );
  });

  it('lets an absent sensor have no reasons', () => {
    expectAccepted(
      variant((p) => {
        p.board.sensors[2] = {
          mcd_id: 'MCD3',
          status: 'ABSENT',
          state_code: null,
          bias: null,
          summary: null,
          reasons: [],
        };
        p.readings.m_star = ['MCD1', 'MCD2'];
        p.readings.sensors.pop();
      })
    );
  });
});

// ---------------------------------------------------------------------------------------

describe('what a reading needs the packet to say', () => {
  it('has no readings at all for Report 2, even one reading with nothing in M*', () => {
    const one = variant(
      (p) => (p.readings.sensors = [clone(BASE.readings.sensors[0])]),
      REPORT_2
    );
    expectRefused(one, ['readings', 'INCONSISTENT']);
    const star = variant((p) => (p.readings.m_star = ['MCD1']), REPORT_2);
    expectRefused(star, ['readings', 'INCONSISTENT']);
    const syn = variant(
      (p) => (p.readings.synthesis = clone(BASE.readings.synthesis)),
      REPORT_2
    );
    expectRefused(syn, ['readings', 'INCONSISTENT']);
  });

  it('needs a cycle for each kind of reading on its own', () => {
    const noSlot = (change: (p: Any) => void): Any =>
      variant((p) => {
        p.data.cycle_slot = null;
        change(p);
      });
    // only M* and its envelopes, no SYN reading
    expectRefused(
      noSlot((p) => {
        p.readings.m_star = ['MCD1'];
        p.readings.sensors = [p.readings.sensors[0]];
        p.readings.synthesis = null;
      }),
      ['readings', 'INCONSISTENT']
    );
    // only the SYN reading, nothing in M*
    expectRefused(
      noSlot((p) => {
        p.readings.m_star = [];
        p.readings.sensors = [];
      }),
      ['readings', 'INCONSISTENT']
    );
    // nothing at all is fine
    expectAccepted(
      noSlot((p) => {
        p.readings.m_star = [];
        p.readings.sensors = [];
        p.readings.synthesis = null;
      })
    );
  });

  it('lists nothing from a calendar that could not be read, not even one event', () => {
    const one = variant((p) => {
      p.events = {
        status: 'UNAVAILABLE',
        calendar_age_seconds: null,
        scope: 'NEXT_24H_HIGH',
        items: [
          {
            event_id: 'E',
            name: 'N',
            time: '2026-09-18T22:00:00Z',
            currency: 'USD',
            importance: 'HIGH',
            approximate: false,
            tier1: false,
          },
        ],
      };
    });
    expectRefused(one, ['events.items', 'INCONSISTENT']);
  });

  it('gives no chunk and no expansion when the index could not be asked, not even one', () => {
    const chunk = clone(BASE.knowledge?.chunks[0]);
    const expansion = variant((p) => {
      p.knowledge = {
        status: 'UNAVAILABLE',
        index_build_id: null,
        chunks: [],
        expansions: [chunk],
      };
    });
    expectRefused(expansion, ['knowledge', 'INCONSISTENT']);
    const empty = variant((p) => {
      p.knowledge = {
        status: 'EMPTY',
        index_build_id: 'build-1',
        chunks: [],
        expansions: [chunk],
      };
    });
    expectRefused(empty, ['knowledge', 'INCONSISTENT']);
    const chunks = variant((p) => {
      p.knowledge = {
        status: 'EMPTY',
        index_build_id: 'build-1',
        chunks: [chunk],
        expansions: [],
      };
    });
    expectRefused(chunks, ['knowledge', 'INCONSISTENT']);
  });

  it('says a SYN reading is given while the board says it is not running, and only then', () => {
    const notRunning = (state: string) =>
      variant((p) => {
        p.board.syn = {
          state,
          status: null,
          rule_id: null,
          bias: null,
          trend_relation: null,
          summary: 'not running',
        };
      });
    expectRefused(notRunning('NOT_RUNNING'), [
      'board.syn.state',
      'INCONSISTENT',
    ]);
    // a state that is not one of the two is reported once, as that and nothing more
    expect(summary(notRunning('PAUSED'))).toContain(
      'board.syn.state NOT_ONE_OF'
    );
    expect(
      summary(notRunning('PAUSED')).filter((line) =>
        line.startsWith('board.syn.state')
      )
    ).toEqual(['board.syn.state NOT_ONE_OF']);
  });

  it('keeps the retrace helper honest: a changed packet with its own trace is valid', () => {
    expectAccepted(retrace(clone(BASE)));
  });
});

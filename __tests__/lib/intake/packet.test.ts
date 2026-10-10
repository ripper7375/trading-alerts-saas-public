/**
 * @jest-environment node
 */

import { createHash } from 'crypto';

import {
  CanonicalError,
  INSTANT_INTENTS,
  INTAKE_VERSION,
  LOCALES,
  PACKET_INTENTS,
  ROUTING_VERSION,
  SENSOR_ROSTER,
  canonicalJson,
  chunkIdsOf,
  deriveTrace,
  forbiddenKeyPaths,
  packetSha256,
  validatePacket,
  type IntakePacket,
  type PacketIntent,
  type RosterSensor,
} from '@/lib/intake';

import { allGoldenPackets, clone, packetFromGolden } from './helpers/packets';
import {
  at,
  deleteAt,
  retrace,
  setAt,
  structured,
  structuredObjects,
  type Any,
} from './helpers/walk';
import {
  BASE,
  broken,
  expectAccepted,
  expectRefused,
  golden,
  issuesOf,
  variant,
} from './helpers/validate';

describe('a packet built from a signed-off golden cycle', () => {
  it('is valid for every one of the 16 cycles and both trader types', () => {
    const all = allGoldenPackets();
    expect(all).toHaveLength(32);
    for (const { name, packet } of all) {
      const result = validatePacket(packet);
      if (!result.ok) {
        throw new Error(
          `${name}: ${result.issues.map((i) => `${i.path} ${i.message}`).join('; ')}`
        );
      }
    }
  });

  it('is valid for each of the nine intents a packet may carry', () => {
    for (const intent of PACKET_INTENTS) {
      expectAccepted(packetFromGolden(golden('04'), { intent }));
      expectAccepted(
        packetFromGolden(golden('14'), { intent, traderType: 'SCALPER' })
      );
    }
  });

  it('carries the board, the readings in full, the knowledge, the profile, the events and the trace', () => {
    expect(Object.keys(BASE).sort()).toEqual(
      [
        'schema',
        'symbol',
        'thread_id',
        'question',
        'intent',
        'profile',
        'data',
        'board',
        'readings',
        'knowledge',
        'events',
        'trace',
      ].sort()
    );
    expect(BASE.board.sensors.map((s) => s.mcd_id)).toEqual([
      'MCD1',
      'MCD2',
      'MCD3',
    ]);
    expect(BASE.board.syn.rule_id).toBe('R1_MACRO_COUNTER_TREND_RALLY');
    expect(BASE.readings.sensors.map((s) => s.mcd_id)).toEqual([
      'MCD1',
      'MCD2',
      'MCD3',
    ]);
    expect(BASE.readings.synthesis?.zones.map((z) => z['zone_id'])).toEqual([
      'Z1',
      'Z2',
    ]);
    expect(BASE.data).toMatchObject({
      status: 'FRESH',
      cycle_slot: '2026-09-18T20:55Z',
    });
    expect(BASE.data.last_price).toEqual({
      price: 4378.31,
      timeframe: 'M5',
      bar: '2026-09-18T20:50Z',
    });
  });

  it('returns the very object it was given', () => {
    const result = validatePacket(BASE);
    expect(result.ok && result.packet).toBe(BASE);
  });

  it('survives a trip through JSON', () => {
    expectAccepted(JSON.parse(JSON.stringify(BASE)));
  });

  it('delivers MCD3’s full reading when only MCD3 says stand aside (4.11, second item)', () => {
    const packet = packetFromGolden(golden('06'), {
      mStar: ['MCD1', 'MCD2', 'MCD3'],
    });
    expect(
      packet.board.sensors
        .filter((s) => s.bias === 'STAND_ASIDE')
        .map((s) => s.mcd_id)
    ).toEqual(['MCD3']);
    expect(packet.readings.m_star).toContain('MCD3');
    expect(
      packet.readings.sensors.find((s) => s.mcd_id === 'MCD3')?.envelope['bias']
    ).toBe('STAND_ASIDE');
    expectAccepted(packet);
  });

  it('lists an unavailable sensor on the board with its reasons (INVALID, STALE)', () => {
    const stale = packetFromGolden(golden('14'), { traderType: 'DAY_TRADER' });
    expect(stale.board.sensors.map((s) => [s.mcd_id, s.status])).toEqual([
      ['MCD1', 'STALE'],
      ['MCD2', 'VALID'],
      ['MCD3', 'STALE'],
    ]);
    expect(stale.board.sensors[0]).toMatchObject({
      state_code: null,
      bias: null,
    });
    expect(stale.board.sensors[0]?.reasons).toEqual(['NO_STATS_AT_SLOT']);
    expectAccepted(stale);
    const invalid = packetFromGolden(golden('15'), { traderType: 'SCALPER' });
    expect(invalid.board.sensors.map((s) => s.status)).toEqual([
      'VALID',
      'INVALID',
      'INVALID',
    ]);
    expectAccepted(invalid);
  });

  it('with only one live sensor still has the SYN line and that sensor’s line', () => {
    const only = packetFromGolden(golden('16'), { traderType: 'SCALPER' });
    expect(only.board.sensors.map((s) => s.mcd_id)).toEqual(['MCD2']);
    expectAccepted(only);
  });
});

describe('every field of the contract is required', () => {
  const paths = structured(BASE).filter(({ parent }) => !Array.isArray(parent));

  it('covers a good number of fields', () => {
    expect(paths.length).toBeGreaterThan(90);
  });

  it('refuses the packet when any one field is missing, naming it', () => {
    for (const { path } of paths) {
      const packet = clone(BASE) as Any;
      deleteAt(packet, path);
      const issues = issuesOf(packet);
      expect({
        path,
        found: issues.some((i) => i.path === path && i.code === 'REQUIRED'),
      }).toEqual({
        path,
        found: true,
      });
    }
  });

  it('refuses a field set to undefined as missing', () => {
    for (const path of [
      'intent',
      'question.original',
      'data.status',
      'board.syn',
      'trace.language',
    ]) {
      const packet = clone(BASE) as Any;
      setAt(packet, path, undefined);
      expectRefused(packet, [path, 'REQUIRED']);
    }
  });

  it('refuses a field that is not part of the contract, at every level of the structure', () => {
    const objects = structuredObjects(BASE);
    expect(objects.length).toBeGreaterThan(20);
    for (const path of objects) {
      const packet = clone(BASE) as Any;
      at(packet, path)['surprise'] = 1;
      const where = path === '' ? 'surprise' : `${path}.surprise`;
      expectRefused(packet, [where, 'UNKNOWN_KEY']);
    }
  });

  it('refuses a field of the wrong type, wherever it is', () => {
    const leaves = structured(BASE).filter(
      ({ value, path }) =>
        (value === null ||
          ['string', 'number', 'boolean'].includes(typeof value)) &&
        !/^trace\.sensor_statuses/.test(path)
    );
    expect(leaves.length).toBeGreaterThan(80);
    for (const { path, value } of leaves) {
      const wrong =
        typeof value === 'string'
          ? 12345
          : typeof value === 'number'
            ? 'x'
            : typeof value === 'boolean'
              ? 'no'
              : 0;
      const packet = clone(BASE) as Any;
      setAt(packet, path, wrong);
      const issues = issuesOf(packet);
      expect({ path, refused: issues.length > 0 }).toEqual({
        path,
        refused: true,
      });
    }
  });

  it('is refused when any value of the trace is changed', () => {
    for (const key of Object.keys(BASE.trace)) {
      if (key === 'intake_version' || key === 'routing_version') continue;
      const packet = clone(BASE) as Any;
      const value = packet.trace[key];
      packet.trace[key] =
        value === null
          ? 'x'
          : Array.isArray(value)
            ? [...value, 'MCD9']
            : typeof value === 'object'
              ? { ...value, MCD9: 'VALID' }
              : `${value}!`;
      expectRefused(packet, [`trace.${key}`]);
    }
  });
});

describe('every enumerated field takes its own values and no others', () => {
  const ENUM_PATHS = [
    'intent',
    'profile.trader_type',
    'profile.style',
    'question.source',
    'question.language',
    'question.interface_locale',
    'question.reply_locale',
    'data.status',
    'board.syn.state',
    'board.syn.status',
    'board.syn.bias',
    'board.syn.trend_relation',
    'board.sensors[0].status',
    'board.sensors[0].bias',
    'knowledge.status',
    'knowledge.chunks[0].domain',
    'knowledge.chunks[0].timeframe',
    'events.status',
    'events.scope',
    'readings.synthesis.profile',
    'trace.language',
    'trace.reply_locale',
    'trace.intent',
    'trace.data_status',
    'trace.sensor_statuses.MCD1',
  ];

  it.each(ENUM_PATHS)(
    'refuses a value that is not in the list of %s',
    (path) => {
      // a chunk may have no timeframe: null is one of that list's values
      const nullIsLegal = path.endsWith('chunks[0].timeframe');
      for (const bad of ['NOT_A_VALUE', '', 'direction', 7, true, null]) {
        if (bad === null && nullIsLegal) continue;
        const packet = clone(BASE) as Any;
        setAt(packet, path, bad);
        const issues = issuesOf(packet);
        expect({ path, bad, refused: issues.length > 0 }).toEqual({
          path,
          bad,
          refused: true,
        });
      }
    }
  );

  it('refuses a value that is not in the list of an item of data.flags', () => {
    const packet = variant((p) => (p.data.flags = ['SENSORS_NOT_LIVE']));
    expectRefused(
      broken((p) => (p.data.flags = ['NOT_A_FLAG']), packet),
      ['data.flags[0]', 'NOT_ONE_OF']
    );
  });
});

describe('the profile never carries the equity or the commission (ADR-077, finding F11)', () => {
  const KEYS = [
    'equity',
    'commission',
    'Equity',
    'COMMISSION',
    'account_equity',
    'accountEquity',
    'equity_usd',
    'commission_per_lot',
    'roundTripCommission',
    'round_trip_commission',
  ];

  it('has the six fields and not the engine’s other two', () => {
    expect(Object.keys(BASE.profile).sort()).toEqual([
      'max_leverage',
      'max_risk_pct',
      'min_sld',
      'style',
      'target_rrr',
      'trader_type',
    ]);
  });

  it.each(KEYS)('refuses a key called %s in the profile', (key) => {
    const packet = broken((p) => {
      p.profile[key] = '5000';
    });
    expectRefused(
      packet,
      [`profile.${key}`, 'FORBIDDEN_KEY'],
      [`profile.${key}`, 'UNKNOWN_KEY']
    );
  });

  it.each(['equity', 'commission'])(
    'refuses %s at the top of the packet and in every section',
    (key) => {
      const places = [
        '',
        'question',
        'profile',
        'data',
        'data.last_price',
        'board',
        'board.syn',
        'board.sensors[0]',
        'readings',
        'readings.sensors[0]',
        'knowledge',
        'knowledge.chunks[0]',
        'events',
        'events.items[0]',
        'trace',
        'trace.sensor_statuses',
      ];
      for (const place of places) {
        const packet = clone(BASE) as Any;
        at(packet, place)[key] = 1;
        const where = place === '' ? key : `${place}.${key}`;
        expectRefused(packet, [where, 'FORBIDDEN_KEY']);
      }
    }
  );

  it.each(['equity', 'commission'])(
    'refuses %s inside a sensor’s envelope, a SYN reading and a zone, however deep',
    (key) => {
      const spots: [string, (p: Any) => Any][] = [
        ['envelope top', (p) => p.readings.sensors[0].envelope],
        ['envelope details', (p) => p.readings.sensors[0].envelope.details],
        [
          'envelope levels item',
          (p) => p.readings.sensors[0].envelope.levels[0],
        ],
        ['syn reading', (p) => p.readings.synthesis.reading],
        ['syn reading inputs', (p) => p.readings.synthesis.reading.inputs.MCD1],
        ['zone', (p) => p.readings.synthesis.zones[0]],
        ['zone level', (p) => p.readings.synthesis.zones[0].source_levels[0]],
      ];
      for (const [name, pick] of spots) {
        const packet = clone(BASE) as Any;
        pick(packet)[key] = 1;
        const issues = issuesOf(packet);
        expect({
          name,
          found: issues.some(
            (i) => i.code === 'FORBIDDEN_KEY' && i.path.endsWith(key)
          ),
        }).toEqual({
          name,
          found: true,
        });
      }
    }
  );

  it('refuses a key that only CONTAINS the word, in any case', () => {
    const packet = clone(BASE) as Any;
    packet.readings.sensors[1].envelope.details.nested = [
      [{ MyEquityCurve: 1 }],
    ];
    expectRefused(packet, [
      'readings.sensors[1].envelope.details.nested[0][0].MyEquityCurve',
      'FORBIDDEN_KEY',
    ]);
  });

  it('does not mind the word in a value, a comment or a different key', () => {
    const packet = clone(BASE) as Any;
    packet.readings.sensors[0].envelope.commentary =
      'equity and commission are not mentioned here';
    packet.question.english =
      'What is my equity and what is the commission on gold?';
    packet.question.original = packet.question.english;
    expectAccepted(retrace(packet));
    expect(forbiddenKeyPaths(packet)).toEqual([]);
  });

  it('reports it even when the rest of the packet is broken, and for a value that is not a packet at all', () => {
    expect(
      issuesOf({ equity: 1 }).some((i) => i.code === 'FORBIDDEN_KEY')
    ).toBe(true);
    const mess = broken((p) => {
      p.intent = 5;
      p.board = null;
      p.readings.sensors[0].envelope.details.equity = 1;
    });
    expectRefused(
      mess,
      ['readings.sensors[0].envelope.details.equity', 'FORBIDDEN_KEY'],
      ['intent'],
      ['board']
    );
  });

  it('is found by forbiddenKeyPaths with the path of each key', () => {
    expect(
      forbiddenKeyPaths({
        a: { equity: 1 },
        b: [{ x: { Commission: 2 } }],
        c: 'equity',
      })
    ).toEqual(['a.equity', 'b[0].x.Commission']);
    expect(forbiddenKeyPaths(BASE)).toEqual([]);
  });

  it('is never in a packet made from a golden cycle', () => {
    for (const { name, packet } of allGoldenPackets()) {
      expect({ name, found: forbiddenKeyPaths(packet) }).toEqual({
        name,
        found: [],
      });
    }
  });

  it('refuses a nest too deep to be searched, instead of walking it', () => {
    let deep: Any = { equity: 1 };
    for (let i = 0; i < 40; i += 1) deep = { a: deep };
    const packet = clone(BASE) as Any;
    packet.readings.sensors[0].envelope.details = deep;
    const issues = issuesOf(packet);
    const tooDeep = issues.find((issue) => issue.code === 'TOO_DEEP');
    expect(
      tooDeep?.path.startsWith('readings.sensors[0].envelope.details.a')
    ).toBe(true);
    // the key sits below the limit and was not walked, so it is not reported as forbidden
    expect(issues.some((issue) => issue.code === 'FORBIDDEN_KEY')).toBe(false);
  });
});

describe('the profile projection', () => {
  it('takes decimal text only', () => {
    for (const ok of ['0', '1', '1.5', '13', '0.75', '100.25']) {
      expectAccepted(variant((p) => (p.profile.max_risk_pct = ok)));
    }
    for (const bad of [
      '',
      '1.',
      '.5',
      '-1',
      '1e3',
      '01',
      ' 1',
      '1 ',
      'abc',
      '1,5',
      '1.5.2',
      1.5,
      null,
      '9'.repeat(21),
    ]) {
      expectRefused(
        variant((p) => (p.profile.max_risk_pct = bad)),
        ['profile.max_risk_pct']
      );
    }
  });

  it('takes the trader types and styles of the engine and no others', () => {
    for (const type of ['DAY_TRADER', 'SCALPER']) {
      expectAccepted(
        packetFromGolden(golden('04'), { traderType: type as 'SCALPER' })
      );
    }
    for (const style of ['TREND_FOLLOWING', 'TREND_COUNTERING', 'BOTH']) {
      expectAccepted(variant((p) => (p.profile.style = style)));
    }
    expectRefused(
      variant((p) => (p.profile.style = 'SWING')),
      ['profile.style', 'NOT_ONE_OF']
    );
    expectRefused(
      broken((p) => (p.profile.trader_type = 'SWING_TRADER')),
      ['profile.trader_type', 'NOT_ONE_OF']
    );
    expectRefused(
      broken((p) => (p.profile.traderType = 'SCALPER')),
      ['profile.traderType', 'UNKNOWN_KEY']
    );
  });
});

describe('the intent', () => {
  it('may not be OUT_OF_SCOPE: that request gets a fixed reply and no packet', () => {
    expectRefused(
      variant((p) => (p.intent = 'OUT_OF_SCOPE')),
      ['intent', 'NOT_ONE_OF']
    );
  });

  it.each(['direction', 'BUY', '', 'INSTANT_H1_INSPECT', null, 7])(
    'refuses the label %p',
    (label) => {
      expectRefused(
        variant((p) => (p.intent = label)),
        ['intent']
      );
    }
  );

  it('is carried into the trace', () => {
    for (const intent of PACKET_INTENTS) {
      expect(packetFromGolden(golden('04'), { intent }).trace.intent).toBe(
        intent
      );
    }
  });

  it('is an instant label only for an instant prompt, and a typed one only for typed text', () => {
    for (const intent of INSTANT_INTENTS) {
      const typed = variant((p) => (p.intent = intent));
      expectRefused(typed, ['intent', 'INCONSISTENT']);
      const instant = packetFromGolden(golden('04'), { intent });
      expect(instant.question.source).toBe('INSTANT');
      expectAccepted(instant);
      expectRefused(
        variant((p) => (p.intent = 'DIRECTION'), instant),
        ['intent', 'INCONSISTENT']
      );
    }
  });
});

describe('the question', () => {
  it('has a typed text of 1 to 500 characters and an English text of 1 to 1000', () => {
    expectAccepted(variant((p) => (p.question.original = 'x'.repeat(500))));
    expectRefused(
      variant((p) => (p.question.original = 'x'.repeat(501))),
      ['question.original', 'TOO_LONG']
    );
    expectRefused(
      variant((p) => (p.question.original = '')),
      ['question.original', 'TOO_SHORT']
    );
    expectRefused(
      variant((p) => (p.question.original = null)),
      ['question.original']
    );
    expectAccepted(variant((p) => (p.question.english = 'x'.repeat(1000))));
    expectRefused(
      variant((p) => (p.question.english = 'x'.repeat(1001))),
      ['question.english', 'TOO_LONG']
    );
    expectRefused(
      variant((p) => (p.question.english = '')),
      ['question.english', 'TOO_SHORT']
    );
  });

  it('has no typed text when it is an instant prompt', () => {
    const instant = packetFromGolden(golden('04'), {
      intent: 'INSTANT_M15_INSPECT',
    });
    expect(instant.question).toMatchObject({
      source: 'INSTANT',
      original: null,
    });
    expectRefused(
      variant((p) => (p.question.original = 'hello'), instant),
      ['question.original', 'INCONSISTENT']
    );
    expectRefused(
      variant((p) => (p.question.source = 'TYPED'), instant),
      ['question.original'],
      ['intent', 'INCONSISTENT']
    );
    expectRefused(
      variant((p) => (p.question.source = 'VOICE')),
      ['question.source', 'NOT_ONE_OF']
    );
  });

  it('keeps its flags as unique upper-case tokens, at most eight', () => {
    expectAccepted(
      variant((p) => (p.question.flags = ['TERM_DROPPED', 'DIGITS_FOLDED']))
    );
    expectRefused(
      variant((p) => (p.question.flags = ['term dropped'])),
      ['question.flags[0]', 'BAD_FORMAT']
    );
    expectRefused(
      variant((p) => (p.question.flags = ['A', 'A'])),
      ['question.flags[1]', 'DUPLICATE']
    );
    expectRefused(
      variant(
        (p) => (p.question.flags = Array.from({ length: 9 }, (_, i) => `F${i}`))
      ),
      ['question.flags', 'TOO_MANY']
    );
  });

  it('is in a language of the 17 or und, and an interface of the 19', () => {
    expectRefused(
      variant((p) => (p.question.language = 'ru')),
      ['question.language', 'NOT_ONE_OF']
    );
    expectRefused(
      variant((p) => (p.question.language = 'pt-BR')),
      ['question.language', 'NOT_ONE_OF']
    );
    expectRefused(
      variant((p) => (p.question.interface_locale = 'en')),
      ['question.interface_locale', 'NOT_ONE_OF']
    );
    expectRefused(
      variant((p) => (p.question.reply_locale = 'xx')),
      ['question.reply_locale', 'NOT_ONE_OF']
    );
  });

  describe('the locale of the reply (decision D1)', () => {
    const CASES: [language: string, ui: string, reply: string][] = [
      ['pt', 'pt-BR', 'pt-BR'],
      ['pt', 'pt', 'pt'],
      ['en', 'en-GB', 'en-GB'],
      ['en', 'en-US', 'en-US'],
      ['en', 'de', 'en-US'],
      ['th', 'en-US', 'th'],
      ['th', 'th', 'th'],
      ['und', 'ar', 'ar'],
      ['und', 'pt-BR', 'pt-BR'],
      ['zh', 'zh-TW', 'zh'],
      ['zh-TW', 'zh', 'zh-TW'],
      ['ja', 'ko', 'ja'],
    ];

    it.each(CASES)(
      'answers %s text from a %s interface in %s, and in no other locale',
      (language, ui, reply) => {
        const made = packetFromGolden(golden('04'), {
          question: { language, interface_locale: ui, reply_locale: reply },
          interfaceLocale: ui,
        });
        expectAccepted(made);
        for (const other of LOCALES.filter((locale) => locale !== reply)) {
          const wrong = variant((p) => (p.question.reply_locale = other), made);
          expectRefused(wrong, ['question.reply_locale', 'INCONSISTENT']);
        }
      }
    );

    it('answers an instant prompt in the interface locale, and says its language is the interface’s own', () => {
      for (const ui of LOCALES) {
        const made = packetFromGolden(golden('04'), {
          intent: 'INSTANT_M5_INSPECT',
          interfaceLocale: ui,
          question: {
            language: ui.startsWith('zh-TW')
              ? 'zh-TW'
              : (ui.split('-')[0] as string),
            reply_locale: ui,
          },
        });
        expectAccepted(made);
        const wrongLanguage = variant(
          (p) => (p.question.language = 'und'),
          made
        );
        expectRefused(wrongLanguage, ['question.language', 'INCONSISTENT']);
      }
    });
  });
});

describe('the symbol and the thread', () => {
  it('is gold, and nothing else', () => {
    expectRefused(
      variant((p) => (p.symbol = 'EURUSD')),
      ['symbol', 'NOT_ONE_OF']
    );
    expectRefused(
      variant((p) => (p.symbol = 'xauusd')),
      ['symbol']
    );
  });

  it('has an optional thread id of 1 to 64 safe characters', () => {
    expectAccepted(variant((p) => (p.thread_id = 'abc_DEF-123')));
    expectAccepted(variant((p) => (p.thread_id = 'x'.repeat(64))));
    for (const bad of ['', 'x'.repeat(65), 'a b', 'a/b', 'a;b', 5]) {
      expectRefused(
        variant((p) => (p.thread_id = bad)),
        ['thread_id']
      );
    }
  });
});

describe('the data status and the cycle it pins', () => {
  it.each(['FRESH', 'DELAYED', 'STALE', 'MARKET_CLOSED'])(
    'allows %s',
    (status) => {
      expectAccepted(variant((p) => (p.data.status = status)));
    }
  );

  it('allows UNKNOWN only with the flag that says the gateway could not be asked, and the reverse', () => {
    expectAccepted(
      variant((p) => {
        p.data.status = 'UNKNOWN';
        p.data.flags = ['GATEWAY_UNREACHABLE'];
      })
    );
    expectRefused(
      variant((p) => (p.data.status = 'UNKNOWN')),
      ['data.flags', 'INCONSISTENT']
    );
    expectRefused(
      variant((p) => (p.data.flags = ['GATEWAY_UNREACHABLE'])),
      ['data.flags', 'INCONSISTENT']
    );
    expectRefused(
      variant((p) => (p.data.status = 'OPEN')),
      ['data.status', 'NOT_ONE_OF']
    );
  });

  it('is flagged STALE in the packet like any other status (4.11, eighth item)', () => {
    const stale = variant((p) => (p.data.status = 'STALE'));
    expectAccepted(stale);
    expect(stale.trace.data_status).toBe('STALE');
  });

  it('says SENSORS_NOT_LIVE exactly when the board has no live sensor (decision D7)', () => {
    const none = variant((p) => {
      p.data.flags = ['SENSORS_NOT_LIVE'];
      p.board = {
        syn: {
          state: 'NOT_RUNNING',
          status: null,
          rule_id: null,
          bias: null,
          trend_relation: null,
          summary: 'Synthesis is not running',
        },
        sensors: [],
      };
      p.readings = { m_star: [], sensors: [], synthesis: null };
    });
    expectAccepted(none);
    expectRefused(
      broken((p) => (p.data.flags = []), none),
      ['data.flags', 'INCONSISTENT']
    );
    expectRefused(
      variant((p) => (p.data.flags = ['SENSORS_NOT_LIVE'])),
      ['data.flags', 'INCONSISTENT']
    );
    expectRefused(
      variant((p) => (p.data.flags = ['SENSORS_NOT_LIVE', 'SENSORS_NOT_LIVE'])),
      ['data.flags[1]', 'DUPLICATE']
    );
    expectRefused(
      variant((p) => (p.data.flags = ['STALE'])),
      ['data.flags[0]', 'NOT_ONE_OF']
    );
  });

  it('pins a cycle slot of five-minute form, or none', () => {
    for (const bad of [
      '2026-09-18T20:57Z',
      '2026-09-18 20:55',
      '2026-09-18T20:55:00Z',
      '18 Sep',
      '',
      5,
    ]) {
      expectRefused(
        variant((p) => (p.data.cycle_slot = bad)),
        ['data.cycle_slot']
      );
    }
    expectAccepted(
      variant((p) => {
        p.data.cycle_slot = null;
        p.readings = { m_star: [], sensors: [], synthesis: null };
      })
    );
  });

  it('may not have readings without a cycle to pin them to', () => {
    expectRefused(
      variant((p) => (p.data.cycle_slot = null)),
      ['readings', 'INCONSISTENT']
    );
  });

  it('says whether the retuning guard is on, as a boolean', () => {
    expectAccepted(variant((p) => (p.data.retuning = true)));
    expectRefused(
      variant((p) => (p.data.retuning = 'yes')),
      ['data.retuning', 'WRONG_TYPE']
    );
  });

  it('shows the close of the last closed M5 bar, or nothing', () => {
    expectAccepted(variant((p) => (p.data.last_price = null)));
    expectAccepted(variant((p) => (p.data.last_price.price = 0.01)));
    expectRefused(
      variant((p) => (p.data.last_price.price = 0)),
      ['data.last_price.price', 'OUT_OF_RANGE']
    );
    expectRefused(
      variant((p) => (p.data.last_price.price = -4000)),
      ['data.last_price.price']
    );
    expectRefused(
      variant((p) => (p.data.last_price.price = '4378.31')),
      ['data.last_price.price']
    );
    expectRefused(
      variant((p) => (p.data.last_price.timeframe = 'M15')),
      ['data.last_price.timeframe', 'NOT_ONE_OF']
    );
    expectRefused(
      variant((p) => (p.data.last_price.bar = '20:50')),
      ['data.last_price.bar']
    );
  });
});

describe('the sensor board', () => {
  it('lists only sensors of the roster that have a line, in id order, once each', () => {
    expectRefused(
      variant((p) => (p.board.sensors[0].mcd_id = 'MCD0')),
      ['board.sensors[0].mcd_id', 'NOT_ONE_OF']
    );
    expectRefused(
      variant((p) => (p.board.sensors[0].mcd_id = 'MCD9')),
      ['board.sensors[0].mcd_id', 'NOT_ONE_OF']
    );
    expectRefused(
      variant((p) => (p.board.sensors[0].mcd_id = 'MCD16')),
      ['board.sensors[0].mcd_id', 'BAD_FORMAT']
    );
    expectRefused(
      variant((p) => p.board.sensors.reverse()),
      ['board.sensors[1]', 'NOT_SORTED']
    );
    expectRefused(
      variant((p) => p.board.sensors.push(clone(p.board.sensors[2]))),
      ['board.sensors[3]', 'DUPLICATE']
    );
    expectRefused(
      variant((p) => {
        for (let i = 0; i < 13; i += 1)
          p.board.sensors.push(clone(p.board.sensors[2]));
      }),
      ['board.sensors', 'TOO_MANY']
    );
  });

  it('gives an available sensor its state code, bias and summary, and the state belongs to the sensor', () => {
    expectRefused(
      variant((p) => (p.board.sensors[0].state_code = null)),
      ['board.sensors[0].state_code']
    );
    expectRefused(
      variant((p) => (p.board.sensors[0].bias = null)),
      ['board.sensors[0].bias']
    );
    expectRefused(
      variant((p) => (p.board.sensors[0].summary = null)),
      ['board.sensors[0].summary']
    );
    expectRefused(
      variant((p) => (p.board.sensors[0].summary = 'x'.repeat(81))),
      ['board.sensors[0].summary', 'TOO_LONG']
    );
    expectRefused(
      variant((p) => (p.board.sensors[0].state_code = 'MCD2_UP_IN_CORRIDOR')),
      ['board.sensors[0].state_code', 'NOT_ONE_OF']
    );
    expectRefused(
      variant((p) => (p.board.sensors[0].state_code = 'MCD1_NO_SUCH_STATE')),
      ['board.sensors[0].state_code', 'NOT_ONE_OF']
    );
    expectRefused(
      variant((p) => (p.board.sensors[0].state_code = 'mcd1_up')),
      ['board.sensors[0].state_code', 'BAD_FORMAT']
    );
    expectRefused(
      variant((p) => (p.board.sensors[0].bias = 'UP')),
      ['board.sensors[0].bias', 'NOT_ONE_OF']
    );
  });

  it('gives an unavailable sensor no state, no bias, and a reason', () => {
    const stale = packetFromGolden(golden('14'), { traderType: 'DAY_TRADER' });
    expectRefused(
      variant(
        (p) => (p.board.sensors[0].state_code = 'MCD1_UP_IN_CORRIDOR'),
        stale
      ),
      ['board.sensors[0].state_code', 'INCONSISTENT']
    );
    expectRefused(
      variant((p) => (p.board.sensors[0].bias = 'LONG'), stale),
      ['board.sensors[0].bias', 'INCONSISTENT']
    );
    expectRefused(
      variant((p) => (p.board.sensors[0].reasons = []), stale),
      ['board.sensors[0].reasons', 'TOO_SHORT']
    );
    expectAccepted(
      variant((p) => {
        p.board.sensors[0].summary = null;
        p.readings.sensors[0].envelope.summary_line = 'whatever';
      }, stale)
    );
  });

  it('asks a CAUTIONARY sensor for its reasons and lets a VALID one have none or some', () => {
    expectRefused(
      variant((p) => (p.board.sensors[0].reasons = [])),
      ['board.sensors[0].reasons', 'TOO_SHORT']
    );
    expectAccepted(
      variant((p) => (p.board.sensors[0].reasons = ['MCD0_DEFECT_M15']))
    );
    const valid = packetFromGolden(golden('04'));
    expectAccepted(valid);
    expectAccepted(
      variant((p) => (p.board.sensors[0].reasons = ['SOME_NOTE']), valid)
    );
    expectRefused(
      variant((p) => (p.board.sensors[0].reasons = ['lower case']), valid),
      ['board.sensors[0].reasons[0]', 'BAD_FORMAT']
    );
    expectRefused(
      variant(
        (p) =>
          (p.board.sensors[0].reasons = Array.from(
            { length: 13 },
            (_, i) => `R${i}`
          )),
        valid
      ),
      ['board.sensors[0].reasons', 'TOO_MANY']
    );
  });

  it('lists a live sensor with no row for the slot as ABSENT, and gives no reading in full for it', () => {
    const absent = variant((p) => {
      p.board.sensors[2] = {
        mcd_id: 'MCD3',
        status: 'ABSENT',
        state_code: null,
        bias: null,
        summary: null,
        reasons: ['NO_ROW_FOR_SLOT'],
      };
      p.readings.m_star = ['MCD1', 'MCD2'];
      p.readings.sensors.pop();
    });
    expectAccepted(absent);
    expect(absent.trace.sensor_statuses.MCD3).toBe('ABSENT');
    expectRefused(
      variant((p) => (p.board.sensors[2].summary = 'x'), absent),
      ['board.sensors[2].summary', 'INCONSISTENT']
    );
    expectRefused(
      variant((p) => (p.board.sensors[2].state_code = 'MCD3_BULL_MID'), absent),
      ['board.sensors[2].state_code', 'INCONSISTENT']
    );
    // MCD3 given in full although the board says there is no row
    expectRefused(
      broken((p) => {
        p.readings.m_star = ['MCD1', 'MCD2', 'MCD3'];
        p.readings.sensors.push(clone(BASE.readings.sensors[2]));
      }, absent),
      ['readings.sensors[2].envelope', 'INCONSISTENT']
    );
  });

  it('has a SYN line that is either running, with its rule, or not running, with nothing else', () => {
    expectAccepted(
      variant((p) => {
        p.board.syn.trend_relation = null;
        p.readings.synthesis.reading.trend_relation = null;
      })
    );
    for (const rule of [
      'NO_MATCH',
      'R0_DATA_CHECK',
      'R3S_TREND_CONTINUATION_M5',
    ]) {
      expectAccepted(
        variant((p) => {
          p.board.syn.rule_id = rule;
          p.readings.synthesis.reading.rule_id = rule;
        })
      );
    }
    expectRefused(
      variant((p) => (p.board.syn.rule_id = 'r1')),
      ['board.syn.rule_id', 'BAD_FORMAT']
    );
    expectRefused(
      variant((p) => (p.board.syn.status = null)),
      ['board.syn.status']
    );
    expectRefused(
      variant((p) => (p.board.syn.bias = 'UP')),
      ['board.syn.bias', 'NOT_ONE_OF']
    );
    expectRefused(
      variant((p) => (p.board.syn.trend_relation = 'SIDEWAYS')),
      ['board.syn.trend_relation', 'NOT_ONE_OF']
    );
    expectRefused(
      variant((p) => (p.board.syn.summary = 'x'.repeat(121))),
      ['board.syn.summary', 'TOO_LONG']
    );
    expectRefused(
      variant((p) => (p.board.syn.summary = '')),
      ['board.syn.summary', 'TOO_SHORT']
    );
    expectRefused(
      variant((p) => (p.board.syn.state = 'PAUSED')),
      ['board.syn.state', 'NOT_ONE_OF']
    );
    const notRunning = variant((p) => {
      p.board.syn = {
        state: 'NOT_RUNNING',
        status: null,
        rule_id: null,
        bias: null,
        trend_relation: null,
        summary: 'not running',
      };
      p.readings.synthesis = null;
    });
    expectAccepted(notRunning);
    for (const key of ['status', 'rule_id', 'bias', 'trend_relation']) {
      const value =
        key === 'status'
          ? 'VALID'
          : key === 'bias'
            ? 'LONG'
            : key === 'rule_id'
              ? 'NO_MATCH'
              : 'WITH_TREND';
      expectRefused(
        variant((p) => (p.board.syn[key] = value), notRunning),
        [`board.syn.${key}`, 'INCONSISTENT']
      );
    }
  });

  it('agrees with the readings in full: a board that says VALID over a STALE envelope is refused', () => {
    for (const [field, value] of [
      ['status', 'VALID'],
      ['state_code', 'MCD1_UP_IN_CORRIDOR'],
      ['bias', 'SHORT'],
      ['summary', 'something else'],
    ] as const) {
      const packet = variant((p) => (p.board.sensors[0][field] = value));
      const path = `readings.sensors[0].envelope.${field === 'summary' ? 'summary_line' : field}`;
      expectRefused(packet, [path, 'INCONSISTENT']);
    }
    // and the other way round: the envelope changed under a board that is right
    for (const field of ['status', 'state_code', 'bias', 'summary_line']) {
      expectRefused(
        variant((p) => (p.readings.sensors[0].envelope[field] = 'CHANGED')),
        [`readings.sensors[0].envelope.${field}`, 'INCONSISTENT']
      );
    }
  });

  it('agrees with the SYN reading in full', () => {
    for (const [field, value] of [
      ['status', 'VALID'],
      ['rule_id', 'R3_TREND_CONTINUATION'],
      ['bias', 'SHORT'],
      ['trend_relation', 'WITH_TREND'],
    ] as const) {
      expectRefused(
        variant((p) => (p.board.syn[field] = value)),
        [`readings.synthesis.reading.${field}`, 'INCONSISTENT']
      );
    }
    // the reading is given, so the board must not say the synthesis is not running
    expectRefused(
      variant((p) => {
        p.board.syn = {
          state: 'NOT_RUNNING',
          status: null,
          rule_id: null,
          bias: null,
          trend_relation: null,
          summary: 'not running',
        };
      }),
      ['board.syn.state', 'INCONSISTENT']
    );
  });
});

describe('the readings in full', () => {
  it('are the sensors of M*, in id order, each once, and M* is a subset of the board', () => {
    expectAccepted(
      variant((p) => {
        p.readings.m_star = ['MCD3'];
        p.readings.sensors = [p.readings.sensors[2]];
      })
    );
    expectAccepted(
      variant((p) => {
        p.readings.m_star = [];
        p.readings.sensors = [];
      })
    );
    expectRefused(
      variant((p) => {
        p.readings.m_star = ['MCD1', 'MCD2', 'MCD3', 'MCD1'];
      }),
      ['readings.sensors', 'INCONSISTENT'],
      ['readings.m_star[3]', 'NOT_SORTED']
    );
    expectRefused(
      variant((p) => (p.readings.m_star = ['MCD2', 'MCD1', 'MCD3'])),
      ['readings.m_star[1]', 'NOT_SORTED']
    );
    expectRefused(
      variant((p) => (p.readings.m_star = ['MCD1', 'MCD1', 'MCD3'])),
      ['readings.m_star[1]', 'DUPLICATE']
    );
    expectRefused(
      variant((p) => (p.readings.m_star = ['MCD1', 'MCD2'])),
      ['readings.sensors', 'INCONSISTENT']
    );
    expectRefused(
      variant((p) => p.readings.sensors.reverse()),
      ['readings.sensors', 'INCONSISTENT']
    );
    expectRefused(
      variant((p) => (p.readings.m_star[0] = 'MCD5')),
      ['readings.m_star[0]', 'INCONSISTENT']
    );
    expectRefused(
      variant((p) => (p.readings.m_star[0] = 'MCD99')),
      ['readings.m_star[0]', 'BAD_FORMAT']
    );
  });

  it('carry the sensor’s envelope as stored, pinned to the packet’s cycle', () => {
    expectRefused(
      variant(
        (p) => (p.readings.sensors[0].envelope.schema_version = 'mcd-output/2')
      ),
      ['readings.sensors[0].envelope.schema_version', 'NOT_ONE_OF']
    );
    expectRefused(
      variant((p) => (p.readings.sensors[0].envelope.mcd_id = 'MCD2')),
      ['readings.sensors[0].envelope.mcd_id', 'INCONSISTENT']
    );
    expectRefused(
      variant(
        (p) => (p.readings.sensors[0].envelope.cycle_slot = '2026-09-18T20:50Z')
      ),
      ['readings.sensors[0].envelope.cycle_slot', 'INCONSISTENT']
    );
    expectRefused(
      variant((p) => (p.readings.sensors[0].envelope = [])),
      ['readings.sensors[0].envelope', 'WRONG_TYPE']
    );
    expectRefused(
      variant((p) => (p.readings.sensors[0].envelope_sha256 = 'ABC')),
      ['readings.sensors[0].envelope_sha256', 'BAD_FORMAT']
    );
    expectRefused(
      variant((p) => (p.readings.sensors[0].envelope_sha256 = 'a'.repeat(63))),
      ['readings.sensors[0].envelope_sha256']
    );
    expectRefused(
      variant((p) => (p.readings.sensors[0].extra = 1)),
      ['readings.sensors[0].extra', 'UNKNOWN_KEY']
    );
  });

  it('accept any other key in an envelope, as the worker may add one', () => {
    expectAccepted(
      variant(
        (p) =>
          (p.readings.sensors[0].envelope.a_new_field = {
            nested: [1, 2, { ok: true }],
          })
      )
    );
  });

  it('carry the SYN reading of the trader’s own type with its zones', () => {
    expectRefused(
      variant((p) => (p.readings.synthesis.profile = 'SCALPER')),
      ['readings.synthesis.profile', 'INCONSISTENT']
    );
    expectRefused(
      variant((p) => (p.readings.synthesis.reading.profile = 'SCALPER')),
      ['readings.synthesis.reading.profile', 'INCONSISTENT']
    );
    expectRefused(
      variant(
        (p) => (p.readings.synthesis.reading.schema_version = 'syn-output/2')
      ),
      ['readings.synthesis.reading.schema_version']
    );
    expectRefused(
      variant((p) => (p.readings.synthesis.reading.mcd_id = 'MCD1')),
      ['readings.synthesis.reading.mcd_id']
    );
    expectRefused(
      variant(
        (p) => (p.readings.synthesis.reading.cycle_slot = '2026-09-18T20:50Z')
      ),
      ['readings.synthesis.reading.cycle_slot', 'INCONSISTENT']
    );
    expectRefused(
      variant((p) => (p.readings.synthesis.reading = null)),
      ['readings.synthesis.reading', 'WRONG_TYPE']
    );
    expectRefused(
      variant((p) => (p.readings.synthesis.reading_sha256 = 'x')),
      ['readings.synthesis.reading_sha256', 'BAD_FORMAT']
    );
    expectRefused(
      variant((p) => (p.readings.synthesis.zones_sha256 = null)),
      ['readings.synthesis.zones_sha256']
    );
    expectRefused(
      variant((p) => (p.readings.synthesis = { profile: 'DAY_TRADER' })),
      ['readings.synthesis.reading', 'REQUIRED']
    );
  });

  it('name their zones as the reading does, once each, pinned to the cycle and the trader type', () => {
    expectRefused(
      variant((p) => p.readings.synthesis.zones.reverse()),
      ['readings.synthesis.zones', 'INCONSISTENT']
    );
    expectRefused(
      variant((p) => p.readings.synthesis.zones.pop()),
      ['readings.synthesis.zones', 'INCONSISTENT']
    );
    expectRefused(
      variant((p) => (p.readings.synthesis.zones[1].zone_id = 'Z1')),
      ['readings.synthesis.zones[1]', 'DUPLICATE']
    );
    expectRefused(
      variant((p) => (p.readings.synthesis.zones[0].zone_id = 'Z9')),
      ['readings.synthesis.zones[0].zone_id', 'BAD_FORMAT']
    );
    expectRefused(
      variant(
        (p) => (p.readings.synthesis.zones[0].cycle_slot = '2026-09-18T20:50Z')
      ),
      ['readings.synthesis.zones[0].cycle_slot', 'INCONSISTENT']
    );
    expectRefused(
      variant((p) => (p.readings.synthesis.zones[0].profile = 'SCALPER')),
      ['readings.synthesis.zones[0].profile', 'INCONSISTENT']
    );
    expectRefused(
      variant((p) => (p.readings.synthesis.zones[0] = 'Z1')),
      ['readings.synthesis.zones[0]', 'WRONG_TYPE']
    );
    expectRefused(
      variant((p) => {
        p.readings.synthesis.zones = Array.from({ length: 6 }, (_, i) => ({
          zone_id: `Z${(i % 5) + 1}`,
          cycle_slot: p.data.cycle_slot,
          profile: 'DAY_TRADER',
        }));
      }),
      ['readings.synthesis.zones', 'TOO_MANY']
    );
  });

  it('say why there are no zones, and only then', () => {
    const none = packetFromGolden(golden('02'));
    expect(none.readings.synthesis?.zones).toEqual([]);
    expect(none.readings.synthesis?.zones_reason).toBe('NO_ZONE_SOURCES');
    expectAccepted(none);
    expectRefused(
      variant((p) => (p.readings.synthesis.zones_reason = null), none),
      ['readings.synthesis.zones_reason', 'INCONSISTENT']
    );
    expectRefused(
      variant((p) => (p.readings.synthesis.zones_reason = 'NO_ZONE_SOURCES')),
      ['readings.synthesis.zones_reason', 'INCONSISTENT']
    );
    expectRefused(
      variant((p) => (p.readings.synthesis.zones_reason = 'no zones')),
      ['readings.synthesis.zones_reason', 'BAD_FORMAT']
    );
  });

  it('are absent for Report 2, where Section 6 reads the pinned cycle by id', () => {
    const report2 = packetFromGolden(golden('01'), { intent: 'REPORT_2' });
    expect(report2.readings).toEqual({
      m_star: [],
      sensors: [],
      synthesis: null,
    });
    expect(report2.knowledge).toBeNull();
    expect(report2.board.sensors).toHaveLength(3); // the board is still there
    expectAccepted(report2);
    expectRefused(
      variant((p) => (p.readings.m_star = ['MCD1']), report2),
      ['readings', 'INCONSISTENT']
    );
    expectRefused(
      variant(
        (p) => (p.readings.synthesis = clone(BASE.readings.synthesis)),
        report2
      ),
      ['readings', 'INCONSISTENT']
    );
  });

  it('are not needed to carry the SYN reading for the intents that do not use it', () => {
    expectAccepted(variant((p) => (p.readings.synthesis = null)));
  });
});

describe('the knowledge pack', () => {
  const chunk = (id: string) => ({ ...clone(BASE.knowledge?.chunks[0]), id });

  it('is absent for Report 2 and present, even if unavailable, for every other intent (decision D9 (d))', () => {
    expectRefused(
      variant((p) => (p.knowledge = null)),
      ['knowledge', 'REQUIRED']
    );
    expectRefused(
      variant(
        (p) => (p.knowledge = clone(BASE.knowledge)),
        packetFromGolden(golden('01'), { intent: 'REPORT_2' })
      ),
      ['knowledge', 'INCONSISTENT']
    );
    for (const intent of PACKET_INTENTS.filter(
      (i) => i !== 'REPORT_2'
    ) as PacketIntent[]) {
      expect(
        packetFromGolden(golden('04'), { intent }).knowledge
      ).not.toBeNull();
    }
  });

  it('holds up to 4 chunks and 8 expansions, with ids that are not repeated', () => {
    expectAccepted(
      variant((p) => (p.knowledge.chunks = ['A', 'B', 'C', 'D'].map(chunk)))
    );
    expectRefused(
      variant(
        (p) => (p.knowledge.chunks = ['A', 'B', 'C', 'D', 'E'].map(chunk))
      ),
      ['knowledge.chunks', 'TOO_MANY']
    );
    expectAccepted(
      variant(
        (p) =>
          (p.knowledge.expansions = Array.from({ length: 8 }, (_, i) =>
            chunk(`X${i}`)
          ))
      )
    );
    expectRefused(
      variant(
        (p) =>
          (p.knowledge.expansions = Array.from({ length: 9 }, (_, i) =>
            chunk(`X${i}`)
          ))
      ),
      ['knowledge.expansions', 'TOO_MANY']
    );
    expectRefused(
      variant(
        (p) => (p.knowledge.expansions = [chunk(p.knowledge.chunks[0].id)])
      ),
      ['knowledge.expansions[0]', 'DUPLICATE']
    );
    expectRefused(
      variant((p) => (p.knowledge.chunks[1].id = p.knowledge.chunks[0].id)),
      ['knowledge.chunks[1]', 'DUPLICATE']
    );
  });

  it('lists the ids of the chunks and then the expansions in the trace', () => {
    const packet = variant((p) => (p.knowledge.expansions = [chunk('X1')]));
    expect(packet.trace.chunk_ids).toEqual([
      'D2-MCD1-UP_IN_CORRIDOR',
      'D1-LEVELS',
      'X1',
    ]);
    expect(chunkIdsOf(packet.knowledge)).toEqual(packet.trace.chunk_ids);
    expect(chunkIdsOf(null)).toEqual([]);
    expect(packet.trace.index_build_id).toBe('build-0001');
  });

  it('describes each chunk by its domain, sensor, states, timeframe, version and text', () => {
    expectRefused(
      variant((p) => (p.knowledge.chunks[0].domain = 'D6')),
      ['knowledge.chunks[0].domain', 'NOT_ONE_OF']
    );
    expectRefused(
      variant((p) => (p.knowledge.chunks[0].mcd_id = 'MCD99')),
      ['knowledge.chunks[0].mcd_id', 'BAD_FORMAT']
    );
    expectAccepted(variant((p) => (p.knowledge.chunks[0].mcd_id = null)));
    expectRefused(
      variant((p) => (p.knowledge.chunks[0].timeframe = 'H1')),
      ['knowledge.chunks[0].timeframe', 'NOT_ONE_OF']
    );
    expectAccepted(variant((p) => (p.knowledge.chunks[0].timeframe = 'M5')));
    expectRefused(
      variant((p) => (p.knowledge.chunks[0].state_codes = ['up'])),
      ['knowledge.chunks[0].state_codes[0]', 'BAD_FORMAT']
    );
    expectRefused(
      variant((p) => (p.knowledge.chunks[0].text = 'x'.repeat(4001))),
      ['knowledge.chunks[0].text', 'TOO_LONG']
    );
    expectAccepted(
      variant((p) => (p.knowledge.chunks[0].text = 'x'.repeat(4000)))
    );
    expectRefused(
      variant((p) => (p.knowledge.chunks[0].text = '')),
      ['knowledge.chunks[0].text', 'TOO_SHORT']
    );
    expectRefused(
      variant((p) => (p.knowledge.chunks[0].id = 'has space')),
      ['knowledge.chunks[0].id', 'BAD_FORMAT']
    );
    expectRefused(
      variant((p) => (p.knowledge.chunks[0].version = '')),
      ['knowledge.chunks[0].version']
    );
  });

  it('names its build when it came from the index, and says so when it could not be asked', () => {
    expectRefused(
      variant((p) => (p.knowledge.index_build_id = null)),
      ['knowledge.index_build_id', 'REQUIRED']
    );
    expectRefused(
      variant((p) => (p.knowledge.chunks = [])),
      ['knowledge.chunks', 'TOO_SHORT']
    );
    const unavailable = variant((p) => {
      p.knowledge = {
        status: 'UNAVAILABLE',
        index_build_id: null,
        chunks: [],
        expansions: [],
      };
    });
    expectAccepted(unavailable);
    expect(unavailable.trace).toMatchObject({
      chunk_ids: [],
      index_build_id: null,
    });
    expectRefused(
      variant((p) => (p.knowledge.index_build_id = 'build-0001'), unavailable),
      ['knowledge.index_build_id', 'INCONSISTENT']
    );
    expectRefused(
      variant((p) => (p.knowledge.chunks = [chunk('A')]), unavailable),
      ['knowledge', 'INCONSISTENT']
    );
    const empty = variant((p) => {
      p.knowledge = {
        status: 'EMPTY',
        index_build_id: 'build-0001',
        chunks: [],
        expansions: [],
      };
    });
    expectAccepted(empty);
    expectRefused(
      variant((p) => (p.knowledge.index_build_id = null), empty),
      ['knowledge.index_build_id', 'REQUIRED']
    );
    expectRefused(
      variant((p) => (p.knowledge.expansions = [chunk('A')]), empty),
      ['knowledge', 'INCONSISTENT']
    );
    expectRefused(
      variant((p) => (p.knowledge.status = 'PARTIAL')),
      ['knowledge.status', 'NOT_ONE_OF']
    );
  });
});

describe('the upcoming events', () => {
  const item = (time: string, importance = 'HIGH') => ({
    event_id: 'EV-1',
    name: 'Some release',
    time,
    currency: 'USD',
    importance,
    approximate: false,
    tier1: false,
  });

  it('are the whole upcoming list for the News intent and the next 24 hours of HIGH impact for the rest', () => {
    const news = packetFromGolden(golden('04'), { intent: 'NEWS' });
    expect(news.events.scope).toBe('UPCOMING_ALL');
    expectAccepted(news);
    expectAccepted(
      variant(
        (p) => p.events.items.push(item('2026-09-18T23:00:00Z', 'LOW')),
        news
      )
    );
    expectRefused(
      variant((p) => (p.events.scope = 'NEXT_24H_HIGH'), news),
      ['events.scope', 'INCONSISTENT']
    );
    expectRefused(
      variant((p) => (p.events.scope = 'UPCOMING_ALL')),
      ['events.scope', 'INCONSISTENT']
    );
    expectRefused(
      variant((p) => p.events.items.push(item('2026-09-18T23:00:00Z', 'LOW'))),
      ['events.items[1].importance', 'INCONSISTENT']
    );
    expectRefused(
      variant((p) => (p.events.scope = 'TODAY')),
      ['events.scope', 'NOT_ONE_OF']
    );
  });

  it('are in order of time, soonest first', () => {
    expectAccepted(
      variant((p) =>
        p.events.items.push(
          item('2026-09-18T21:30:00Z'),
          item('2026-09-18T22:00:00Z')
        )
      )
    );
    expectRefused(
      variant((p) => p.events.items.push(item('2026-09-18T21:00:00Z'))),
      ['events.items[1].time', 'NOT_SORTED']
    );
  });

  it('say aloud when the calendar could not be read, and never list anything then', () => {
    const unavailable = variant((p) => {
      p.events = {
        status: 'UNAVAILABLE',
        calendar_age_seconds: null,
        scope: 'NEXT_24H_HIGH',
        items: [],
      };
    });
    expectAccepted(unavailable);
    expectRefused(
      variant((p) => (p.events.calendar_age_seconds = 60), unavailable),
      ['events.calendar_age_seconds', 'INCONSISTENT']
    );
    expectRefused(
      variant(
        (p) => p.events.items.push(item('2026-09-18T23:00:00Z')),
        unavailable
      ),
      ['events.items', 'INCONSISTENT']
    );
    expectRefused(
      variant((p) => (p.events.calendar_age_seconds = null)),
      ['events.calendar_age_seconds', 'REQUIRED']
    );
    expectAccepted(
      variant((p) => {
        p.events.status = 'LATE';
        p.events.calendar_age_seconds = 5000;
      })
    );
    expectAccepted(variant((p) => (p.events.items = [])));
  });

  it('have an age in whole seconds, and items of a fixed form', () => {
    expectAccepted(variant((p) => (p.events.calendar_age_seconds = 0)));
    expectRefused(
      variant((p) => (p.events.calendar_age_seconds = -1)),
      ['events.calendar_age_seconds', 'OUT_OF_RANGE']
    );
    expectRefused(
      variant((p) => (p.events.calendar_age_seconds = 1.5)),
      ['events.calendar_age_seconds', 'WRONG_TYPE']
    );
    expectRefused(
      variant((p) => (p.events.status = 'STALE')),
      ['events.status', 'NOT_ONE_OF']
    );
    expectRefused(
      variant((p) => (p.events.items[0].currency = 'usd')),
      ['events.items[0].currency', 'BAD_FORMAT']
    );
    expectRefused(
      variant((p) => (p.events.items[0].time = '2026-09-18 21:30')),
      ['events.items[0].time', 'BAD_FORMAT']
    );
    expectRefused(
      variant((p) => (p.events.items[0].name = 'x'.repeat(121))),
      ['events.items[0].name', 'TOO_LONG']
    );
    expectRefused(
      variant((p) => (p.events.items[0].tier1 = 'yes')),
      ['events.items[0].tier1', 'WRONG_TYPE']
    );
    expectRefused(
      variant((p) => (p.events.items[0].approximate = 0)),
      ['events.items[0].approximate']
    );
    expectRefused(
      variant((p) => (p.events.items[0].importance = 'high')),
      ['events.items[0].importance', 'BAD_FORMAT']
    );
  });

  it('hold at most 50 items', () => {
    const many = (n: number) =>
      Array.from({ length: n }, () => item('2026-09-18T21:30:00Z'));
    expectAccepted(variant((p) => (p.events.items = many(50))));
    expectRefused(
      variant((p) => (p.events.items = many(51))),
      ['events.items', 'TOO_MANY']
    );
  });
});

describe('the trace', () => {
  it('is what deriveTrace says of the rest of the packet, for every golden cycle', () => {
    for (const { name, packet } of allGoldenPackets()) {
      const { trace, ...body } = packet;
      expect({
        name,
        trace: deriveTrace(body, {
          intake: trace.intake_version,
          routing: trace.routing_version,
        }),
      }).toEqual({
        name,
        trace,
      });
    }
  });

  it('names the language, intent, M*, chunk ids, build, cycle slot and the synthesis rule (4.11, last item)', () => {
    expect(BASE.trace).toEqual({
      language: 'en',
      reply_locale: 'en-US',
      intent: 'DIRECTION',
      m_star: ['MCD1', 'MCD2', 'MCD3'],
      chunk_ids: ['D2-MCD1-UP_IN_CORRIDOR', 'D1-LEVELS'],
      index_build_id: 'build-0001',
      cycle_slot: '2026-09-18T20:55Z',
      data_status: 'FRESH',
      sensor_statuses: {
        MCD1: 'CAUTIONARY',
        MCD2: 'CAUTIONARY',
        MCD3: 'CAUTIONARY',
      },
      synthesis_rule: 'R1_MACRO_COUNTER_TREND_RALLY',
      intake_version: INTAKE_VERSION,
      routing_version: ROUTING_VERSION,
    });
  });

  it('follows the packet when the packet changes (the validator accepts the derived one only)', () => {
    expectAccepted(variant((p) => (p.question.language = 'und')));
    expectRefused(
      broken((p) => (p.question.language = 'und')),
      ['trace.language', 'INCONSISTENT']
    );
    expectRefused(
      broken((p) => (p.data.cycle_slot = '2026-09-18T20:50Z'), BASE),
      ['readings.sensors[0].envelope.cycle_slot']
    );
    expectRefused(
      broken((p) => (p.knowledge.chunks[0].id = 'OTHER')),
      ['trace.chunk_ids', 'INCONSISTENT']
    );
    expectRefused(
      broken((p) => (p.readings.m_star = ['MCD1'])),
      ['readings.sensors']
    );
  });

  it('keeps the two versions as free tokens: an old packet stays readable', () => {
    expectAccepted(broken((p) => (p.trace.intake_version = '0.9.0')));
    expectAccepted(broken((p) => (p.trace.routing_version = 'routing-v2')));
    expectRefused(
      broken((p) => (p.trace.intake_version = 'not a version')),
      ['trace.intake_version', 'BAD_FORMAT']
    );
    expectRefused(
      broken((p) => (p.trace.routing_version = '')),
      ['trace.routing_version', 'TOO_SHORT']
    );
  });

  it('is not compared while the rest of the packet is broken (the first problem is reported, not a cascade)', () => {
    const issues = issuesOf(broken((p) => (p.intent = 'OUT_OF_SCOPE')));
    expect(issues.some((i) => i.path.startsWith('trace'))).toBe(false);
  });
});

describe('the fingerprint of a packet (decision D9 (e))', () => {
  /** The same value with the keys of every object written in the opposite order. */
  const reversedKeys = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(reversedKeys);
    if (typeof value === 'object' && value !== null) {
      return Object.fromEntries(
        Object.entries(value)
          .reverse()
          .map(([key, inner]) => [key, reversedKeys(inner)])
      );
    }
    return value;
  };

  it('is the SHA-256 of the canonical text, whatever order the keys were built in', async () => {
    const first = await packetSha256(BASE);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).toBe(
      createHash('sha256').update(canonicalJson(BASE), 'utf8').digest('hex')
    );
    expect(await packetSha256(BASE)).toBe(first);
    expect(await packetSha256(reversedKeys(BASE) as IntakePacket)).toBe(first);
    expect(await packetSha256(clone(BASE))).toBe(first);
  });

  it('differs for each of the 32 packets of the golden cycles', async () => {
    const hashes = new Set<string>();
    for (const { packet } of allGoldenPackets()) {
      hashes.add(await packetSha256(packet));
    }
    expect(hashes.size).toBe(32);
  });

  it('changes when any one value of the packet changes, the trace included', async () => {
    const first = await packetSha256(BASE);
    const leaves = structured(BASE).filter(
      ({ value }) => typeof value !== 'object' || value === null
    );
    expect(leaves.length).toBeGreaterThan(80);
    for (const { path, value } of leaves) {
      const packet = clone(BASE) as Any;
      setAt(
        packet,
        path,
        typeof value === 'string' ? `${value}!` : value === null ? 0 : 'x'
      );
      expect({ path, same: (await packetSha256(packet)) === first }).toEqual({
        path,
        same: false,
      });
    }
    const traced = clone(BASE) as Any;
    traced.trace.intake_version = '1.0.1';
    expect(await packetSha256(traced)).not.toBe(first);
  });

  it('refuses a packet that has no single JSON text', async () => {
    const packet = clone(BASE) as Any;
    packet.data.retuning = undefined;
    await expect(packetSha256(packet)).rejects.toBeInstanceOf(CanonicalError);
  });
});

describe('the roster decides which sensors exist', () => {
  const fake = (patch: Partial<RosterSensor> = {}): RosterSensor => ({
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
    owned_terms: [],
    state_codes: ['MCD4_ONE'],
    ...patch,
  });

  it('refuses a board line for a sensor the committed roster does not have, and accepts it with a roster that has one', () => {
    const line = {
      mcd_id: 'MCD4',
      status: 'VALID',
      state_code: 'MCD4_ONE',
      bias: 'LONG',
      summary: 'A fourth sensor',
      reasons: [],
    };
    const packet = variant((p) => {
      p.board.sensors.push(line);
      p.readings.m_star.push('MCD4');
      p.readings.sensors.push({
        mcd_id: 'MCD4',
        envelope_sha256: 'a'.repeat(64),
        envelope: {
          schema_version: 'mcd-output/1',
          mcd_id: 'MCD4',
          cycle_slot: p.data.cycle_slot,
          status: 'VALID',
          state_code: 'MCD4_ONE',
          bias: 'LONG',
          summary_line: 'A fourth sensor',
        },
      });
    });
    expectRefused(packet, ['board.sensors[3].mcd_id', 'NOT_ONE_OF']);
    const roster = clone(SENSOR_ROSTER);
    roster.sensors.push(fake());
    expectAccepted(packet, roster);
    expectRefused(packet, ['board.sensors[3].mcd_id']); // the committed roster is still the default
  });

  it('refuses a board line for the gate, even if the roster has it', () => {
    expectRefused(
      variant((p) => (p.board.sensors[0].mcd_id = 'MCD0')),
      ['board.sensors[0].mcd_id', 'NOT_ONE_OF']
    );
  });
});

describe('what is not a packet', () => {
  it.each([null, undefined, [], 'packet', 42, true, () => 1])(
    'refuses %p without throwing',
    (value) => {
      const result = validatePacket(value);
      expect(result.ok).toBe(false);
    }
  );

  it('refuses a wrong schema id', () => {
    expectRefused(
      variant((p) => (p.schema = 'intake-packet/2')),
      ['schema', 'NOT_ONE_OF']
    );
  });

  it('reports at most 60 problems however bad the input', () => {
    const issues = issuesOf({
      ...Object.fromEntries(Object.keys(BASE).map((k) => [k, 5])),
      extra1: 1,
      extra2: 2,
    });
    expect(issues.length).toBeLessThanOrEqual(60);
    expect(issues.length).toBeGreaterThan(10);
  });

  it('never throws, whatever it is given (a seeded fuzz of 3,000 values and 3,000 damaged packets)', () => {
    let state = 987654321;
    const next = (n: number): number => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return state % n;
    };
    const scalar = (): unknown =>
      [
        null,
        true,
        false,
        0,
        -1,
        1.5,
        '',
        'x',
        'MCD1',
        'FRESH',
        [],
        {},
        1e308,
        'é',
      ][next(14)];
    const random = (depth: number): unknown => {
      const kind = next(depth > 3 ? 1 : 3);
      if (kind === 0) return scalar();
      if (kind === 1)
        return Array.from({ length: next(4) }, () => random(depth + 1));
      const out: Record<string, unknown> = {};
      for (let i = 0; i < next(5); i += 1) {
        out[
          ['schema', 'intent', 'board', 'equity', 'a', 'sensors', 'status'][
            next(7)
          ] as string
        ] = random(depth + 1);
      }
      return out;
    };
    for (let i = 0; i < 3000; i += 1) {
      expect(() => validatePacket(random(0))).not.toThrow();
    }
    const leaves = structured(BASE).filter(
      ({ value }) => typeof value !== 'object' || value === null
    );
    for (let i = 0; i < 3000; i += 1) {
      const packet = clone(BASE) as Any;
      for (let hits = 0; hits < 1 + next(3); hits += 1) {
        const { path } = leaves[next(leaves.length)] as { path: string };
        try {
          setAt(packet, path, random(2));
        } catch {
          // an earlier change in this round replaced the parent: skip this one
        }
      }
      expect(() => validatePacket(packet)).not.toThrow();
    }
  });

  it('copes with a hostile size: a million-item list is refused at once', () => {
    const packet = clone(BASE) as Any;
    packet.board.sensors = new Array(1_000_000).fill(0);
    const started = Date.now();
    expectRefused(packet, ['board.sensors', 'TOO_MANY']);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

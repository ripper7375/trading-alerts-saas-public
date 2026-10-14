/**
 * @jest-environment node
 */

import {
  CHART_DECISIONS,
  CONSENT_ACTIONS,
  CONTEXT_COMPONENTS,
  GATE_DIRECTION,
  GATE_OTHER_QUESTIONS,
  GATE_REPORT2,
  MODEL_CALL_OUTCOMES,
  MODEL_CALL_ROLES,
  NUMBER_CLASSES,
  REPLY_OUTCOMES,
  REPLY_SHAPES,
  REQUEST_KINDS,
  STAGE_NAME,
  TRACE_LIMITS,
  TRACE_TIERS,
  WORDING_CATEGORIES,
  validateReplyTrace,
  validateRiskGroup,
} from '@/lib/reply/contracts/trace-fields';

import {
  Any,
  clone,
  makeTrace,
  riskGroup,
  summary,
  withPath,
  without,
} from '../helpers/fixtures';

const codes = (value: unknown) => summary(validateReplyTrace(value));

describe('the trace of one answer', () => {
  it('accepts a full trace, with and without a risk group', () => {
    const trace = makeTrace();
    expect(validateReplyTrace(trace)).toEqual({ ok: true, value: trace });
    expect(validateReplyTrace(withPath(trace, 'risk', riskGroup())).ok).toBe(
      true
    );
  });

  it('has the seven groups of 7.4 and an outcome', () => {
    expect(Object.keys(makeTrace()).sort()).toEqual(
      [
        'checks',
        'data',
        'knowledge',
        'model',
        'outcome',
        'request',
        'risk',
        'time',
      ].sort()
    );
    for (const group of [
      'request',
      'data',
      'knowledge',
      'model',
      'checks',
      'risk',
      'time',
      'outcome',
    ]) {
      expect(codes(without(makeTrace(), group))).toEqual([`${group}:REQUIRED`]);
    }
  });

  it('refuses an unknown key in the trace and in every group, so no field can be added by accident', () => {
    expect(codes({ ...makeTrace(), question: 'is gold going up?' })).toEqual([
      'question:UNKNOWN_KEY',
    ]);
    for (const group of [
      'request',
      'data',
      'knowledge',
      'model',
      'checks',
      'time',
    ]) {
      expect(codes(withPath(makeTrace(), `${group}.question`, 'x'))).toEqual([
        `${group}.question:UNKNOWN_KEY`,
      ]);
    }
    expect(
      codes(withPath(makeTrace(), 'risk', { ...riskGroup(), note: 'x' }))
    ).toEqual(['risk.note:UNKNOWN_KEY']);
  });

  it.each([null, undefined, [], 'x', 4])(
    'refuses %j as a whole trace',
    (value) => {
      expect(codes(value)).toEqual([':WRONG_TYPE']);
    }
  );

  describe('the request group', () => {
    it('requires each field', () => {
      const keys = Object.keys(makeTrace().request);
      expect(keys).toHaveLength(11);
      for (const key of keys) {
        expect(codes(without(makeTrace(), `request.${key}`))).toEqual([
          `request.${key}:REQUIRED`,
        ]);
      }
    });

    it('takes the two tiers, the two kinds and the nine intents', () => {
      for (const tier of TRACE_TIERS)
        expect(codes(withPath(makeTrace(), 'request.tier', tier))).toEqual([]);
      expect(
        codes(withPath(makeTrace(), 'request.tier', 'ENTERPRISE'))
      ).toEqual(['request.tier:NOT_ONE_OF']);
      for (const kind of REQUEST_KINDS)
        expect(codes(withPath(makeTrace(), 'request.kind', kind))).toEqual([]);
      expect(codes(withPath(makeTrace(), 'request.kind', 'VOICE'))).toEqual([
        'request.kind:NOT_ONE_OF',
      ]);
      expect(
        codes(withPath(makeTrace(), 'request.intent', 'OUT_OF_SCOPE'))
      ).toEqual(['request.intent:NOT_ONE_OF']);
      expect(
        codes(withPath(makeTrace(), 'request.intent', 'INSTANT_M15_INSPECT'))
      ).toEqual([]);
    });

    it('takes ids, locales and a language family', () => {
      expect(
        codes(withPath(makeTrace(), 'request.request_id', 'has space'))
      ).toEqual(['request.request_id:BAD_FORMAT']);
      expect(
        codes(
          withPath(makeTrace(), 'request.client_request_id', 'x'.repeat(65))
        )
      ).toEqual(['request.client_request_id:BAD_FORMAT']);
      expect(codes(withPath(makeTrace(), 'request.thread_id', null))).toEqual(
        []
      );
      expect(
        codes(withPath(makeTrace(), 'request.reply_locale', 'xx'))
      ).toEqual(['request.reply_locale:NOT_ONE_OF']);
      expect(
        codes(withPath(makeTrace(), 'request.interface_locale', 'en'))
      ).toEqual(['request.interface_locale:NOT_ONE_OF']);
      for (const language of ['en', 'und', 'zh-TW', 'pt']) {
        expect(
          codes(withPath(makeTrace(), 'request.language', language))
        ).toEqual([]);
      }
      expect(
        codes(withPath(makeTrace(), 'request.language', 'English'))
      ).toEqual(['request.language:BAD_FORMAT']);
    });

    it('takes flags as codes, never text', () => {
      expect(
        codes(
          withPath(makeTrace(), 'request.question_flags', [
            'TERM_DROPPED',
            'AMBIGUOUS_NUMBER',
          ])
        )
      ).toEqual([]);
      expect(
        codes(
          withPath(makeTrace(), 'request.question_flags', ['is gold going up?'])
        )
      ).toEqual(['request.question_flags[0]:BAD_FORMAT']);
      expect(
        codes(
          withPath(
            makeTrace(),
            'request.question_flags',
            Array.from({ length: 9 }, (_, i) => `FLAG_${i}`)
          )
        )
      ).toEqual(['request.question_flags:TOO_MANY']);
    });
  });

  describe('the data group', () => {
    it('takes a cycle slot that is a real slot, or null', () => {
      expect(codes(withPath(makeTrace(), 'data.cycle_slot', null))).toEqual([]);
      expect(
        codes(withPath(makeTrace(), 'data.cycle_slot', '2026-09-18T20:56Z'))
      ).toEqual(['data.cycle_slot:BAD_FORMAT']);
      expect(
        codes(withPath(makeTrace(), 'data.last_price_bar', 'yesterday'))
      ).toEqual(['data.last_price_bar:BAD_FORMAT']);
    });

    it('takes the five data statuses and null, and the two flags', () => {
      for (const status of [
        'FRESH',
        'DELAYED',
        'STALE',
        'MARKET_CLOSED',
        'UNKNOWN',
        null,
      ]) {
        expect(
          codes(withPath(makeTrace(), 'data.data_status', status))
        ).toEqual([]);
      }
      expect(codes(withPath(makeTrace(), 'data.data_status', 'LATE'))).toEqual([
        'data.data_status:NOT_ONE_OF',
      ]);
      expect(
        codes(withPath(makeTrace(), 'data.flags', ['SENSORS_NOT_LIVE']))
      ).toEqual([]);
      expect(codes(withPath(makeTrace(), 'data.flags', ['OTHER']))).toEqual([
        'data.flags[0]:NOT_ONE_OF',
      ]);
    });

    it('takes the sensor statuses as a map from sensor id to a board status', () => {
      expect(codes(withPath(makeTrace(), 'data.sensor_statuses', {}))).toEqual(
        []
      );
      expect(
        codes(withPath(makeTrace(), 'data.sensor_statuses', { MCD1: 'ABSENT' }))
      ).toEqual([]);
      expect(
        codes(withPath(makeTrace(), 'data.sensor_statuses', { MCD0: 'VALID' }))
      ).toEqual(['data.sensor_statuses.MCD0:BAD_FORMAT']);
      expect(
        codes(withPath(makeTrace(), 'data.sensor_statuses', { MCD1: 'GOOD' }))
      ).toEqual(['data.sensor_statuses.MCD1:NOT_ONE_OF']);
      expect(codes(withPath(makeTrace(), 'data.sensor_statuses', []))).toEqual([
        'data.sensor_statuses:WRONG_TYPE',
      ]);
    });

    it('takes a rule id, a rules version and hashes, or null', () => {
      expect(
        codes(withPath(makeTrace(), 'data.synthesis_rule', 'NO_MATCH'))
      ).toEqual([]);
      expect(
        codes(withPath(makeTrace(), 'data.synthesis_rule', 'rule 1'))
      ).toEqual(['data.synthesis_rule:BAD_FORMAT']);
      expect(
        codes(withPath(makeTrace(), 'data.synthesis_rules_version', 'Draft 1'))
      ).toEqual(['data.synthesis_rules_version:BAD_FORMAT']);
      expect(codes(withPath(makeTrace(), 'data.packet_sha256', 'ABC'))).toEqual(
        ['data.packet_sha256:BAD_FORMAT']
      );
      expect(codes(withPath(makeTrace(), 'data.packet_sha256', null))).toEqual(
        []
      );
    });
  });

  describe('the knowledge group', () => {
    it('takes the chunk ids and the index build id', () => {
      expect(codes(withPath(makeTrace(), 'knowledge.chunk_ids', []))).toEqual(
        []
      );
      expect(
        codes(withPath(makeTrace(), 'knowledge.chunk_ids', ['has space']))
      ).toEqual(['knowledge.chunk_ids[0]:BAD_FORMAT']);
      expect(
        codes(
          withPath(
            makeTrace(),
            'knowledge.chunk_ids',
            Array.from({ length: 13 }, (_, i) => `D1-C${i}`)
          )
        )
      ).toEqual(['knowledge.chunk_ids:TOO_MANY']);
      expect(
        codes(withPath(makeTrace(), 'knowledge.index_build_id', 'kb-short'))
      ).toEqual(['knowledge.index_build_id:BAD_FORMAT']);
      expect(
        codes(withPath(makeTrace(), 'knowledge.index_build_id', null))
      ).toEqual([]);
      expect(
        codes(withPath(makeTrace(), 'knowledge.status', 'UNAVAILABLE'))
      ).toEqual([]);
      expect(
        codes(withPath(makeTrace(), 'knowledge.status', 'BROKEN'))
      ).toEqual(['knowledge.status:NOT_ONE_OF']);
    });

    it('records a miss without the question: the intent, M*, the locale, a count and the fingerprint', () => {
      const missed = {
        intent: 'EXPLAIN',
        m_star: ['MCD1'],
        reply_locale: 'de',
        chunk_count: 0,
        packet_sha256: 'e'.repeat(64),
      };
      expect(codes(withPath(makeTrace(), 'knowledge.missed', missed))).toEqual(
        []
      );
      for (const key of Object.keys(missed)) {
        expect(
          codes(withPath(makeTrace(), 'knowledge.missed', without(missed, key)))
        ).toEqual([`knowledge.missed.${key}:REQUIRED`]);
      }
      for (const key of [
        'question',
        'text',
        'english',
        'original',
        'query',
        'prompt',
      ]) {
        expect(
          codes(
            withPath(makeTrace(), 'knowledge.missed', {
              ...missed,
              [key]: 'is gold going up?',
            })
          )
        ).toEqual([`knowledge.missed.${key}:UNKNOWN_KEY`]);
      }
      expect(
        codes(
          withPath(makeTrace(), 'knowledge.missed', {
            ...missed,
            packet_sha256: 'short',
          })
        )
      ).toEqual(['knowledge.missed.packet_sha256:BAD_FORMAT']);
    });
  });

  describe('the model group', () => {
    it('counts all ten components of the prompt', () => {
      expect([...CONTEXT_COMPONENTS]).toHaveLength(10);
      for (const key of CONTEXT_COMPONENTS) {
        expect(codes(without(makeTrace(), `model.components.${key}`))).toEqual([
          `model.components.${key}:REQUIRED`,
        ]);
      }
      expect(codes(withPath(makeTrace(), 'model.components.OHLC', -1))).toEqual(
        ['model.components.OHLC:OUT_OF_RANGE']
      );
      expect(
        codes(withPath(makeTrace(), 'model.components.OHLC', 1.5))
      ).toEqual(['model.components.OHLC:WRONG_TYPE']);
      expect(codes(withPath(makeTrace(), 'model.components.EXTRA', 1))).toEqual(
        ['model.components.EXTRA:UNKNOWN_KEY']
      );
    });

    it('takes a model slug or none, and no free text', () => {
      expect(codes(withPath(makeTrace(), 'model.model', null))).toEqual([]);
      expect(
        codes(
          withPath(makeTrace(), 'model.model', 'anthropic/claude-sonnet:beta')
        )
      ).toEqual([]);
      expect(codes(withPath(makeTrace(), 'model.model', 'a model'))).toEqual([
        'model.model:BAD_FORMAT',
      ]);
    });

    it('takes the real token counts, or null for a count the provider did not give', () => {
      expect(
        codes(
          withPath(makeTrace(), 'model.tokens', {
            prompt: null,
            completion: null,
            cached: null,
          })
        )
      ).toEqual([]);
      expect(
        codes(
          withPath(makeTrace(), 'model.tokens.prompt', TRACE_LIMITS.tokens + 1)
        )
      ).toEqual(['model.tokens.prompt:OUT_OF_RANGE']);
    });

    it('records each call: role, outcome, attempts, tokens, cost in micro-dollars, latency', () => {
      expect([...MODEL_CALL_ROLES]).toEqual([
        'UNDERSTAND',
        'ANSWER',
        'REGENERATE',
        'FALLBACK',
      ]);
      expect([...MODEL_CALL_OUTCOMES]).toEqual([
        'OK',
        'TIMEOUT',
        'ERROR',
        'BAD_JSON',
        'BAD_SCHEMA',
      ]);
      const call = (patch: Record<string, unknown>) =>
        withPath(makeTrace(), 'model.calls[0]', {
          ...makeTrace().model.calls[0],
          ...patch,
        });
      expect(codes(call({ role: 'GUESS' }))).toEqual([
        'model.calls[0].role:NOT_ONE_OF',
      ]);
      expect(codes(call({ outcome: 'FINE' }))).toEqual([
        'model.calls[0].outcome:NOT_ONE_OF',
      ]);
      expect(codes(call({ attempts: 0 }))).toEqual([
        'model.calls[0].attempts:OUT_OF_RANGE',
      ]);
      expect(codes(call({ attempts: 6 }))).toEqual([
        'model.calls[0].attempts:OUT_OF_RANGE',
      ]);
      expect(codes(call({ cost_micro_usd: null }))).toEqual([]);
      expect(codes(call({ cost_micro_usd: -1 }))).toEqual([
        'model.calls[0].cost_micro_usd:OUT_OF_RANGE',
      ]);
      expect(codes(call({ cost_micro_usd: 0.5 }))).toEqual([
        'model.calls[0].cost_micro_usd:WRONG_TYPE',
      ]);
      expect(codes(call({ cost_estimated: 'no' }))).toEqual([
        'model.calls[0].cost_estimated:WRONG_TYPE',
      ]);
      expect(codes(call({ latency_ms: TRACE_LIMITS.ms + 1 }))).toEqual([
        'model.calls[0].latency_ms:OUT_OF_RANGE',
      ]);
      expect(codes(call({ extra: 1 }))).toEqual([
        'model.calls[0].extra:UNKNOWN_KEY',
      ]);
    });

    it('holds the calls to six', () => {
      const call = makeTrace().model.calls[1];
      const six = Array.from({ length: 6 }, () => call);
      const seven = Array.from({ length: 7 }, () => call);
      expect(
        codes(
          withPath(
            withPath(makeTrace(), 'model.calls', six),
            'checks.regenerations',
            0
          )
        )
      ).toEqual([]);
      expect(
        codes(
          withPath(
            withPath(makeTrace(), 'model.calls', seven),
            'checks.regenerations',
            0
          )
        )
      ).toEqual(['model.calls:TOO_MANY']);
    });

    it('holds the units to a 32-bit count', () => {
      expect(
        codes(withPath(makeTrace(), 'model.units_charged', TRACE_LIMITS.units))
      ).toEqual([]);
      expect(
        codes(
          withPath(makeTrace(), 'model.units_charged', TRACE_LIMITS.units + 1)
        )
      ).toEqual(['model.units_charged:OUT_OF_RANGE']);
      expect(codes(withPath(makeTrace(), 'model.units_charged', -1))).toEqual([
        'model.units_charged:OUT_OF_RANGE',
      ]);
      expect(
        codes(withPath(makeTrace(), 'model.cost_micro_usd', null))
      ).toEqual([]);
    });
  });

  describe('the checks group', () => {
    it('records what the answer gate decided, from the table of 5.3', () => {
      expect([...GATE_DIRECTION]).toEqual([
        'YES',
        'DELAYED',
        'NO',
        'LAST_SESSION',
      ]);
      expect([...GATE_OTHER_QUESTIONS]).toEqual(['ALL', 'EXPLAIN_AND_GENERAL']);
      expect([...GATE_REPORT2]).toEqual([
        'ALLOWED',
        'ALLOWED_DELAY_STATED',
        'BLOCKED',
        'HALF_RISK_PRESET',
      ]);
      expect(CHART_DECISIONS).toContain('CYCLE_MISMATCH');
      expect(codes(withPath(makeTrace(), 'checks.answer_gate', null))).toEqual(
        []
      );
      expect(
        codes(withPath(makeTrace(), 'checks.answer_gate.chart', 'MAYBE'))
      ).toEqual(['checks.answer_gate.chart:NOT_ONE_OF']);
      expect(
        codes(withPath(makeTrace(), 'checks.answer_gate.report2', 'OPEN'))
      ).toEqual(['checks.answer_gate.report2:NOT_ONE_OF']);
      expect(
        codes(withPath(makeTrace(), 'checks.answer_gate.direction', 'MAYBE'))
      ).toEqual(['checks.answer_gate.direction:NOT_ONE_OF']);
      expect(
        codes(
          withPath(makeTrace(), 'checks.answer_gate.other_questions', 'SOME')
        )
      ).toEqual(['checks.answer_gate.other_questions:NOT_ONE_OF']);
    });

    it('takes the shape and at most two schema retries', () => {
      for (const shape of REPLY_SHAPES)
        expect(codes(withPath(makeTrace(), 'checks.shape', shape))).toEqual(
          shape === 'REPORT1' ? [] : ['checks.shape:INCONSISTENT']
        );
      expect(codes(withPath(makeTrace(), 'checks.schema_retries', 2))).toEqual(
        []
      );
      expect(codes(withPath(makeTrace(), 'checks.schema_retries', 3))).toEqual([
        'checks.schema_retries:OUT_OF_RANGE',
      ]);
    });

    it('has the violations of each class and each category add up to the count', () => {
      expect([...NUMBER_CLASSES]).toEqual([
        'PRICE',
        'DISTANCE',
        'PCT',
        'RATIO',
        'TIME',
        'COUNT',
      ]);
      expect([...WORDING_CATEGORIES]).toEqual([
        'ADVICE',
        'PROBABILITY',
        'GUARANTEE',
        'URGENCY',
        'UNLISTED_NEWS',
        'DIRECTION_WORD',
      ]);
      expect(
        codes(withPath(makeTrace(), 'checks.numbers.violations', 2))
      ).toEqual(['checks.numbers.classes:INCONSISTENT']);
      expect(
        codes(withPath(makeTrace(), 'checks.wording.violations', 1))
      ).toEqual(['checks.wording.categories:INCONSISTENT']);
      const t = withPath(
        withPath(makeTrace(), 'checks.wording.violations', 2),
        'checks.wording.categories',
        {
          ADVICE: 1,
          PROBABILITY: 0,
          GUARANTEE: 0,
          URGENCY: 1,
          UNLISTED_NEWS: 0,
          DIRECTION_WORD: 0,
        }
      );
      expect(codes(t)).toEqual([]);
      for (const key of NUMBER_CLASSES) {
        expect(
          codes(without(makeTrace(), `checks.numbers.classes.${key}`))
        ).toEqual([`checks.numbers.classes.${key}:REQUIRED`]);
      }
      for (const key of WORDING_CATEGORIES) {
        expect(
          codes(without(makeTrace(), `checks.wording.categories.${key}`))
        ).toEqual([`checks.wording.categories.${key}:REQUIRED`]);
      }
    });

    it('has one regeneration at most, and as many regeneration calls as it says', () => {
      expect(codes(withPath(makeTrace(), 'checks.regenerations', 2))).toEqual(
        expect.arrayContaining(['checks.regenerations:OUT_OF_RANGE'])
      );
      expect(codes(withPath(makeTrace(), 'checks.regenerations', 0))).toEqual([
        'checks.regenerations:INCONSISTENT',
      ]);
      const noRegeneration = withPath(
        withPath(
          makeTrace(),
          'model.calls',
          makeTrace().model.calls.slice(0, 2)
        ),
        'checks.regenerations',
        0
      );
      expect(codes(noRegeneration)).toEqual([]);
      expect(
        codes(withPath(noRegeneration, 'checks.regenerations', 1))
      ).toEqual(['checks.regenerations:INCONSISTENT']);
    });

    it('says whether direction equalled the synthesis, or that there was none', () => {
      for (const value of [true, false, null]) {
        expect(
          codes(withPath(makeTrace(), 'checks.direction_equals_syn', value))
        ).toEqual([]);
      }
      expect(
        codes(withPath(makeTrace(), 'checks.direction_equals_syn', 'yes'))
      ).toEqual(['checks.direction_equals_syn:WRONG_TYPE']);
    });

    it('names a fixed answer reason from the result contract', () => {
      expect(
        codes(withPath(makeTrace(), 'checks.fixed_reason', 'DEADLINE'))
      ).toEqual([]);
      expect(
        codes(withPath(makeTrace(), 'checks.fixed_reason', 'BORED'))
      ).toEqual(['checks.fixed_reason:NOT_ONE_OF']);
    });
  });

  describe('the risk group', () => {
    it('is attached later and has its own contract', () => {
      expect(validateRiskGroup(riskGroup())).toEqual({
        ok: true,
        value: riskGroup(),
      });
      expect([...CONSENT_ACTIONS]).toEqual(['ACCEPT', 'MODIFY', 'DECLINE']);
      const risk = (patch: Record<string, unknown>) =>
        summary(validateRiskGroup({ ...riskGroup(), ...patch }));
      expect(risk({ consent_action: null })).toEqual([]);
      expect(risk({ consent_action: 'IGNORE' })).toEqual([
        'consent_action:NOT_ONE_OF',
      ]);
      expect(risk({ setup_sha256: null })).toEqual([]);
      expect(risk({ setup_sha256: 'xyz' })).toEqual([
        'setup_sha256:BAD_FORMAT',
      ]);
      expect(risk({ profile_snapshot_id: 'has space' })).toEqual([
        'profile_snapshot_id:BAD_FORMAT',
      ]);
      expect(risk({ validator_results: [{ code: 'risk', ok: true }] })).toEqual(
        ['validator_results[0].code:BAD_FORMAT']
      );
      expect(
        risk({ validator_results: [{ code: 'RISK', ok: 'yes' }] })
      ).toEqual(['validator_results[0].ok:WRONG_TYPE']);
      expect(
        risk({
          validator_results: Array.from({ length: 17 }, () => ({
            code: 'RISK',
            ok: true,
          })),
        })
      ).toEqual(['validator_results:TOO_MANY']);
      expect(risk({ overrides: ['DEFECT_FLAG', 'DEFECT_FLAG'] })).toEqual([
        'overrides[1]:DUPLICATE',
      ]);
      expect(summary(validateRiskGroup(null))).toEqual([':WRONG_TYPE']);
      expect(summary(validateRiskGroup({}))).toEqual(
        Object.keys(riskGroup())
          .map((k) => `${k}:REQUIRED`)
          .sort()
      );
    });
  });

  describe('the time group', () => {
    it('takes the start as ISO time, the total, the deadline flag and named stages', () => {
      expect(
        codes(withPath(makeTrace(), 'time.started_at', '2026-09-18T21:00:12Z'))
      ).toEqual([]);
      expect(codes(withPath(makeTrace(), 'time.started_at', 'Friday'))).toEqual(
        ['time.started_at:BAD_FORMAT']
      );
      expect(
        codes(withPath(makeTrace(), 'time.total_ms', TRACE_LIMITS.ms))
      ).toEqual([]);
      expect(
        codes(withPath(makeTrace(), 'time.total_ms', TRACE_LIMITS.ms + 1))
      ).toEqual(['time.total_ms:OUT_OF_RANGE']);
      expect(codes(withPath(makeTrace(), 'time.deadline_hit', 'no'))).toEqual([
        'time.deadline_hit:WRONG_TYPE',
      ]);
      expect(codes(withPath(makeTrace(), 'time.stages', []))).toEqual([]);
      expect(
        codes(
          withPath(makeTrace(), 'time.stages', [{ name: 'compose', ms: 1 }])
        )
      ).toEqual(['time.stages[0].name:BAD_FORMAT']);
      expect(
        codes(
          withPath(makeTrace(), 'time.stages', [{ name: 'COMPOSE', ms: -1 }])
        )
      ).toEqual(['time.stages[0].ms:OUT_OF_RANGE']);
      expect(
        codes(
          withPath(
            makeTrace(),
            'time.stages',
            Array.from({ length: 25 }, () => ({ name: 'COMPOSE', ms: 1 }))
          )
        )
      ).toEqual(['time.stages:TOO_MANY']);
    });
  });

  describe('the outcome', () => {
    it('is one of six', () => {
      expect([...REPLY_OUTCOMES]).toEqual([
        'REPORT1',
        'ANSWER',
        'FIXED_ANSWER',
        'OPEN_TRADE_SETUP',
        'REFUSED',
        'ERROR',
      ]);
      expect(codes({ ...makeTrace(), outcome: 'SUCCESS' })).toEqual([
        'outcome:NOT_ONE_OF',
      ]);
    });

    it('a REPORT1 was made as a REPORT1 and an ANSWER as an ANSWER; a fixed answer may follow either', () => {
      expect(codes({ ...makeTrace(), outcome: 'ANSWER' })).toEqual([
        'checks.shape:INCONSISTENT',
      ]);
      const answered = withPath(makeTrace(), 'checks.shape', 'ANSWER');
      expect(codes({ ...answered, outcome: 'ANSWER' })).toEqual([]);
      expect(codes({ ...answered, outcome: 'REPORT1' })).toEqual([
        'checks.shape:INCONSISTENT',
      ]);
      expect(codes({ ...makeTrace(), outcome: 'FIXED_ANSWER' })).toEqual([]);
      expect(codes({ ...answered, outcome: 'FIXED_ANSWER' })).toEqual([]);
      expect(codes({ ...makeTrace(), outcome: 'REFUSED' })).toEqual([]);
    });
  });

  it('does not change what it is given', () => {
    const trace = makeTrace();
    const before = JSON.stringify(trace);
    validateReplyTrace(trace);
    validateReplyTrace(withPath(trace, 'request.tier', 'X'));
    expect(JSON.stringify(trace)).toBe(before);
    expect((clone(trace) as Any).outcome).toBe('REPORT1');
  });
});

describe('the lists and the limits are what the contract says', () => {
  it('pins the limits on a trace', () => {
    expect(TRACE_LIMITS).toEqual({
      questionFlags: 8,
      sensors: 16,
      chunks: 12,
      calls: 6,
      stages: 24,
      validatorResults: 16,
      overrides: 8,
      units: 2147483647,
      count: 100000,
      tokens: 2000000,
      ms: 3600000,
    });
  });

  it('pins the closed lists', () => {
    expect([...REQUEST_KINDS]).toEqual(['TYPED', 'INSTANT']);
    expect([...REPLY_SHAPES]).toEqual(['REPORT1', 'ANSWER', 'NONE']);
    expect([...CHART_DECISIONS]).toEqual([
      'SENT',
      'NO_VISION',
      'TIER',
      'CYCLE_MISMATCH',
      'NOT_CALLED_FOR',
      'MISSING',
      'DATA_STATUS',
    ]);
    expect([...GATE_DIRECTION]).toEqual([
      'YES',
      'DELAYED',
      'NO',
      'LAST_SESSION',
    ]);
    expect([...GATE_OTHER_QUESTIONS]).toEqual(['ALL', 'EXPLAIN_AND_GENERAL']);
    expect([...GATE_REPORT2]).toEqual([
      'ALLOWED',
      'ALLOWED_DELAY_STATED',
      'BLOCKED',
      'HALF_RISK_PRESET',
    ]);
    expect([...CONSENT_ACTIONS]).toEqual(['ACCEPT', 'MODIFY', 'DECLINE']);
  });

  it.each([
    ['request.kind', REQUEST_KINDS],
    ['checks.shape', REPLY_SHAPES],
    ['checks.answer_gate.chart', CHART_DECISIONS],
    ['checks.answer_gate.direction', GATE_DIRECTION],
    ['checks.answer_gate.other_questions', GATE_OTHER_QUESTIONS],
    ['checks.answer_gate.report2', GATE_REPORT2],
  ] as const)('%s takes each word of its list and no other', (path, words) => {
    for (const word of words) {
      // a word the rest of the trace does not contradict: the shape fixes the outcome
      const trace =
        path === 'checks.shape'
          ? { ...withPath(makeTrace(), path, word), outcome: 'FIXED_ANSWER' }
          : withPath(makeTrace(), path, word);
      expect(codes(trace)).toEqual([]);
    }
    expect(codes(withPath(makeTrace(), path, 'OTHER'))).toEqual([
      `${path}:NOT_ONE_OF`,
    ]);
  });

  it('takes a consent action in the risk group, and no other', () => {
    for (const action of CONSENT_ACTIONS) {
      expect(
        validateRiskGroup({ ...riskGroup(), consent_action: action }).ok
      ).toBe(true);
    }
  });
});

describe('a field that may be null, one at a time', () => {
  it.each([
    'request.thread_id',
    'data.cycle_slot',
    'data.data_status',
    'data.synthesis_rule',
    'data.synthesis_rules_version',
    'data.last_price_bar',
    'data.intake_version',
    'data.routing_version',
    'data.packet_sha256',
    'knowledge.index_build_id',
    'knowledge.status',
    'knowledge.missed',
    'model.model',
    'model.prompt_version',
    'model.cycle_block_sha256',
    'model.cost_micro_usd',
    'model.tokens.prompt',
    'model.tokens.completion',
    'model.tokens.cached',
    'model.calls[0].tokens_cached',
    'model.calls[0].cost_micro_usd',
    'checks.answer_gate',
    'checks.direction_equals_syn',
    'checks.fixed_reason',
    'risk',
  ])('%s', (path) => {
    expect(codes(withPath(makeTrace(), path, null))).toEqual([]);
  });

  it.each(['setup_sha256', 'profile_snapshot_id', 'consent_action'])(
    'risk.%s',
    (key) => {
      expect(validateRiskGroup({ ...riskGroup(), [key]: null }).ok).toBe(true);
    }
  );
});

describe('the shape of a few text fields, at their edges', () => {
  const at = (path: string, value: unknown) =>
    codes(withPath(makeTrace(), path, value));

  it('the language is two or three lower-case letters, then an optional region', () => {
    for (const language of ['en', 'eng', 'en-US', 'eng-GB']) {
      expect(at('request.language', language)).toEqual([]);
    }
    for (const language of [
      'e',
      'engl',
      'en-us',
      'en-USA',
      'EN',
      'en_US',
      'en-US\n',
      ' en',
    ]) {
      expect(at('request.language', language)).toEqual([
        'request.language:BAD_FORMAT',
      ]);
    }
  });

  it('a chunk id is 1 to 96 characters that start with a letter or a digit', () => {
    const ids = (id: string) => at('knowledge.chunk_ids', [id]);
    expect(ids('a')).toEqual([]);
    expect(ids('a'.repeat(96))).toEqual([]);
    for (const id of ['a'.repeat(97), '.a', '-a', 'a b', 'a\n', ' a']) {
      expect(ids(id)).toEqual(['knowledge.chunk_ids[0]:BAD_FORMAT']);
    }
  });

  it('an index build id is kb- and 32 lower-case hex digits, nothing around it', () => {
    const build = (value: string) => at('knowledge.index_build_id', value);
    expect(build(`kb-${'0'.repeat(32)}`)).toEqual([]);
    for (const value of [
      `kb-${'0'.repeat(31)}`,
      `kb-${'0'.repeat(33)}`,
      `kb-${'A'.repeat(32)}`,
      `xkb-${'0'.repeat(32)}`,
      `kb-${'0'.repeat(32)}\n`,
      `KB-${'0'.repeat(32)}`,
    ]) {
      expect(build(value)).toEqual(['knowledge.index_build_id:BAD_FORMAT']);
    }
  });

  it('the rules version is at most 40 characters', () => {
    expect(at('data.synthesis_rules_version', 'a'.repeat(40))).toEqual([]);
    expect(at('data.synthesis_rules_version', 'a'.repeat(41))).toEqual([
      'data.synthesis_rules_version:TOO_LONG',
    ]);
  });

  it('a stage name is 2 to 24 capital letters and underscores', () => {
    expect(STAGE_NAME.source).toBe('^[A-Z][A-Z_]{1,23}$');
    for (const name of ['AB', 'GATE', 'A_B', `A${'B'.repeat(23)}`]) {
      expect(STAGE_NAME.test(name)).toBe(true);
      expect(at('time.stages[0].name', name)).toEqual([]);
    }
    for (const name of [
      'A',
      '',
      `A${'B'.repeat(24)}`,
      'gate',
      'Gate',
      'G8TE',
      '_GATE',
      'GATE\n',
      ' GATE',
      'GA TE',
    ]) {
      expect(STAGE_NAME.test(name)).toBe(false);
    }
    expect(at('time.stages[0].name', 'gate')).toEqual([
      'time.stages[0].name:BAD_FORMAT',
    ]);
  });

  it('names the flags it knows when it refuses one', () => {
    const result = validateReplyTrace(
      withPath(makeTrace(), 'data.flags', ['X'])
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.issues[0]).toMatchObject({
      path: 'data.flags[0]',
      code: 'NOT_ONE_OF',
      message: 'must be one of SENSORS_NOT_LIVE, GATEWAY_UNREACHABLE',
    });
  });
});

describe('how big a number of the trace may be', () => {
  const at = (path: string, value: unknown) =>
    codes(withPath(makeTrace(), path, value));

  it('a count goes to 100000', () => {
    expect(at('checks.numbers.extracted', 100000)).toEqual([]);
    expect(at('checks.numbers.extracted', 100001)).toEqual([
      'checks.numbers.extracted:OUT_OF_RANGE',
    ]);
  });

  it('a token count goes to 2000000', () => {
    expect(at('model.tokens.prompt', 2000000)).toEqual([]);
    expect(at('model.tokens.prompt', 2000001)).toEqual([
      'model.tokens.prompt:OUT_OF_RANGE',
    ]);
  });

  it('a time goes to an hour in milliseconds', () => {
    expect(at('time.total_ms', 3600000)).toEqual([]);
    expect(at('time.total_ms', 3600001)).toEqual([
      'time.total_ms:OUT_OF_RANGE',
    ]);
  });

  it('a call is made from 1 to 5 times', () => {
    expect(at('model.calls[0].attempts', 5)).toEqual([]);
    expect(at('model.calls[0].attempts', 6)).toEqual([
      'model.calls[0].attempts:OUT_OF_RANGE',
    ]);
    expect(at('model.calls[0].attempts', 0)).toEqual([
      'model.calls[0].attempts:OUT_OF_RANGE',
    ]);
  });
});

describe('a missed-knowledge record names the locale it was missed in', () => {
  const missed = {
    intent: 'EXPLAIN',
    m_star: ['MCD1'],
    reply_locale: 'de',
    chunk_count: 0,
    packet_sha256: 'e'.repeat(64),
  };
  it.each(['xx', 'DE', 'de_DE', '', 4, null])(
    'refuses %j as the locale',
    (locale) => {
      expect(
        codes(
          withPath(makeTrace(), 'knowledge.missed', {
            ...missed,
            reply_locale: locale,
          })
        )
      ).toEqual(['knowledge.missed.reply_locale:NOT_ONE_OF']);
    }
  );
});

/**
 * @jest-environment node
 */

import { createHash } from 'crypto';

import { buildRefusal } from '@/lib/intake';
import { canonicalJson } from '@/lib/reply/contracts/intake';
import { hashTraceUser } from '@/lib/platform/traces/hash';
import type { AuditKey } from '@/lib/platform/traces/hash';
import { attachRisk, readTrace, writeTrace } from '@/lib/platform/traces/store';
import type { Delivered } from '@/lib/platform/delivered';
import type { ReplyTrace } from '@/lib/reply/contracts/trace-fields';

import {
  OTHER_USER_ID,
  REQUEST_ID,
  SLOT_SECONDS,
  THREAD_ID,
  USER_ID,
  actionResult,
  answerResult,
  clone,
  fixedResult,
  makeTrace,
  REPORT2_TEXT,
  report2,
  sha256 as sha,
  reportResult,
  riskGroup,
  withPath,
} from '../../reply/helpers/fixtures';
import { FakeTraceClient } from '../helpers/fakes';

// the stores import the database client at load time; these tests pass their own
jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));

const KEY: AuditKey = { key: 'k'.repeat(48), version: 3, source: 'ENV' };

const write = (
  fake: FakeTraceClient,
  over: { trace?: ReplyTrace; reply?: Delivered | null; userId?: string } = {}
) =>
  writeTrace(
    {
      userId: over.userId ?? USER_ID,
      trace: over.trace ?? makeTrace(),
      reply: over.reply === undefined ? reportResult() : over.reply,
    },
    { client: fake, key: KEY }
  );

describe('writeTrace: the row it writes', () => {
  it('writes one row, with the filter columns copied from the groups', async () => {
    const fake = new FakeTraceClient();
    const trace = makeTrace();
    const result = await write(fake);
    expect(result).toEqual({
      ok: true,
      requestId: REQUEST_ID,
      replySha256: sha(canonicalJson(reportResult())),
    });
    expect(fake.calls.create).toHaveLength(1);
    const row = fake.calls.create[0]!;
    expect(row).toMatchObject({
      request_id: REQUEST_ID,
      client_request_id: trace.request.client_request_id,
      user_id: USER_ID,
      thread_id: THREAD_ID,
      tier: 'PRO',
      locale: 'en-US',
      intent: 'DIRECTION',
      cycle_slot: SLOT_SECONDS,
      data_status: 'FRESH',
      model: 'google/gemini-2.5-flash',
      units_charged: 4620,
      regenerations: 1,
      number_violations: 1,
      wording_violations: 0,
      outcome: 'REPORT1',
      total_ms: 12400,
      consent_action: null,
    });
    expect(row.request_group).toEqual(trace.request);
    expect(row.data_group).toEqual(trace.data);
    expect(row.knowledge_group).toEqual(trace.knowledge);
    expect(row.model_group).toEqual(trace.model);
    expect(row.checks_group).toEqual(trace.checks);
    expect(row.time_group).toEqual(trace.time);
  });

  it('hashes the user id with the key and its version, and writes the id beside the hash', async () => {
    const fake = new FakeTraceClient();
    await write(fake);
    const row = fake.calls.create[0]!;
    expect({ hash: row.user_id_hash, keyVersion: row.key_version }).toEqual(
      hashTraceUser(USER_ID, KEY)
    );
    expect(row.key_version).toBe(3);
    expect(row.user_id).toBe(USER_ID);
  });

  it('stores the reply as the exact canonical JSON that it hashed', async () => {
    const fake = new FakeTraceClient();
    await write(fake);
    const row = fake.calls.create[0]!;
    expect(row.reply_json).toBe(canonicalJson(reportResult()));
    expect(row.reply_sha256).toBe(sha(row.reply_json as string));
    expect(JSON.parse(row.reply_json as string)).toEqual(reportResult());
  });

  it('leaves the risk group out (not null) when there is none, and writes it with its consent action when there is', async () => {
    const fake = new FakeTraceClient();
    await write(fake);
    expect('risk_group' in fake.calls.create[0]!).toBe(false);
    const withRisk = new FakeTraceClient();
    await write(withRisk, {
      trace: withPath(makeTrace(), 'risk', riskGroup()),
    });
    expect(withRisk.calls.create[0]!.risk_group).toEqual(riskGroup());
    expect(withRisk.calls.create[0]!.consent_action).toBe('ACCEPT');
  });

  it('writes a null cycle slot and null model for a trace that had none', async () => {
    const fake = new FakeTraceClient();
    const trace = withPath(
      withPath(makeTrace(), 'data.cycle_slot', null),
      'model.model',
      null
    );
    await write(fake, { trace });
    expect(fake.calls.create[0]).toMatchObject({
      cycle_slot: null,
      model: null,
    });
  });

  it.each([
    ['REPORT1', reportResult(), 'DIRECTION'],
    ['ANSWER', answerResult(), 'EXPLAIN'],
    ['FIXED_ANSWER', fixedResult(), 'DIRECTION'],
    ['OPEN_TRADE_SETUP', actionResult(), 'REPORT_2'],
  ] as const)(
    'writes a %s outcome with its reply',
    async (outcome, reply, intent) => {
      const fake = new FakeTraceClient();
      let trace = withPath(
        withPath(makeTrace(), 'outcome', outcome),
        'request.intent',
        intent
      );
      if (outcome === 'ANSWER')
        trace = withPath(trace, 'checks.shape', 'ANSWER');
      const result = await write(fake, { trace, reply });
      expect(result.ok).toBe(true);
      expect(fake.calls.create[0]!.outcome).toBe(outcome);
      expect(fake.calls.create[0]!.intent).toBe(intent);
    }
  );

  it('writes a REFUSED outcome with the refusal the trader read', async () => {
    const fake = new FakeTraceClient();
    const refusal = buildRefusal(
      'QUOTA_INSUFFICIENT',
      'en-US',
      'Your monthly allowance is used up.'
    );
    const result = await write(fake, {
      trace: withPath(makeTrace(), 'outcome', 'REFUSED'),
      reply: refusal,
    });
    expect(result.ok).toBe(true);
    expect(JSON.parse(fake.calls.create[0]!.reply_json as string)).toEqual(
      refusal
    );
  });

  it('writes an ERROR outcome with no reply, and nothing else', async () => {
    const fake = new FakeTraceClient();
    const result = await write(fake, {
      trace: withPath(makeTrace(), 'outcome', 'ERROR'),
      reply: null,
    });
    expect(result).toEqual({
      ok: true,
      requestId: REQUEST_ID,
      replySha256: null,
    });
    expect(fake.calls.create[0]).toMatchObject({
      reply_json: null,
      reply_sha256: null,
      outcome: 'ERROR',
    });
  });

  it('writes the same twice for the same input', async () => {
    const a = new FakeTraceClient();
    const b = new FakeTraceClient();
    await write(a);
    await write(b);
    expect(a.calls.create).toEqual(b.calls.create);
  });
});

describe('writeTrace: what it refuses (and writes nothing)', () => {
  const refused = async (over: Parameters<typeof write>[1], code: string) => {
    const fake = new FakeTraceClient();
    const result = await write(fake, over);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe(code);
    expect(fake.calls.create).toEqual([]);
    return result;
  };

  it('no user', async () => {
    await refused({ userId: '' }, 'MISSING_USER');
    const fake = new FakeTraceClient();
    const result = await writeTrace(
      {
        userId: undefined as unknown as string,
        trace: makeTrace(),
        reply: reportResult(),
      },
      { client: fake, key: KEY }
    );
    expect(result).toMatchObject({ ok: false, code: 'MISSING_USER' });
    expect(fake.calls.create).toEqual([]);
  });

  it('a trace that fails its contract, with the issues', async () => {
    const result = await refused(
      { trace: withPath(makeTrace(), 'request.tier', 'GOLD') },
      'INVALID_TRACE'
    );
    if (!result.ok)
      expect(result.issues.map((i) => i.path)).toEqual(['request.tier']);
    await refused(
      {
        trace: {
          ...makeTrace(),
          question: 'is gold going up?',
        } as unknown as ReplyTrace,
      },
      'INVALID_TRACE'
    );
  });

  it('a field called like the equity or the commission, named as a privacy incident and not as an unknown key', async () => {
    const trace = withPath(makeTrace(), 'model.equity', 10000);
    const result = await refused({ trace }, 'FORBIDDEN_KEY');
    if (!result.ok)
      expect(result.issues.map((i) => i.path)).toEqual(['model.equity']);
    await refused(
      { trace: withPath(makeTrace(), 'time.account_commission', 4) },
      'FORBIDDEN_KEY'
    );
  });

  it('a reply that fails its contract', async () => {
    await refused(
      { reply: { ...reportResult(), extra: 1 } as unknown as Delivered },
      'INVALID_REPLY'
    );
    await refused({ reply: 'text' as unknown as Delivered }, 'INVALID_REPLY');
  });

  it('a reply with the equity or the commission in a key', async () => {
    const reply = withPath(
      reportResult(),
      'report.zones[0].equity',
      1
    ) as unknown as Delivered;
    await refused({ reply }, 'FORBIDDEN_KEY');
  });

  it('a reply that is not the kind the outcome says', async () => {
    await refused({ reply: fixedResult() }, 'REPLY_MISMATCH');
    await refused(
      {
        trace: withPath(makeTrace(), 'outcome', 'FIXED_ANSWER'),
        reply: reportResult(),
      },
      'REPLY_MISMATCH'
    );
    const refusal = buildRefusal('QUOTA_INSUFFICIENT', 'en-US', 'Used up.');
    await refused({ reply: refusal }, 'REPLY_MISMATCH');
  });

  it('a reply for another intent or another locale than the trace says', async () => {
    await refused(
      { reply: withPath(reportResult(), 'intent', 'NEWS') },
      'REPLY_MISMATCH'
    );
    await refused({ reply: answerResult() }, 'REPLY_MISMATCH');
    await refused(
      { reply: withPath(reportResult(), 'reply_locale', 'de') },
      'REPLY_MISMATCH'
    );
    const refusal = buildRefusal('QUOTA_INSUFFICIENT', 'de', 'Aufgebraucht.');
    await refused(
      { trace: withPath(makeTrace(), 'outcome', 'REFUSED'), reply: refusal },
      'REPLY_MISMATCH'
    );
  });

  it('a reply for another request or another thread', async () => {
    await refused(
      {
        reply: withPath(
          reportResult(),
          'provenance.request_id',
          'req-other-0002'
        ),
      },
      'REPLY_MISMATCH'
    );
    await refused(
      {
        reply: withPath(
          reportResult(),
          'thread_id',
          'cm0thread000000000000000999'
        ),
      },
      'REPLY_MISMATCH'
    );
  });

  it('a missing reply, or a reply on an ERROR', async () => {
    await refused({ reply: null }, 'REPLY_MISMATCH');
    await refused(
      {
        trace: withPath(makeTrace(), 'outcome', 'ERROR'),
        reply: reportResult(),
      },
      'REPLY_MISMATCH'
    );
  });

  it('the user id inside a group or the reply: it lives in its own column', async () => {
    await refused(
      {
        trace: withPath(
          makeTrace(),
          'request.client_request_id',
          `${USER_ID}-x`
        ),
      },
      'USER_ID_IN_TRACE'
    );
    await refused(
      { reply: withPath(reportResult(), 'report.headline', `for ${USER_ID}`) },
      'USER_ID_IN_TRACE'
    );
  });
});

describe('writeTrace: the key and the database', () => {
  it('throws when there is no key to hash with (outside a test), never writes without one', async () => {
    const fake = new FakeTraceClient();
    const original = process.env['NODE_ENV'];
    const env = process.env as Record<string, string | undefined>;
    const savedKey = env['ENGINE4_AUDIT_HMAC_KEY'];
    try {
      env['NODE_ENV'] = 'production';
      delete env['ENGINE4_AUDIT_HMAC_KEY'];
      await expect(
        writeTrace(
          { userId: USER_ID, trace: makeTrace(), reply: reportResult() },
          { client: fake }
        )
      ).rejects.toMatchObject({ name: 'AuditKeyError', code: 'MISSING' });
    } finally {
      env['NODE_ENV'] = original;
      if (savedKey !== undefined) env['ENGINE4_AUDIT_HMAC_KEY'] = savedKey;
    }
    expect(fake.calls.create).toEqual([]);
  });

  it('lets a database error through (a repeated client request id is a unique violation)', async () => {
    const fake = new FakeTraceClient();
    await write(fake);
    const again = withPath(
      makeTrace(),
      'request.request_id',
      'req-7f3a9c1e-0002'
    );
    await expect(
      writeTrace(
        {
          userId: USER_ID,
          trace: withPath(again, 'request.request_id', 'req-7f3a9c1e-0002'),
          reply: withPath(
            reportResult(),
            'provenance.request_id',
            'req-7f3a9c1e-0002'
          ),
        },
        { client: fake, key: KEY }
      )
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});

describe('attachRisk', () => {
  async function written(): Promise<FakeTraceClient> {
    const fake = new FakeTraceClient();
    await write(fake);
    return fake;
  }

  const attach = (
    fake: FakeTraceClient,
    over: Partial<Parameters<typeof attachRisk>[0]> = {}
  ) =>
    attachRisk(
      {
        userId: USER_ID,
        requestId: REQUEST_ID,
        risk: riskGroup(),
        report2Json: REPORT2_TEXT,
        ...over,
      },
      { client: fake }
    );

  it('attaches the risk group, Report 2 as the exact text with its hash, and the consent action', async () => {
    const fake = await written();
    const result = await attach(fake);
    expect(result).toEqual({ ok: true, report2Sha256: sha(REPORT2_TEXT) });
    const row = await readTrace(REQUEST_ID, { client: fake });
    expect(row).toMatchObject({
      risk_group: riskGroup(),
      report2_json: REPORT2_TEXT,
      report2_sha256: sha(REPORT2_TEXT),
      consent_action: 'ACCEPT',
    });
  });

  it('keeps the text it is given byte for byte (it is the text the consent record hashes), not a re-serialisation', async () => {
    const fake = await written();
    const spaced = `${JSON.stringify(report2(), null, 2)}`;
    expect(spaced).not.toBe(REPORT2_TEXT);
    const result = await attach(fake, {
      report2Json: spaced,
      risk: riskGroup(spaced),
    });
    expect(result).toEqual({ ok: true, report2Sha256: sha(spaced) });
    expect(fake.rows.get(REQUEST_ID)?.report2_json).toBe(spaced);
  });

  it('finds the row by the request AND the user, and changes only the four columns the database allows', async () => {
    const fake = await written();
    await attach(fake);
    const call = fake.calls.updateMany[0]!;
    expect(call.where).toEqual({ request_id: REQUEST_ID, user_id: USER_ID });
    expect(Object.keys(call.data).sort()).toEqual([
      'consent_action',
      'report2_json',
      'report2_sha256',
      'risk_group',
    ]);
  });

  it('may attach the risk group alone, without Report 2, whatever hash the group names', async () => {
    const fake = await written();
    const result = await attach(fake, { report2Json: null });
    expect(result).toEqual({ ok: true, report2Sha256: null });
    expect(fake.rows.get(REQUEST_ID)).toMatchObject({
      report2_json: null,
      report2_sha256: null,
    });
    expect(
      (
        await attach(fake, {
          report2Json: null,
          risk: { ...riskGroup(), setup_sha256: null },
        })
      ).ok
    ).toBe(true);
  });

  it('keeps the trader`s own equity in Report 2: the equity scan is for the reply, not for Engine 4`s setup', async () => {
    const fake = await written();
    expect(REPORT2_TEXT).toContain('equity');
    expect((await attach(fake)).ok).toBe(true);
  });

  it('says NOT_FOUND for a request that does not exist and for one that is another user`s', async () => {
    const fake = await written();
    const missing = await attach(fake, { requestId: 'req-nothing-0000' });
    const other = await attach(fake, { userId: OTHER_USER_ID });
    expect(missing).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    expect(other).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    expect(fake.rows.get(REQUEST_ID)!.risk_group).toBeNull();
  });

  it('refuses a risk group that fails its contract', async () => {
    const fake = await written();
    const bad = await attach(fake, {
      risk: { ...riskGroup(), consent_action: 'IGNORE' } as never,
    });
    expect(bad).toMatchObject({ ok: false, code: 'INVALID_RISK' });
    expect(fake.calls.updateMany).toEqual([]);
  });

  it('refuses a Report 2 that is not JSON text of a validated setup', async () => {
    const fake = await written();
    for (const notSetup of [
      'not json',
      '',
      '4',
      '[]',
      'null',
      '"text"',
      '{"schema":"other/1"}',
      '{}',
    ]) {
      const result = await attach(fake, { report2Json: notSetup });
      expect({ notSetup, ...result }).toMatchObject({
        notSetup,
        ok: false,
        code: 'INVALID_REPORT2',
      });
    }
    expect(fake.calls.updateMany).toEqual([]);
  });

  it('wants the risk group to name the hash of the Report 2 it came with', async () => {
    const fake = await written();
    for (const wrong of [null, 'e'.repeat(64), sha('something else')]) {
      const result = await attach(fake, {
        risk: { ...riskGroup(), setup_sha256: wrong },
      });
      expect(result).toMatchObject({ ok: false, code: 'INVALID_RISK' });
      if (!result.ok) {
        expect(result.issues.map((i) => `${i.path}:${i.code}`)).toEqual([
          'setup_sha256:INCONSISTENT',
        ]);
      }
    }
    expect(fake.calls.updateMany).toEqual([]);
  });

  it('refuses the user id inside the risk group or Report 2, and a missing user', async () => {
    const fake = await written();
    const inRisk = await attach(fake, {
      report2Json: null,
      risk: { ...riskGroup(), profile_snapshot_id: USER_ID },
    });
    const withUser = JSON.stringify({ ...report2(), note: USER_ID });
    const inReport = await attach(fake, {
      report2Json: withUser,
      risk: riskGroup(withUser),
    });
    const noUser = await attach(fake, { userId: '' });
    expect(inRisk).toMatchObject({ ok: false, code: 'USER_ID_IN_TRACE' });
    expect(inReport).toMatchObject({ ok: false, code: 'USER_ID_IN_TRACE' });
    expect(noUser).toMatchObject({ ok: false, code: 'MISSING_USER' });
    expect(fake.calls.updateMany).toEqual([]);
  });
});

describe('readTrace', () => {
  it('returns the row of a request id, or null', async () => {
    const fake = new FakeTraceClient();
    await write(fake);
    expect(await readTrace(REQUEST_ID, { client: fake })).toMatchObject({
      request_id: REQUEST_ID,
      outcome: 'REPORT1',
    });
    expect(await readTrace('req-nothing-0000', { client: fake })).toBeNull();
    expect(fake.calls.findUnique).toEqual([REQUEST_ID, 'req-nothing-0000']);
    expect(clone({})).toEqual({});
  });
});

describe('writeTrace: what it asks of the database', () => {
  it('asks for the request id back and nothing else', async () => {
    const fake = new FakeTraceClient();
    const asked: unknown[] = [];
    const real = fake.requestTrace.create;
    fake.requestTrace.create = async (args) => {
      asked.push(args.select);
      return real(args);
    };
    await write(fake);
    expect(asked).toEqual([{ request_id: true }]);
  });

  it('hashes the reply as UTF-8, the way the database does', async () => {
    const reply = withPath(
      reportResult(),
      'report.headline',
      'Gold rallies — Gold steigt über 4 367 \u{1f4c8}'
    );
    const fake = new FakeTraceClient();
    const result = await write(fake, { reply });
    expect(result).toMatchObject({
      ok: true,
      replySha256: createHash('sha256')
        .update(Buffer.from(canonicalJson(reply), 'utf8'))
        .digest('hex'),
    });
  });
});

describe('writeTrace: what it says when it refuses', () => {
  const said = async (over: Parameters<typeof write>[1]) => {
    const result = await write(new FakeTraceClient(), over);
    return result.ok ? null : { code: result.code, issues: result.issues };
  };

  it('puts the reason at the root of the trace when no field is to blame', async () => {
    expect(
      await said({ reply: { ...reportResult(), thread_id: 'cm0other' } })
    ).toEqual({
      code: 'REPLY_MISMATCH',
      issues: [
        {
          path: '',
          code: 'INCONSISTENT',
          message: 'the reply belongs to another request, thread or intent',
        },
      ],
    });
  });

  it('names a field called like the equity or the commission, with the reason', async () => {
    expect(
      await said({ trace: withPath(makeTrace(), 'model.equity', 10000) })
    ).toEqual({
      code: 'FORBIDDEN_KEY',
      issues: [
        {
          path: 'model.equity',
          code: 'FORBIDDEN_KEY',
          message: 'a trace never carries the equity or the commission',
        },
      ],
    });
  });

  it('says the user id lives in its own column, in a group of the trace as in the reply', async () => {
    const inGroup = withPath(
      makeTrace(),
      'data.synthesis_rules_version',
      USER_ID
    );
    expect(await said({ trace: inGroup })).toMatchObject({
      code: 'USER_ID_IN_TRACE',
    });
    const trace = withPath(makeTrace(), 'request.language', 'en');
    const reply = withPath(reportResult(), 'report.headline', `for ${USER_ID}`);
    expect(await said({ trace, reply })).toEqual({
      code: 'USER_ID_IN_TRACE',
      issues: [
        {
          path: '',
          code: 'INCONSISTENT',
          message:
            'the user id lives in its own column, never inside a group or a reply',
        },
      ],
    });
  });
});

describe('attachRisk: what it says when it refuses', () => {
  const attach = (over: Partial<Parameters<typeof attachRisk>[0]>) =>
    attachRisk(
      {
        userId: USER_ID,
        requestId: REQUEST_ID,
        risk: riskGroup(),
        report2Json: REPORT2_TEXT,
        ...over,
      },
      { client: new FakeTraceClient() }
    );
  const root = (message: string) => [
    { path: '', code: 'INCONSISTENT', message },
  ];

  it('says each reason at the root, in words', async () => {
    expect(await attach({ userId: '' })).toEqual({
      ok: false,
      code: 'MISSING_USER',
      issues: root('a trace belongs to a user'),
    });
    expect(await attach({ report2Json: '{not json' })).toEqual({
      ok: false,
      code: 'INVALID_REPORT2',
      issues: root('Report 2 is JSON text'),
    });
    expect(await attach({ report2Json: '[]' })).toEqual({
      ok: false,
      code: 'INVALID_REPORT2',
      issues: root('Report 2 is a validated-setup/1 object'),
    });
    expect(await attach({ report2Json: '{"schema":"other"}' })).toEqual({
      ok: false,
      code: 'INVALID_REPORT2',
      issues: root('Report 2 is a validated-setup/1 object'),
    });
  });

  it('puts a wrong hash at the field that holds it', async () => {
    expect(
      await attach({ risk: { ...riskGroup(), setup_sha256: 'a'.repeat(64) } })
    ).toEqual({
      ok: false,
      code: 'INVALID_RISK',
      issues: [
        {
          path: 'setup_sha256',
          code: 'INCONSISTENT',
          message:
            'the risk group must name the hash of the Report 2 it came with',
        },
      ],
    });
  });

  it('says the user id lives in its own column', async () => {
    const text = JSON.stringify({ ...report2(), note: USER_ID });
    expect(await attach({ report2Json: text, risk: riskGroup(text) })).toEqual({
      ok: false,
      code: 'USER_ID_IN_TRACE',
      issues: root(
        'the user id lives in its own column, never inside a group or a report'
      ),
    });
  });
});

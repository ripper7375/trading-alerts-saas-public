/**
 * @jest-environment node
 */

/**
 * POST /api/engine4/consent (build step 5, part 6; architecture 6.11, ADR-069).
 *
 * The route recomputes the setup, records it only if it is the setup the trader was
 * shown, and writes ONE append-only record per `submissionId`. The profile and consent
 * STORES run for real here against the in-memory stand-in of part 5, so what is
 * checked is the row the route would insert: the exact text of the setup, its hash, the
 * versions, the badge, the profile snapshot and the keyed hash of the user id.
 */

jest.mock('@/lib/auth/session', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .sessionModule()
);
jest.mock('@/lib/db/prisma', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .prismaModule()
);
jest.mock('@/lib/redis/client', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .redisModule()
);
jest.mock('@/lib/active-indicator/gateway-client', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .gatewayModule()
);
jest.mock('@/lib/engine4/read/cycle', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .cycleModule()
);
jest.mock('@/lib/engine4/read/specs', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .specsModule()
);
jest.mock('@/lib/engine4/read/events', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .eventsModule()
);
jest.mock('@/lib/engine4/read/bars', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .barsModule()
);
jest.mock('@/lib/engine4/read/synthesis', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .synthesisModule()
);
jest.mock('@/lib/engine4/read/structure-levels', () =>
  jest
    .requireActual<typeof import('./helpers/mocks')>('./helpers/mocks')
    .structureModule()
);

import * as consentRoute from '@/app/api/engine4/consent/route';
import * as profileRoute from '@/app/api/engine4/profile/route';
import * as sizeRoute from '@/app/api/engine4/size/route';
import {
  ENGINE4_VERSION,
  serializeValidatedSetup,
  validateSetup,
} from '@/lib/engine4';
import { hashUserId, resolveAuditKey } from '@/lib/engine4/store/user-hash';
import { CLAIM_SECONDS, DONE_SECONDS } from '@/lib/engine4/server/idempotency';
import {
  REPORT2_DISCLAIMER_VERSION,
  REPORT2_TEMPLATE_VERSION,
} from '@/lib/engine4/server/versions';

import { setup as engineSetup } from '../../lib/engine4/helpers/setup';
import {
  USER_ID,
  calls,
  db,
  post,
  redis,
  resetAll,
  signIn,
  world,
} from './helpers/mocks';
import { ROOMY, Z1_FIELDS } from './helpers/world';

type Json = any;

const ORIGINAL_ENV = process.env;
const env = (): Record<string, string | undefined> =>
  process.env as Record<string, string | undefined>;

let n = 0;
/** One submission id per press, the way the modal makes it. */
const newId = (): string =>
  `press-${String((n += 1)).padStart(8, '0')}-abcdefghij`;

beforeEach(async () => {
  process.env = { ...ORIGINAL_ENV, ENGINE4_REPORT2_ENABLED: 'true' };
  jest.spyOn(Date, 'now').mockImplementation(() => world.nowMs);
  resetAll();
  signIn('PRO');
  await profileRoute.POST(post('/api/engine4/profile', { profile: ROOMY }));
});

afterEach(() => jest.restoreAllMocks());
afterAll(() => {
  process.env = ORIGINAL_ENV;
});

async function sized(over: object = {}): Promise<Json> {
  const response = await sizeRoute.POST(
    post('/api/engine4/size', { cycleSlot: world.slot, ...Z1_FIELDS, ...over })
  );
  return (await response.json()) as Json;
}

interface Press {
  action?: string;
  submissionId?: string;
  shownSetupSha256?: string;
  [key: string]: unknown;
}

/** What the modal sends when the trader presses a button on the setup it showed. */
async function consent(
  press: Press = {},
  over: object = {}
): Promise<{ status: number; json: Json }> {
  const shown = press.shownSetupSha256 ?? (await sized(over)).setupSha256;
  const response = await consentRoute.POST(
    post('/api/engine4/consent', {
      action: 'ACCEPT',
      submissionId: newId(),
      cycleSlot: world.slot,
      ...Z1_FIELDS,
      ...over,
      ...press,
      shownSetupSha256: shown,
    })
  );
  return { status: response.status, json: (await response.json()) as Json };
}

describe('an Accept of the setup the trader was shown', () => {
  test('writes one record, and says which', async () => {
    const { status, json } = await consent();
    expect(status).toBe(201);
    expect(json).toMatchObject({ success: true, duplicate: false });
    expect(json.consent).toMatchObject({
      action: 'ACCEPT',
      cycleSlot: String(world.slot),
      recordedAt: '2026-10-10T08:00:00.000Z',
    });
    expect(json.consent.id).toBe(db.consents[0]!.id);
    expect(db.consents).toHaveLength(1);
  });

  test('the row holds what the server worked out, not what the client said', async () => {
    const { json } = await consent();
    const row = db.consents[0]!;
    const engineText = serializeValidatedSetup(
      validateSetup(engineSetup().ctx, Z1_FIELDS)
    );
    expect(row.setup_json).toBe(engineText);
    expect(JSON.stringify(row.setup)).toBe(engineText);
    expect(row.setup_sha256).toBe(json.consent.setupSha256);
    const profileRow = db.prefs.get(USER_ID)!;
    expect(row).toMatchObject({
      user_id: USER_ID,
      action: 'ACCEPT',
      symbol: 'XAUUSD',
      cycle_slot: world.slot,
      zone_id: 'Z1',
      side: 'BUY',
      synthesis_rule_id: 'R1_MACRO_COUNTER_TREND_RALLY',
      synthesis_rules_version: 'draft-1',
      profile_snapshot_id: profileRow.snapshot_id,
      badge: null,
      engine4_version: ENGINE4_VERSION,
      symbol_specs_version: 3,
      template_version: REPORT2_TEMPLATE_VERSION,
      disclaimer_version: REPORT2_DISCLAIMER_VERSION,
      language: 'en-US',
    });
  });

  test('the user id is stored with its keyed hash and the version of the key', async () => {
    await consent();
    const expected = hashUserId(USER_ID, resolveAuditKey());
    expect(db.consents[0]).toMatchObject({
      user_id_hash: expected.hash,
      key_version: expected.keyVersion,
    });
  });

  test('the record keeps the language the trader read the report in', async () => {
    await consent({}, { language: 'ja' });
    expect(db.consents[0]!.language).toBe('ja');
  });

  test('the answer carries the trace of 7.4: action, record id, submission id, checks', async () => {
    const press = { submissionId: newId() };
    const { json } = await consent(press, { language: 'de' });
    expect(json.trace).toMatchObject({
      route: 'consent',
      submissionId: press.submissionId,
      language: 'de',
      tier: 'PRO',
      risk: {
        ok: true,
        consentAction: 'ACCEPT',
        consentRecordId: db.consents[0]!.id,
        setupSha256: json.consent.setupSha256,
        override: null,
      },
      data: { cycleSlot: String(world.slot) },
    });
    expect(json.trace.risk.checks).toHaveLength(8);
    expect(json.trace.timings.stages.map((s: Json) => s.name)).toEqual(
      expect.arrayContaining(['claim', 'record', 'profile'])
    );
  });

  test('a CAUTIONARY override up to Max RPT is recorded with its reason, inside the setup', async () => {
    const { status, json } = await consent({}, { riskPct: '1.5' });
    expect(status).toBe(201);
    const stored = JSON.parse(db.consents[0]!.setup_json) as Json;
    expect(stored.overrides.defectFlag).toEqual({
      preset: '0.75',
      chosen: '1.5',
      reasons: ['MCD0_DEFECT_M15', 'MCD0_DEFECT_M5'],
    });
    expect(stored.risk).toMatchObject({
      preset: '0.75',
      max: '1.5',
      halfRisk: true,
    });
    expect(json.trace.risk.override).toEqual(stored.overrides.defectFlag);
  });

  test('a custom entry is recorded as CUSTOM with no zone', async () => {
    const { status } = await consent({}, { zoneId: undefined, entry: '4360' });
    expect(status).toBe(201);
    expect(db.consents[0]).toMatchObject({ zone_id: null, side: 'BUY' });
    expect(JSON.parse(db.consents[0]!.setup_json).entry.source).toBe('CUSTOM');
  });

  test('a with-trend setup`s badge is recorded as the server decided it', async () => {
    world.use('04-');
    const fields = {
      zoneId: 'Z2',
      entry: '4376.0',
      equity: '10000',
      riskPct: '1',
      stopDistance: '30.5',
      rrr: '1.5',
    };
    const shown = await sized(fields);
    const { status } = await consent(
      { shownSetupSha256: shown.setupSha256 },
      fields
    );
    expect(status).toBe(201);
    expect(db.consents[0]!.badge).toBe(shown.badge.badge);
  });
});

describe('Modify and Decline', () => {
  test.each(['MODIFY', 'DECLINE'])(
    '%s is recorded with the setup that was shown',
    async (action) => {
      const { status, json } = await consent({ action });
      expect(status).toBe(201);
      expect(json.consent.action).toBe(action);
      expect(db.consents.map((r) => r.action)).toEqual([action]);
    }
  );

  test('a setup that failed its checks can be declined and modified, and the record says it failed', async () => {
    for (const action of ['DECLINE', 'MODIFY']) {
      const { status } = await consent({ action }, { riskPct: '1.6' });
      expect([action, status]).toEqual([action, 201]);
    }
    expect(db.consents.map((r) => JSON.parse(r.setup_json).ok)).toEqual([
      false,
      false,
    ]);
  });

  test('a setup that failed its checks can NOT be accepted: nothing is written and the press can be tried again', async () => {
    const press = { submissionId: newId() };
    const { status, json } = await consent(press, { riskPct: '1.6' });
    expect(status).toBe(422);
    expect(json.error).toMatchObject({
      code: 'CONSENT_REFUSED',
      details: { code: 'ACCEPT_OF_A_FAILED_SETUP' },
    });
    expect(db.consents).toEqual([]);
    expect(redis.store.size).toBe(0);
  });
});

describe('the setup must be the one the trader was shown', () => {
  test('a picture that moved since it was shown is refused with the hash of the new one', async () => {
    const shown = await sized();
    // a Tier-1 release enters the window between the screen and the press
    world.knobs.events = [
      {
        valueId: 'v-1',
        eventId: '900000001',
        eventName: 'TEST US CPI',
        eventTime: world.now + 600,
        currency: 'USD',
        importance: 'HIGH',
        timeMode: 0,
        capturedAt: world.now - 600,
      },
    ];
    const { status, json } = await consent({
      shownSetupSha256: shown.setupSha256,
    });
    expect(status).toBe(409);
    expect(json.error.code).toBe('SETUP_CHANGED');
    expect(json.error.details.currentSetupSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(json.error.details.currentSetupSha256).not.toBe(shown.setupSha256);
    expect(db.consents).toEqual([]);
  });

  test('inputs that differ from the ones shown are refused', async () => {
    const shown = await sized();
    const { status, json } = await consent(
      { shownSetupSha256: shown.setupSha256 },
      { riskPct: '0.5' }
    );
    expect(status).toBe(409);
    expect(json.error.code).toBe('SETUP_CHANGED');
    expect(db.consents).toEqual([]);
  });

  test('a profile changed after the setup was shown is refused: the record names the profile it was validated against', async () => {
    const shown = await sized();
    await profileRoute.POST(
      post('/api/engine4/profile', { profile: { ...ROOMY, commission: '9' } })
    );
    const { status, json } = await consent({
      shownSetupSha256: shown.setupSha256,
    });
    expect(status).toBe(409);
    expect(json.error.code).toBe('SETUP_CHANGED');
    expect(db.consents).toEqual([]);
  });

  test('a made-up hash is refused', async () => {
    const { status, json } = await consent({
      shownSetupSha256: 'a'.repeat(64),
    });
    expect(status).toBe(409);
    expect(json.error.code).toBe('SETUP_CHANGED');
  });

  test('the same press can be sent again after a refusal like this one (the claim was released)', async () => {
    const submissionId = newId();
    const shown = await sized();
    const bad = await consent({
      submissionId,
      shownSetupSha256: 'b'.repeat(64),
    });
    expect(bad.status).toBe(409);
    expect(redis.store.size).toBe(0);
    const good = await consent({
      submissionId,
      shownSetupSha256: shown.setupSha256,
    });
    expect(good.status).toBe(201);
    expect(db.consents).toHaveLength(1);
  });
});

describe('what the route accepts', () => {
  test.each([
    ['no action', { action: undefined }],
    ['an unknown action', { action: 'CANCEL' }],
    ['a lower-case action', { action: 'accept' }],
    ['no submission id', { submissionId: undefined }],
    ['a short submission id', { submissionId: 'short' }],
    [
      'a submission id with a slash',
      { submissionId: 'a/b/c/d/e/f/g/h/i/j/k/l' },
    ],
    ['no hash of the setup shown', { shownSetupSha256: 'x'.repeat(0) }],
    ['a hash in capitals', { shownSetupSha256: 'A'.repeat(64) }],
    ['no cycle', { cycleSlot: undefined }],
    ['a language the app does not offer', { language: 'klingon' }],
    ['a zone id with spaces', { zoneId: 'Z 1' }],
  ])('%s is a 400', async (_label, over) => {
    const response = await consentRoute.POST(
      post('/api/engine4/consent', {
        action: 'ACCEPT',
        submissionId: newId(),
        shownSetupSha256: 'c'.repeat(64),
        cycleSlot: world.slot,
        ...Z1_FIELDS,
        ...over,
      })
    );
    const json = (await response.json()) as Json;
    expect(response.status).toBe(400);
    expect(json.error.code).toBe('BAD_REQUEST');
    expect(db.consents).toEqual([]);
    expect(redis.calls).toEqual([]);
    expect(calls.snapshot).not.toHaveBeenCalled();
  });

  test('a trader with no profile is told to confirm one, and nothing is written', async () => {
    signIn('PRO', 'user_new');
    const { status, json } = await consent({
      shownSetupSha256: 'd'.repeat(64),
    });
    expect(status).toBe(409);
    expect(json.error.code).toBe('PROFILE_NOT_SET');
    expect(db.consents).toEqual([]);
    expect(redis.store.size).toBe(0);
  });

  test('a cycle with no reading cannot be recorded against', async () => {
    const shown = await sized({ cycleSlot: world.slot + 300 });
    const { status, json } = await consent(
      { shownSetupSha256: shown.setupSha256, action: 'DECLINE' },
      { cycleSlot: world.slot + 300 }
    );
    expect(status).toBe(422);
    expect(json.error).toMatchObject({
      code: 'CONSENT_REFUSED',
      details: { code: 'SETUP_NOT_PINNED' },
    });
    expect(db.consents).toEqual([]);
  });
});

describe('the client cannot choose what is recorded', () => {
  test('a setup, a verdict, a badge, a profile snapshot, versions, a symbol, a rule or an owner in the body are not read', async () => {
    const { status } = await consent(
      {},
      {
        setup: { ok: true, side: 'SELL' },
        ok: true,
        badge: 'AGGRESSIVE',
        profileSnapshotId: 'forged-snapshot',
        profile_snapshot_id: 'forged-snapshot',
        templateVersion: 'my-template',
        disclaimerVersion: 'my-disclaimer',
        engine4Version: '9.9.9',
        symbol: 'EURUSD',
        ruleId: 'MY_RULE',
        rulesVersion: 'my-rules',
        symbolSpecsVersion: 999,
        userId: 'user_victim',
        user_id: 'user_victim',
        userIdHash: 'f'.repeat(64),
        keyVersion: 99,
        recordedAt: '1999-01-01T00:00:00Z',
        setupJson: '{"ok":true}',
        setupSha256: 'e'.repeat(64),
      }
    );
    expect(status).toBe(201);
    const row = db.consents[0]!;
    expect(row).toMatchObject({
      user_id: USER_ID,
      symbol: 'XAUUSD',
      badge: null,
      side: 'BUY',
      synthesis_rule_id: 'R1_MACRO_COUNTER_TREND_RALLY',
      synthesis_rules_version: 'draft-1',
      template_version: REPORT2_TEMPLATE_VERSION,
      disclaimer_version: REPORT2_DISCLAIMER_VERSION,
      engine4_version: ENGINE4_VERSION,
      symbol_specs_version: 3,
      key_version: 1,
    });
    expect(row.profile_snapshot_id).toBe(db.prefs.get(USER_ID)!.snapshot_id);
    expect(row.user_id_hash).toBe(hashUserId(USER_ID, resolveAuditKey()).hash);
    expect(JSON.parse(row.setup_json).ok).toBe(true);
    expect(JSON.parse(row.setup_json).side).toBe('BUY');
  });

  test('a forged hash cannot make a failed setup acceptable', async () => {
    const failed = await sized({ riskPct: '1.6' });
    const lying = await consent(
      { shownSetupSha256: failed.setupSha256 },
      { riskPct: '1.6', ok: true, setup: { ok: true } }
    );
    expect(lying.status).toBe(422);
    expect(db.consents).toEqual([]);
  });
});

describe('one submit writes one record', () => {
  test('a double click: the second press gets the first answer and writes nothing', async () => {
    const press = { submissionId: newId() };
    const shown = (await sized()).setupSha256 as string;
    const first = await consent({ ...press, shownSetupSha256: shown });
    const reads = calls.snapshot.mock.calls.length;
    const second = await consent({ ...press, shownSetupSha256: shown });
    expect(first.status).toBe(201);
    expect(first.json.duplicate).toBe(false);
    expect(second.status).toBe(200);
    expect(second.json).toMatchObject({ success: true, duplicate: true });
    expect(second.json.consent).toEqual(first.json.consent);
    expect(db.consents).toHaveLength(1);
    // the repeat did not even re-read the market
    expect(calls.snapshot.mock.calls.length).toBe(reads);
    expect(second.json.trace.risk.consentRecordId).toBe(first.json.consent.id);
  });

  test('two presses at the same moment: one is recorded, the other is told to wait', async () => {
    const press = { submissionId: newId() };
    const shown = (await sized()).setupSha256 as string;
    const [a, b] = await Promise.all([
      consent({ ...press, shownSetupSha256: shown }),
      consent({ ...press, shownSetupSha256: shown }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const refused = a.status === 409 ? a : b;
    expect(refused.json.error.code).toBe('SUBMISSION_IN_FLIGHT');
    expect(db.consents).toHaveLength(1);
    // and a retry after both finished is answered from the record
    const retry = await consent({ ...press, shownSetupSha256: shown });
    expect(retry.status).toBe(200);
    expect(retry.json.duplicate).toBe(true);
    expect(db.consents).toHaveLength(1);
  });

  test('the same id for a different request is refused, and the first record stands', async () => {
    const press = { submissionId: newId() };
    const shown = (await sized()).setupSha256 as string;
    await consent({ ...press, shownSetupSha256: shown });
    const other = await consent({
      ...press,
      action: 'DECLINE',
      shownSetupSha256: shown,
    });
    expect(other.status).toBe(422);
    expect(other.json.error.code).toBe('SUBMISSION_ID_REUSED');
    expect(db.consents.map((r) => r.action)).toEqual(['ACCEPT']);
  });

  test('another trader`s identical id is another press', async () => {
    const submissionId = newId();
    await consent({ submissionId });
    await profileRoute.POST(post('/api/engine4/profile', { profile: ROOMY })); // same trader: no change
    signIn('PRO', 'user_pro_2');
    await profileRoute.POST(post('/api/engine4/profile', { profile: ROOMY }));
    const second = await consent({ submissionId });
    expect(second.status).toBe(201);
    expect(db.consents.map((r) => r.user_id)).toEqual([USER_ID, 'user_pro_2']);
  });

  test('a new press (a new id) is a new record: the trader may modify and then accept', async () => {
    await consent({ action: 'MODIFY' });
    await consent({ action: 'ACCEPT' });
    expect(db.consents.map((r) => r.action)).toEqual(['MODIFY', 'ACCEPT']);
  });

  test('the claim lasts two minutes and the answer a day', async () => {
    const press = { submissionId: newId() };
    const shown = (await sized()).setupSha256 as string;
    redis.calls.length = 0;
    await consent({ ...press, shownSetupSha256: shown });
    const key = `engine4:consent:v1:${USER_ID}:${press.submissionId}`;
    expect(redis.calls[0]).toBe(`set NX ${key}`);
    expect(redis.store.get(key)!.ttl).toBe(DONE_SECONDS);
    expect(CLAIM_SECONDS).toBe(120);
    expect(DONE_SECONDS).toBe(86_400);
    expect(redis.store.get(key)!.value).not.toContain('PENDING');
  });

  test('a claim that expired without an answer lets the press go through', async () => {
    const press = { submissionId: newId() };
    const shown = (await sized()).setupSha256 as string;
    const key = `engine4:consent:v1:${USER_ID}:${press.submissionId}`;
    redis.store.set(key, { value: 'PENDING:abc', ttl: 1 });
    redis.expire(key);
    const { status } = await consent({ ...press, shownSetupSha256: shown });
    expect(status).toBe(201);
  });

  test('a failed press releases its claim so the trader can press again', async () => {
    const quiet = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const press = { submissionId: newId() };
    const shown = (await sized()).setupSha256 as string;
    db.failConsentCreate = true;
    const failed = await consent({ ...press, shownSetupSha256: shown });
    expect(failed.status).toBe(500);
    expect(failed.json.error.code).toBe('INTERNAL');
    expect(JSON.stringify(failed.json)).not.toContain('create failed');
    expect(redis.store.size).toBe(0);
    expect(db.consents).toEqual([]);
    db.failConsentCreate = false;
    const again = await consent({ ...press, shownSetupSha256: shown });
    expect(again.status).toBe(201);
    expect(db.consents).toHaveLength(1);
    expect(quiet).toHaveBeenCalled();
  });

  test('with Redis down the guard fails OPEN, as lib/idempotency does: a repeat writes a second identical record (the documented limit)', async () => {
    const quiet = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    redis.down = true;
    const press = { submissionId: newId() };
    const shown = (await sized()).setupSha256 as string;
    const first = await consent({ ...press, shownSetupSha256: shown });
    const second = await consent({ ...press, shownSetupSha256: shown });
    expect([first.status, second.status]).toEqual([201, 201]);
    expect(db.consents).toHaveLength(2);
    expect(db.consents[0]!.setup_sha256).toBe(db.consents[1]!.setup_sha256);
    expect(quiet).toHaveBeenCalled();
    // a press that was never guarded does not try to keep an answer, or to release a claim
    const key = `engine4:consent:v1:${USER_ID}:${press.submissionId}`;
    expect(redis.calls).toEqual([`set NX ${key}`, `set NX ${key}`]);
  });
});

describe('what stops a record from being written', () => {
  test('no audit key: nothing is written, the answer says only that recording is unavailable, the press can be retried', async () => {
    const quiet = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const press = { submissionId: newId() };
    const shown = (await sized()).setupSha256 as string;
    env()['NODE_ENV'] = 'production';
    delete env()['ENGINE4_AUDIT_HMAC_KEY'];
    const response = await consentRoute.POST(
      post('/api/engine4/consent', {
        action: 'ACCEPT',
        ...press,
        shownSetupSha256: shown,
        cycleSlot: world.slot,
        ...Z1_FIELDS,
      })
    );
    const text = await response.text();
    expect(response.status).toBe(503);
    expect(JSON.parse(text).error.code).toBe('AUDIT_NOT_CONFIGURED');
    expect(text).not.toContain('HMAC');
    expect(db.consents).toEqual([]);
    expect(redis.store.size).toBe(0);
    expect(quiet).toHaveBeenCalled();
  });

  test('a synthesis reading that cannot be read: nothing is written (the rule and version are part of the record)', async () => {
    const shown = (await sized()).setupSha256 as string;
    world.knobs.detail = 'TAMPERED';
    const { status, json } = await consent({ shownSetupSha256: shown });
    expect(status).toBe(503);
    expect(json.error).toMatchObject({
      code: 'DATA_UNAVAILABLE',
      details: { code: 'READING_TAMPERED' },
    });
    expect(db.consents).toEqual([]);
    expect(redis.store.size).toBe(0);
  });

  test('a newer cycle that changed the picture: the pinned setup can be declined but not accepted', async () => {
    world.knobs.newest = {
      cycleSlot: world.slot + 300,
      bias: 'SHORT',
      status: 'VALID',
      statusReasons: [],
      trendRelation: 'WITH_TREND',
      ruleId: 'OTHER',
      branchId: null,
      retuning: false,
    };
    const accept = await consent({});
    expect(accept.status).toBe(422);
    expect(accept.json.error.details.code).toBe('ACCEPT_OF_A_FAILED_SETUP');
    const decline = await consent({ action: 'DECLINE' });
    expect(decline.status).toBe(201);
    expect(JSON.parse(db.consents[0]!.setup_json).checks[6].codes).toContain(
      'SETUP_CHANGED'
    );
  });
});

describe('a badge the server decided is the badge recorded', () => {
  // golden 07: a SHORT counter-trend reading, Z1 at 4282 with the next level at 4250; at RRR 1.75 only the
  // Conservative target (1.5) sits before that level, so the badge is CONSERVATIVE
  const BADGED = {
    zoneId: 'Z1',
    entry: '4282.0',
    equity: '10000',
    riskPct: '0.5',
    stopDistance: '20.5',
    rrr: '1.75',
  };

  test('is shown by the size route and recorded by the consent route, in the row, the trace and the answer', async () => {
    world.use('07-');
    const shown = await sized(BADGED);
    expect(shown.setup.ok).toBe(true);
    expect(shown.badge).toMatchObject({
      badge: 'CONSERVATIVE',
      unavailable: null,
      result: {
        row: 'COUNTER_TREND',
        cap: 'CONSERVATIVE',
        fitting: ['CONSERVATIVE'],
        nextLevel: { price: '4250' },
      },
    });
    const { status, json } = await consent(
      { shownSetupSha256: shown.setupSha256 },
      BADGED
    );
    expect(status).toBe(201);
    expect(db.consents[0]!.badge).toBe('CONSERVATIVE');
    expect(json.trace.risk.badge).toBe('CONSERVATIVE');
  });

  test('a client`s own badge is not read', async () => {
    world.use('07-');
    const shown = await sized(BADGED);
    await consent(
      { shownSetupSha256: shown.setupSha256 },
      { ...BADGED, badge: 'AGGRESSIVE' }
    );
    expect(db.consents[0]!.badge).toBe('CONSERVATIVE');
  });
});

describe('the same submission id is bound to the whole request, not only to the action', () => {
  const FIRST = { submissionId: 'press-fingerprint-0001-abcdef' };

  test.each([
    ['another cycle', { cycleSlot: 1789764900 + 300 }],
    ['another zone', { zoneId: 'Z2' }],
    ['another shown hash', { shownSetupSha256: 'f'.repeat(64) }],
    ['another language', { language: 'de' }],
    ['other inputs', { riskPct: '0.5' }],
    ['an input more', { side: 'BUY' }],
  ])('%s is refused as a reuse and writes nothing', async (_label, change) => {
    const shown = (await sized()).setupSha256 as string;
    const first = await consent({ ...FIRST, shownSetupSha256: shown });
    expect(first.status).toBe(201);
    const { shownSetupSha256, ...rest } = change as Record<string, unknown>;
    const second = await consent(
      { ...FIRST, shownSetupSha256: (shownSetupSha256 as string) ?? shown },
      rest
    );
    expect(second.status).toBe(422);
    expect(second.json.error.code).toBe('SUBMISSION_ID_REUSED');
    expect(db.consents).toHaveLength(1);
  });

  test('the same request is not a reuse, whatever the order of its fields', async () => {
    const shown = (await sized()).setupSha256 as string;
    await consent({ ...FIRST, shownSetupSha256: shown });
    const response = await consentRoute.POST(
      post('/api/engine4/consent', {
        rrr: Z1_FIELDS.rrr,
        stopDistance: Z1_FIELDS.stopDistance,
        riskPct: Z1_FIELDS.riskPct,
        equity: Z1_FIELDS.equity,
        entry: Z1_FIELDS.entry,
        zoneId: Z1_FIELDS.zoneId,
        cycleSlot: world.slot,
        shownSetupSha256: shown,
        submissionId: FIRST.submissionId,
        action: 'ACCEPT',
      })
    );
    expect(response.status).toBe(200);
    expect((await response.json()).duplicate).toBe(true);
  });
});

describe('a press that was never guarded does not touch Redis again', () => {
  test('with Redis down, a refused press tries no release', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    redis.down = true;
    const press = { submissionId: newId() };
    const { status } = await consent({
      ...press,
      shownSetupSha256: 'b'.repeat(64),
    });
    expect(status).toBe(409);
    const key = `engine4:consent:v1:${USER_ID}:${press.submissionId}`;
    expect(redis.calls).toEqual([`set NX ${key}`]);
  });
});

describe('the versions a record names are pinned here on purpose', () => {
  test('are the two DRAFT strings of part 7 until counsel replaces the wording', async () => {
    await consent();
    expect(db.consents[0]).toMatchObject({
      template_version: 'report2-template/draft-1',
      disclaimer_version: 'disclaimer/draft-1',
    });
  });
});

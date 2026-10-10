/**
 * @jest-environment node
 */

/**
 * The consent store (build step 5, part 5), on REAL validated setups (the 18 Sep
 * golden cycle through `validateSetup`) against an in-memory stand-in for the
 * tables. What the DATABASE refuses is shown by the gated spec on a real PostgreSQL.
 */

import { createHash } from 'crypto';

import {
  ENGINE4_VERSION,
  serializeValidatedSetup,
  validateSetup,
} from '@/lib/engine4';
import type { SetupFields, ValidatedSetup } from '@/lib/engine4';
import {
  CONSENT_ACTIONS,
  recordConsent,
} from '@/lib/engine4/store/consent-store';
import type {
  ConsentInput,
  RecordConsentResult,
} from '@/lib/engine4/store/consent-store';
import { profileColumnsOf } from '@/lib/engine4/store/profile-store';
import { AuditKeyError, hashUserId } from '@/lib/engine4/store/user-hash';
import type { AuditKey } from '@/lib/engine4/store/user-hash';

import { fakeClient } from '../helpers/store-fake';
import type { FakeClient } from '../helpers/store-fake';
import { setup } from '../helpers/setup';

// the store imports the database client at load time; no test here touches it
jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));

const KEY: AuditKey = { key: 'k'.repeat(40), version: 3, source: 'ENV' };

const MODAL: SetupFields = {
  zoneId: 'Z1',
  entry: '4367.20',
  equity: '10000',
  riskPct: '0.75',
  stopDistance: '16.78',
  rrr: '1.75',
};

const GOOD = validateSetup(setup().ctx, MODAL);
const FAILED = validateSetup(setup().ctx, { ...MODAL, riskPct: '5' });
const CUSTOM = validateSetup(setup().ctx, {
  ...MODAL,
  zoneId: undefined,
  entry: '4370',
});

const sha256 = (text: string) =>
  createHash('sha256').update(text, 'utf8').digest('hex');

function world(snapshotOf: ValidatedSetup = GOOD) {
  const client = fakeClient();
  client.db.history.push({
    id: 'snap-1',
    user_id: 'user-1',
    user_id_hash: 'h'.repeat(64),
    key_version: 1,
    ...profileColumnsOf(snapshotOf.profile),
  });
  return client;
}

function input(over: Partial<ConsentInput> = {}): ConsentInput {
  return {
    userId: 'user-1',
    action: 'ACCEPT',
    symbol: 'XAUUSD',
    setup: GOOD,
    synthesis: { ruleId: 'R7', rulesVersion: 'draft-1' },
    profileSnapshotId: 'snap-1',
    badge: 'AI-CAUTIONARY',
    templateVersion: 'report2-0.1',
    disclaimerVersion: 'disc-2026-10',
    language: 'en',
    ...over,
  };
}

async function record(
  client: FakeClient,
  over: Partial<ConsentInput> = {}
): Promise<RecordConsentResult> {
  return recordConsent(input(over), { client, key: KEY });
}

function refused(result: RecordConsentResult) {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('expected a refusal');
  return result;
}

describe('the setups under test', () => {
  test('are what the cases below need them to be', () => {
    expect(GOOD.ok).toBe(true);
    expect(GOOD.pinnedSlot).not.toBeNull();
    expect(GOOD.entry.zoneId).toBe('Z1');
    expect(GOOD.side).toBe('BUY');
    expect(GOOD.versions.specs).not.toBeNull();
    expect(FAILED.ok).toBe(false);
    expect(FAILED.pinnedSlot).toBe(GOOD.pinnedSlot);
    expect(CUSTOM.ok).toBe(true);
    expect(CUSTOM.entry).toMatchObject({ source: 'CUSTOM', zoneId: null });
  });
});

describe('recordConsent: an Accept', () => {
  test('appends one row with every column of 6.11', async () => {
    const client = world();
    const result = await record(client);
    expect(result).toMatchObject({ ok: true, id: 'consent-1' });
    expect(client.db.consents).toHaveLength(1);
    const row = client.db.consents[0]!;
    expect(row).toMatchObject({
      user_id: 'user-1',
      user_id_hash: hashUserId('user-1', KEY).hash,
      key_version: 3,
      action: 'ACCEPT',
      symbol: 'XAUUSD',
      cycle_slot: Number(GOOD.pinnedSlot),
      synthesis_rule_id: 'R7',
      synthesis_rules_version: 'draft-1',
      zone_id: 'Z1',
      side: 'BUY',
      profile_snapshot_id: 'snap-1',
      badge: 'AI-CAUTIONARY',
      engine4_version: ENGINE4_VERSION,
      symbol_specs_version: Number(GOOD.versions.specs),
      template_version: 'report2-0.1',
      disclaimer_version: 'disc-2026-10',
      language: 'en',
    });
  });

  test('keeps the setup as the exact text, its hash, and the same document as JSON', async () => {
    const client = world();
    const result = await record(client);
    const row = client.db.consents[0]!;
    const text = serializeValidatedSetup(GOOD);
    expect(row.setup_json).toBe(text);
    expect(row.setup_sha256).toBe(sha256(text));
    expect(JSON.stringify(row.setup)).toBe(text);
    expect(result).toMatchObject({ ok: true, setupSha256: sha256(text) });
  });

  test('the columns a reader filters on are the setup’s own values', async () => {
    const client = world();
    await record(client);
    const row = client.db.consents[0]!;
    const stored = row.setup as unknown as ValidatedSetup;
    expect(String(row.cycle_slot)).toBe(stored.pinnedSlot);
    expect(row.side).toBe(stored.side);
    expect(row.zone_id).toBe(stored.entry.zoneId);
  });

  test('a custom entry has no zone', async () => {
    const client = world(CUSTOM);
    await record(client, { setup: CUSTOM });
    expect(client.db.consents[0]?.zone_id).toBeNull();
  });

  test('a record without a badge or without broker figures keeps the NULLs', async () => {
    const client = world();
    const noSpecs: ValidatedSetup = {
      ...GOOD,
      versions: { ...GOOD.versions, specs: null },
    };
    await record(client, { badge: null, setup: noSpecs });
    expect(client.db.consents[0]).toMatchObject({
      badge: null,
      symbol_specs_version: null,
    });
  });

  test('does not change the setup it is given', async () => {
    const client = world();
    const before = serializeValidatedSetup(GOOD);
    await record(client);
    expect(serializeValidatedSetup(GOOD)).toBe(before);
  });

  test('records the symbol and the language it is given, not a fixed one', async () => {
    const client = world();
    await record(client, { symbol: 'XAGUSD', language: 'ar' });
    expect(client.db.consents[0]).toMatchObject({
      symbol: 'XAGUSD',
      language: 'ar',
    });
  });

  test('the Engine 4 version a record names is the release string, "1.0.0" until a deliberate change (6.11)', () => {
    // bumping ENGINE4_VERSION is a decision (see lib/engine4/version.ts): it edits this line too
    expect(ENGINE4_VERSION).toBe('1.0.0');
  });

  test('stores the hash and version of the key it was given', async () => {
    const client = world();
    const other: AuditKey = { key: 'z'.repeat(40), version: 9, source: 'ENV' };
    await recordConsent(input(), { client, key: other });
    expect(client.db.consents[0]).toMatchObject({
      user_id_hash: hashUserId('user-1', other).hash,
      key_version: 9,
    });
  });
});

describe('recordConsent: Modify and Decline, and what they may be', () => {
  test.each(['MODIFY', 'DECLINE'] as const)(
    '%s of a good setup is recorded',
    async (action) => {
      const client = world();
      expect(await record(client, { action })).toMatchObject({ ok: true });
      expect(client.db.consents[0]?.action).toBe(action);
    }
  );

  test.each(['MODIFY', 'DECLINE'] as const)(
    '%s of a setup that failed its checks is recorded too',
    async (action) => {
      const client = world(FAILED);
      expect(await record(client, { action, setup: FAILED })).toMatchObject({
        ok: true,
      });
      const stored = client.db.consents[0]?.setup as unknown as ValidatedSetup;
      expect(stored.ok).toBe(false);
    }
  );

  test('an Accept of a setup that failed its checks is refused, and nothing is written', async () => {
    const client = world(FAILED);
    const result = refused(await record(client, { setup: FAILED }));
    expect(result.code).toBe('ACCEPT_OF_A_FAILED_SETUP');
    expect(client.db.calls).toEqual([]);
  });

  test('the three actions are exactly the ones the table allows', () => {
    expect([...CONSENT_ACTIONS]).toEqual(['ACCEPT', 'MODIFY', 'DECLINE']);
  });

  test.each(['accept', 'ACCEPTED', 'CANCEL', '', 'Decline'])(
    'the action %p is refused',
    async (action) => {
      const client = world();
      const result = refused(
        await record(client, {
          action: action as unknown as ConsentInput['action'],
        })
      );
      expect(result.code).toBe('UNKNOWN_ACTION');
      expect(client.db.calls).toEqual([]);
    }
  );
});

describe('recordConsent: appends only', () => {
  test('two records of the same setup are two rows, never one replaced', async () => {
    const client = world();
    await record(client);
    await record(client, { action: 'MODIFY' });
    expect(client.db.consents.map((r) => r.id)).toEqual([
      'consent-1',
      'consent-2',
    ]);
    expect(client.db.consents.map((r) => r.action)).toEqual([
      'ACCEPT',
      'MODIFY',
    ]);
  });

  test('its only write is one create', async () => {
    const client = world();
    await record(client);
    expect(client.db.calls).toEqual(['history.findUnique', 'consent.create']);
  });

  test('a failed create is thrown, never swallowed', async () => {
    const client = world();
    client.db.failConsentCreate = true;
    await expect(record(client)).rejects.toThrow('the create failed');
    expect(client.db.consents).toHaveLength(0);
  });
});

describe('recordConsent: a setup that cannot be recorded against a cycle', () => {
  test.each([
    ['null', null],
    ['empty', ''],
    ['zero', '0'],
    ['negative', '-5'],
    ['a fraction', '1.5'],
    ['text', 'soon'],
    ['past the 32-bit column', '2147483648'],
    ['a leading zero', '0123'],
  ])('a pinned slot that is %s', async (_name, pinnedSlot) => {
    const client = world();
    const result = refused(
      await record(client, {
        setup: { ...GOOD, pinnedSlot: pinnedSlot as string | null },
      })
    );
    expect(result.code).toBe('SETUP_NOT_PINNED');
    expect(client.db.calls).toEqual([]);
  });

  test('the largest slot a 32-bit column holds is accepted', async () => {
    const client = world();
    expect(
      await record(client, { setup: { ...GOOD, pinnedSlot: '2147483647' } })
    ).toMatchObject({ ok: true });
    expect(client.db.consents[0]?.cycle_slot).toBe(2147483647);
  });

  test.each(['0', 'x', '-1', '1.5', '2147483648'])(
    'a symbol_specs version of %p is refused',
    async (specs) => {
      const client = world();
      const result = refused(
        await record(client, {
          setup: { ...GOOD, versions: { ...GOOD.versions, specs } },
        })
      );
      expect(result.code).toBe('BAD_SETUP');
    }
  );
});

describe('recordConsent: names that must not be empty', () => {
  const cases: [string, Partial<ConsentInput>][] = [
    ['userId', { userId: '' }],
    ['symbol', { symbol: '' }],
    [
      'synthesis.ruleId',
      { synthesis: { ruleId: '', rulesVersion: 'draft-1' } },
    ],
    [
      'synthesis.rulesVersion',
      { synthesis: { ruleId: 'R7', rulesVersion: ' ' } },
    ],
    ['profileSnapshotId', { profileSnapshotId: '' }],
    ['templateVersion', { templateVersion: '   ' }],
    ['disclaimerVersion', { disclaimerVersion: '' }],
    ['language', { language: '' }],
  ];
  test.each(cases)('%s', async (field, over) => {
    const client = world();
    const result = refused(await record(client, over));
    expect(result.code).toBe('MISSING_FIELD');
    expect(result.detail).toBe(`${field} is required`);
    expect(client.db.calls).toEqual([]);
  });
});

describe('recordConsent: the profile snapshot', () => {
  test('a snapshot that does not exist is refused', async () => {
    const client = world();
    const result = refused(await record(client, { profileSnapshotId: 'nope' }));
    expect(result.code).toBe('PROFILE_SNAPSHOT_NOT_FOUND');
    expect(client.db.consents).toHaveLength(0);
  });

  test('another user’s snapshot is refused', async () => {
    const client = world();
    const result = refused(await record(client, { userId: 'user-2' }));
    expect(result.code).toBe('PROFILE_SNAPSHOT_NOT_THE_USERS');
    expect(client.db.consents).toHaveLength(0);
  });

  test('a snapshot of a deleted account (user_id NULL) is nobody’s', async () => {
    const client = world();
    client.db.history[0] = { ...client.db.history[0]!, user_id: null };
    const result = refused(await record(client));
    expect(result.code).toBe('PROFILE_SNAPSHOT_NOT_THE_USERS');
  });

  test.each([
    ['trader_type', 'SCALPER'],
    ['style', 'TREND_FOLLOWING'],
    ['max_risk_pct', '1.1'],
    ['max_leverage', '4'],
    ['target_rrr', '3'],
    ['equity', '9999'],
    ['min_sld', '20'],
    ['commission', '9'],
  ])(
    'a snapshot that differs in %s is not the profile the setup was validated against',
    async (column, value) => {
      const client = world();
      client.db.history[0] = { ...client.db.history[0]!, [column]: value };
      const result = refused(await record(client));
      expect(result.code).toBe('PROFILE_SNAPSHOT_NOT_THE_SETUPS');
      expect(client.db.consents).toHaveLength(0);
    }
  );
});

describe('recordConsent: the key', () => {
  test('a missing key is thrown, and nothing is written', async () => {
    const client = world();
    jest.replaceProperty(process, 'env', {
      ...process.env,
      NODE_ENV: 'production',
      ENGINE4_AUDIT_HMAC_KEY: undefined,
    } as NodeJS.ProcessEnv);
    try {
      await expect(recordConsent(input(), { client })).rejects.toThrow(
        AuditKeyError
      );
    } finally {
      jest.restoreAllMocks();
    }
    expect(client.db.calls).toEqual([]);
  });

  test('a refusal does not need a key', async () => {
    const client = world(FAILED);
    jest.replaceProperty(process, 'env', {
      ...process.env,
      NODE_ENV: 'production',
      ENGINE4_AUDIT_HMAC_KEY: undefined,
    } as NodeJS.ProcessEnv);
    try {
      const result = await recordConsent(input({ setup: FAILED }), { client });
      expect(refused(result).code).toBe('ACCEPT_OF_A_FAILED_SETUP');
    } finally {
      jest.restoreAllMocks();
    }
  });
});

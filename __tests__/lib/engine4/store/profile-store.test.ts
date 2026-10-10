/**
 * @jest-environment node
 */

/**
 * The profile store (build step 5, part 5), against an in-memory stand-in for the
 * tables. What the DATABASE refuses is shown by the gated spec on a real PostgreSQL.
 */

import { PROFILE_DEFAULTS, validateProfile } from '@/lib/engine4';
import type { TraderProfile } from '@/lib/engine4';
import {
  StoredProfileError,
  profileColumnsOf,
  readProfile,
  saveProfile,
} from '@/lib/engine4/store/profile-store';
import {
  AuditKeyError,
  hashUserId,
  verifyUserHash,
} from '@/lib/engine4/store/user-hash';
import type { AuditKey } from '@/lib/engine4/store/user-hash';

import { NOW, fakeClient } from '../helpers/store-fake';

// the store imports the database client at load time; no test here touches it
jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));

const KEY_V1: AuditKey = { key: 'k'.repeat(40), version: 1, source: 'ENV' };
const KEY_V2: AuditKey = { key: 'q'.repeat(40), version: 2, source: 'ENV' };

const PROFILE: TraderProfile = {
  ...PROFILE_DEFAULTS,
  style: 'BOTH',
  maxRiskPct: '1.25',
  maxLeverage: '3',
  targetRrr: '2',
  equity: '12500.5',
  minSld: '14',
  commission: '3.5',
};

let ids = 0;
const newId = () => `snap-${(ids += 1)}`;

function setup() {
  ids = 0;
  const client = fakeClient();
  return { client, db: client.db };
}

describe('saveProfile: a first profile', () => {
  test('appends one snapshot and makes it the current profile, in one transaction', async () => {
    const { client, db } = setup();
    const result = await saveProfile('user-1', PROFILE, {
      client,
      key: KEY_V1,
      newId,
    });
    expect(result).toEqual({
      ok: true,
      profile: PROFILE,
      snapshotId: 'snap-1',
      changed: true,
    });
    expect(db.transactions).toBe(1);
    expect(db.calls).toEqual([
      'prefs.findUnique',
      'history.create',
      'prefs.upsert',
    ]);
    expect(db.history).toHaveLength(1);
    expect(db.history[0]).toEqual({
      id: 'snap-1',
      user_id: 'user-1',
      user_id_hash: hashUserId('user-1', KEY_V1).hash,
      key_version: 1,
      ...profileColumnsOf(PROFILE),
    });
    const current = db.prefs.get('user-1');
    expect(current).toMatchObject({
      user_id: 'user-1',
      snapshot_id: 'snap-1',
      ...profileColumnsOf(PROFILE),
    });
  });

  test('stores the figures as canonical decimal text, never as typed', async () => {
    const { client, db } = setup();
    await saveProfile(
      'user-1',
      { ...PROFILE, maxRiskPct: '1.250', equity: '12500.50', minSld: 14 },
      { client, key: KEY_V1, newId }
    );
    expect(db.history[0]).toMatchObject({
      max_risk_pct: '1.25',
      equity: '12500.5',
      min_sld: '14',
    });
  });

  test('keeps a figure exactly: no rounding to any column scale', async () => {
    const { client, db } = setup();
    await saveProfile(
      'user-1',
      { ...PROFILE, equity: '12345.678901234567890123' },
      { client, key: KEY_V1, newId }
    );
    expect(db.history[0]?.equity).toBe('12345.678901234567890123');
  });

  test('the stored hash is the keyed hash of the user id, with the key’s version', async () => {
    const { client, db } = setup();
    await saveProfile('user-1', PROFILE, { client, key: KEY_V2, newId });
    const row = db.history[0]!;
    expect(row.key_version).toBe(2);
    expect(
      verifyUserHash(
        'user-1',
        { hash: row.user_id_hash, keyVersion: row.key_version },
        KEY_V2
      )
    ).toBe('MATCH');
  });

  test('the snapshot id is a random UUID unless one is given', async () => {
    const { client, db } = setup();
    await saveProfile('user-1', PROFILE, { client, key: KEY_V1 });
    expect(db.history[0]?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });
});

describe('saveProfile: a profile that is not valid', () => {
  test.each([
    ['risk below 0.5', { maxRiskPct: '0.49' }],
    ['risk above 2', { maxRiskPct: '2.01' }],
    ['leverage above the 1:5 ceiling', { maxLeverage: '5.01' }],
    ['leverage zero', { maxLeverage: '0' }],
    ['RRR below 1.5', { targetRrr: '1.49' }],
    ['RRR above 3.5', { targetRrr: '3.51' }],
    [
      'RRR above 2.5 for a counter-trend style',
      { style: 'TREND_COUNTERING', targetRrr: '2.51' },
    ],
    ['equity zero', { equity: '0' }],
    ['a minimum stop of zero', { minSld: '0' }],
    ['a negative commission', { commission: '-1' }],
    ['an unknown trader type', { traderType: 'SWING' }],
    ['a figure that is not a number', { equity: 'lots' }],
    ['a figure padded with spaces', { equity: ' 12500.50 ' }],
  ])(
    '%s: refused with the engine’s problems, nothing written',
    async (_name, over) => {
      const { client, db } = setup();
      const result = await saveProfile(
        'user-1',
        { ...PROFILE, ...over },
        {
          client,
          key: KEY_V1,
          newId,
        }
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe('INVALID_PROFILE');
      // the problems are exactly the validator's, so the card can show them all
      const expected = validateProfile({ ...PROFILE, ...over });
      expect(expected.ok).toBe(false);
      if (!expected.ok) expect(result.issues).toEqual(expected.issues);
      expect(db.calls).toEqual([]);
      expect(db.transactions).toBe(0);
    }
  );

  test('a missing figure is refused, never filled from a default', async () => {
    const { client, db } = setup();
    const { equity: _equity, ...withoutEquity } = PROFILE;
    const result = await saveProfile('user-1', withoutEquity, {
      client,
      key: KEY_V1,
    });
    expect(result).toMatchObject({ ok: false, code: 'INVALID_PROFILE' });
    expect(db.calls).toEqual([]);
  });

  test('is refused before the key is looked at (no key is set here, and it is not an AuditKeyError)', async () => {
    const { client } = setup();
    jest.replaceProperty(process, 'env', {
      ...process.env,
      NODE_ENV: 'production',
      ENGINE4_AUDIT_HMAC_KEY: undefined,
    } as NodeJS.ProcessEnv);
    try {
      const result = await saveProfile(
        'user-1',
        { ...PROFILE, equity: '0' },
        {
          client,
        }
      );
      expect(result).toMatchObject({ ok: false, code: 'INVALID_PROFILE' });
    } finally {
      jest.restoreAllMocks();
    }
  });
});

describe('saveProfile: a change, and no change', () => {
  test('saving the profile the trader already has writes nothing and returns its snapshot', async () => {
    const { client, db } = setup();
    await saveProfile('user-1', PROFILE, { client, key: KEY_V1, newId });
    db.calls.length = 0;
    const again = await saveProfile(
      'user-1',
      { ...PROFILE, equity: '12500.50' },
      {
        client,
        key: KEY_V1,
        newId,
      }
    );
    expect(again).toEqual({
      ok: true,
      profile: PROFILE,
      snapshotId: 'snap-1',
      changed: false,
    });
    expect(db.calls).toEqual(['prefs.findUnique']);
    expect(db.history).toHaveLength(1);
  });

  test.each([
    ['traderType', { traderType: 'SCALPER' }],
    ['style', { style: 'TREND_FOLLOWING' }],
    ['maxRiskPct', { maxRiskPct: '1.5' }],
    ['maxLeverage', { maxLeverage: '2.5' }],
    ['targetRrr', { targetRrr: '2.25' }],
    ['equity', { equity: '12500.51' }],
    ['minSld', { minSld: '15' }],
    ['commission', { commission: '4' }],
  ])(
    'a changed %s is a new snapshot and a moved current profile',
    async (_field, over) => {
      const { client, db } = setup();
      await saveProfile('user-1', PROFILE, { client, key: KEY_V1, newId });
      const result = await saveProfile(
        'user-1',
        { ...PROFILE, ...over },
        {
          client,
          key: KEY_V1,
          newId,
        }
      );
      expect(result).toMatchObject({
        ok: true,
        changed: true,
        snapshotId: 'snap-2',
      });
      expect(db.history.map((r) => r.id)).toEqual(['snap-1', 'snap-2']);
      expect(db.prefs.get('user-1')?.snapshot_id).toBe('snap-2');
      // the current profile holds the new figures, and a reader gets them back
      expect(db.prefs.get('user-1')).toMatchObject(
        profileColumnsOf({ ...PROFILE, ...over } as TraderProfile)
      );
      expect((await readProfile('user-1', client))?.profile).toEqual({
        ...PROFILE,
        ...over,
      });
      // the first snapshot is untouched
      expect(db.history[0]).toMatchObject(profileColumnsOf(PROFILE));
    }
  );

  test('a rotated key: the new snapshot carries the new version, the old one is NOT recomputed (D12)', async () => {
    const { client, db } = setup();
    await saveProfile('user-1', PROFILE, { client, key: KEY_V1, newId });
    const first = { ...db.history[0]! };
    await saveProfile(
      'user-1',
      { ...PROFILE, equity: '9000' },
      {
        client,
        key: KEY_V2,
        newId,
      }
    );
    expect(db.history[0]).toEqual(first);
    expect(db.history[0]?.key_version).toBe(1);
    expect(db.history[1]?.key_version).toBe(2);
    expect(db.history[1]?.user_id_hash).toBe(hashUserId('user-1', KEY_V2).hash);
    expect(db.history[1]?.user_id_hash).not.toBe(first.user_id_hash);
  });

  test('an unchanged save under a rotated key does not rewrite the old hash either', async () => {
    const { client, db } = setup();
    await saveProfile('user-1', PROFILE, { client, key: KEY_V1, newId });
    const before = JSON.stringify(db.history);
    await saveProfile('user-1', PROFILE, { client, key: KEY_V2, newId });
    expect(JSON.stringify(db.history)).toBe(before);
  });

  test('two users have their own current profile and their own hash', async () => {
    const { client, db } = setup();
    await saveProfile('user-1', PROFILE, { client, key: KEY_V1, newId });
    await saveProfile(
      'user-2',
      { ...PROFILE, equity: '800' },
      {
        client,
        key: KEY_V1,
        newId,
      }
    );
    expect(db.prefs.get('user-1')?.equity).toBe('12500.5');
    expect(db.prefs.get('user-2')?.equity).toBe('800');
    expect(db.history[0]?.user_id_hash).not.toBe(db.history[1]?.user_id_hash);
  });
});

describe('saveProfile: failures', () => {
  test('a failed write rolls the snapshot back with it: no snapshot without a current profile', async () => {
    const { client, db } = setup();
    db.failUpsert = true;
    await expect(
      saveProfile('user-1', PROFILE, { client, key: KEY_V1, newId })
    ).rejects.toThrow('the upsert failed');
    expect(db.history).toHaveLength(0);
    expect(db.prefs.size).toBe(0);
  });

  test('a missing key is thrown, and nothing is written', async () => {
    const { client, db } = setup();
    const env = process.env;
    jest.replaceProperty(process, 'env', {
      ...env,
      NODE_ENV: 'production',
      ENGINE4_AUDIT_HMAC_KEY: undefined,
    } as NodeJS.ProcessEnv);
    try {
      await expect(saveProfile('user-1', PROFILE, { client })).rejects.toThrow(
        AuditKeyError
      );
    } finally {
      jest.restoreAllMocks();
    }
    expect(db.calls).toEqual([]);
  });
});

describe('readProfile', () => {
  test('null when the trader never saved one', async () => {
    const { client } = setup();
    expect(await readProfile('user-1', client)).toBeNull();
  });

  test('returns the profile, its snapshot and when it was written', async () => {
    const { client } = setup();
    await saveProfile('user-1', PROFILE, { client, key: KEY_V1, newId });
    const stored = await readProfile('user-1', client);
    expect(stored).not.toBeNull();
    expect(stored?.profile).toEqual(PROFILE);
    expect(stored?.snapshotId).toBe('snap-1');
    expect(stored?.updatedAt).toEqual(NOW);
  });

  test('reads only the user’s own row', async () => {
    const { client } = setup();
    await saveProfile('user-1', PROFILE, { client, key: KEY_V1, newId });
    expect(await readProfile('user-2', client)).toBeNull();
  });

  test('a stored row the validator would refuse is an error, not a profile', async () => {
    const { client, db } = setup();
    await saveProfile('user-1', PROFILE, { client, key: KEY_V1, newId });
    db.prefs.set('user-1', { ...db.prefs.get('user-1')!, equity: '0' });
    await expect(readProfile('user-1', client)).rejects.toThrow(
      StoredProfileError
    );
    await expect(readProfile('user-1', client)).rejects.toThrow(/equity/);
  });

  test('...and the error names the user and every problem, joined', async () => {
    const { client, db } = setup();
    await saveProfile('user-1', PROFILE, { client, key: KEY_V1, newId });
    db.prefs.set('user-1', {
      ...db.prefs.get('user-1')!,
      equity: '0',
      min_sld: '0',
    });
    const error = await readProfile('user-1', client).then(
      () => null,
      (e: unknown) => e
    );
    expect(error).toBeInstanceOf(StoredProfileError);
    expect((error as StoredProfileError).name).toBe('StoredProfileError');
    expect((error as StoredProfileError).message).toBe(
      'the stored profile of user user-1 is not a valid profile: equity NOT_POSITIVE, minSld NOT_POSITIVE'
    );
    expect((error as StoredProfileError).issues).toHaveLength(2);
  });

  test('is a plain read: no transaction, no write', async () => {
    const { client, db } = setup();
    await saveProfile('user-1', PROFILE, { client, key: KEY_V1, newId });
    db.calls.length = 0;
    db.transactions = 0;
    await readProfile('user-1', client);
    expect(db.calls).toEqual(['prefs.findUnique']);
    expect(db.transactions).toBe(0);
  });
});

describe('profileColumnsOf', () => {
  test('maps the eight metrics onto the eight columns', () => {
    expect(profileColumnsOf(PROFILE)).toEqual({
      trader_type: 'DAY_TRADER',
      style: 'BOTH',
      max_risk_pct: '1.25',
      max_leverage: '3',
      target_rrr: '2',
      equity: '12500.5',
      min_sld: '14',
      commission: '3.5',
    });
  });
});

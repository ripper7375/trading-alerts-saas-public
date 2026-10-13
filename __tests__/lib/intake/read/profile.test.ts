/**
 * @jest-environment node
 */

/**
 * The profile projection (`lib/intake/read/profile.ts`, plan finding F11 and decision D9 c,
 * ADR-077, architecture 5.4): six of the eight metrics, NEVER the equity balance or the
 * commission, in every packet.
 */

import {
  StoredProfileError,
  type StoredProfile,
} from '@/lib/engine4/store/profile-store';
import type { TraderProfile } from '@/lib/engine4/types';
import {
  FORBIDDEN_PACKET_KEY,
  forbiddenKeyPaths,
  validatePacket,
} from '@/lib/intake';
import {
  projectProfile,
  readProfileProjection,
  type ProfileDeps,
} from '@/lib/intake/read/profile';

import { runWorld } from '../helpers/assemble';
import { goldenWorlds } from '../helpers/world';

const PROFILE: TraderProfile = {
  traderType: 'DAY_TRADER',
  style: 'TREND_FOLLOWING',
  maxRiskPct: '1.5',
  maxLeverage: '1.5',
  targetRrr: '1.75',
  equity: '5000',
  minSld: '13',
  commission: '4',
};

const stored = (over: Partial<TraderProfile> = {}): StoredProfile => ({
  profile: { ...PROFILE, ...over },
  snapshotId: 'snap-1',
  updatedAt: new Date(0),
});

const deps = (answer: () => Promise<StoredProfile | null>): ProfileDeps => ({
  readProfile: answer,
});

describe('the projection', () => {
  it('has exactly the six fields a prompt may see, as the stored text', () => {
    const result = projectProfile(stored());
    expect(result).toEqual({
      ok: true,
      profile: {
        trader_type: 'DAY_TRADER',
        style: 'TREND_FOLLOWING',
        max_risk_pct: '1.5',
        max_leverage: '1.5',
        target_rrr: '1.75',
        min_sld: '13',
      },
    });
  });

  it('carries neither the equity nor the commission, at any depth, whatever the profile holds', () => {
    // a profile that grew a field, or an object with the two as extra keys, cannot leak them
    const rich = {
      ...stored(),
      profile: {
        ...PROFILE,
        secret: 'x',
        nested: { equity: 1, commission: 2 },
      },
    } as unknown as StoredProfile;
    for (const input of [
      stored(),
      rich,
      stored({ equity: '999999', commission: '12' }),
    ]) {
      const result = projectProfile(input);
      expect(result.ok).toBe(true);
      expect(forbiddenKeyPaths(result)).toEqual([]);
      const text = JSON.stringify(result);
      expect(text).not.toMatch(FORBIDDEN_PACKET_KEY);
      expect(text).not.toContain('999999');
      expect(text).not.toContain('"4"');
      expect(text).not.toContain('secret');
      if (result.ok)
        expect(Object.keys(result.profile)).toEqual([
          'trader_type',
          'style',
          'max_risk_pct',
          'max_leverage',
          'target_rrr',
          'min_sld',
        ]);
    }
  });

  it('covers both trader types and all three styles', () => {
    for (const traderType of ['DAY_TRADER', 'SCALPER'] as const) {
      for (const style of [
        'TREND_FOLLOWING',
        'TREND_COUNTERING',
        'BOTH',
      ] as const) {
        expect(projectProfile(stored({ traderType, style }))).toMatchObject({
          ok: true,
          profile: { trader_type: traderType, style },
        });
      }
    }
  });

  it('keeps the stored decimals exactly: no float, no rounding', () => {
    const result = projectProfile(
      stored({
        maxRiskPct: '0.75',
        maxLeverage: '3.25',
        targetRrr: '2.5',
        minSld: '13.5',
      })
    );
    expect(result).toMatchObject({
      ok: true,
      profile: {
        max_risk_pct: '0.75',
        max_leverage: '3.25',
        target_rrr: '2.5',
        min_sld: '13.5',
      },
    });
  });

  it.each([
    ['a trader type that does not exist', { traderType: 'SWING' }],
    ['a style that does not exist', { style: 'RANDOM' }],
    ['a risk that is not a decimal', { maxRiskPct: '1,5' }],
    ['a leverage with a sign', { maxLeverage: '-1' }],
    ['a target that is empty', { targetRrr: '' }],
    ['a stop distance in exponent form', { minSld: '1e1' }],
    ['a risk that ends in a point', { maxRiskPct: '1.' }],
    ['a number where text is stored', { maxRiskPct: 1.5 as unknown as string }],
  ])('refuses %s', (_name, change) => {
    expect(projectProfile(stored(change as Partial<TraderProfile>))).toEqual({
      ok: false,
      code: 'PROFILE_UNREADABLE',
      detail: 'the stored profile is not well formed',
    });
  });
});

describe('reading it', () => {
  it('reads the profile of the user it is given', async () => {
    const seen: string[] = [];
    const result = await readProfileProjection('user-1', {
      readProfile: async (id) => {
        seen.push(id);
        return stored();
      },
    });
    expect(result.ok).toBe(true);
    expect(seen).toEqual(['user-1']);
  });

  it('says PROFILE_NOT_SET for a trader who never confirmed one', async () => {
    expect(
      await readProfileProjection(
        'u',
        deps(async () => null)
      )
    ).toEqual({
      ok: false,
      code: 'PROFILE_NOT_SET',
      detail: 'the trader has not confirmed a profile',
    });
  });

  it('says PROFILE_UNREADABLE for a stored profile that fails its own validator', async () => {
    const result = await readProfileProjection(
      'u',
      deps(async () => {
        throw new StoredProfileError('u', []);
      })
    );
    expect(result).toEqual({
      ok: false,
      code: 'PROFILE_UNREADABLE',
      detail: 'the stored profile fails its own validator',
    });
  });

  it('says DATABASE_ERROR for anything else that fails, without the database’s own text leaking the user', async () => {
    const result = await readProfileProjection(
      'u',
      deps(async () => {
        throw new Error('connection refused');
      })
    );
    expect(result).toEqual({
      ok: false,
      code: 'DATABASE_ERROR',
      detail: 'the profile could not be read: connection refused',
    });
    const odd = await readProfileProjection(
      'u',
      deps(() => Promise.reject('plain text'))
    );
    expect(odd).toMatchObject({ ok: false, code: 'DATABASE_ERROR' });
    expect(odd.ok ? '' : odd.detail).toContain('unknown error');
  });

  it('never throws, even when the reader itself throws before it returns a promise', async () => {
    const result = await readProfileProjection(
      'u',
      deps(() => {
        throw new TypeError('sync failure');
      })
    );
    expect(result).toEqual({
      ok: false,
      code: 'DATABASE_ERROR',
      detail: 'the profile could not be read: sync failure',
    });
  });
});

describe('in a packet', () => {
  it('a packet with the projection passes, and one that carries the equity or the commission is refused', async () => {
    const w = goldenWorlds()[3]!;
    const run = await runWorld(w, 'DAY_TRADER', 'RISK_SIZING');
    const projection = projectProfile(stored());
    if (!projection.ok) throw new Error('no projection');
    const packet = { ...run.packet!, profile: projection.profile };
    expect(validatePacket(packet).ok).toBe(true);

    for (const key of [
      'equity',
      'commission',
      'account_equity',
      'Commission_per_lot',
    ]) {
      const leaked = {
        ...packet,
        profile: { ...packet.profile, [key]: '5000' },
      };
      const result = validatePacket(leaked);
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.issues.some((i) => i.code === 'FORBIDDEN_KEY')).toBe(
          true
        );
    }
    // at depth, too
    const deep = {
      ...packet,
      readings: { ...packet.readings, extra: { a: [{ equity: 1 }] } },
    };
    expect(validatePacket(deep).ok).toBe(false);
  });
});

/**
 * @jest-environment node
 */

/**
 * One value changed in `config/entitlements.ts` is the value every reader follows (architecture
 * 7.13; ADR-074 "one table in config, read by every gate"; build step 7 part 6).
 *
 * The readers are loaded fresh, in isolation, over a table with ONE value changed (the real
 * module's own reader, built over the changed table), and each reader is asked. Then the source tree
 * is scanned to show these are ALL the readers: nothing reads the table, or the flag it replaced, in
 * a way this test would not see.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

import type { EntitlementTable } from '@/config/entitlements';

const ROOT = resolve(__dirname, '..', '..', '..');

jest.mock('@/lib/auth/session', () => ({ getSession: jest.fn() }));
jest.mock('@/lib/i18n/server-locale', () => ({ getServerLanguage: jest.fn() }));
jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));
jest.mock('@/lib/engine4/store/profile-store', () => ({
  readProfile: jest.fn(),
  StoredProfileError: class extends Error {},
}));
jest.mock('@/lib/intake/read/snapshot', () => ({ readSnapshot: jest.fn() }));
jest.mock('@/lib/intake/read/events', () => ({
  readUpcomingEvents: jest.fn(),
}));

interface Readers {
  tierValidation: typeof import('@/lib/tier-validation');
  platform: typeof import('@/lib/platform/entitlements');
  access: typeof import('@/lib/intake/server/access');
}

/** Load every reader over the table `change` makes of the shipped one. */
function load(
  change: (table: Record<string, Record<string, unknown>>) => void
): Readers {
  let readers: Readers | undefined;
  jest.isolateModules(() => {
    jest.doMock('@/config/entitlements', () => {
      const actual = jest.requireActual(
        '@/config/entitlements'
      ) as typeof import('@/config/entitlements');
      const copy = JSON.parse(JSON.stringify(actual.ENTITLEMENTS)) as Record<
        string,
        Record<string, unknown>
      >;
      change(copy);
      const table = copy as unknown as EntitlementTable;
      return {
        ...actual,
        ENTITLEMENTS: table,
        entitlementOf: actual.makeEntitlementOf(table),
      };
    });
    readers = {
      tierValidation: require('@/lib/tier-validation'),
      platform: require('@/lib/platform/entitlements'),
      access: require('@/lib/intake/server/access'),
    };
  });
  jest.dontMock('@/config/entitlements');
  return readers as Readers;
}

afterEach(() => {
  jest.resetModules();
});

describe('the control: the shipped table', () => {
  it('Free is refused by every reader of the analyst', async () => {
    const r = load(() => undefined);
    expect(r.tierValidation.canAccessAiAnalyst('FREE').allowed).toBe(false);
    expect(r.platform.canUseAiChat('FREE')).toBe(false);
    expect(r.access.entitlementPort.allows('FREE')).toBe(false);
    expect(r.platform.quotaModeOf('FREE')).toBe('NONE');
    expect(r.tierValidation.canAccessAiAnalyst('PRO').allowed).toBe(true);
    expect(r.access.entitlementPort.allows('PRO')).toBe(true);
  });
});

describe('one value changed: the live analyst for Free', () => {
  it('opens the tier helper, the session gate’s port, the platform reader and the quota mode together', async () => {
    const r = load((table) => {
      table['ai_chat_and_report1']!['FREE'] = 'MONTHLY_UNITS';
    });
    expect(r.tierValidation.canAccessAiAnalyst('FREE')).toEqual({
      allowed: true,
    });
    expect(r.access.entitlementPort.allows('FREE')).toBe(true);
    expect(r.platform.canUseAiChat('FREE')).toBe(true);
    expect(r.platform.seesRecordedDemo('FREE')).toBe(false);
    expect(r.platform.quotaModeOf('FREE')).toBe('MONTHLY_UNITS');
  });

  it('and the quota port then meters the Free tier, against the allowance, with no other change', async () => {
    const r = load((table) => {
      table['ai_chat_and_report1']!['FREE'] = 'MONTHLY_UNITS';
    });
    const balance = jest.fn(async () => ({
      limit: 5_000,
      used: 0,
      reserved: 0,
      available: 5_000,
    }));
    const ledger = {
      balance,
      reserve: jest.fn(),
      settle: jest.fn(),
      release: jest.fn(),
    };
    const port = r.access.quotaPort(
      { PRO_MONTHLY_UNITS: '5000' },
      { ledger, now: () => 1_800_000_000_000 }
    );
    await expect(
      port.precheck({ userId: 'u', tier: 'FREE', kind: 'TYPED' })
    ).resolves.toEqual({ allowed: true });
    expect(balance).toHaveBeenCalledWith({
      userId: 'u',
      nowMs: 1_800_000_000_000,
      allowanceUnits: 5_000,
    });
  });
});

describe('one value changed: the live analyst taken from Pro', () => {
  it('closes every reader of the analyst, and the quota port refuses', async () => {
    const r = load((table) => {
      table['ai_chat_and_report1']!['PRO'] = 'RECORDED_DEMO';
    });
    expect(r.tierValidation.canAccessAiAnalyst('PRO').allowed).toBe(false);
    expect(r.access.entitlementPort.allows('PRO')).toBe(false);
    expect(r.platform.canUseAiChat('PRO')).toBe(false);
    const ledger = {
      balance: jest.fn(),
      reserve: jest.fn(),
      settle: jest.fn(),
      release: jest.fn(),
    };
    const port = r.access.quotaPort(
      { PRO_MONTHLY_UNITS: '5000' },
      { ledger, now: () => 1_800_000_000_000 }
    );
    await expect(
      port.precheck({ userId: 'u', tier: 'PRO', kind: 'TYPED' })
    ).resolves.toEqual({ allowed: false });
    expect(ledger.balance).not.toHaveBeenCalled();
  });
});

describe('one value changed in each of the other features, for each tier', () => {
  const CASES: [
    string,
    'FREE' | 'PRO',
    unknown,
    (r: Readers) => unknown,
    unknown,
  ][] = [
    ['report2', 'FREE', true, (r) => r.platform.canUseReport2('FREE'), true],
    ['report2', 'PRO', false, (r) => r.platform.canUseReport2('PRO'), false],
    [
      'chart_image_to_model',
      'FREE',
      true,
      (r) => r.platform.canSendChartToModel('FREE'),
      true,
    ],
    [
      'chart_image_to_model',
      'PRO',
      false,
      (r) => r.platform.canSendChartToModel('PRO'),
      false,
    ],
    [
      'chart_download',
      'FREE',
      true,
      (r) => r.platform.canDownloadChart('FREE'),
      true,
    ],
    [
      'chart_download',
      'PRO',
      false,
      (r) => r.platform.canDownloadChart('PRO'),
      false,
    ],
    [
      'session_clock_and_countdown',
      'FREE',
      true,
      (r) => r.platform.hasSessionClock('FREE'),
      true,
    ],
    [
      'session_clock_and_countdown',
      'PRO',
      false,
      (r) => r.platform.hasSessionClock('PRO'),
      false,
    ],
    [
      'model_choice',
      'FREE',
      'PASSED_MODELS',
      (r) => r.platform.canChooseModel('FREE'),
      true,
    ],
    [
      'model_choice',
      'PRO',
      false,
      (r) => r.platform.canChooseModel('PRO'),
      false,
    ],
    [
      'chat_history',
      'FREE',
      'TWELVE_MONTHS',
      (r) => r.platform.chatHistoryMonths('FREE'),
      12,
    ],
    [
      'chat_history',
      'PRO',
      false,
      (r) => r.platform.chatHistoryMonths('PRO'),
      0,
    ],
  ];

  it.each(CASES)(
    '%s for %s set to %j',
    (feature, tier, value, read, expected) => {
      const r = load((table) => {
        table[feature]![tier] = value;
      });
      expect(read(r)).toBe(expected);
      // and the same change shows in the tier's whole row
      expect(
        (r.platform.entitlementsOf(tier).values as Record<string, unknown>)[
          feature
        ]
      ).toBe(value);
    }
  );

  it('a change to one feature moves no other', () => {
    const r = load((table) => {
      table['report2']!['FREE'] = true;
    });
    expect(r.platform.canUseReport2('FREE')).toBe(true);
    expect(r.platform.canDownloadChart('FREE')).toBe(false);
    expect(r.platform.canUseAiChat('FREE')).toBe(false);
    expect(r.platform.chatHistoryMonths('FREE')).toBe(0);
  });
});

describe('these are all the readers', () => {
  function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.next') continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
      else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.d.ts'))
        out.push(full);
    }
    return out;
  }
  const FILES = ['app', 'components', 'hooks', 'lib', 'config', 'src']
    .map((d) => join(ROOT, d))
    .filter((d) => {
      try {
        return statSync(d).isDirectory();
      } catch {
        return false;
      }
    })
    .flatMap(sourceFiles)
    .map((full) => ({
      path: full.slice(ROOT.length + 1).replace(/\\/g, '/'),
      text: readFileSync(full, 'utf8'),
    }));

  const importers = (module: string): string[] =>
    FILES.filter((f) =>
      new RegExp(`from '${module.replace(/[/.]/g, '\\$&')}'`).test(f.text)
    )
      .map((f) => f.path)
      .sort();

  it('only the tier helper and the platform reader import the table', () => {
    expect(importers('@/config/entitlements')).toEqual([
      'lib/platform/entitlements.ts',
      'lib/tier-validation.ts',
    ]);
  });

  it('only the session gate’s adapters import the platform reader', () => {
    expect(importers('@/lib/platform/entitlements')).toEqual([
      'lib/intake/server/access.ts',
    ]);
  });

  it('the old flag is read by nothing the table does not already cover', () => {
    const readers = FILES.filter((f) => /\baiAnalystAllowed\b/.test(f.text))
      .map((f) => f.path)
      .sort();
    // the shared package's helper (re-exported by lib/tier-config.ts for the throwaway metering route of
    // step 6, which part 7 deletes) is the one place the old flag is still read; tier-validation is not
    expect(readers).toEqual([]);
    expect(
      FILES.filter((f) => /\bcanAccessAiAnalyst\b/.test(f.text))
        .map((f) => f.path)
        .sort()
    ).toEqual([
      'app/api/test/ai-metering/route.ts',
      'lib/engine4/server/session.ts',
      'lib/tier-config.ts',
      'lib/tier-validation.ts',
    ]);
  });

  it('lib/tier-validation.ts no longer takes the analyst’s answer from the shared package', () => {
    const text = FILES.find((f) => f.path === 'lib/tier-validation.ts')!.text;
    expect(text).not.toMatch(/sharedCanAccessAiAnalyst/);
    expect(text).toMatch(/entitlementOf\('ai_chat_and_report1', tier\)/);
  });

  it('lib/intake/server/access.ts no longer takes the tier from canAccessAiAnalyst', () => {
    const text = FILES.find(
      (f) => f.path === 'lib/intake/server/access.ts'
    )!.text;
    expect(text).not.toMatch(/canAccessAiAnalyst/);
    expect(text).toMatch(/canUseAiChat\(tier\)/);
  });
});

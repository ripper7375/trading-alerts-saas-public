/**
 * @jest-environment node
 */
/**
 * One bcrypt cost for every new password hash (CODE-13, WS-6).
 *
 * Passwords were hashed at cost 10 in most places and at cost 12 in two. The cost is stored inside
 * every hash, so raising it changes only the hashes written from now on: the old cost-10 hashes
 * keep verifying. The 2FA backup codes are the exception and stay at cost 10
 * (`BACKUP_CODE_BCRYPT_COST`): ten of them are hashed in a row, so cost 12 made enabling 2FA take
 * about 4 s (plan WS-6, Deviation 8). Held here:
 *
 * 1. the two constants are 12 and 10;
 * 2. the backup codes carry the backup-code cost (the reset-password route and the development
 *    sign-in have their cost-12 assertions next to their other tests);
 * 3. no bcrypt hash call anywhere in `app/` or `lib/` names another cost, so a new call site
 *    cannot quietly bring cost 10 back for a password.
 */

import fs from 'fs';
import path from 'path';

import bcrypt from 'bcryptjs';

import { BACKUP_CODE_BCRYPT_COST, BCRYPT_COST } from '@/lib/auth/password-hash';
import { generateBackupCodes, verifyBackupCode } from '@/lib/auth/two-factor';

// The ten backup codes are hashed one after the other.
const SLOW = 30_000;

describe('the bcrypt costs', () => {
  it('are 12 for a password', () => {
    expect(BCRYPT_COST).toBe(12);
  });

  it('are 10 for a 2FA backup code', () => {
    expect(BACKUP_CODE_BCRYPT_COST).toBe(10);
  });
});

describe('2FA backup codes', () => {
  it(
    'are hashed at BACKUP_CODE_BCRYPT_COST (10, not the password cost) and verify against their plain codes',
    async () => {
      const { plainCodes, hashedCodes } = await generateBackupCodes();

      expect(plainCodes).toHaveLength(10);
      expect(hashedCodes).toHaveLength(10);
      for (const hashed of hashedCodes) {
        expect(bcrypt.getRounds(hashed)).toBe(BACKUP_CODE_BCRYPT_COST);
        expect(bcrypt.getRounds(hashed)).toBe(10);
      }
      await expect(verifyBackupCode(plainCodes[3], hashedCodes)).resolves.toBe(
        3
      );
      await expect(verifyBackupCode('0000-0000', hashedCodes)).resolves.toBe(
        -1
      );
    },
    SLOW
  );

  it('verify whichever cost they were hashed at (the cost is inside the hash)', async () => {
    const hashed = [
      await bcrypt.hash('abcd-ef01', 10),
      await bcrypt.hash('1234-5678', 12),
    ];

    await expect(verifyBackupCode('1234-5678', hashed)).resolves.toBe(1);
    await expect(verifyBackupCode('ABCD-EF01', hashed)).resolves.toBe(0);
  });
});

/** The second argument of every `bcrypt.hash(` / `hash(` call in a file that imports bcryptjs. */
function hashCallCosts(source: string): string[] {
  if (!/from 'bcryptjs'/.test(source)) return [];
  const costs: string[] = [];
  const call = /(?:\bbcrypt\.|(?<![.\w]))hash\(/g;
  for (let match = call.exec(source); match; match = call.exec(source)) {
    const args: string[] = [];
    let depth = 1;
    let current = '';
    for (let i = call.lastIndex; i < source.length; i++) {
      const ch = source[i];
      if (ch === '(') depth++;
      if (ch === ')' && --depth === 0) break;
      if (ch === ',' && depth === 1) {
        args.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    args.push(current.trim());
    costs.push(args[1] ?? '<no cost>');
  }
  return costs;
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'node_modules' ? [] : sourceFiles(full);
    }
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe('every bcrypt hash call in app/ and lib/', () => {
  const root = path.resolve(__dirname, '..', '..', '..');
  // The development seed script hashes a throw-away password at cost 10; it never runs in
  // production (plan WS-6, Deviation 3).
  const SEED = path.join('lib', 'db', 'seed.ts');

  const calls = [
    ...sourceFiles(path.join(root, 'app')),
    ...sourceFiles(path.join(root, 'lib')),
  ]
    .filter((file) => path.relative(root, file) !== SEED)
    .flatMap((file) =>
      hashCallCosts(fs.readFileSync(file, 'utf8')).map((cost) => ({
        file: path.relative(root, file).replace(/\\/g, '/'),
        cost,
      }))
    );

  it('finds the call sites it is meant to guard', () => {
    const files = new Set(calls.map((c) => c.file));
    for (const expected of [
      'app/api/auth/reset-password/route.ts',
      'app/api/user/password/route.ts',
      'lib/auth/auth-options.ts',
      'lib/auth/two-factor.ts',
    ]) {
      expect(files).toContain(expected);
    }
  });

  it('names BCRYPT_COST (or the same 12) or the backup-code cost, never another cost', () => {
    const offenders = calls.filter(
      (c) => !/^(BCRYPT_COST|BACKUP_CODE_BCRYPT_COST|12)$/.test(c.cost)
    );
    expect(offenders).toEqual([]);
  });

  it('uses BCRYPT_COST for the passwords in the two files this order changed', () => {
    for (const file of [
      'app/api/auth/reset-password/route.ts',
      'lib/auth/auth-options.ts',
    ]) {
      const costs = calls.filter((c) => c.file === file).map((c) => c.cost);
      expect(costs.length).toBeGreaterThan(0);
      expect(costs.every((cost) => cost === 'BCRYPT_COST')).toBe(true);
    }
  });

  it('uses BACKUP_CODE_BCRYPT_COST, and only it, for the backup codes', () => {
    const costs = calls
      .filter((c) => c.file === 'lib/auth/two-factor.ts')
      .map((c) => c.cost);
    expect(costs).toEqual(['BACKUP_CODE_BCRYPT_COST']);
  });
});

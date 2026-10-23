/**
 * One bcrypt cost for every new password hash (CODE-13, WS-6).
 *
 * Passwords were hashed at cost 10 in most places and at cost 12 in one. The cost is stored inside
 * every hash, so raising it changes only the hashes written from now on: the old cost-10 hashes
 * keep verifying. The 2FA backup codes are the exception and stay at cost 10
 * (`BACKUP_CODE_BCRYPT_COST`): ten of them are hashed in a row, so cost 12 made enabling 2FA take
 * about 4 s (plan WS-6, Deviation 8). Held here: the two constants, and that no bcrypt hash call
 * in `src/` names another cost, so a new call site cannot quietly bring cost 10 back for a
 * password. What each site writes is asserted next to its other tests (`auth.service*.spec.ts`,
 * `two-factor.util.spec.ts`).
 */
import fs from 'fs';
import path from 'path';

import { BACKUP_CODE_BCRYPT_COST, BCRYPT_COST } from './password-hash.const';

describe('the bcrypt costs', () => {
  it('are 12 for a password', () => {
    expect(BCRYPT_COST).toBe(12);
  });

  it('are 10 for a 2FA backup code', () => {
    expect(BACKUP_CODE_BCRYPT_COST).toBe(10);
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

function productionSources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return productionSources(full);
    return /\.ts$/.test(entry.name) && !/\.spec\.ts$/.test(entry.name)
      ? [full]
      : [];
  });
}

describe('every bcrypt hash call in src/', () => {
  const src = path.resolve(__dirname, '..');
  const calls = productionSources(src).flatMap((file) =>
    hashCallCosts(fs.readFileSync(file, 'utf8')).map((cost) => ({
      file: path.relative(src, file).replace(/\\/g, '/'),
      cost,
    }))
  );

  it('finds the call sites it is meant to guard', () => {
    const files = new Set(calls.map((c) => c.file));
    for (const expected of [
      'auth/auth.service.ts',
      'two-factor/two-factor.util.ts',
      'users/users.service.ts',
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

  it('uses BCRYPT_COST for every password in auth.service.ts', () => {
    const costs = calls
      .filter((c) => c.file === 'auth/auth.service.ts')
      .map((c) => c.cost);
    expect(costs.length).toBeGreaterThan(0);
    expect(costs.every((cost) => cost === 'BCRYPT_COST')).toBe(true);
  });

  it('uses BACKUP_CODE_BCRYPT_COST, and only it, for the backup codes', () => {
    const costs = calls
      .filter((c) => c.file === 'two-factor/two-factor.util.ts')
      .map((c) => c.cost);
    expect(costs).toEqual(['BACKUP_CODE_BCRYPT_COST']);
  });
});

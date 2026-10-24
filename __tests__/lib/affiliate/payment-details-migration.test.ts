/**
 * @jest-environment node
 *
 * WS-11 (CODE-06C): the migration FILE and the schemas that carry
 * `AffiliateProfile.paymentDetailsEncrypted`.
 *
 * The Executor never applies a migration to a live database; this suite holds
 * the file and the three mirrors of the model to the same shape, so a column
 * added to one place and forgotten in another fails here instead of at runtime.
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const MIGRATION_DIR = '20261026000000_encrypt_payment_details';

function read(...parts: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...parts), 'utf8');
}

/** The body of `model AffiliateProfile { ... }`. */
function affiliateProfileModel(schemaPath: string): string {
  const text = read(schemaPath);
  const start = text.indexOf('model AffiliateProfile {');
  expect(start).toBeGreaterThan(-1);
  const end = text.indexOf('\n}', start);
  return text.slice(start, end);
}

function sqlStatements(sql: string): string[] {
  return sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

describe('the migration file', () => {
  const sql = read('prisma', 'migrations', MIGRATION_DIR, 'migration.sql');

  it('sorts after every earlier migration', () => {
    const names = fs
      .readdirSync(path.join(ROOT, 'prisma', 'migrations'), {
        withFileTypes: true,
      })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    expect(names[names.length - 1]).toBe(MIGRATION_DIR);
  });

  it('adds exactly one nullable TEXT column, safely re-runnable', () => {
    expect(sqlStatements(sql)).toEqual([
      'ALTER TABLE "AffiliateProfile" ADD COLUMN IF NOT EXISTS "paymentDetailsEncrypted" TEXT',
    ]);
  });

  it('does not drop, rewrite or default anything (the plain column stays for the transition)', () => {
    const code = sqlStatements(sql).join(' ');
    expect(code).not.toMatch(/DROP|UPDATE|DELETE|NOT NULL|DEFAULT|SET /i);
  });

  it('tells Davin to apply it before any deploy, alone, and that the Executor did not', () => {
    expect(sql).toMatch(/NOT APPLIED/);
    expect(sql).toMatch(/BEFORE/i);
    expect(sql).toContain('prisma migrate resolve --applied');
    expect(sql).toContain('PAYMENT_DETAILS_ENCRYPTION_KEY');
  });
});

describe('the Prisma schemas', () => {
  it.each([
    ['monolith', 'prisma/non-market-data/schema.prisma'],
    ['money-service', 'money-service/prisma/schema.prisma'],
  ])(
    '%s: AffiliateProfile has the nullable column and keeps the plain one',
    (_n, p) => {
      const model = affiliateProfileModel(p);
      expect(model).toMatch(
        /^\s*paymentDetailsEncrypted\s+String\?\s*(\/\/.*)?$/m
      );
      expect(model).toMatch(/^\s*paymentDetails\s+Json\s*(\/\/.*)?$/m);
    }
  );

  it('the monolith stubs mirror the model', () => {
    const stubs = read('types', 'prisma-stubs.d.ts');
    const start = stubs.indexOf('export interface AffiliateProfile {');
    expect(start).toBeGreaterThan(-1);
    const block = stubs.slice(start, stubs.indexOf('\n  }', start));
    expect(block).toMatch(/paymentDetailsEncrypted:\s*string \| null;/);
  });
});

/**
 * @jest-environment node
 *
 * WS-11 (CODE-06C): a source guard for the dual write and the decrypt-first read.
 *
 * Behaviour tests cover each site; this holds the rule for the next one:
 *  - a file that creates an `AffiliateProfile` writes its payment details through
 *    `paymentDetailsForWrite` (both columns), never as a bare `paymentDetails:`;
 *  - a file that selects or reads `paymentDetails` off a profile row reads it through
 *    `readPaymentDetails` and selects the encrypted column with it.
 * `frontend/` and `seed-code/` are not part of the running stacks (D9-2) and are not scanned.
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();

function sourceFiles(relDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        walk(full);
      } else if (
        /\.tsx?$/.test(entry.name) &&
        !/\.(test|spec)\.tsx?$/.test(entry.name) &&
        !entry.name.endsWith('.d.ts')
      ) {
        out.push(full);
      }
    }
  };
  walk(path.join(ROOT, relDir));
  return out;
}

const rel = (f: string): string => path.relative(ROOT, f).replace(/\\/g, '/');

const SCANNED = [
  ...sourceFiles('app'),
  ...sourceFiles('lib'),
  ...sourceFiles('money-service/src'),
  path.join(ROOT, 'prisma', 'seed.ts'),
]
  .filter((f) => !rel(f).endsWith('lib/affiliate/payment-details-crypto.ts'))
  .filter(
    (f) =>
      !rel(f).endsWith('money-service/src/common/payment-details-crypto.ts')
  );

describe('payment details are written through the dual-write helper', () => {
  const writers = SCANNED.filter((f) =>
    /affiliateProfile\s*\.\s*(create|upsert)\s*\(/.test(
      fs.readFileSync(f, 'utf8')
    )
  );

  it('finds the six known writers (a seventh needs a decision, not a bare literal)', () => {
    expect(writers.map(rel).sort()).toEqual(
      [
        'app/api/affiliate/profile/route.ts',
        'lib/affiliate/registration.ts',
        'lib/auth/auth-options.ts',
        'lib/auth/session.ts',
        'prisma/seed.ts',
      ].sort()
    );
  });

  it.each(writers.map((f) => [rel(f), f]))(
    '%s calls paymentDetailsForWrite',
    (_n, f) => {
      const text = fs.readFileSync(f as string, 'utf8');
      expect(text).toContain('paymentDetailsForWrite(');
    }
  );

  it('no writer assigns a bare literal or variable to the plain column', () => {
    for (const f of writers) {
      const text = fs.readFileSync(f, 'utf8');
      // `paymentDetails: {}` / `paymentDetails: x as ...` as a Prisma data key is the old, plain-only write.
      expect(
        `${rel(f)}: ${text.match(/^\s*paymentDetails:\s*(\{\}|[\w.]+ as )/m)?.[0] ?? ''}`
      ).toBe(`${rel(f)}: `);
    }
  });
});

describe('payment details are read through the decrypt-first helper', () => {
  const selecting = SCANNED.filter((f) =>
    /paymentDetails:\s*true/.test(fs.readFileSync(f, 'utf8'))
  );
  const reading = SCANNED.filter((f) =>
    /\b(profile|affiliate|profileRow|affiliateRow|row)\s*\.\s*paymentDetails\b/.test(
      fs.readFileSync(f, 'utf8')
    )
  );

  it('finds the known selects', () => {
    expect(selecting.map(rel).sort()).toEqual(
      [
        'app/api/admin/affiliates/reports/commission-owings/route.ts',
        'money-service/src/admin/admin-affiliate-reports.controller.ts',
      ].sort()
    );
  });

  it.each(selecting.map((f) => [rel(f), f]))(
    '%s selects the encrypted column with the plain one',
    (_n, f) => {
      expect(fs.readFileSync(f as string, 'utf8')).toMatch(
        /paymentDetailsEncrypted:\s*true/
      );
    }
  );

  it('no file reads the plain column off a profile row directly: only readPaymentDetails does', () => {
    expect(reading.map(rel)).toEqual([]);
  });

  it('the two admin readers and the two detail loaders call readPaymentDetails', () => {
    for (const p of [
      'app/api/admin/affiliates/reports/commission-owings/route.ts',
      'app/api/disbursement/affiliates/[affiliateId]/route.ts',
      'lib/admin/affiliate-management.ts',
      'money-service/src/admin/admin-affiliate-reports.controller.ts',
      'money-service/src/admin/affiliate-management.service.ts',
    ]) {
      expect(fs.readFileSync(path.join(ROOT, p), 'utf8')).toContain(
        'readPaymentDetails('
      );
    }
  });
});

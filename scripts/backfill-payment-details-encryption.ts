#!/usr/bin/env tsx
/**
 * One-off backfill for WS-11 (CODE-06C): encrypt `AffiliateProfile.paymentDetails` into
 * `AffiliateProfile.paymentDetailsEncrypted` for every row that does not have a ciphertext yet.
 *
 * DAVIN RUNS THIS. The Workhorse that wrote it never ran it against any database.
 *
 * Order of work (see the header of migration 20261026000000_encrypt_payment_details):
 *   1. PAYMENT_DETAILS_ENCRYPTION_KEY is set on Vercel and on money-service.
 *   2. The migration is applied (it adds the column).
 *   3. The monolith and money-service are deployed (new rows are written to both columns).
 *   4. This script:  verify first, dry run, then apply, then verify again.
 *
 *   Everything is read from the shell environment. Nothing is read from a .env file, so the
 *   staging clone in .env.local can never be hit by mistake, and nothing is written by default:
 *
 *     export DATABASE_URL='postgresql://...'                 # the database to work on
 *     export PAYMENT_DETAILS_ENCRYPTION_KEY='<64 hex chars>' # the SAME key the deployed stacks use
 *
 *     npx tsx scripts/backfill-payment-details-encryption.ts --verify        # read only
 *     npx tsx scripts/backfill-payment-details-encryption.ts                 # dry run (default)
 *     npx tsx scripts/backfill-payment-details-encryption.ts --apply --confirm-host=<host:port>
 *
 *   --confirm-host must equal the host:port of DATABASE_URL (the script prints it first): a wrong
 *   DATABASE_URL in the shell therefore stops at the confirmation, not after the writes.
 *   --batch-size=N (1..1000, default 200) and --limit=N (stop after N rows; for a trial run).
 *
 * What it does, and what it guarantees:
 *   - It refuses to run on the public test key that the application uses outside production: a real
 *     key must be configured, in every mode.
 *   - It only touches rows whose `paymentDetailsEncrypted` is NULL, so it can be run again, and it
 *     never overwrites a ciphertext a deployed writer already made.
 *   - Each ciphertext is decrypted again and compared with the plain column BEFORE it is written.
 *   - A row is written only if it has not changed since it was read (`updatedAt` is part of the
 *     WHERE), and `updatedAt` is written back unchanged: a backfill is not an edit of the profile.
 *   - It prints counts and row ids only. It never prints a payment detail or a ciphertext.
 *   - Exit code 0 only if nothing failed (`--verify`: nothing mismatched or unreadable).
 *
 * `--verify` is the check to run before the later order drops the plain column: it opens every
 * ciphertext with the configured key and compares it with the plain column. A row that differs was
 * changed in the plain column after it was encrypted (for example by the old `frontend/` app, if it
 * is deployed anywhere): decide which copy is right before the plain column goes.
 */

// Must come first: the helper below carries `import 'server-only'`, which throws in plain Node.
import './server-only-stub';

import {
  assertConfiguredEncryptionKey,
  decryptPaymentDetails,
  encryptPaymentDetails,
} from '../lib/affiliate/payment-details-crypto';

const DEFAULT_BATCH_SIZE = 200;
const MAX_BATCH_SIZE = 1000;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// The part of Prisma this script uses
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface BackfillRow {
  id: string;
  paymentDetails: unknown;
  paymentDetailsEncrypted?: string | null;
  updatedAt: Date;
}

export interface BackfillDb {
  affiliateProfile: {
    count(args?: {
      where?: { paymentDetailsEncrypted?: null };
    }): Promise<number>;
    findMany(args: {
      where?: { paymentDetailsEncrypted?: null; id?: { gt: string } };
      select: {
        id: true;
        paymentDetails: true;
        paymentDetailsEncrypted: true;
        updatedAt: true;
      };
      orderBy: { id: 'asc' };
      take: number;
    }): Promise<BackfillRow[]>;
    updateMany(args: {
      where: { id: string; paymentDetailsEncrypted: null; updatedAt: Date };
      data: { paymentDetailsEncrypted: string; updatedAt: Date };
    }): Promise<{ count: number }>;
  };
}

type Log = (line: string) => void;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Helpers
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** JSON text with the keys of every object sorted: two values that mean the same compare equal. */
function canonical(value: unknown): string {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v !== null && typeof v === 'object') {
      return Object.fromEntries(
        Object.keys(v as Record<string, unknown>)
          .sort()
          .map((k) => [k, walk((v as Record<string, unknown>)[k])])
      );
    }
    return v;
  };
  return JSON.stringify(walk(value)) ?? 'undefined';
}

/** The first non-empty line of an error message, short, so a database error cannot dump arguments. */
function reasonOf(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  const first = text.split('\n').find((l) => l.trim().length > 0) ?? 'unknown';
  return first.slice(0, 200);
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// The backfill (dry run and apply)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface BackfillOptions {
  apply: boolean;
  batchSize: number;
  limit?: number;
  log: Log;
}

export interface BackfillReport {
  /** Rows without a ciphertext when the run started. */
  pending: number;
  /** Rows written (apply only). */
  encrypted: number;
  /** Rows that could be encrypted and read back (dry run only). */
  rehearsed: number;
  /** Rows changed by someone else between the read and the write: left for the next run. */
  skippedChanged: number;
  failed: number;
  failures: Array<{ id: string; reason: string }>;
}

export async function runBackfill(
  db: BackfillDb,
  options: BackfillOptions
): Promise<BackfillReport> {
  const { apply, batchSize, limit, log } = options;

  // Every mode needs a real key: a dry run without one would give false confidence.
  assertConfiguredEncryptionKey();

  const pending = await db.affiliateProfile.count({
    where: { paymentDetailsEncrypted: null },
  });
  log(`Rows without an encrypted copy: ${pending}`);

  const report: BackfillReport = {
    pending,
    encrypted: 0,
    rehearsed: 0,
    skippedChanged: 0,
    failed: 0,
    failures: [],
  };

  let lastId: string | undefined;
  let processed = 0;

  for (;;) {
    const take =
      limit === undefined ? batchSize : Math.min(batchSize, limit - processed);
    if (take <= 0) break;

    const rows = await db.affiliateProfile.findMany({
      where: {
        paymentDetailsEncrypted: null,
        ...(lastId === undefined ? {} : { id: { gt: lastId } }),
      },
      select: {
        id: true,
        paymentDetails: true,
        paymentDetailsEncrypted: true,
        updatedAt: true,
      },
      orderBy: { id: 'asc' },
      take,
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      processed += 1;
      lastId = row.id;

      try {
        const blob = encryptPaymentDetails(row.paymentDetails);
        // Read it back before anything is written.
        if (
          canonical(decryptPaymentDetails(blob)) !==
          canonical(row.paymentDetails)
        ) {
          throw new Error('The ciphertext does not open to the plain value');
        }

        if (!apply) {
          report.rehearsed += 1;
          continue;
        }

        const { count } = await db.affiliateProfile.updateMany({
          where: {
            id: row.id,
            paymentDetailsEncrypted: null,
            updatedAt: row.updatedAt,
          },
          data: { paymentDetailsEncrypted: blob, updatedAt: row.updatedAt },
        });
        if (count === 1) report.encrypted += 1;
        else report.skippedChanged += 1;
      } catch (error) {
        report.failed += 1;
        report.failures.push({ id: row.id, reason: reasonOf(error) });
      }
    }

    log(
      `Progress: ${processed} row(s) looked at` +
        (apply
          ? `, ${report.encrypted} written, ${report.skippedChanged} changed meanwhile, ${report.failed} failed`
          : `, ${report.rehearsed} would be written, ${report.failed} would fail`)
    );
  }

  if (!apply)
    log('Dry run: nothing was written. Run again with --apply to write.');
  for (const f of report.failures) log(`FAILED ${f.id}: ${f.reason}`);
  return report;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// The check (read only)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface VerifyReport {
  scanned: number;
  /** Ciphertext opens and equals the plain column. */
  matching: number;
  /** No ciphertext yet. */
  pending: number;
  /** Ciphertext opens but differs from the plain column. */
  mismatched: string[];
  /** Ciphertext does not open with the configured key (or is not v1). */
  undecryptable: string[];
}

export async function runVerify(
  db: BackfillDb,
  options: { batchSize: number; log: Log }
): Promise<VerifyReport> {
  assertConfiguredEncryptionKey();

  const report: VerifyReport = {
    scanned: 0,
    matching: 0,
    pending: 0,
    mismatched: [],
    undecryptable: [],
  };
  let lastId: string | undefined;

  for (;;) {
    const rows = await db.affiliateProfile.findMany({
      ...(lastId === undefined ? {} : { where: { id: { gt: lastId } } }),
      select: {
        id: true,
        paymentDetails: true,
        paymentDetailsEncrypted: true,
        updatedAt: true,
      },
      orderBy: { id: 'asc' },
      take: options.batchSize,
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      report.scanned += 1;
      lastId = row.id;

      if (
        row.paymentDetailsEncrypted === null ||
        row.paymentDetailsEncrypted === undefined
      ) {
        report.pending += 1;
        continue;
      }
      try {
        const opened = decryptPaymentDetails(row.paymentDetailsEncrypted);
        if (canonical(opened) === canonical(row.paymentDetails))
          report.matching += 1;
        else report.mismatched.push(row.id);
      } catch {
        report.undecryptable.push(row.id);
      }
    }
  }

  options.log(
    `Verified ${report.scanned} row(s): ${report.matching} match, ${report.pending} not encrypted yet, ` +
      `${report.mismatched.length} differ from the plain column, ${report.undecryptable.length} do not open`
  );
  if (report.mismatched.length > 0) {
    options.log(`DIFFERENT (ids): ${report.mismatched.join(', ')}`);
  }
  if (report.undecryptable.length > 0) {
    options.log(`UNREADABLE (ids): ${report.undecryptable.join(', ')}`);
  }
  return report;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Command line
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface Args {
  mode: 'dry-run' | 'apply' | 'verify';
  batchSize: number;
  limit?: number;
  confirmHost?: string;
}

function positiveInt(flag: string, text: string, max?: number): number {
  const n = Number(text);
  if (!Number.isInteger(n) || n < 1 || (max !== undefined && n > max)) {
    throw new Error(
      `${flag} must be a whole number from 1${max === undefined ? '' : ` to ${max}`}`
    );
  }
  return n;
}

export function parseArgs(argv: string[]): Args {
  let apply = false;
  let verify = false;
  let batchSize = DEFAULT_BATCH_SIZE;
  let limit: number | undefined;
  let confirmHost: string | undefined;

  for (const arg of argv) {
    if (arg === '--apply') apply = true;
    else if (arg === '--verify') verify = true;
    else if (arg.startsWith('--confirm-host=')) {
      confirmHost = arg.slice('--confirm-host='.length);
    } else if (arg.startsWith('--batch-size=')) {
      batchSize = positiveInt('--batch-size', arg.slice(13), MAX_BATCH_SIZE);
    } else if (arg.startsWith('--limit=')) {
      limit = positiveInt('--limit', arg.slice(8));
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (apply && verify)
    throw new Error('Use either --apply or --verify, not both');
  if (apply && !confirmHost) {
    throw new Error(
      '--apply needs --confirm-host=<host:port>, the host and port of DATABASE_URL (the script prints them)'
    );
  }

  return {
    mode: verify ? 'verify' : apply ? 'apply' : 'dry-run',
    batchSize,
    ...(limit === undefined ? {} : { limit }),
    ...(confirmHost === undefined ? {} : { confirmHost }),
  };
}

/** Host, port and database name of a connection URL. Never the user name or the password. */
export function describeConnection(connectionString: string): {
  hostPort: string;
  database: string;
} {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL is not a valid connection URL');
  }
  return {
    hostPort: `${url.hostname}:${url.port || '5432'}`,
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
  };
}

/**
 * TLS settings for the pg adapter: the same as the application's (Railway's proxy certificate is
 * not verified, see lib/db/prisma.ts) for a remote host, none for a database on this machine, which
 * has no TLS (a scratch PostgreSQL used to rehearse the script).
 */
export function sslFor(
  connectionString: string
): false | { rejectUnauthorized: false } {
  const host = new URL(connectionString).hostname;
  return ['localhost', '127.0.0.1', '[::1]'].includes(host)
    ? false
    : { rejectUnauthorized: false };
}

async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv);

  const url = process.env['DATABASE_URL'];
  if (!url) {
    console.error('DATABASE_URL is not set in the shell.');
    return 2;
  }
  const target = describeConnection(url);
  console.log(`Database: ${target.hostPort}/${target.database}`);
  console.log(`Mode: ${args.mode}`);

  if (args.mode === 'apply' && args.confirmHost !== target.hostPort) {
    console.error(
      `--confirm-host (${args.confirmHost}) is not the host and port of DATABASE_URL (${target.hostPort}). Nothing was written.`
    );
    return 2;
  }

  // Loaded here, not at the top, so the tests of the logic above never load the Prisma client.
  // `require`, not `import()`: under tsx the dotted package name `.prisma/...` only resolves through CommonJS
  // (prisma/seed.ts reaches it the same way, through a static import that is compiled to a require).
  const { PrismaClient } =
    require('.prisma/non-market-client') as typeof import('.prisma/non-market-client');
  const { PrismaPg } =
    require('@prisma/adapter-pg') as typeof import('@prisma/adapter-pg');
  const adapter = new PrismaPg({
    connectionString: url,
    ssl: sslFor(url),
  });
  const prisma = new PrismaClient({ adapter });
  const db = prisma as unknown as BackfillDb;
  const log: Log = (line) => console.log(line);

  try {
    if (args.mode === 'verify') {
      const report = await runVerify(db, { batchSize: args.batchSize, log });
      return report.mismatched.length > 0 || report.undecryptable.length > 0
        ? 1
        : 0;
    }
    const report = await runBackfill(db, {
      apply: args.mode === 'apply',
      batchSize: args.batchSize,
      ...(args.limit === undefined ? {} : { limit: args.limit }),
      log,
    });
    return report.failed > 0 ? 1 : 0;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
      console.error(`Backfill stopped: ${reasonOf(error)}`);
      process.exit(1);
    });
}

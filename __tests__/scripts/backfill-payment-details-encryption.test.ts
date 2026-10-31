/**
 * @jest-environment node
 *
 * WS-11 (CODE-06C): the one-off backfill that Davin runs.
 * scripts/backfill-payment-details-encryption.ts
 *
 * The script is never run against a live database by the Workhorse; this
 * suite runs its logic against an in-memory stand-in of the one Prisma
 * delegate it uses (`affiliateProfile.count / findMany / updateMany`), with the
 * real helper and a real key.
 */

// The real helper, with `decryptPaymentDetails` wrapped so one test can make the read-back differ.
jest.mock('@/lib/affiliate/payment-details-crypto', () => {
  const actual = jest.requireActual('@/lib/affiliate/payment-details-crypto');
  return {
    ...actual,
    decryptPaymentDetails: jest.fn(actual.decryptPaymentDetails),
  };
});

import {
  PaymentDetailsKeyError,
  decryptPaymentDetails,
  encryptPaymentDetails,
} from '@/lib/affiliate/payment-details-crypto';

import {
  describeConnection,
  parseArgs,
  runBackfill,
  runVerify,
  sslFor,
  type BackfillDb,
} from '../../scripts/backfill-payment-details-encryption';

const KEY_ENV = 'PAYMENT_DETAILS_ENCRYPTION_KEY';
const savedKey = process.env[KEY_ENV];
const savedNodeEnv = process.env['NODE_ENV'];

interface Row {
  id: string;
  paymentDetails: unknown;
  paymentDetailsEncrypted: string | null;
  updatedAt: Date;
}

function makeDb(rows: Row[]): BackfillDb & {
  rows: Row[];
  calls: { updateMany: number };
  failOn: Set<string>;
  beforeUpdate?: (id: string) => void;
} {
  const state = {
    rows,
    calls: { updateMany: 0 },
    failOn: new Set<string>(),
    beforeUpdate: undefined as undefined | ((id: string) => void),
  };
  const sorted = (): Row[] =>
    [...state.rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return Object.assign(state, {
    affiliateProfile: {
      async count(args?: { where?: { paymentDetailsEncrypted?: null } }) {
        return state.rows.filter((r) =>
          args?.where && 'paymentDetailsEncrypted' in args.where
            ? r.paymentDetailsEncrypted === null
            : true
        ).length;
      },
      async findMany(args: {
        where?: { paymentDetailsEncrypted?: null; id?: { gt: string } };
        take: number;
      }) {
        let list = sorted();
        const w = args.where;
        if (
          w &&
          'paymentDetailsEncrypted' in w &&
          w.paymentDetailsEncrypted === null
        ) {
          list = list.filter((r) => r.paymentDetailsEncrypted === null);
        }
        const after = w?.id?.gt;
        if (after !== undefined) list = list.filter((r) => r.id > after);
        return list.slice(0, args.take).map((r) => ({ ...r }));
      },
      // Honours exactly the conditions the caller names, like a database does: a condition the
      // script leaves out is a condition that is not applied.
      async updateMany(args: {
        where: { id: string; paymentDetailsEncrypted?: null; updatedAt?: Date };
        data: { paymentDetailsEncrypted: string; updatedAt: Date };
      }) {
        state.calls.updateMany += 1;
        state.beforeUpdate?.(args.where.id);
        if (state.failOn.has(args.where.id)) throw new Error('write refused');
        const row = state.rows.find((r) => r.id === args.where.id);
        const w = args.where;
        if (
          !row ||
          ('paymentDetailsEncrypted' in w &&
            row.paymentDetailsEncrypted !== w.paymentDetailsEncrypted) ||
          (w.updatedAt !== undefined &&
            row.updatedAt.getTime() !== w.updatedAt.getTime())
        ) {
          return { count: 0 };
        }
        row.paymentDetailsEncrypted = args.data.paymentDetailsEncrypted;
        row.updatedAt = args.data.updatedAt;
        return { count: 1 };
      },
    },
  }) as never;
}

function row(
  id: string,
  details: unknown,
  encrypted: string | null = null
): Row {
  return {
    id,
    paymentDetails: details,
    paymentDetailsEncrypted: encrypted,
    updatedAt: new Date('2026-03-01T10:00:00.000Z'),
  };
}

beforeEach(() => {
  process.env[KEY_ENV] = '44'.repeat(32);
  process.env['NODE_ENV'] = 'test';
});
afterEach(() => {
  if (savedKey === undefined) delete process.env[KEY_ENV];
  else process.env[KEY_ENV] = savedKey;
  process.env['NODE_ENV'] = savedNodeEnv;
});

const MARK = 'DE89370400440532013000';

describe('runBackfill', () => {
  it('dry run: counts what it would encrypt and writes nothing', async () => {
    const db = makeDb([
      row('a', { iban: MARK }),
      row('b', {}),
      row('c', { x: 1 }, encryptPaymentDetails({ x: 1 })),
    ]);
    const lines: string[] = [];

    const report = await runBackfill(db, {
      apply: false,
      batchSize: 100,
      log: (l) => lines.push(l),
    });

    expect(report).toMatchObject({ pending: 2, encrypted: 0, failed: 0 });
    expect(db.calls.updateMany).toBe(0);
    expect(
      db.rows.filter((r) => r.paymentDetailsEncrypted === null)
    ).toHaveLength(2);
    expect(lines.join('\n')).not.toContain(MARK);
  });

  it('apply: encrypts every pending row and each value opens to its plain copy', async () => {
    const db = makeDb([
      row('a', { iban: MARK, email: 'a@wise.test' }),
      row('b', {}),
      row('c', null),
    ]);

    const report = await runBackfill(db, {
      apply: true,
      batchSize: 100,
      log: () => {},
    });

    expect(report).toMatchObject({
      pending: 3,
      encrypted: 3,
      failed: 0,
      skippedChanged: 0,
    });
    for (const r of db.rows) {
      expect(r.paymentDetailsEncrypted).toMatch(
        /^v1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/
      );
      expect(
        decryptPaymentDetails(r.paymentDetailsEncrypted as string)
      ).toEqual(r.paymentDetails);
    }
  });

  it('apply: leaves updatedAt as it was (a backfill is not an edit of the profile)', async () => {
    const db = makeDb([row('a', { iban: MARK })]);
    const before = db.rows[0]?.updatedAt.getTime();

    await runBackfill(db, { apply: true, batchSize: 100, log: () => {} });

    expect(db.rows[0]?.updatedAt.getTime()).toBe(before);
  });

  it('apply: never touches a row that already has a ciphertext', async () => {
    const existing = encryptPaymentDetails({ iban: 'KEEP' });
    const db = makeDb([
      row('a', { iban: 'stale' }, existing),
      row('b', { iban: MARK }),
    ]);

    await runBackfill(db, { apply: true, batchSize: 100, log: () => {} });

    expect(db.rows.find((r) => r.id === 'a')?.paymentDetailsEncrypted).toBe(
      existing
    );
    expect(db.calls.updateMany).toBe(1);
  });

  it('apply: a second run has nothing to do', async () => {
    const db = makeDb([row('a', { iban: MARK }), row('b', {})]);
    await runBackfill(db, { apply: true, batchSize: 100, log: () => {} });
    const after = db.rows.map((r) => r.paymentDetailsEncrypted);

    const report = await runBackfill(db, {
      apply: true,
      batchSize: 100,
      log: () => {},
    });

    expect(report).toMatchObject({ pending: 0, encrypted: 0, failed: 0 });
    expect(db.rows.map((r) => r.paymentDetailsEncrypted)).toEqual(after);
  });

  it('apply: walks several batches', async () => {
    const db = makeDb(['a', 'b', 'c', 'd', 'e'].map((id) => row(id, { id })));

    const report = await runBackfill(db, {
      apply: true,
      batchSize: 2,
      log: () => {},
    });

    expect(report.encrypted).toBe(5);
    expect(db.rows.every((r) => r.paymentDetailsEncrypted !== null)).toBe(true);
  });

  it('apply with a limit: stops after that many rows', async () => {
    const db = makeDb(['a', 'b', 'c', 'd'].map((id) => row(id, { id })));

    const report = await runBackfill(db, {
      apply: true,
      batchSize: 2,
      limit: 3,
      log: () => {},
    });

    expect(report.encrypted).toBe(3);
    expect(
      db.rows.filter((r) => r.paymentDetailsEncrypted === null)
    ).toHaveLength(1);
  });

  it('apply: a row edited after it was read is skipped, not overwritten', async () => {
    const db = makeDb([row('a', { iban: 'old' }), row('b', { iban: MARK })]);
    db.beforeUpdate = (id) => {
      const r = db.rows.find((x) => x.id === id);
      if (id === 'a' && r) {
        r.paymentDetails = { iban: 'edited' };
        r.updatedAt = new Date('2026-03-02T00:00:00.000Z');
      }
    };

    const report = await runBackfill(db, {
      apply: true,
      batchSize: 100,
      log: () => {},
    });

    expect(report).toMatchObject({
      encrypted: 1,
      skippedChanged: 1,
      failed: 0,
    });
    expect(
      db.rows.find((r) => r.id === 'a')?.paymentDetailsEncrypted
    ).toBeNull();
  });

  it('apply: a row another writer encrypted after it was read keeps that ciphertext', async () => {
    const other = encryptPaymentDetails({ iban: 'WRITTEN-BY-THE-APP' });
    const db = makeDb([row('a', { iban: 'x' })]);
    db.beforeUpdate = (id) => {
      const r = db.rows.find((x) => x.id === id);
      if (r) r.paymentDetailsEncrypted = other;
    };

    const report = await runBackfill(db, {
      apply: true,
      batchSize: 100,
      log: () => {},
    });

    expect(report).toMatchObject({
      encrypted: 0,
      skippedChanged: 1,
      failed: 0,
    });
    expect(db.rows[0]?.paymentDetailsEncrypted).toBe(other);
  });

  it('apply: a ciphertext that does not open to the plain value is never written', async () => {
    (decryptPaymentDetails as jest.Mock).mockReturnValueOnce({ iban: 'OTHER' });
    const db = makeDb([row('a', { iban: MARK }), row('b', { iban: 'fine' })]);

    const report = await runBackfill(db, {
      apply: true,
      batchSize: 100,
      log: () => {},
    });

    expect(report).toMatchObject({ encrypted: 1, failed: 1 });
    expect(report.failures[0]).toMatchObject({ id: 'a' });
    expect(report.failures[0]?.reason).toMatch(
      /does not open to the plain value/
    );
    expect(
      db.rows.find((r) => r.id === 'a')?.paymentDetailsEncrypted
    ).toBeNull();
    expect(
      db.rows.find((r) => r.id === 'b')?.paymentDetailsEncrypted
    ).not.toBeNull();
  });

  it('apply: one failing write is counted and the rest still go through', async () => {
    const db = makeDb([row('a', {}), row('b', {}), row('c', {})]);
    db.failOn.add('b');

    const report = await runBackfill(db, {
      apply: true,
      batchSize: 100,
      log: () => {},
    });

    expect(report).toMatchObject({ encrypted: 2, failed: 1 });
    expect(report.failures).toEqual([{ id: 'b', reason: 'write refused' }]);
    expect(
      db.rows.find((r) => r.id === 'b')?.paymentDetailsEncrypted
    ).toBeNull();
  });

  it('writes nothing to the log but ids and counts', async () => {
    const db = makeDb([row('a', { iban: MARK })]);
    const lines: string[] = [];

    await runBackfill(db, {
      apply: true,
      batchSize: 100,
      log: (l) => lines.push(l),
    });

    const text = lines.join('\n');
    expect(text).not.toContain(MARK);
    expect(text).not.toContain(String(db.rows[0]?.paymentDetailsEncrypted));
  });

  it.each(['apply', 'dry-run'])(
    'refuses to run (%s) on the public fallback key',
    async (mode) => {
      delete process.env[KEY_ENV];
      const db = makeDb([row('a', { iban: MARK })]);

      await expect(
        runBackfill(db, {
          apply: mode === 'apply',
          batchSize: 100,
          log: () => {},
        })
      ).rejects.toThrow(PaymentDetailsKeyError);
      expect(db.calls.updateMany).toBe(0);
    }
  );
});

describe('runVerify (read only)', () => {
  it('refuses to run on the public fallback key', async () => {
    delete process.env[KEY_ENV];
    const db = makeDb([
      row('a', { iban: MARK }, encryptPaymentDetails({ iban: 'x' })),
    ]);

    await expect(
      runVerify(db, { batchSize: 100, log: () => {} })
    ).rejects.toThrow(PaymentDetailsKeyError);
  });

  it('reports pending, matching, mismatching and undecryptable rows by id', async () => {
    const good = encryptPaymentDetails({ iban: 'same' });
    const diverged = encryptPaymentDetails({ iban: 'one' });
    const db = makeDb([
      row('a', { iban: 'same' }, good),
      row('b', { iban: 'two' }, diverged),
      row('c', { iban: MARK }, 'v1:00:00:00'),
      row('d', { iban: 'later' }, null),
    ]);

    const report = await runVerify(db, { batchSize: 100, log: () => {} });

    expect(report).toMatchObject({ scanned: 4, matching: 1, pending: 1 });
    expect(report.mismatched).toEqual(['b']);
    expect(report.undecryptable).toEqual(['c']);
    expect(db.calls.updateMany).toBe(0);
  });

  it('compares values, not key order', async () => {
    const db = makeDb([
      row('a', { b: 2, a: 1 }, encryptPaymentDetails({ a: 1, b: 2 })),
    ]);

    const report = await runVerify(db, { batchSize: 100, log: () => {} });

    expect(report).toMatchObject({ matching: 1, mismatched: [] });
  });

  it('does not print a value', async () => {
    const lines: string[] = [];
    const db = makeDb([
      row('a', { iban: MARK }, encryptPaymentDetails({ iban: 'x' })),
    ]);

    await runVerify(db, { batchSize: 100, log: (l) => lines.push(l) });

    expect(lines.join('\n')).not.toContain(MARK);
  });
});

describe('parseArgs', () => {
  it('defaults to a dry run', () => {
    expect(parseArgs([])).toMatchObject({ mode: 'dry-run', batchSize: 200 });
  });

  it('--verify is read only', () => {
    expect(parseArgs(['--verify'])).toMatchObject({ mode: 'verify' });
  });

  it('--apply needs --confirm-host and carries it', () => {
    expect(() => parseArgs(['--apply'])).toThrow(/confirm-host/);
    expect(
      parseArgs(['--apply', '--confirm-host=db.example:5432'])
    ).toMatchObject({
      mode: 'apply',
      confirmHost: 'db.example:5432',
    });
  });

  it('refuses combining modes, unknown flags and silly numbers', () => {
    expect(() =>
      parseArgs(['--apply', '--verify', '--confirm-host=h:1'])
    ).toThrow();
    expect(() => parseArgs(['--nope'])).toThrow(/unknown/i);
    expect(() => parseArgs(['--batch-size=0'])).toThrow();
    expect(() => parseArgs(['--batch-size=100000'])).toThrow();
    expect(() => parseArgs(['--limit=-1'])).toThrow();
  });

  it('reads --batch-size and --limit', () => {
    expect(parseArgs(['--batch-size=50', '--limit=7'])).toMatchObject({
      batchSize: 50,
      limit: 7,
    });
  });
});

describe('describeConnection', () => {
  it('gives host:port and the database name and never the credentials', () => {
    const d = describeConnection(
      'postgresql://user:SECRETPW@database-host:5432/railway?sslmode=require'
    );
    expect(d).toEqual({
      hostPort: 'database-host:5432',
      database: 'railway',
    });
    expect(JSON.stringify(d)).not.toContain('SECRETPW');
    expect(JSON.stringify(d)).not.toContain('user');
  });

  it('throws on a value that is not a connection URL, without echoing it', () => {
    expect(() => describeConnection('not a url SECRETPW')).toThrow();
    try {
      describeConnection('not a url SECRETPW');
    } catch (e) {
      expect(String((e as Error).message)).not.toContain('SECRETPW');
    }
  });
});

describe('sslFor', () => {
  it("keeps the application's TLS setting for a remote host", () => {
    expect(sslFor('postgresql://u:p@database-host:5432/railway')).toEqual({
      rejectUnauthorized: false,
    });
  });

  it.each(['localhost', '127.0.0.1', '[::1]'])(
    'uses no TLS for a database on this machine (%s)',
    (host) => {
      expect(sslFor(`postgres://postgres@${host}:55437/ws11`)).toBe(false);
    }
  );
});

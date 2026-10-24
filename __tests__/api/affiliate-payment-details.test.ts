/**
 * @jest-environment node
 *
 * WS-11 (CODE-06C): the monolith's routes that write or read
 * `AffiliateProfile.paymentDetails` use the encrypted column.
 *
 * - Readers (admin disbursement detail, admin commission-owings report) decrypt
 *   `paymentDetailsEncrypted` first and fall back to the plaintext column.
 * - The affiliate's own profile route writes BOTH columns when it creates a row
 *   and never puts either of them in a response body.
 *
 * The routes run for real against the real helper (a real key in the
 * environment); only Prisma, the session and the money-service seam are doubles.
 */

import {
  decryptPaymentDetails,
  encryptPaymentDetails,
} from '@/lib/affiliate/payment-details-crypto';

const KEY_ENV = 'PAYMENT_DETAILS_ENCRYPTION_KEY';

const mockRequireAdmin = jest.fn();
const mockRequireAffiliate = jest.fn();
const mockGetAffiliateProfile = jest.fn();
jest.mock('@/lib/auth/session', () => ({
  __esModule: true,
  requireAdmin: () => mockRequireAdmin(),
  requireAffiliate: () => mockRequireAffiliate(),
  getAffiliateProfile: () => mockGetAffiliateProfile(),
}));

const mockGetAdminViewAs = jest.fn();
jest.mock('@/lib/affiliate/view-as', () => ({
  __esModule: true,
  getAdminViewAs: () => mockGetAdminViewAs(),
}));

const mockProfileFindUnique = jest.fn();
const mockProfileFindMany = jest.fn();
const mockProfileCount = jest.fn();
const mockProfileUpsert = jest.fn();
const mockUserFindUnique = jest.fn();
const mockUserFindMany = jest.fn();
const mockTransactionFindMany = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    affiliateProfile: {
      findUnique: (...a: unknown[]) => mockProfileFindUnique(...a),
      findMany: (...a: unknown[]) => mockProfileFindMany(...a),
      count: (...a: unknown[]) => mockProfileCount(...a),
      upsert: (...a: unknown[]) => mockProfileUpsert(...a),
    },
    user: {
      findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
      findMany: (...a: unknown[]) => mockUserFindMany(...a),
    },
    disbursementTransaction: {
      findMany: (...a: unknown[]) => mockTransactionFindMany(...a),
    },
  },
}));

jest.mock('@/lib/disbursement/settings', () => ({
  __esModule: true,
  getDisbursementSettings: async () => ({ minimumPayoutUsd: 50 }),
}));
jest.mock('@/lib/money-service/flags', () => ({
  __esModule: true,
  isAdminReadApiMigrated: () => false,
}));
jest.mock('@/lib/money-service/routes', () => ({
  __esModule: true,
  getMoneyServiceToken: jest.fn(),
  fetchAdminCommissionOwingsReport: jest.fn(),
}));
jest.mock('@/lib/money-service/client', () => ({
  __esModule: true,
  MoneyServiceError: class MoneyServiceError extends Error {},
}));
jest.mock('@/lib/disbursement/services/commission-aggregator', () => ({
  __esModule: true,
  CommissionAggregator: class {
    getAggregatesByAffiliate = async () => ({
      commissionCount: 0,
      totalAmount: 0,
      oldestDate: null,
      canPayout: false,
      commissionIds: [],
    });
  },
}));

import { GET as getOwings } from '@/app/api/admin/affiliates/reports/commission-owings/route';
import {
  GET as getProfile,
  PUT as putProfile,
} from '@/app/api/affiliate/profile/route';
import { GET as getDisbursementAffiliate } from '@/app/api/disbursement/affiliates/[affiliateId]/route';

const savedKey = process.env[KEY_ENV];

const OLD_DETAILS = { email: 'stale@old.test', iban: 'OLD-IBAN-0000' };
const NEW_DETAILS = {
  email: 'fresh@wise.test',
  iban: 'DE89370400440532013000',
};

beforeAll(() => {
  process.env[KEY_ENV] = '33'.repeat(32);
});
afterAll(() => {
  if (savedKey === undefined) delete process.env[KEY_ENV];
  else process.env[KEY_ENV] = savedKey;
});
beforeEach(() => {
  jest.resetAllMocks();
  mockRequireAdmin.mockResolvedValue({
    user: { id: 'admin-1', role: 'ADMIN' },
  });
});

function requestFor(url: string, init?: RequestInit): never {
  const { NextRequest } = jest.requireActual('next/server');
  return new NextRequest(url, init) as never;
}

describe('admin disbursement detail (GET /api/disbursement/affiliates/[affiliateId])', () => {
  function serveProfile(extra: Record<string, unknown>): void {
    mockProfileFindUnique.mockResolvedValue({
      id: 'prof-1',
      userId: 'user-1',
      fullName: 'Alice Affiliate',
      country: 'TH',
      status: 'ACTIVE',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      verifiedAt: null,
      pendingCommissions: 0,
      paidCommissions: 0,
      totalEarnings: 0,
      totalCodesDistributed: 0,
      totalCodesUsed: 0,
      paymentMethod: 'WISE',
      paymentDetails: OLD_DETAILS,
      riseAccount: null,
      ...extra,
    });
    mockUserFindUnique.mockResolvedValue({
      email: 'alice@example.com',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    mockTransactionFindMany.mockResolvedValue([]);
  }

  async function call(): Promise<{ status: number; text: string; body: any }> {
    const res = await getDisbursementAffiliate(
      requestFor('http://localhost/api/disbursement/affiliates/prof-1'),
      { params: Promise.resolve({ affiliateId: 'prof-1' }) }
    );
    const text = await res.text();
    return { status: res.status, text, body: JSON.parse(text) };
  }

  it('shows the decrypted value, not the stale plaintext copy', async () => {
    serveProfile({
      paymentDetailsEncrypted: encryptPaymentDetails(NEW_DETAILS),
    });

    const { status, body } = await call();

    expect(status).toBe(200);
    expect(body.affiliate.paymentInfo.paymentDetails).toEqual(NEW_DETAILS);
  });

  it('shows the plaintext value for a row that is not backfilled yet', async () => {
    serveProfile({ paymentDetailsEncrypted: null });

    const { body } = await call();

    expect(body.affiliate.paymentInfo.paymentDetails).toEqual(OLD_DETAILS);
  });

  it('falls back to the plaintext value when the stored ciphertext does not open', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    serveProfile({ paymentDetailsEncrypted: 'v1:00:00:00' });

    const { status, body } = await call();

    expect(status).toBe(200);
    expect(body.affiliate.paymentInfo.paymentDetails).toEqual(OLD_DETAILS);
  });

  it('never puts the ciphertext in the answer', async () => {
    const blob = encryptPaymentDetails(NEW_DETAILS);
    serveProfile({ paymentDetailsEncrypted: blob });

    const { text } = await call();

    expect(text).not.toContain(blob);
    expect(text).not.toContain('paymentDetailsEncrypted');
  });
});

describe('admin commission-owings report (GET /api/admin/affiliates/reports/commission-owings)', () => {
  function serveRows(rows: Array<Record<string, unknown>>): void {
    mockProfileFindMany.mockResolvedValue(
      rows.map((r) => ({
        id: 'prof-1',
        userId: 'user-1',
        fullName: 'Alice Affiliate',
        country: 'TH',
        paymentMethod: 'WISE',
        paymentDetails: OLD_DETAILS,
        pendingCommissions: 80,
        paidCommissions: 0,
        totalEarnings: 80,
        commissions: [],
        ...r,
      }))
    );
    mockProfileCount.mockResolvedValue(rows.length);
    mockUserFindMany.mockResolvedValue([
      { id: 'user-1', email: 'alice@example.com' },
    ]);
  }

  async function call(): Promise<{ text: string; body: any }> {
    const res = await getOwings(
      requestFor(
        'http://localhost/api/admin/affiliates/reports/commission-owings'
      )
    );
    const text = await res.text();
    return { text, body: JSON.parse(text) };
  }

  it('asks the database for the encrypted column too', async () => {
    serveRows([{ paymentDetailsEncrypted: null }]);

    await call();

    const args = mockProfileFindMany.mock.calls[0]?.[0] as {
      select: Record<string, unknown>;
    };
    expect(args.select).toMatchObject({
      paymentDetails: true,
      paymentDetailsEncrypted: true,
    });
  });

  it('reports the decrypted value, not the stale plaintext copy', async () => {
    serveRows([
      { paymentDetailsEncrypted: encryptPaymentDetails(NEW_DETAILS) },
    ]);

    const { body } = await call();

    expect(body.affiliates[0].paymentDetails).toEqual(NEW_DETAILS);
  });

  it('reports the plaintext value for a row that is not backfilled yet', async () => {
    serveRows([{ paymentDetailsEncrypted: null }]);

    const { body } = await call();

    expect(body.affiliates[0].paymentDetails).toEqual(OLD_DETAILS);
  });

  it('never puts the ciphertext in the report', async () => {
    const blob = encryptPaymentDetails(NEW_DETAILS);
    serveRows([{ paymentDetailsEncrypted: blob }]);

    const { text } = await call();

    expect(text).not.toContain(blob);
    expect(text).not.toContain('paymentDetailsEncrypted');
  });
});

describe('affiliate profile route (GET and PUT /api/affiliate/profile)', () => {
  const ROW = {
    id: 'prof-1',
    userId: 'user-1',
    fullName: 'Alice Affiliate',
    country: 'TH',
    paymentMethod: 'WISE',
    paymentDetails: NEW_DETAILS,
    paymentDetailsEncrypted: '', // set per test
    status: 'ACTIVE',
    totalEarnings: '12.5',
    pendingCommissions: null,
    paidCommissions: '3',
  };

  beforeEach(() => {
    ROW.paymentDetailsEncrypted = encryptPaymentDetails(NEW_DETAILS);
    mockGetAdminViewAs.mockResolvedValue(null);
    mockRequireAffiliate.mockResolvedValue({
      user: { id: 'user-1', name: 'Alice', email: 'alice@example.com' },
    });
  });

  it('GET: an existing profile comes back without either payment column', async () => {
    mockGetAffiliateProfile.mockResolvedValue({ ...ROW });

    const res = await getProfile({} as never);
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(text).not.toContain('paymentDetails');
    expect(text).not.toContain(ROW.paymentDetailsEncrypted);
    expect(JSON.parse(text)).toMatchObject({ id: 'prof-1', status: 'ACTIVE' });
  });

  it('GET: a profile created on first read writes BOTH columns and returns neither', async () => {
    mockGetAffiliateProfile.mockResolvedValue(null);
    mockProfileUpsert.mockImplementation(
      async (args: { create: Record<string, unknown> }) => ({
        ...ROW,
        ...args.create,
      })
    );

    const res = await getProfile({} as never);
    const text = await res.text();

    const create = (
      mockProfileUpsert.mock.calls[0]?.[0] as {
        create: Record<string, unknown>;
      }
    ).create;
    expect(create['paymentDetails']).toEqual({});
    expect(typeof create['paymentDetailsEncrypted']).toBe('string');
    expect(
      decryptPaymentDetails(create['paymentDetailsEncrypted'] as string)
    ).toEqual({});
    expect(res.status).toBe(200);
    expect(text).not.toContain('paymentDetails');
  });

  it('PUT: the create branch writes BOTH columns; the update branch does not touch them', async () => {
    mockGetAffiliateProfile.mockResolvedValue({ ...ROW });
    mockProfileUpsert.mockImplementation(
      async (args: { create: Record<string, unknown> }) => ({
        ...ROW,
        ...args.create,
      })
    );

    const res = await putProfile(
      requestFor('http://localhost/api/affiliate/profile', {
        method: 'PUT',
        body: JSON.stringify({ fullName: 'Alice B' }),
      })
    );
    const text = await res.text();

    const args = mockProfileUpsert.mock.calls[0]?.[0] as {
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };
    expect(args.update).toEqual({ fullName: 'Alice B' });
    expect(args.create['paymentDetails']).toEqual({});
    expect(
      decryptPaymentDetails(args.create['paymentDetailsEncrypted'] as string)
    ).toEqual({});
    expect(res.status).toBe(200);
    expect(text).not.toContain('paymentDetails');
  });
});

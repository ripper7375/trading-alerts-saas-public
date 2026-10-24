/**
 * @jest-environment node
 *
 * WS-11 (CODE-06C): `getAffiliateProfile` (lib/auth/session.ts).
 *
 * - The profile it auto-creates for an affiliate account that has none writes
 *   BOTH payment columns (the plain `{}` and its ciphertext).
 * - The profile it returns never carries the encrypted column: it is spread
 *   from the database row, and callers serialize it.
 */

import { decryptPaymentDetails } from '@/lib/affiliate/payment-details-crypto';

const mockUserFindUnique = jest.fn();
const mockProfileFindUnique = jest.fn();
const mockProfileUpsert = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
    affiliateProfile: {
      findUnique: (...a: unknown[]) => mockProfileFindUnique(...a),
      upsert: (...a: unknown[]) => mockProfileUpsert(...a),
    },
  },
}));

const mockGetServerSession = jest.fn();
jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));
jest.mock('@/lib/auth/auth-options', () => ({
  __esModule: true,
  authOptions: {},
}));

import { getAffiliateProfile } from '@/lib/auth/session';

const BASE_ROW = {
  id: 'prof-1',
  userId: 'user-1',
  fullName: 'Alice Affiliate',
  country: 'TH',
  paymentMethod: 'WISE',
  paymentDetails: { iban: 'DE89370400440532013000' },
  paymentDetailsEncrypted: 'v1:aa:bb:CIPHERTEXT-MARKER',
  status: 'ACTIVE',
  totalEarnings: '12.5',
  pendingCommissions: '0',
  paidCommissions: '3',
};

beforeEach(() => {
  jest.resetAllMocks();
  mockGetServerSession.mockResolvedValue({
    user: { id: 'user-1', isAffiliate: true, name: 'Alice' },
    expires: '2099-01-01',
  });
  mockUserFindUnique.mockResolvedValue({
    id: 'user-1',
    isAffiliate: true,
    name: 'Alice',
    email: 'alice@example.com',
  });
});

describe('getAffiliateProfile and the encrypted payment column', () => {
  it('does not return the encrypted column of an existing profile', async () => {
    mockProfileFindUnique.mockResolvedValue({ ...BASE_ROW });

    const profile = await getAffiliateProfile();

    expect(profile).not.toBeNull();
    expect(profile).toMatchObject({ id: 'prof-1', totalEarnings: 12.5 });
    expect(profile).not.toHaveProperty('paymentDetailsEncrypted');
    expect(JSON.stringify(profile)).not.toContain('CIPHERTEXT-MARKER');
  });

  it('writes BOTH payment columns when it creates the profile, and returns no ciphertext', async () => {
    mockProfileFindUnique.mockResolvedValue(null);
    mockProfileUpsert.mockImplementation(
      async (args: { create: Record<string, unknown> }) => ({
        ...BASE_ROW,
        ...args.create,
      })
    );

    const profile = await getAffiliateProfile();

    const create = (
      mockProfileUpsert.mock.calls[0]?.[0] as {
        create: Record<string, unknown>;
      }
    ).create;
    expect(create['paymentDetails']).toEqual({});
    expect(
      decryptPaymentDetails(create['paymentDetailsEncrypted'] as string)
    ).toEqual({});
    expect(profile).not.toHaveProperty('paymentDetailsEncrypted');
  });
});

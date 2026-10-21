/**
 * @jest-environment node
 *
 * T2-c: explicit Prisma `select` on the `User` reads of six routes, and no
 * `paymentDetails` in the affiliate profile responses.
 *
 * - A source guard holds every `prisma.user.findUnique` of the six routes to
 *   an explicit `select` that never names a secret column.
 * - Behaviour tests run the routes and read the `select` they pass to Prisma
 *   (a mock cannot tell a full row from a projection, so the argument is the
 *   evidence) and check that the answers are unchanged.
 * - The affiliate profile routes are run with a row that carries bank data.
 */

import fs from 'fs';
import path from 'path';

const mockGetServerSession = jest.fn();
jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));
jest.mock('@/lib/auth/auth-options', () => ({
  __esModule: true,
  authOptions: {},
}));

const mockUserFindUnique = jest.fn();
const mockUserUpdate = jest.fn();
const mockSubscriptionFindUnique = jest.fn();
const mockSubscriptionUpdate = jest.fn();
const mockProfileUpsert = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    user: {
      findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
      update: (...a: unknown[]) => mockUserUpdate(...a),
    },
    subscription: {
      findUnique: (...a: unknown[]) => mockSubscriptionFindUnique(...a),
      update: (...a: unknown[]) => mockSubscriptionUpdate(...a),
    },
    affiliateProfile: {
      upsert: (...a: unknown[]) => mockProfileUpsert(...a),
    },
  },
}));

// subscription GET: a plain signed-in caller (no admin view-as).
jest.mock('@/lib/admin/user-view-as', () => ({
  __esModule: true,
  VIEW_AS_DENIED_BODY: { error: 'denied' },
  resolveViewAsSubject: async (_req: unknown, user: { id: string }) => ({
    kind: 'self',
    userId: user.id,
  }),
}));
const mockSetCancelAtPeriodEnd = jest.fn();
jest.mock('@/lib/stripe/stripe', () => ({
  __esModule: true,
  getSubscription: jest.fn(),
  getCustomerPaymentMethods: jest.fn(),
  getOpenInvoiceUrl: jest.fn(),
  setCancelAtPeriodEnd: (...a: unknown[]) => mockSetCancelAtPeriodEnd(...a),
}));

// subscription cancel
jest.mock('@/lib/money-service/flags', () => ({
  __esModule: true,
  shouldUseMoneyServiceForStripeWrite: () => false,
}));
jest.mock('@/lib/money-service/write-routes', () => ({
  __esModule: true,
  forwardWriteRequestToMoneyService: jest.fn(),
  MoneyServiceError: class MoneyServiceError extends Error {},
}));
const mockSendCanceledEmail = jest.fn();
jest.mock('@/lib/email/subscription-emails', () => ({
  __esModule: true,
  sendSubscriptionCanceledEmail: (...a: unknown[]) =>
    mockSendCanceledEmail(...a),
}));

// forgot-password
jest.mock('@/lib/csrf', () => ({
  __esModule: true,
  validateOrigin: async () => true,
  csrfErrorResponse: () => new Response(null, { status: 403 }),
}));
const mockSendPasswordResetEmail = jest.fn();
jest.mock('@/lib/email/email', () => ({
  __esModule: true,
  sendPasswordResetEmail: (...a: unknown[]) => mockSendPasswordResetEmail(...a),
  sendVerificationEmail: jest.fn(),
}));

// user profile
jest.mock('@/lib/operation-service/flags', () => ({
  __esModule: true,
  shouldUseOperationServiceForUserProfile: () => false,
}));
jest.mock('@/lib/operation-service/write-routes', () => ({
  __esModule: true,
  forwardRequestToOperationService: jest.fn(),
  OperationServiceError: class OperationServiceError extends Error {},
}));

// affiliate profile
const mockGetAdminViewAs = jest.fn();
jest.mock('@/lib/affiliate/view-as', () => ({
  __esModule: true,
  getAdminViewAs: () => mockGetAdminViewAs(),
}));
const mockRequireAffiliate = jest.fn();
const mockGetAffiliateProfile = jest.fn();
jest.mock('@/lib/auth/session', () => ({
  __esModule: true,
  requireAffiliate: () => mockRequireAffiliate(),
  getAffiliateProfile: () => mockGetAffiliateProfile(),
}));

import {
  GET as getAffiliateProfile,
  PUT as putAffiliateProfile,
} from '@/app/api/affiliate/profile/route';
import { POST as forgotPassword } from '@/app/api/auth/forgot-password/route';
import { POST as cancelSubscription } from '@/app/api/subscription/cancel/route';
import { GET as getSubscription } from '@/app/api/subscription/route';
import { PATCH as patchProfile } from '@/app/api/user/profile/route';

// ─── Source guard ────────────────────────────────────────────────────────────

const ROUTES = [
  'app/api/subscription/route.ts',
  'app/api/subscription/cancel/route.ts',
  'app/api/payments/dlocal/create/route.ts',
  'app/api/user/profile/route.ts',
  'app/api/auth/forgot-password/route.ts',
  'app/api/auth/resend-verification/route.ts',
];

/** Columns that must never be loaded by these routes. */
const SECRET_COLUMNS = [
  'password',
  'twoFactorSecret',
  'twoFactorBackupCodes',
  'resetToken',
];

/** The text between the balanced delimiters that open at `open`. */
function balanced(source: string, open: number): string {
  const opener = source[open];
  const closer = opener === '(' ? ')' : '}';
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === opener) depth++;
    else if (source[i] === closer && --depth === 0) {
      return source.slice(open + 1, i);
    }
  }
  throw new Error('unbalanced source');
}

function userReads(file: string): string[] {
  const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
  const reads: string[] = [];
  const needle = 'prisma.user.findUnique(';
  for (
    let at = source.indexOf(needle);
    at !== -1;
    at = source.indexOf(needle, at + needle.length)
  ) {
    reads.push(balanced(source, at + needle.length - 1));
  }
  return reads;
}

describe('source guard: every User findUnique has an explicit select', () => {
  it.each(ROUTES)('%s', (file) => {
    const reads = userReads(file);
    expect(reads.length).toBeGreaterThan(0);
    for (const args of reads) {
      const selectAt = args.indexOf('select:');
      expect(selectAt).toBeGreaterThanOrEqual(0);
      const brace = args.indexOf('{', selectAt);
      const projection = balanced(args, brace);
      for (const column of SECRET_COLUMNS) {
        expect(projection).not.toMatch(new RegExp(`\\b${column}\\b`));
      }
    }
  });

  it('the guard can tell a bare read from a projection (self-test)', () => {
    const bare = 'prisma.user.findUnique({ where: { id } });';
    const at = bare.indexOf('(');
    expect(balanced(bare, at).includes('select:')).toBe(false);
    const withSelect =
      'prisma.user.findUnique({ where: { id }, select: { tier: true } })';
    const inner = balanced(withSelect, withSelect.indexOf('('));
    expect(balanced(inner, inner.indexOf('{', inner.indexOf('select:')))).toBe(
      ' tier: true '
    );
  });

  it('lib/candle-data-helpers.ts (raw SQL interpolation, no importer) is gone', () => {
    expect(
      fs.existsSync(path.join(process.cwd(), 'lib/candle-data-helpers.ts'))
    ).toBe(false);
  });
});

// ─── Behaviour ───────────────────────────────────────────────────────────────

function selectOf(mock: jest.Mock): Record<string, unknown> | undefined {
  return (mock.mock.calls[0]?.[0] as { select?: Record<string, unknown> })
    ?.select;
}

beforeEach(() => {
  jest.resetAllMocks();
  mockGetServerSession.mockResolvedValue({
    user: { id: 'u1', email: 'u1@example.com', name: 'U One' },
  });
});

describe('GET /api/subscription', () => {
  it('reads only the tier and trial columns and answers as before', async () => {
    mockUserFindUnique.mockResolvedValue({
      tier: 'FREE',
      trialStatus: 'NOT_STARTED',
      trialConvertedAt: null,
      trialCancelledAt: null,
      hasUsedFreeTrial: false,
    });
    mockSubscriptionFindUnique.mockResolvedValue(null);

    const res = await getSubscription({} as never);

    expect(selectOf(mockUserFindUnique)).toEqual({
      tier: true,
      trialStatus: true,
      trialConvertedAt: true,
      trialCancelledAt: true,
      hasUsedFreeTrial: true,
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      tier: 'FREE',
      status: 'none',
      allowedActions: [],
      displayState: 'FREE',
      subscription: null,
      trial: {
        status: 'NOT_STARTED',
        convertedAt: null,
        cancelledAt: null,
        hasUsedFreeTrial: false,
      },
    });
  });
});

describe('POST /api/subscription/cancel', () => {
  it('reads only tier, email and name, and still schedules the cancellation and emails', async () => {
    mockUserFindUnique.mockResolvedValue({
      tier: 'PRO',
      email: 'u1@example.com',
      name: 'U One',
    });
    mockSubscriptionFindUnique.mockResolvedValue({
      id: 'sub1',
      status: 'ACTIVE',
      stripeSubscriptionId: 'sub_stripe_1',
      stripeCurrentPeriodEnd: null,
      dLocalPaymentId: null,
      expiresAt: null,
      cancelAtPeriodEnd: false,
    });
    mockUserUpdate.mockResolvedValue({});
    mockSubscriptionUpdate.mockResolvedValue({});
    mockSetCancelAtPeriodEnd.mockResolvedValue({
      cancel_at: 1795305600,
      current_period_end: 1795305600,
    });
    mockSendCanceledEmail.mockResolvedValue(undefined);

    const res = await cancelSubscription({ json: async () => ({}) } as never);

    expect(selectOf(mockUserFindUnique)).toEqual({
      tier: true,
      email: true,
      name: true,
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      tier: 'PRO',
      cancelAtPeriodEnd: true,
    });
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(mockSendCanceledEmail).toHaveBeenCalledWith(
      'u1@example.com',
      'U One',
      'PRO',
      new Date(1795305600 * 1000)
    );
  });

  it('a FREE user is still refused with NO_SUBSCRIPTION', async () => {
    mockUserFindUnique.mockResolvedValue({
      tier: 'FREE',
      email: 'u1@example.com',
      name: null,
    });
    mockSubscriptionFindUnique.mockResolvedValue(null);

    const res = await cancelSubscription({ json: async () => ({}) } as never);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      code: 'NO_SUBSCRIPTION',
    });
  });
});

describe('POST /api/auth/forgot-password', () => {
  it('reads only id and name, and still stores a token and sends the email', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'u1', name: 'U One' });
    mockUserUpdate.mockResolvedValue({});
    mockSendPasswordResetEmail.mockResolvedValue({ success: true });

    const res = await forgotPassword(
      new Request('https://davintrade.app/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: 'u1@example.com' }),
      })
    );

    expect(selectOf(mockUserFindUnique)).toEqual({ id: true, name: true });
    expect(res.status).toBe(200);
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' } })
    );
    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
      'u1@example.com',
      'U One',
      expect.stringMatching(/^[0-9a-f]{64}$/)
    );
  });

  it('an unknown email gets the same answer and no email goes out', async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const res = await forgotPassword(
      new Request('https://davintrade.app/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: 'nobody@example.com' }),
      })
    );

    expect(res.status).toBe(200);
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/user/profile (email already in use)', () => {
  it('looks the new email up with select { id } and still answers 409', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'someone-else' });

    const res = await patchProfile(
      new Request('https://davintrade.app/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ email: 'taken@example.com' }),
      }) as never
    );

    expect(selectOf(mockUserFindUnique)).toEqual({ id: true });
    expect(res.status).toBe(409);
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });
});

describe('affiliate profile: no paymentDetails in a response', () => {
  const ROW = {
    id: 'prof1',
    userId: 'u1',
    fullName: 'Alice Affiliate',
    country: 'US',
    paymentMethod: 'WISE',
    paymentDetails: { iban: 'DE89370400440532013000', email: 'a@wise.test' },
    status: 'ACTIVE',
    totalEarnings: '12.5',
    pendingCommissions: null,
    paidCommissions: '3',
  };

  beforeEach(() => {
    mockGetAdminViewAs.mockResolvedValue(null);
    mockRequireAffiliate.mockResolvedValue({
      user: { id: 'u1', name: 'Alice', email: 'a@example.com' },
    });
  });

  it('GET: an existing profile is returned without paymentDetails', async () => {
    mockGetAffiliateProfile.mockResolvedValue(ROW);

    const res = await getAffiliateProfile({} as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).not.toHaveProperty('paymentDetails');
    expect(JSON.stringify(body)).not.toContain('DE89370400440532013000');
    expect(body).toMatchObject({
      id: 'prof1',
      fullName: 'Alice Affiliate',
      paymentMethod: 'WISE',
      status: 'ACTIVE',
    });
  });

  it('GET: a profile created on first read is returned without paymentDetails', async () => {
    mockGetAffiliateProfile.mockResolvedValue(null);
    mockProfileUpsert.mockResolvedValue({ ...ROW, paymentDetails: {} });

    const res = await getAffiliateProfile({} as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).not.toHaveProperty('paymentDetails');
    expect(body).toMatchObject({
      totalEarnings: 12.5,
      pendingCommissions: 0,
      paidCommissions: 3,
    });
  });

  it('PUT: the updated profile is returned without paymentDetails, and is still written', async () => {
    mockGetAffiliateProfile.mockResolvedValue(ROW);
    mockProfileUpsert.mockResolvedValue({ ...ROW, fullName: 'Alice B' });

    const res = await putAffiliateProfile(
      new Request('https://davintrade.app/api/affiliate/profile', {
        method: 'PUT',
        body: JSON.stringify({ fullName: 'Alice B' }),
      }) as never
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1' },
        update: { fullName: 'Alice B' },
      })
    );
    expect(body).not.toHaveProperty('paymentDetails');
    expect(JSON.stringify(body)).not.toContain('DE89370400440532013000');
    expect(body).toMatchObject({ fullName: 'Alice B', totalEarnings: 12.5 });
  });
});

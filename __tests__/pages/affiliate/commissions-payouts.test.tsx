/**
 * Commissions & Payouts Wise Status Tests (Session 6-7, A1-15 / A2-11)
 *
 * Verifies the commissions page still displays the real per-commission
 * CommissionStatus (PENDING/APPROVED/PAID/CANCELLED) — not the batch
 * vocabulary — and links out to the new payouts page for real
 * PaymentBatchStatus / Wise transfer status, and that the new
 * /affiliate/dashboard/payouts server component renders real batch data
 * scoped to the caller's own DisbursementTransaction rows.
 *
 * @module __tests__/pages/affiliate/commissions-payouts.test
 */

import { render, screen, waitFor, within } from '@testing-library/react';

import AffiliateCommissionsPage from '@/app/affiliate/dashboard/commissions/page';
import { LocaleProvider } from '@/lib/context/locale-context';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/locale-resolver';

jest.mock('next/navigation', () => ({
  usePathname: () => '/affiliate/dashboard/commissions',
}));

// AffiliateCommissionsPage calls useLocale() -- needs a LocaleProvider
// ancestor (LESSONS-LEARNED.md L40). Pre-seed US/USD preferences so
// formatCurrency() reproduces this file's pre-existing literal
// "$X.XX" assertions.
function renderCommissionsPage(): ReturnType<typeof render> {
  localStorage.setItem(
    LOCALE_STORAGE_KEY,
    JSON.stringify({
      countryCode: 'US',
      language: 'en-US',
      timezone: 'America/New_York',
      dateFormat: 'MDY',
      timeFormat: '12h',
      currency: 'USD',
    })
  );
  return render(
    <LocaleProvider>
      <AffiliateCommissionsPage />
    </LocaleProvider>
  );
}

const mockCommissionReport = {
  summary: {},
  commissions: [
    {
      id: 'c1',
      commissionAmount: '4.64',
      status: 'PAID',
      earnedAt: '2026-08-01T00:00:00.000Z',
      paidAt: '2026-08-05T00:00:00.000Z',
      affiliateCode: { code: 'TEST1234' },
    },
    {
      id: 'c2',
      commissionAmount: '4.64',
      status: 'APPROVED',
      earnedAt: '2026-08-02T00:00:00.000Z',
      paidAt: null,
      affiliateCode: { code: 'TEST1234' },
    },
  ],
  pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
};

describe('AffiliateCommissionsPage', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCommissionReport,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders real per-commission CommissionStatus values, not batch vocabulary', async () => {
    renderCommissionsPage();

    await waitFor(() => expect(screen.getByText('PAID')).toBeInTheDocument());
    expect(screen.getByText('APPROVED')).toBeInTheDocument();
    // Batch-only statuses must never appear on this page
    expect(screen.queryByText('QUEUED')).not.toBeInTheDocument();
    expect(screen.queryByText('PROCESSING')).not.toBeInTheDocument();
  });

  it('correctly sums commissionAmount (Decimal-as-string) into totals, not the fictional amount field', async () => {
    renderCommissionsPage();

    // 4.64 (PAID) + 4.64 (APPROVED, counted as pending-bucket) = totalEarned 9.28
    await waitFor(() => expect(screen.getByText('$9.28')).toBeInTheDocument());
    // $4.64 renders in both the Paid summary card and the table row
    expect(screen.getAllByText('$4.64').length).toBeGreaterThanOrEqual(2);
  });

  it('links out to the payouts page for real Wise/batch status', async () => {
    renderCommissionsPage();

    await waitFor(() =>
      expect(screen.getByText('View Payout Status →')).toBeInTheDocument()
    );
    expect(
      screen.getByText('View Payout Status →').closest('a')
    ).toHaveAttribute('href', '/affiliate/dashboard/payouts');
  });
});

describe('AffiliatePayoutsPage', () => {
  const mockGetAffiliateProfile = jest.fn();
  const mockFindMany = jest.fn();

  const mockCookieStore = { get: jest.fn(() => undefined) };
  const mockHeaderStore = { get: jest.fn(() => null) };

  beforeEach(() => {
    jest.resetModules();
    jest.doMock('@/lib/auth/session', () => ({
      getAffiliateProfile: () => mockGetAffiliateProfile(),
    }));
    jest.doMock('@/lib/db/prisma', () => ({
      prisma: {
        disbursementTransaction: {
          findMany: (...a: unknown[]) => mockFindMany(...a),
        },
      },
    }));
    jest.doMock('next/navigation', () => ({
      redirect: jest.fn((url: string) => {
        throw new Error(`NEXT_REDIRECT:${url}`);
      }),
    }));
    jest.doMock('next/headers', () => ({
      __esModule: true,
      cookies: jest.fn(() => Promise.resolve(mockCookieStore)),
      headers: jest.fn(() => Promise.resolve(mockHeaderStore)),
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows real PaymentBatchStatus and Wise transfer sub-status', async () => {
    mockGetAffiliateProfile.mockResolvedValue({ id: 'affiliate-1' });
    mockFindMany.mockResolvedValue([
      {
        id: 'tx1',
        amount: '4.64',
        currency: 'USD',
        status: 'COMPLETED',
        createdAt: new Date('2026-08-01'),
        completedAt: new Date('2026-08-05'),
        commission: {
          commissionAmount: '4.64',
          affiliateCode: { code: 'TEST1234' },
        },
        batch: {
          id: 'batch1',
          batchNumber: 'BATCH-001',
          status: 'COMPLETED',
          scheduledAt: new Date('2026-08-03'),
          completedAt: new Date('2026-08-05'),
          provider: 'WISE',
        },
        wiseTransfer: {
          currentState: 'outgoing_payment_sent',
          targetCurrency: 'THB',
          targetValue: '164.32',
          reference: 'ref-1',
        },
      },
    ]);

    const {
      default: AffiliatePayoutsPage,
    } = require('@/app/affiliate/dashboard/payouts/page');
    const element = await AffiliatePayoutsPage();
    render(element);

    // Completed appears both in the table row and the status-guide legend
    expect(
      screen.getAllByText('Completed', { selector: 'span' }).length
    ).toBeGreaterThanOrEqual(1);
    expect(
      within(screen.getByRole('table')).getByText('Completed', {
        selector: 'span',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText('outgoing_payment_sent (164.32 THB)')
    ).toBeInTheDocument();
    expect(screen.getByText('BATCH-001')).toBeInTheDocument();
  });

  it('shows an empty state with zero payout batches', async () => {
    mockGetAffiliateProfile.mockResolvedValue({ id: 'affiliate-1' });
    mockFindMany.mockResolvedValue([]);

    const {
      default: AffiliatePayoutsPage,
    } = require('@/app/affiliate/dashboard/payouts/page');
    const element = await AffiliatePayoutsPage();
    render(element);

    expect(screen.getByText(/no payout batches yet/i)).toBeInTheDocument();
  });

  it('redirects when the caller has no affiliate profile', async () => {
    mockGetAffiliateProfile.mockResolvedValue(null);

    const {
      default: AffiliatePayoutsPage,
    } = require('@/app/affiliate/dashboard/payouts/page');

    await expect(AffiliatePayoutsPage()).rejects.toThrow(
      'NEXT_REDIRECT:/affiliate/register'
    );
  });

  it("only ever queries transactions scoped to the caller's own affiliate profile", async () => {
    mockGetAffiliateProfile.mockResolvedValue({ id: 'affiliate-1' });
    mockFindMany.mockResolvedValue([]);

    const {
      default: AffiliatePayoutsPage,
    } = require('@/app/affiliate/dashboard/payouts/page');
    await AffiliatePayoutsPage();

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { commission: { affiliateProfileId: 'affiliate-1' } },
      })
    );
  });
});

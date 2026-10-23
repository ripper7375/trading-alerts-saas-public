/**
 * Admin disbursement views: the payout-details flags (WS-9, CODE-06A).
 *
 * - The batch page marks a transaction whose affiliate's Wise recipient was
 *   added or changed since they were last paid, and says until when payouts to
 *   it are held.
 * - The recipients page marks a recipient that is inside the hold.
 *
 * Admin pages need no translations; the words are `t(key, English)`.
 */
import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { LocaleProvider } from '@/lib/context/locale-context';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/locale-resolver';

function render(ui: React.ReactElement) {
  return rtlRender(ui, { wrapper: LocaleProvider });
}

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'authenticated' }),
}));

jest.mock('next/navigation', () => ({
  usePathname: () => '/admin/disbursement',
  useParams: () => ({ batchId: 'batch-1' }),
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

jest.mock('next/link', () => {
  return function MockLink({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }): React.ReactElement {
    return <a href={href}>{children}</a>;
  };
});

import BatchDetailsPage from '@/app/admin/disbursement/batches/[batchId]/page';
import AdminDisbursementAccountsPage from '@/app/admin/disbursement/recipients/page';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const batch = {
  id: 'batch-1',
  batchNumber: 'BATCH-2026-1',
  provider: 'WISE',
  status: 'PENDING',
  paymentCount: 2,
  totalAmount: 120,
  currency: 'USD',
  scheduledAt: null,
  executedAt: null,
  completedAt: null,
  failedAt: null,
  errorMessage: null,
  createdAt: '2026-10-26T09:00:00.000Z',
  updatedAt: '2026-10-26T09:00:00.000Z',
};

function tx(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    batchId: 'batch-1',
    commissionId: `comm-${id}`,
    transactionId: `TX-${id}`,
    providerTxId: null,
    provider: 'WISE',
    payeeRiseId: null,
    amount: 60,
    currency: 'USD',
    status: 'PENDING',
    retryCount: 0,
    errorMessage: null,
    createdAt: '2026-10-26T09:00:00.000Z',
    completedAt: null,
    failedAt: null,
    payoutDetailsChangedAt: null,
    payoutDetailsChangedSinceLastPaid: false,
    payoutHoldUntil: null,
    ...extra,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem(
    LOCALE_STORAGE_KEY,
    JSON.stringify({
      countryCode: 'US',
      language: 'en-US',
      timezone: 'UTC',
      dateFormat: 'MDY',
      timeFormat: '24h',
      currency: 'USD',
    })
  );
});

describe('batch page: payout-details flags', () => {
  it('marks only the transaction whose recipient changed since the last payout, and says when its hold ends', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        batch,
        transactions: [
          tx('flagged', {
            payoutDetailsChangedAt: '2026-10-25T10:00:00.000Z',
            payoutDetailsChangedSinceLastPaid: true,
            payoutHoldUntil: '2026-10-28T10:00:00.000Z',
          }),
          tx('plain'),
        ],
        auditLogs: [],
      })
    ) as unknown as typeof fetch;

    render(<BatchDetailsPage />);

    await screen.findByText('TX-flagged');
    expect(screen.getAllByText(/Payout details changed/)).toHaveLength(1);
    expect(screen.getByText(/Payouts held until/)).toBeInTheDocument();
  });

  it('marks a recipient changed since the last payout even when the hold is over', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        batch,
        transactions: [
          tx('flagged', {
            payoutDetailsChangedAt: '2026-10-01T10:00:00.000Z',
            payoutDetailsChangedSinceLastPaid: true,
            payoutHoldUntil: null,
          }),
        ],
        auditLogs: [],
      })
    ) as unknown as typeof fetch;

    render(<BatchDetailsPage />);

    await screen.findByText('TX-flagged');
    expect(screen.getByText(/Payout details changed/)).toBeInTheDocument();
    expect(screen.queryByText(/Payouts held until/)).not.toBeInTheDocument();
  });

  it('shows no flag for a batch whose recipients have not changed', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        batch,
        transactions: [tx('a'), tx('b')],
        auditLogs: [],
      })
    ) as unknown as typeof fetch;

    render(<BatchDetailsPage />);

    await screen.findByText('TX-a');
    expect(
      screen.queryByText(/Payout details changed/)
    ).not.toBeInTheDocument();
  });
});

describe('recipients page: the hold', () => {
  function recipient(id: string, extra: Record<string, unknown> = {}) {
    return {
      id,
      affiliateProfileId: `aff-profile-${id}`,
      wiseRecipientId: `w-${id}`,
      accountHolderName: `Holder ${id}`,
      targetCurrency: 'GBP',
      recipientCountry: 'GB',
      legalType: 'PRIVATE',
      accountTail: '8842',
      status: 'ACTIVE',
      createdAt: '2026-10-01T00:00:00.000Z',
      detailsChangedAt: null,
      payoutHoldUntil: null,
      ...extra,
    };
  }

  it('marks a recipient inside the hold with the time it ends, and no other', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        items: [
          recipient('held', {
            detailsChangedAt: '2026-10-25T10:00:00.000Z',
            payoutHoldUntil: '2026-10-28T10:00:00.000Z',
          }),
          recipient('free'),
        ],
        total: 2,
        page: 1,
        pageSize: 25,
      })
    ) as unknown as typeof fetch;

    render(<AdminDisbursementAccountsPage />);

    await screen.findByText('Holder held');
    await waitFor(() =>
      expect(screen.getAllByText(/Payouts held until/)).toHaveLength(1)
    );
    expect(screen.getByText('Holder free')).toBeInTheDocument();
  });
});

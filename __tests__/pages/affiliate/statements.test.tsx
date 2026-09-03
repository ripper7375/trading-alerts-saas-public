/**
 * Affiliate Statements Page Tests (Session 6-7, B2-19)
 *
 * Verifies client-side monthly grouping of the real commission-report
 * response and that the CSV download function builds and triggers a real
 * Blob download.
 *
 * @module __tests__/pages/affiliate/statements.test
 */

import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AffiliateStatementsPage from '@/app/affiliate/dashboard/statements/page';
import { LocaleProvider } from '@/lib/context/locale-context';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/locale-resolver';

jest.mock('next/navigation', () => ({
  usePathname: () => '/affiliate/dashboard/statements',
}));

function render(ui: React.ReactElement) {
  return rtlRender(ui, { wrapper: LocaleProvider });
}

function page(commissions: unknown[]) {
  return {
    ok: true,
    json: async () => ({
      commissions,
      pagination: {
        page: 1,
        limit: 100,
        total: commissions.length,
        totalPages: 1,
      },
    }),
  };
}

describe('AffiliateStatementsPage', () => {
  // jsdom doesn't implement URL.createObjectURL/revokeObjectURL at all, so
  // jest.spyOn (which requires the property to pre-exist) can't be used —
  // assign plain jest.fn() stubs directly instead.
  let createObjectURLSpy: jest.Mock;
  let revokeObjectURLSpy: jest.Mock;
  let clickSpy: jest.SpyInstance;

  beforeEach(() => {
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
    createObjectURLSpy = jest.fn().mockReturnValue('blob:mock-url');
    revokeObjectURLSpy = jest.fn();
    (URL as unknown as { createObjectURL: jest.Mock }).createObjectURL =
      createObjectURLSpy;
    (URL as unknown as { revokeObjectURL: jest.Mock }).revokeObjectURL =
      revokeObjectURLSpy;
    clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    clickSpy.mockRestore();
  });

  it('groups commissions into monthly statement cards', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      page([
        {
          id: 'c1',
          commissionAmount: '4.64',
          status: 'PAID',
          earnedAt: '2026-07-15T00:00:00.000Z',
          paidAt: '2026-07-20T00:00:00.000Z',
          affiliateCode: { code: 'AAA11111' },
        },
        {
          id: 'c2',
          commissionAmount: '5.00',
          status: 'APPROVED',
          earnedAt: '2026-08-02T00:00:00.000Z',
          paidAt: null,
          affiliateCode: { code: 'AAA11111' },
        },
      ])
    );

    render(<AffiliateStatementsPage />);

    await waitFor(() =>
      expect(screen.getByText('July 2026')).toBeInTheDocument()
    );
    expect(screen.getByText('August 2026')).toBeInTheDocument();
  });

  it('shows an empty state with zero commission history', async () => {
    global.fetch = jest.fn().mockResolvedValue(page([]));

    render(<AffiliateStatementsPage />);

    await waitFor(() =>
      expect(
        screen.getByText(/no commission activity in the last 12 months/i)
      ).toBeInTheDocument()
    );
  });

  it('triggers a CSV download when Download CSV is clicked', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      page([
        {
          id: 'c1',
          commissionAmount: '4.64',
          status: 'PAID',
          earnedAt: '2026-08-01T00:00:00.000Z',
          paidAt: '2026-08-05T00:00:00.000Z',
          affiliateCode: { code: 'AAA11111' },
        },
      ])
    );

    const user = userEvent.setup();
    render(<AffiliateStatementsPage />);

    await waitFor(() =>
      expect(screen.getByText('Download CSV')).toBeInTheDocument()
    );
    await user.click(screen.getByText('Download CSV'));

    expect(createObjectURLSpy).toHaveBeenCalled();
    const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
    expect(blobArg.type).toContain('text/csv');
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
  });

  it('renders the tax summary disclaimer', async () => {
    global.fetch = jest.fn().mockResolvedValue(page([]));

    render(<AffiliateStatementsPage />);

    await waitFor(() =>
      expect(screen.getByText('Tax Summary Note')).toBeInTheDocument()
    );
    expect(screen.getByText(/not tax documents/i)).toBeInTheDocument();
  });
});

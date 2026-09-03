/**
 * Code Inventory Report Page Tests (Session 6-7, A2-6)
 *
 * Verifies GET /api/affiliate/dashboard/code-inventory is fetched on mount
 * and refetched on date-range change, and that the returned
 * CodeInventoryReport shape renders correctly.
 *
 * @module __tests__/pages/affiliate/code-inventory-report.test
 */

import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AffiliateCodeInventoryPage from '@/app/affiliate/dashboard/code-inventory/page';
import { LocaleProvider } from '@/lib/context/locale-context';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/locale-resolver';

jest.mock('next/navigation', () => ({
  usePathname: () => '/affiliate/dashboard/code-inventory',
}));

function render(ui: React.ReactElement) {
  return rtlRender(ui, { wrapper: LocaleProvider });
}

const mockReport = {
  period: {
    start: '2026-07-11T00:00:00.000Z',
    end: '2026-08-11T00:00:00.000Z',
  },
  openingBalance: 5,
  additions: {
    monthlyDistribution: 15,
    initialDistribution: 0,
    bonusDistribution: 2,
    total: 17,
  },
  reductions: { used: 3, expired: 1, cancelled: 0, total: 4 },
  closingBalance: 18,
};

describe('AffiliateCodeInventoryPage', () => {
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
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockReport,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('fetches the report on mount', async () => {
    render(<AffiliateCodeInventoryPage />);

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/affiliate/dashboard/code-inventory?')
      )
    );
  });

  it('renders opening and closing balance', async () => {
    render(<AffiliateCodeInventoryPage />);

    await waitFor(() => expect(screen.getByText('5')).toBeInTheDocument());
    expect(screen.getByText('18')).toBeInTheDocument();
  });

  it('renders the additions and reductions breakdown', async () => {
    render(<AffiliateCodeInventoryPage />);

    await waitFor(() =>
      expect(screen.getByText('Additions (17)')).toBeInTheDocument()
    );
    expect(screen.getByText('Reductions (4)')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument(); // monthly distribution
  });

  it('shows an error message when the fetch fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false });

    render(<AffiliateCodeInventoryPage />);

    await waitFor(() =>
      expect(
        screen.getByText('Failed to load code inventory report')
      ).toBeInTheDocument()
    );
  });

  it('refetches when the date range changes', async () => {
    render(<AffiliateCodeInventoryPage />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    const startInput = screen.getByLabelText('Start Date');
    const user = userEvent.setup();
    await user.clear(startInput);
    await user.type(startInput, '2026-01-01');

    await waitFor(() =>
      expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(1)
    );
  });
});

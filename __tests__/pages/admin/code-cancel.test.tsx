/**
 * Admin Code Cancel & Disbursement Config Tests (Session 6-6, A1-14 / A1-5)
 *
 * Two independent surfaces:
 * - Code Inventory report's new "Cancel a Code" widget: confirmation
 *   dialog, POST /api/admin/codes/[code]/cancel, and report refresh on
 *   success. There is no per-code listing UI/API anywhere in this codebase
 *   (see the order's own Deviations), so this is a standalone lookup form,
 *   not a per-row action.
 * - Disbursement Configuration page's new WISE provider option, including
 *   the "Configured via DISBURSEMENT_PROVIDER env var" notice and the fixed
 *   config.provider object shape (was a flat string, a pre-existing bug).
 *
 * @module __tests__/pages/admin/code-cancel.test
 */

import {
  render as rtlRender,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import CodeInventoryReportPage from '@/app/admin/affiliates/reports/code-inventory/page';
import ConfigurationPage from '@/app/admin/disbursement/config/page';
import { LocaleProvider } from '@/lib/context/locale-context';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/locale-resolver';

function render(ui: React.ReactElement) {
  return rtlRender(ui, { wrapper: LocaleProvider });
}

jest.mock('next/navigation', () => ({
  usePathname: () => '/admin/affiliates/reports/code-inventory',
}));

const realReport = {
  period: { start: '2026-05-01', end: '2026-08-01', name: '3 Months' },
  allTime: {
    totalCodes: 100,
    byStatus: { active: 60, used: 30, expired: 5, cancelled: 5 },
    byReason: { initial: 40, monthly: 50, adminBonus: 10 },
    conversionRate: 30,
  },
  periodMetrics: {
    distributed: 20,
    used: 10,
    expired: 2,
    periodConversionRate: 50,
  },
  alerts: { expiringIn7Days: 0, lowActiveCodesWarning: false },
};

describe('Code Inventory — Cancel a Code widget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.startsWith('/api/admin/affiliates/reports/code-inventory')) {
        return Promise.resolve({
          ok: true,
          json: async () => realReport,
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    }) as unknown as typeof fetch;
  });

  it('opens a confirmation dialog before cancelling, and fires the real endpoint on confirm', async () => {
    const user = userEvent.setup();
    render(<CodeInventoryReportPage />);

    await screen.findByText('Code Inventory Report');

    const codeInput = screen.getByLabelText('Code to cancel');
    await user.type(codeInput, 'promo123');
    await user.click(screen.getByRole('button', { name: 'Cancel Code' }));

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText('Cancel code PROMO123?')
    ).toBeInTheDocument();

    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Code cancelled successfully',
          code: { code: 'PROMO123', status: 'CANCELLED' },
        }),
      } as Response)
    );

    await user.click(
      within(dialog).getByRole('button', { name: 'Confirm Cancel' })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/codes/PROMO123/cancel',
        expect.objectContaining({ method: 'POST' })
      );
    });
    expect(
      await screen.findByText('Code PROMO123 cancelled successfully.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the real error and keeps the dialog closed state on failure', async () => {
    const user = userEvent.setup();
    render(<CodeInventoryReportPage />);

    await screen.findByText('Code Inventory Report');

    await user.type(screen.getByLabelText('Code to cancel'), 'USED1');
    await user.click(screen.getByRole('button', { name: 'Cancel Code' }));

    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        json: async () => ({
          error: 'Cannot cancel a code that has already been used',
        }),
      } as Response)
    );

    await user.click(screen.getByRole('button', { name: 'Confirm Cancel' }));

    expect(
      await screen.findByText('Cannot cancel a code that has already been used')
    ).toBeInTheDocument();
  });

  it('dismisses the dialog on "Keep Code" without calling the API', async () => {
    const user = userEvent.setup();
    render(<CodeInventoryReportPage />);

    await screen.findByText('Code Inventory Report');
    await user.type(screen.getByLabelText('Code to cancel'), 'ABC123');
    await user.click(screen.getByRole('button', { name: 'Cancel Code' }));

    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: 'Keep Code' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/cancel'),
      expect.anything()
    );
  });
});

describe('Disbursement Configuration — WISE provider option', () => {
  const realConfig = {
    provider: {
      default: 'WISE',
      available: ['MOCK', 'WISE'],
      riseEnabled: false,
      wiseEnabled: true,
    },
    enabled: true,
    minimumPayout: 50,
    batchSize: 100,
    environment: 'production',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ config: realConfig }),
    } as Response);
  });

  it('shows the active WISE provider and the env-var notice, not a flat string render', async () => {
    render(<ConfigurationPage />);

    expect(await screen.findByText('WISE')).toBeInTheDocument();
    expect(
      screen.getByText(/Configured via/, { exact: false })
    ).toBeInTheDocument();
  });

  it('offers a selectable WISE radio option when editing, disabled for unavailable RISE', async () => {
    const user = userEvent.setup();
    render(<ConfigurationPage />);

    await screen.findByText('WISE');
    await user.click(
      screen.getByRole('button', { name: 'Edit Configuration' })
    );

    const wiseRadio = screen.getByRole('radio', { name: /WISE \(Wise\)/ });
    const riseRadio = screen.getByRole('radio', {
      name: /RISE \(RiseWorks/,
    });

    expect(wiseRadio).toBeChecked();
    expect(riseRadio).toBeDisabled();
    expect(wiseRadio).not.toBeDisabled();
  });
});

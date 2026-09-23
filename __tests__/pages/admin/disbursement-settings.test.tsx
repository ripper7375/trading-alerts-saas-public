/**
 * /admin/disbursement/settings page (DECISION-LOG F83, spec §8)
 */

import {
  render as rtlRender,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import DisbursementSettingsPage from '@/app/admin/disbursement/settings/page';
import { LocaleProvider } from '@/lib/context/locale-context';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/locale-resolver';

jest.mock('next/navigation', () => ({
  usePathname: () => '/admin/disbursement/settings',
}));

function render(ui: React.ReactElement) {
  return rtlRender(ui, { wrapper: LocaleProvider });
}

type Overrides = {
  enabled?: boolean;
  envKillSwitch?: boolean;
  minimum?: number;
  lastPause?: { changedBy: string; changedAt: string } | null;
};

function settingsResponse(o: Overrides = {}) {
  const enabled = o.enabled ?? true;
  const envKillSwitch = o.envKillSwitch ?? false;
  const meta = (value: unknown, def: unknown, extra: object = {}) => ({
    key: 'k',
    value,
    default: def,
    source: value === def ? 'default' : 'database',
    updatedBy: null,
    updatedAt: null,
    lastChange: null,
    ...extra,
  });
  return {
    settings: {
      enabled: meta(enabled, true, { lastChange: o.lastPause ?? null }),
      minimumPayoutUsd: meta(o.minimum ?? 50, 50, {
        min: 1,
        max: 10000,
        integer: false,
      }),
      maxBatchSize: meta(100, 100, { min: 1, max: 500, integer: true }),
      commissionApprovalDays: meta(14, 14, { min: 0, max: 90, integer: true }),
    },
    effective: { enabled: enabled && !envKillSwitch, envKillSwitch },
    provider: {
      active: 'WISE',
      available: ['MOCK', 'WISE'],
      source: 'env',
      envVar: 'DISBURSEMENT_PROVIDER',
    },
    schedule: {
      cronExpression: '0 2 1 * *',
      description: 'Monthly — 1st of each month, 02:00 UTC',
      nextRunAt: '2026-10-01T02:00:00.000Z',
    },
    recentChanges: [],
    version: null,
  };
}

let getBody = settingsResponse();
let patchResponses: Array<{ status: number; body: unknown }> = [];

function mockFetch(): void {
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === '/api/disbursement/settings' && init?.method === 'PATCH') {
      const next = patchResponses.shift() ?? {
        status: 200,
        body: { changes: [] },
      };
      return Promise.resolve({
        ok: next.status < 400,
        status: next.status,
        json: async () => next.body,
      } as Response);
    }
    if (url === '/api/disbursement/settings') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => getBody,
      } as Response);
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  }) as unknown as typeof fetch;
}

describe('Disbursement payout settings page', () => {
  beforeEach(() => {
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
    getBody = settingsResponse();
    patchResponses = [];
    mockFetch();
  });

  it('renders the current values, defaults, schedule and read-only provider', async () => {
    render(<DisbursementSettingsPage />);

    expect(await screen.findByText('Payouts active')).toBeInTheDocument();
    expect(screen.getByTestId('input-minimumPayoutUsd')).toHaveValue(50);
    expect(screen.getByTestId('input-maxBatchSize')).toHaveValue(100);
    expect(screen.getByTestId('input-commissionApprovalDays')).toHaveValue(14);
    expect(screen.getByText('Default: 50')).toBeInTheDocument();
    expect(screen.getByTestId('payout-schedule')).toHaveTextContent(
      'Monthly — 1st of each month, 02:00 UTC'
    );
    expect(screen.getByTestId('payout-schedule')).toHaveTextContent(
      '2026-10-01 02:00 UTC'
    );
    expect(screen.getByTestId('provider-active')).toHaveTextContent('WISE');
    expect(screen.getByText(/requires a redeploy/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Affiliate Settings' })
    ).toHaveAttribute('href', '/admin/settings/affiliate');
  });

  it('keeps Save disabled until something changes AND a valid reason is entered', async () => {
    const user = userEvent.setup();
    render(<DisbursementSettingsPage />);
    const save = await screen.findByTestId('save-settings');

    expect(save).toBeDisabled();

    await user.type(screen.getByTestId('settings-reason'), 'raise minimum');
    expect(save).toBeDisabled(); // reason but no change

    const input = screen.getByTestId('input-minimumPayoutUsd');
    await user.clear(input);
    await user.type(input, '60');
    expect(save).toBeEnabled();

    await user.clear(screen.getByTestId('settings-reason'));
    await user.type(screen.getByTestId('settings-reason'), 'abc');
    expect(save).toBeDisabled(); // reason too short
  });

  it('flags an out-of-bounds value and keeps Save disabled', async () => {
    const user = userEvent.setup();
    render(<DisbursementSettingsPage />);
    const input = await screen.findByTestId('input-maxBatchSize');

    await user.clear(input);
    await user.type(input, '900');
    await user.type(screen.getByTestId('settings-reason'), 'too many');

    expect(
      screen.getByText('Enter a whole number from 1 to 500.')
    ).toBeInTheDocument();
    expect(screen.getByTestId('save-settings')).toBeDisabled();
  });

  it('shows the old → new diff in the confirm dialog and PATCHes on confirm', async () => {
    const user = userEvent.setup();
    patchResponses.push({
      status: 200,
      body: {
        changes: [
          { setting: 'minimumPayoutUsd', oldValue: '50', newValue: '60' },
        ],
      },
    });
    render(<DisbursementSettingsPage />);

    const input = await screen.findByTestId('input-minimumPayoutUsd');
    await user.clear(input);
    await user.type(input, '60');
    await user.type(screen.getByTestId('settings-reason'), 'raise minimum');
    await user.click(screen.getByTestId('save-settings'));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('confirm-diff')).toHaveTextContent(
      'Minimum payout (USD): $50 → $60'
    );

    await user.click(within(dialog).getByTestId('confirm-save'));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/disbursement/settings',
        expect.objectContaining({ method: 'PATCH' })
      )
    );
    const patchCall = (global.fetch as jest.Mock).mock.calls.find(
      (call) => call[1]?.method === 'PATCH'
    );
    expect(JSON.parse(patchCall[1].body)).toEqual({
      minimumPayoutUsd: 60,
      reason: 'raise minimum',
      expectedVersion: null,
    });
    expect(
      await screen.findByText('Payout settings saved')
    ).toBeInTheDocument();
  });

  it('warns in the confirm dialog when pausing', async () => {
    const user = userEvent.setup();
    render(<DisbursementSettingsPage />);

    await user.click(await screen.findByTestId('switch-enabled'));
    await user.type(screen.getByTestId('settings-reason'), 'bank freeze');
    await user.click(screen.getByTestId('save-settings'));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('confirm-diff')).toHaveTextContent(
      'Payouts enabled: On → Off'
    );
    expect(within(dialog).getByText(/Pausing blocks/)).toBeInTheDocument();
  });

  it('env kill switch: red banner and the toggle is disabled', async () => {
    getBody = settingsResponse({ envKillSwitch: true });
    render(<DisbursementSettingsPage />);

    expect(await screen.findByTestId('status-banner')).toHaveTextContent(
      'Payouts stopped at deploy level (DISBURSEMENT_ENABLED=false)'
    );
    expect(screen.getByTestId('switch-enabled')).toBeDisabled();
  });

  it('paused by an admin: amber banner with who and when', async () => {
    getBody = settingsResponse({
      enabled: false,
      lastPause: {
        changedBy: 'ops@davintrade.app',
        changedAt: '2026-09-20T10:00:00.000Z',
      },
    });
    render(<DisbursementSettingsPage />);

    const banner = await screen.findByTestId('status-banner');
    expect(banner).toHaveTextContent('Payouts paused by an admin.');
    expect(banner).toHaveTextContent('ops@davintrade.app');
    expect(screen.getByTestId('switch-enabled')).toBeEnabled();
  });

  it('on 409 SETTINGS_STALE shows the reload notice and refetches', async () => {
    const user = userEvent.setup();
    patchResponses.push({
      status: 409,
      body: { code: 'SETTINGS_STALE', error: 'stale' },
    });
    render(<DisbursementSettingsPage />);

    const input = await screen.findByTestId('input-maxBatchSize');
    await user.clear(input);
    await user.type(input, '50');
    await user.type(screen.getByTestId('settings-reason'), 'smaller batches');
    await user.click(screen.getByTestId('save-settings'));
    await user.click(
      within(await screen.findByRole('dialog')).getByTestId('confirm-save')
    );

    expect(
      await screen.findByText(/Settings were changed by someone else/)
    ).toBeInTheDocument();
    const getCalls = (global.fetch as jest.Mock).mock.calls.filter(
      (call) => !call[1]?.method
    );
    expect(getCalls.length).toBeGreaterThanOrEqual(2);
  });
});

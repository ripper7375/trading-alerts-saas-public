/**
 * Admin batch execution: the fresh authenticator code (CODE-06B).
 *
 * Executing a payout batch moves real money, so both batch pages ask the admin for a current
 * authenticator code in the confirm dialog, trade it for a 120-second step-up token at
 * `/api/admin/payout-step-up`, and send that token to the execute route in `X-Payout-Step-Up`.
 * No token, no execute call.
 *
 * Admin pages need no translations; the words are `t(key, English)`.
 */
import {
  render as rtlRender,
  screen,
  waitFor,
  within,
  fireEvent,
} from '@testing-library/react';
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
  usePathname: () => '/admin/disbursement/batches',
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
import PaymentBatchesPage from '@/app/admin/disbursement/batches/page';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

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

interface Routes {
  stepUp?: () => Response;
  execute?: () => Response;
}

/** Answers each URL the two pages call; the step-up and execute answers are per test. */
function serve(routes: Routes = {}): void {
  mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === '/api/admin/payout-step-up') {
      return (
        routes.stepUp?.() ??
        jsonResponse(200, {
          stepUpToken: 'step-up-token',
          expiresInSeconds: 120,
        })
      );
    }
    if (url === '/api/disbursement/batches/batch-1/execute') {
      return (
        routes.execute?.() ??
        jsonResponse(200, {
          success: true,
          result: { successCount: 2, failedCount: 0 },
        })
      );
    }
    if (url === '/api/disbursement/batches/batch-1' && !init?.method) {
      return jsonResponse(200, { batch, transactions: [], auditLogs: [] });
    }
    if (url.startsWith('/api/disbursement/batches')) {
      return jsonResponse(200, { batches: [batch] });
    }
    return jsonResponse(404, { error: `unexpected ${url}` });
  });
}

function callsTo(url: string): Array<[string, RequestInit | undefined]> {
  return mockFetch.mock.calls.filter(([u]) => u === url) as Array<
    [string, RequestInit | undefined]
  >;
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

const PAGES: Array<{
  name: string;
  Page: () => React.ReactElement;
  /** The button that opens the confirm dialog. */
  openerName: string;
}> = [
  {
    name: 'the batch detail page',
    Page: BatchDetailsPage,
    openerName: 'Execute Batch',
  },
  {
    name: 'the batches list',
    Page: PaymentBatchesPage,
    openerName: 'Execute',
  },
];

describe.each(PAGES)('$name', ({ Page, openerName }) => {
  async function openConfirmDialog(): Promise<HTMLElement> {
    render(<Page />);
    fireEvent.click(await screen.findByRole('button', { name: openerName }));
    return screen.findByRole('dialog');
  }

  it('asks for an authenticator code and will not execute without six digits', async () => {
    serve();
    const dialog = await openConfirmDialog();

    const field = within(dialog).getByLabelText(/authenticator code/i);
    const execute = within(dialog).getByRole('button', { name: 'Execute' });
    expect(execute).toBeDisabled();

    fireEvent.change(field, { target: { value: '12345' } });
    expect(execute).toBeDisabled();
    fireEvent.change(field, { target: { value: '12ab56' } });
    expect(execute).toBeDisabled();
    fireEvent.change(field, { target: { value: '123456' } });
    expect(execute).toBeEnabled();
  });

  it('trades the code for a token, then executes with the token in X-Payout-Step-Up', async () => {
    serve();
    const dialog = await openConfirmDialog();
    fireEvent.change(within(dialog).getByLabelText(/authenticator code/i), {
      target: { value: '123456' },
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Execute' }));

    await waitFor(() =>
      expect(callsTo('/api/disbursement/batches/batch-1/execute')).toHaveLength(
        1
      )
    );
    const [stepUp] = callsTo('/api/admin/payout-step-up');
    expect(stepUp?.[1]?.method).toBe('POST');
    expect(JSON.parse(String(stepUp?.[1]?.body))).toEqual({ code: '123456' });
    const [execute] = callsTo('/api/disbursement/batches/batch-1/execute');
    expect(execute?.[1]?.method).toBe('POST');
    expect(execute?.[1]?.headers).toEqual(
      expect.objectContaining({ 'X-Payout-Step-Up': 'step-up-token' })
    );
    expect(
      await screen.findByText('Batch executed: 2 succeeded, 0 failed')
    ).toBeInTheDocument();
  });

  it('does not execute when the code is refused, and shows why', async () => {
    serve({
      stepUp: () =>
        jsonResponse(400, {
          error: 'Invalid verification code',
          code: 'INVALID_CODE',
        }),
    });
    const dialog = await openConfirmDialog();
    fireEvent.change(within(dialog).getByLabelText(/authenticator code/i), {
      target: { value: '000000' },
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Execute' }));

    expect(
      await screen.findByText('Invalid verification code')
    ).toBeInTheDocument();
    expect(callsTo('/api/disbursement/batches/batch-1/execute')).toHaveLength(
      0
    );
  });

  it('shows the refusal of money-service when the token is not accepted', async () => {
    serve({
      execute: () =>
        jsonResponse(403, {
          error: 'A fresh identity check is required for this action',
          code: 'PAYOUT_STEP_UP_REQUIRED',
        }),
    });
    const dialog = await openConfirmDialog();
    fireEvent.change(within(dialog).getByLabelText(/authenticator code/i), {
      target: { value: '123456' },
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Execute' }));

    expect(
      await screen.findByText(
        'A fresh identity check is required for this action'
      )
    ).toBeInTheDocument();
  });
});

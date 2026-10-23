/**
 * WiseRecipientForm Component Tests (Session 4A-W3b, File 4/5)
 *
 * @module __tests__/components/affiliate/wise-recipient-form.test
 */

import {
  render as rtlRender,
  screen,
  waitFor,
  fireEvent,
} from '@testing-library/react';

import WiseRecipientForm from '@/components/affiliate/wise-recipient-form';
import { LocaleProvider } from '@/lib/context/locale-context';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/locale-resolver';

jest.mock('next/navigation', () => ({
  usePathname: () => '/affiliate/settings/payout',
}));

function render(ui: React.ReactElement) {
  return rtlRender(ui, { wrapper: LocaleProvider });
}

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
});

const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockRequirementsResponse = {
  quoteId: null,
  groups: [
    {
      type: 'aba',
      title: 'Local bank account',
      fields: [
        {
          group: [
            {
              key: 'accountNumber',
              name: 'Account number',
              type: 'text',
              required: true,
              minLength: 4,
              maxLength: 17,
              validationRegexp: '^[0-9]+$',
            },
          ],
        },
      ],
    },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('WiseRecipientForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the currency/country selection step first', () => {
    render(<WiseRecipientForm />);

    expect(screen.getByText('Continue')).toBeInTheDocument();
    expect(
      screen.getByText(/recipient country \(2-letter code\)/i)
    ).toBeInTheDocument();
  });

  it('requires a valid 2-letter recipient country before continuing', async () => {
    render(<WiseRecipientForm />);

    fireEvent.click(screen.getByText('Continue'));

    expect(
      await screen.findByText(/enter a valid 2-letter recipient country/i)
    ).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fetches and renders dynamic fields from the requirements response', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(mockRequirementsResponse));

    render(<WiseRecipientForm />);

    fireEvent.change(screen.getByPlaceholderText('TH'), {
      target: { value: 'GB' },
    });
    fireEvent.click(screen.getByText('Continue'));

    expect(await screen.findByText('Account number')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/wise/recipients/requirements?')
    );
  });

  it('validates required fields and regex patterns before submitting', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(mockRequirementsResponse));

    render(<WiseRecipientForm />);
    fireEvent.change(screen.getByPlaceholderText('TH'), {
      target: { value: 'GB' },
    });
    fireEvent.click(screen.getByText('Continue'));
    await screen.findByText('Account number');

    fireEvent.click(screen.getByText('Submit payout details'));

    expect(
      await screen.findByText('Account holder name is required')
    ).toBeInTheDocument();
    expect(screen.getByText('Required')).toBeInTheDocument();
    // CODE-06B: the password is asked for before anything is sent.
    expect(screen.getByText('Enter your current password')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  /** Steps 1 and 2: pick GB, fetch the fields, fill the bank details. */
  async function reachDetailsStep(
    props: React.ComponentProps<typeof WiseRecipientForm> = {}
  ): Promise<void> {
    render(<WiseRecipientForm {...props} />);

    fireEvent.change(screen.getByPlaceholderText('TH'), {
      target: { value: 'GB' },
    });
    fireEvent.click(screen.getByText('Continue'));
    await screen.findByText('Account number');

    fireEvent.change(screen.getByLabelText(/account holder name/i), {
      target: { value: 'Jane Doe' },
    });
    fireEvent.change(screen.getByLabelText('Account number *'), {
      target: { value: '12345678' },
    });
  }

  function typePassword(value = 'my-password'): void {
    fireEvent.change(screen.getByLabelText(/current password/i), {
      target: { value },
    });
  }

  const stepUpOk = (): Response =>
    jsonResponse({ stepUpToken: 'step-up-token', expiresInSeconds: 120 });

  it('submits successfully and shows the success state', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(mockRequirementsResponse))
      .mockResolvedValueOnce(stepUpOk())
      .mockResolvedValueOnce(jsonResponse({ id: 'r1', status: 'ACTIVE' }, 201));

    const onSubmitted = jest.fn();
    await reachDetailsStep({ onSubmitted });
    typePassword();

    fireEvent.click(screen.getByText('Submit payout details'));

    await waitFor(() => {
      expect(
        screen.getByText('Payout details submitted successfully.')
      ).toBeInTheDocument();
    });
    expect(onSubmitted).toHaveBeenCalledWith({ id: 'r1', status: 'ACTIVE' });
  });

  it('proves the password first, then sends the step-up token with the recipient', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(mockRequirementsResponse))
      .mockResolvedValueOnce(stepUpOk())
      .mockResolvedValueOnce(jsonResponse({ id: 'r1', status: 'ACTIVE' }, 201));

    await reachDetailsStep();
    typePassword('my-password');
    fireEvent.click(screen.getByText('Submit payout details'));
    await screen.findByText('Payout details submitted successfully.');

    const stepUpCall = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(stepUpCall[0]).toBe('/api/affiliate/payout-step-up');
    expect(stepUpCall[1].method).toBe('POST');
    expect(JSON.parse(String(stepUpCall[1].body))).toEqual({
      password: 'my-password',
    });

    const recipientCall = mockFetch.mock.calls[2] as [string, RequestInit];
    expect(recipientCall[0]).toBe('/api/wise/recipients');
    expect(recipientCall[1].headers).toEqual(
      expect.objectContaining({ 'X-Payout-Step-Up': 'step-up-token' })
    );
    // The password goes to the step-up route only, never to the recipient route.
    expect(String(recipientCall[1].body)).not.toContain('my-password');
  });

  it('does not send the recipient when the password is wrong', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(mockRequirementsResponse))
      .mockResolvedValueOnce(
        jsonResponse(
          { error: 'Incorrect password', code: 'INVALID_PASSWORD' },
          401
        )
      );

    await reachDetailsStep();
    typePassword('wrong');
    fireEvent.click(screen.getByText('Submit payout details'));

    expect(
      await screen.findByText('That password is not correct.')
    ).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(2);
    // The wrong password is not kept in the field.
    expect(screen.getByLabelText(/current password/i)).toHaveValue('');
  });

  it('asks for the authenticator code when the account has two-factor on, then sends it', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(mockRequirementsResponse))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: 'Enter your authenticator code',
            code: 'TWO_FACTOR_CODE_REQUIRED',
          },
          400
        )
      )
      .mockResolvedValueOnce(stepUpOk())
      .mockResolvedValueOnce(jsonResponse({ id: 'r1', status: 'ACTIVE' }, 201));

    await reachDetailsStep();
    expect(screen.queryByLabelText(/authenticator code/i)).toBeNull();
    typePassword('my-password');
    fireEvent.click(screen.getByText('Submit payout details'));

    const codeField = await screen.findByLabelText(/authenticator code/i);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    typePassword('my-password');
    fireEvent.change(codeField, { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Submit payout details'));
    await screen.findByText('Payout details submitted successfully.');

    const retry = mockFetch.mock.calls[2] as [string, RequestInit];
    expect(JSON.parse(String(retry[1].body))).toEqual({
      password: 'my-password',
      code: '123456',
    });
  });

  it('says so when the attempts are used up', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(mockRequirementsResponse))
      .mockResolvedValueOnce(
        jsonResponse(
          { error: 'Too many attempts', code: 'STEP_UP_RATE_LIMITED' },
          429
        )
      );

    await reachDetailsStep();
    typePassword();
    fireEvent.click(screen.getByText('Submit payout details'));

    expect(
      await screen.findByText(/too many attempts\. try again in a few minutes/i)
    ).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('asks for the password again when money-service refuses the token', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(mockRequirementsResponse))
      .mockResolvedValueOnce(stepUpOk())
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: 'A fresh identity check is required for this action',
            code: 'PAYOUT_STEP_UP_REQUIRED',
          },
          403
        )
      );

    await reachDetailsStep();
    typePassword();
    fireEvent.click(screen.getByText('Submit payout details'));

    expect(
      await screen.findByText(/confirm your password again/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/current password/i)).toHaveValue('');
  });

  it('shows a calm error banner on the confirmed live 403/500 failure', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(mockRequirementsResponse))
      .mockResolvedValueOnce(stepUpOk())
      .mockResolvedValueOnce(
        jsonResponse({ error: 'Wise provider error', providerStatus: 403 }, 500)
      );

    await reachDetailsStep();
    typePassword();
    fireEvent.click(screen.getByText('Submit payout details'));

    expect(
      await screen.findByText(/verification is in progress/i)
    ).toBeInTheDocument();
  });
});

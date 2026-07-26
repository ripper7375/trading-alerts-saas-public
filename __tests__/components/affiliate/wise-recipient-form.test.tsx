/**
 * WiseRecipientForm Component Tests (Session 4A-W3b, File 4/5)
 *
 * @module __tests__/components/affiliate/wise-recipient-form.test
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import WiseRecipientForm from '@/components/affiliate/wise-recipient-form';

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
  });

  it('submits successfully and shows the success state', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(mockRequirementsResponse))
      .mockResolvedValueOnce(jsonResponse({ id: 'r1', status: 'ACTIVE' }, 201));

    const onSubmitted = jest.fn();
    render(<WiseRecipientForm onSubmitted={onSubmitted} />);

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

    fireEvent.click(screen.getByText('Submit payout details'));

    await waitFor(() => {
      expect(
        screen.getByText('Payout details submitted successfully.')
      ).toBeInTheDocument();
    });
    expect(onSubmitted).toHaveBeenCalledWith({ id: 'r1', status: 'ACTIVE' });
  });

  it('shows a calm error banner on the confirmed live 403/500 failure', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(mockRequirementsResponse))
      .mockResolvedValueOnce(
        jsonResponse({ error: 'Wise provider error', providerStatus: 403 }, 500)
      );

    render(<WiseRecipientForm />);

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
    fireEvent.click(screen.getByText('Submit payout details'));

    expect(
      await screen.findByText(/verification is in progress/i)
    ).toBeInTheDocument();
  });
});

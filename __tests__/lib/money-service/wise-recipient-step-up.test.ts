/**
 * @jest-environment node
 */
/**
 * CODE-06B: `createWiseRecipient` carries the payout step-up token to money-service in the
 * `X-Payout-Step-Up` header, next to the body and the bearer token the typed client already adds.
 */

const mockPost = jest.fn();
const mockCreateMoneyApi = jest.fn();
jest.mock('@/lib/api/generated/money-api/client', () => ({
  __esModule: true,
  createMoneyApi: (...args: unknown[]) => mockCreateMoneyApi(...args),
  unwrapMoneyApi: async (result: { data?: unknown }) => result.data,
}));

jest.mock('next/headers', () => ({
  __esModule: true,
  cookies: async () => ({ get: () => undefined }),
}));

import { createWiseRecipient } from '@/lib/money-service/routes';

const body = {
  targetCurrency: 'GBP',
  recipientCountry: 'GB',
  legalType: 'PRIVATE' as const,
  accountHolderName: 'Jane Doe',
  requirementsType: 'sort_code',
  details: { accountNumber: '12345678' },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateMoneyApi.mockReturnValue({ POST: mockPost });
  mockPost.mockResolvedValue({ data: { id: 'r1' }, response: {} });
});

describe('createWiseRecipient', () => {
  it('sends the step-up token in X-Payout-Step-Up', async () => {
    await createWiseRecipient('session-token', body, {
      stepUpToken: 'step-up-token',
    });

    expect(mockCreateMoneyApi).toHaveBeenCalledWith('session-token');
    expect(mockPost).toHaveBeenCalledWith(
      '/v1/wise/recipients',
      expect.objectContaining({
        body,
        headers: { 'X-Payout-Step-Up': 'step-up-token' },
      })
    );
  });

  it('sends no step-up header when there is none, and money-service answers 403', async () => {
    await createWiseRecipient('session-token', body);
    await createWiseRecipient('session-token', body, {});

    for (const call of mockPost.mock.calls) {
      const init = call[1] as { headers?: Record<string, string> };
      expect(init.headers ?? {}).not.toHaveProperty('X-Payout-Step-Up');
    }
  });
});

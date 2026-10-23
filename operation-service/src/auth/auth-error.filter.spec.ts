import { ArgumentsHost } from '@nestjs/common';

import { AuthErrorFilter } from './auth-error.filter';
import {
  InvalidCredentialsError,
  RateLimitError,
  TooManyAttemptsError,
  TwoFactorRequiredError,
} from './errors';

function mockHost() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AuthErrorFilter', () => {
  const filter = new AuthErrorFilter();

  it('maps a regular AuthError to its statusCode + {error, message}', () => {
    const { host, status, json } = mockHost();
    filter.catch(new InvalidCredentialsError(), host);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      error: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    });
  });

  it('maps TwoFactorRequiredError to 200 + {twoFactorRequired, token}, not an error body', () => {
    const { host, status, json } = mockHost();
    filter.catch(new TwoFactorRequiredError('temp-token'), host);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      twoFactorRequired: true,
      token: 'temp-token',
    });
  });

  it('maps TooManyAttemptsError (CODE-01B) to 429 + {error, message, retryAfter}', () => {
    const { host, status, json } = mockHost();
    filter.catch(new TooManyAttemptsError(undefined, 600), host);

    expect(status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith({
      error: 'RATE_LIMITED',
      message: 'Too many attempts. Please try again later.',
      retryAfter: 600,
    });
  });

  it('leaves RateLimitError (the 5s and 60s guards) as it was: its own code, with retryAfter', () => {
    const { host, status, json } = mockHost();
    filter.catch(new RateLimitError('Please wait 42 seconds.', 42), host);

    expect(status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith({
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Please wait 42 seconds.',
      retryAfter: 42,
    });
  });
});

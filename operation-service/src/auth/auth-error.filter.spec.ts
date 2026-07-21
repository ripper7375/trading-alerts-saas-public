import { ArgumentsHost } from '@nestjs/common';

import { AuthErrorFilter } from './auth-error.filter';
import { InvalidCredentialsError, TwoFactorRequiredError } from './errors';

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
});

import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Response } from 'express';

import { AuthError, TwoFactorRequiredError } from './errors';

// Maps the ported AuthError hierarchy to HTTP responses. TwoFactorRequiredError
// is not a failure (statusCode 200) — it returns the intermediate-step token,
// not an { error, message } body.
@Catch(AuthError)
export class AuthErrorFilter implements ExceptionFilter {
  catch(exception: AuthError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof TwoFactorRequiredError) {
      response.status(200).json({
        twoFactorRequired: true,
        token: exception.twoFactorToken,
      });
      return;
    }

    response.status(exception.statusCode).json({
      error: exception.code,
      message: exception.message,
    });
  }
}

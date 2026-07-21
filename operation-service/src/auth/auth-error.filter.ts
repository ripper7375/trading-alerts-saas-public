import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Response } from 'express';

import { AuthError, RateLimitError, TwoFactorRequiredError } from './errors';

// Maps the ported AuthError hierarchy to HTTP responses. TwoFactorRequiredError
// is not a failure (statusCode 200) — it returns the intermediate-step token,
// not an { error, message } body. RateLimitError (Session 3-4: verify-email's
// 5s Gmail-preview guard, resend-verification's 60s per-user limit) carries a
// retryAfter the source Next.js routes always included in the body — added
// here rather than the generic branch so every other AuthError subclass's
// shape stays unchanged.
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

    if (exception instanceof RateLimitError) {
      response.status(exception.statusCode).json({
        error: exception.code,
        message: exception.message,
        retryAfter: exception.retryAfter,
      });
      return;
    }

    response.status(exception.statusCode).json({
      error: exception.code,
      message: exception.message,
    });
  }
}

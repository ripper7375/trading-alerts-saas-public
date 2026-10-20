import { AsyncLocalStorage } from 'async_hooks';

import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { emailHintFromHeaders, type EmailLocaleHint } from './i18n';

/**
 * The reader's language and formats for the request in flight, as the Next.js
 * app forwarded them (`x-email-language`, `x-email-formats`,
 * `x-email-timezone`; see `forwardedRequestContext()` in the monolith).
 *
 * E-mail sent while handling a request (verification, password reset, account
 * deletion, ...) reads it back through `currentEmailLocaleHint()`, so the
 * services that send it never had to pass a locale down.
 */
const requestHint = new AsyncLocalStorage<EmailLocaleHint>();

/** The hint of the request being handled, or none outside a request. */
export function currentEmailLocaleHint(): EmailLocaleHint {
  return requestHint.getStore() ?? {};
}

@Injectable()
export class EmailLocaleContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    requestHint.run(
      emailHintFromHeaders((name) => req.header(name)),
      () => {
        next();
      }
    );
  }
}

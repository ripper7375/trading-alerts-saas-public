import { randomUUID } from 'crypto';

import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { correlationContextStorage } from '../context/log-context';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header(CORRELATION_ID_HEADER);
    const correlationId =
      incoming && incoming.trim().length > 0 ? incoming : `req_${randomUUID()}`;

    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    // Every downstream handler/log call for this request runs inside this
    // AsyncLocalStorage context, so PinoLoggerService's mixin (Step 3) can
    // read the same correlationId without it being threaded through every
    // call site manually.
    correlationContextStorage.run({ correlationId }, () => {
      next();
    });
  }
}

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { getCorrelationId } from '../context/log-context';
import { rootPinoLogger } from '../logging/pino-instance';

interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
  correlationId?: string;
}

/** Global catch-all, registered as APP_FILTER in AppModule. No pre-existing route-scoped filters exist in this service (checked before writing this). */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message, error } = this.resolve(exception);
    const correlationId =
      getCorrelationId() ??
      (response.getHeader('x-correlation-id') as string | undefined);
    const path = request.originalUrl ?? request.url;

    const body: ErrorResponseBody = {
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path,
      ...(correlationId ? { correlationId } : {}),
    };

    const logPayload = {
      correlationId,
      statusCode,
      path,
      ...(statusCode >= 500 && exception instanceof Error
        ? { stack: exception.stack }
        : {}),
    };
    const logMessage =
      typeof message === 'string' ? message : message.join('; ');

    if (statusCode >= 500) {
      rootPinoLogger.error(logPayload, logMessage);
    } else {
      rootPinoLogger.warn(logPayload, logMessage);
    }

    response.status(statusCode).json(body);
  }

  private resolve(exception: unknown): {
    statusCode: number;
    message: string | string[];
    error: string;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === 'string') {
        return {
          statusCode: status,
          message: payload,
          error: exception.name,
        };
      }

      const payloadObj = payload as Record<string, unknown>;
      const message = (payloadObj['message'] ?? exception.message) as
        | string
        | string[];
      const error =
        (payloadObj['error'] as string | undefined) ?? exception.name;
      return { statusCode: status, message, error };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
    };
  }
}

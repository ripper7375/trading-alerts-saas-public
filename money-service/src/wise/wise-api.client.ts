/**
 * Wise HTTP Client (Session 4A-W3a, File 4/10)
 *
 * Central `@Injectable()` service wrapping Node's native `fetch` for all
 * Wise Platform API calls. Injects `X-External-Correlation-Id` and
 * `Authorization: Bearer <WISE_API_TOKEN>` on every request; retries
 * `429`/`5xx` with exponential back-off, respecting `Retry-After` when
 * present (per `02-wise-platform-api-integration-reference.md` §3, §6.2).
 *
 * CRITICAL SECURITY INVARIANT (Body Redaction, design §7.4): callers pass
 * `redactBodyFields` for any request whose body may contain raw bank
 * details (e.g. `POST /v1/accounts`'s `details` object) — those fields are
 * stripped from every log line this client writes. The client never logs
 * response bodies at all (only status/correlation metadata), since a Wise
 * error response can itself echo back submitted PII.
 */

import { randomUUID } from 'crypto';

import { Injectable } from '@nestjs/common';

import { logger } from '../common/logger.util';

import { WiseConfig } from './wise.config';
import {
  CORRELATION_HEADER,
  DEFAULT_TIMEOUT_MS,
  MAX_RETRIES,
  RETRY_BACKOFF_DELAYS_MS,
} from './wise.constants';

export class WiseApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
    public readonly correlationId?: string
  ) {
    super(message);
    this.name = 'WiseApiError';
  }
}

export interface WiseRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  /** Field names to redact from `body` before it is ever logged (design §7.4). */
  redactBodyFields?: string[];
  timeoutMs?: number;
}

@Injectable()
export class WiseApiClient {
  constructor(private readonly config: WiseConfig) {}

  async request<T>(path: string, options: WiseRequestOptions = {}): Promise<T> {
    const method = options.method ?? 'GET';
    const correlationId = `money-service-${randomUUID()}`;
    const url = `${this.config.baseUrl}${path}`;
    const safeRequestBody = this.redact(options.body, options.redactBodyFields);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiToken}`,
      'Content-Type': 'application/json',
      [CORRELATION_HEADER]: correlationId,
      ...options.headers,
    };

    const body =
      options.body !== undefined ? JSON.stringify(options.body) : undefined;

    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutHandle = setTimeout(
          () => controller.abort(),
          options.timeoutMs ?? DEFAULT_TIMEOUT_MS
        );

        let response: Response;
        try {
          response = await fetch(url, {
            method,
            headers,
            body,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutHandle);
        }

        if (
          (response.status === 429 || response.status >= 500) &&
          attempt < MAX_RETRIES
        ) {
          const delay = this.resolveRetryDelay(response, attempt);
          logger.warn('Wise API retryable error, backing off', {
            correlationId,
            path,
            method,
            status: response.status,
            attempt,
            delayMs: delay,
          });
          await this.sleep(delay);
          continue;
        }

        if (!response.ok) {
          logger.error('Wise API request failed', {
            correlationId,
            path,
            method,
            status: response.status,
            requestBody: safeRequestBody,
          });
          throw new WiseApiError(
            `Wise API request failed: ${response.status}`,
            response.status,
            await this.safeReadJson(response),
            correlationId
          );
        }

        logger.info('Wise API request succeeded', {
          correlationId,
          path,
          method,
          status: response.status,
          requestBody: safeRequestBody,
        });

        if (response.status === 204) {
          return undefined as T;
        }
        return (await response.json()) as T;
      } catch (error) {
        if (error instanceof WiseApiError) throw error;
        lastError = error;
        if (attempt < MAX_RETRIES) {
          const delay = RETRY_BACKOFF_DELAYS_MS[attempt] ?? 2000;
          logger.warn('Wise API network error, retrying', {
            correlationId,
            path,
            method,
            attempt,
            delayMs: delay,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          await this.sleep(delay);
          continue;
        }
      }
    }

    logger.error('Wise API request exhausted retries', {
      correlationId,
      path,
      method,
      error: lastError instanceof Error ? lastError.message : 'Unknown error',
    });
    throw lastError instanceof Error
      ? lastError
      : new Error('Wise API request failed after retries');
  }

  private resolveRetryDelay(response: Response, attempt: number): number {
    const retryAfter = response.headers.get('Retry-After');
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (!Number.isNaN(seconds)) return seconds * 1000;
      const dateMs = Date.parse(retryAfter);
      if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
    }
    return RETRY_BACKOFF_DELAYS_MS[attempt] ?? 2000;
  }

  private async safeReadJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }

  private redact(body: unknown, fields?: string[]): unknown {
    if (!body || !fields || fields.length === 0 || typeof body !== 'object') {
      return body;
    }
    const clone: Record<string, unknown> = {
      ...(body as Record<string, unknown>),
    };
    for (const field of fields) {
      if (field in clone) clone[field] = '[REDACTED]';
    }
    return clone;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

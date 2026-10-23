import { createHash, timingSafeEqual } from 'crypto';

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/**
 * SHA-256 both strings, then `timingSafeEqual`: the two buffers always have the same length, so
 * neither the content nor the length of a key shows in the time the comparison takes (CODE-04).
 */
function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash('sha256').update(a).digest(),
    createHash('sha256').update(b).digest()
  );
}

/**
 * The callers a key may belong to. A log line names a caller by one of these prefixes and by
 * nothing else: no other part of a key ever reaches a log, so a prefix rule can never leak the
 * secret part of a key.
 */
const CALLER_PREFIXES = [
  'push_worker_',
  'mt5_relay_',
  'renderer_',
  'monolith_',
] as const;

function callerOf(key: string): string {
  return CALLER_PREFIXES.find((prefix) => key.startsWith(prefix)) ?? 'unknown';
}

/**
 * Bearer-token auth for the Push Worker / Relay. Per
 * gateway_contract_market_data.schema.json and the build doc's §5.1, this
 * pipeline has at most two senders (push_worker_v5, mt5_relay_v2_29) — keys
 * are compared against a comma-separated API_KEYS env var, not looked up
 * per-terminal.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }

    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid authorization type');
    }

    const validApiKeys = (this.configService.get<string>('API_KEYS') ?? '')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    // Every configured key is compared, with no exit on the first match, so the time taken does
    // not say which key (or how many) matched.
    let matched = false;
    let caller = 'unknown';
    for (const key of validApiKeys) {
      const isMatch = safeEqual(token, key);
      if (isMatch) caller = callerOf(key);
      matched = matched || isMatch;
    }

    if (!matched) {
      throw new UnauthorizedException('Invalid API key');
    }

    this.logger.debug(`Authorized caller: ${caller}`);
    return true;
  }
}

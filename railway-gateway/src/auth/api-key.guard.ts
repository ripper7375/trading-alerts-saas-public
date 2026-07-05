import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/**
 * Bearer-token auth for the Push Worker / Relay. Per
 * gateway_contract_market_data.schema.json and the build doc's §5.1, this
 * pipeline has at most two senders (push_worker_v5, mt5_relay_v2_29) — keys
 * are compared against a comma-separated API_KEYS env var, not looked up
 * per-terminal.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
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

    if (!validApiKeys.includes(token)) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}

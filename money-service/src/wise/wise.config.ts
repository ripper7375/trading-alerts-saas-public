/**
 * Wise Configuration Provider (Session 4A-W3a, File 1/10)
 *
 * Typed Wise settings read from ConfigService. Asserts WISE_PROFILE_ID and
 * WISE_API_TOKEN are defined at module init — a misconfigured deploy fails
 * fast instead of silently making unauthenticated calls to Wise.
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type WiseEnvironment = 'sandbox' | 'production';

@Injectable()
export class WiseConfig implements OnModuleInit {
  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    if (!this.profileId) {
      throw new Error('WISE_PROFILE_ID is not set');
    }
    if (!this.apiToken) {
      throw new Error('WISE_API_TOKEN is not set');
    }
  }

  get profileId(): string {
    return this.configService.get<string>('WISE_PROFILE_ID') ?? '';
  }

  get apiToken(): string {
    return this.configService.get<string>('WISE_API_TOKEN') ?? '';
  }

  get environment(): WiseEnvironment {
    return this.configService.get<string>('WISE_ENVIRONMENT') === 'production'
      ? 'production'
      : 'sandbox';
  }

  get baseUrl(): string {
    return this.environment === 'production'
      ? 'https://api.wise.com'
      : 'https://api.wise-sandbox.com';
  }
}

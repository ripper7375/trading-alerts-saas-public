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

  /** F37 (RESOLVED, `DECISION-LOG.md`): `MANUAL`, Thailand region gate.
   * `API` is designed (design §6.3) but not built in Phase 1 — reading this
   * from env allows a future session to flip it without a code change, but
   * the default stays `MANUAL` regardless of region until F37 is revisited. */
  get fundingMode(): 'MANUAL' | 'API' {
    return this.configService.get<string>('WISE_FUNDING_MODE') === 'API'
      ? 'API'
      : 'MANUAL';
  }

  /** Design §6.2/§7.2, OpenAPI `/wise/funding-queue`: default 72h, not the
   * 24h this session's own order text cited (`LESSONS-LEARNED.md` L27). */
  get fundingSlaHours(): number {
    const raw = this.configService.get<string>('WISE_FUNDING_SLA_HOURS');
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 72;
  }
}

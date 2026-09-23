/**
 * Disbursement Settings Service (DECISION-LOG F83)
 *
 * money-service's single reader for the admin-editable payout settings
 * (`/admin/disbursement/settings`). HAND-SYNCED TWIN of the Next reader
 * `getDisbursementSettings()` in lib/disbursement/settings.ts — keys,
 * defaults and bounds live in `disbursement-settings.constants.ts`.
 *
 * Read rules (spec §5.1):
 * - one `systemConfig.findMany` per call, NO cache — a saved change applies
 *   to the next payout run;
 * - a malformed / out-of-bounds row falls back to its default and is logged;
 * - a failed DB read falls back to all defaults and is logged (never throws —
 *   creating a batch needs the same DB, so a real outage still fails the run);
 * - env `DISBURSEMENT_ENABLED=false` (this service's own env) forces
 *   `effectiveEnabled=false` regardless of the DB value.
 *
 * Registered as its own provider instance in CronsModule, DisbursementModule
 * and WiseModule (stateless — same duplicate-instance house convention as
 * TransactionLoggerService et al.).
 */

import { ConflictException, Injectable } from '@nestjs/common';

import { logger } from '../common/logger.util';
import { PrismaService } from '../prisma/prisma.service';

import {
  DISBURSEMENTS_PAUSED_CODE,
  DISBURSEMENT_SETTING_DEFINITIONS,
  DISBURSEMENT_SETTING_NAMES,
  DisbursementSettings,
  defaultDisbursementSettings,
  resolveDisbursementSettings,
} from './disbursement-settings.constants';

export type { DisbursementSettings } from './disbursement-settings.constants';

const SETTING_KEYS = DISBURSEMENT_SETTING_NAMES.map(
  (name) => DISBURSEMENT_SETTING_DEFINITIONS[name].key
);

@Injectable()
export class DisbursementSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<DisbursementSettings> {
    const envValue = process.env['DISBURSEMENT_ENABLED'];
    try {
      const rows = await this.prisma.systemConfig.findMany({
        where: { key: { in: SETTING_KEYS } },
        select: { key: true, value: true },
      });
      const { settings, invalidKeys } = resolveDisbursementSettings(
        rows,
        envValue
      );
      if (invalidKeys.length > 0) {
        logger.error(
          '[disbursement-settings] invalid SystemConfig value(s) — using defaults',
          { invalidKeys }
        );
      }
      return settings;
    } catch (error) {
      logger.error(
        '[disbursement-settings] SystemConfig read failed — using defaults',
        { error: error instanceof Error ? error.message : String(error) }
      );
      return defaultDisbursementSettings(envValue);
    }
  }

  /**
   * Throws 409 `{ error: 'Disbursements are paused', code:
   * 'DISBURSEMENTS_PAUSED' }` when payouts are paused (DB or env). Used by
   * every money-service entry point that creates or executes money movement
   * (E5, E6). Recovery/recording actions do not call it (D4).
   */
  async assertPayoutsNotPaused(): Promise<void> {
    const settings = await this.get();
    if (!settings.effectiveEnabled) {
      throw new ConflictException({
        error: 'Disbursements are paused',
        code: DISBURSEMENTS_PAUSED_CODE,
      });
    }
  }
}

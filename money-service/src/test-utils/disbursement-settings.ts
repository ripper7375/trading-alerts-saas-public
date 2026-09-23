/**
 * Test helpers for DisbursementSettingsService (DECISION-LOG F83).
 *
 * Builds the REAL service over a minimal PrismaService stub whose
 * `systemConfig.findMany` returns the given rows, so controller/service
 * specs exercise the actual parsing + pause logic rather than a hand-rolled
 * double.
 */
import { DisbursementSettingsService } from '../disbursement/disbursement-settings.service';
import type { PrismaService } from '../prisma/prisma.service';

export interface SettingRowFixture {
  key: string;
  value: string;
}

export const PAUSED_SETTING_ROWS: SettingRowFixture[] = [
  { key: 'disbursement_enabled', value: 'false' },
];

export function createDisbursementSettingsService(
  rows: SettingRowFixture[] = []
): DisbursementSettingsService {
  const prisma = {
    systemConfig: { findMany: jest.fn().mockResolvedValue(rows) },
  };
  return new DisbursementSettingsService(prisma as unknown as PrismaService);
}

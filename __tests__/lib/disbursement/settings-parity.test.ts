/**
 * Parity guard: Next ↔ money-service payout settings (DECISION-LOG F83,
 * spec §5.1, LESSONS-LEARNED L1 — money-service code is hand-synced, never a
 * shared package).
 *
 * 1. The SHARED-BEGIN..SHARED-END block of lib/disbursement/settings.ts and
 *    money-service/src/disbursement/disbursement-settings.constants.ts must be
 *    byte-identical (apart from the marker line naming the twin file).
 * 2. The money-service file is also imported directly (it is import-free by
 *    design) and its key/default/bounds table and cron expressions compared
 *    to the Next table value-for-value.
 */

import fs from 'fs';
import path from 'path';

import {
  MAX_BATCH_SIZE,
  MINIMUM_PAYOUT_USD,
} from '@/lib/disbursement/constants';
import * as nextSettings from '@/lib/disbursement/settings';
import * as moneySettings from '../../../money-service/src/disbursement/disbursement-settings.constants';

const ROOT = path.resolve(__dirname, '../../..');
const NEXT_FILE = path.join(ROOT, 'lib/disbursement/settings.ts');
const MONEY_FILE = path.join(
  ROOT,
  'money-service/src/disbursement/disbursement-settings.constants.ts'
);

function sharedBlock(file: string): string {
  const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const start = text.indexOf('// SHARED-BEGIN');
  const end = text.indexOf('// SHARED-END');
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  // drop the marker line itself (it names the other file)
  return text.slice(text.indexOf('\n', start) + 1, end);
}

describe('payout settings parity (Next ↔ money-service)', () => {
  it('the SHARED blocks are byte-identical', () => {
    expect(sharedBlock(NEXT_FILE)).toBe(sharedBlock(MONEY_FILE));
  });

  it('keys, defaults and bounds are equal', () => {
    expect(nextSettings.DISBURSEMENT_SETTING_DEFINITIONS).toEqual(
      moneySettings.DISBURSEMENT_SETTING_DEFINITIONS
    );
    expect(nextSettings.DISBURSEMENT_SETTING_KEYS).toEqual(
      moneySettings.DISBURSEMENT_SETTING_KEYS
    );
    expect(nextSettings.DISBURSEMENT_SETTING_NAMES).toEqual(
      moneySettings.DISBURSEMENT_SETTING_NAMES
    );
  });

  it('the payout schedule and pause code are equal', () => {
    expect(nextSettings.PAYOUT_CRON_EXPRESSION).toBe(
      moneySettings.PAYOUT_CRON_EXPRESSION
    );
    expect(nextSettings.APPROVAL_CRON_EXPRESSION).toBe(
      moneySettings.APPROVAL_CRON_EXPRESSION
    );
    expect(nextSettings.PAYOUT_CRON_EXPRESSION).toBe('0 2 1 * *');
    expect(nextSettings.DISBURSEMENTS_PAUSED_CODE).toBe('DISBURSEMENTS_PAUSED');
  });

  it('the old constants remain the defaults', () => {
    expect(
      nextSettings.DISBURSEMENT_SETTING_DEFINITIONS.minimumPayoutUsd.default
    ).toBe(MINIMUM_PAYOUT_USD);
    expect(
      nextSettings.DISBURSEMENT_SETTING_DEFINITIONS.maxBatchSize.default
    ).toBe(MAX_BATCH_SIZE);
  });

  it('money-service uses PAYOUT_CRON_EXPRESSION on the payout job', () => {
    const scheduler = fs.readFileSync(
      path.join(ROOT, 'money-service/src/crons/crons.scheduler.ts'),
      'utf8'
    );
    expect(scheduler).toMatch(
      /@Cron\(PAYOUT_CRON_EXPRESSION\)\s*\n\s*async scheduledProcessPendingDisbursements/
    );
  });
});

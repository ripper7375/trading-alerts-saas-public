/**
 * Disbursement Payout Settings — keys, defaults, bounds, schedule
 * (DECISION-LOG F83/F84)
 *
 * HAND-SYNCED TWIN: lib/disbursement/settings.ts (Next app). Everything
 * between the SHARED-BEGIN / SHARED-END markers must stay byte-identical in
 * both files — `__tests__/lib/disbursement/settings-parity.test.ts` diffs
 * them. money-service never owns the schema (LESSONS-LEARNED L1); these are
 * plain `SystemConfig` rows, no migration.
 *
 * Kept free of imports (no Nest, no Prisma) so the Next parity test can load
 * it directly. `DisbursementSettingsService` is the DI-injected reader.
 */

// SHARED-BEGIN — keep byte-identical with lib/disbursement/settings.ts
export type DisbursementSettingName =
  | 'enabled'
  | 'minimumPayoutUsd'
  | 'maxBatchSize'
  | 'commissionApprovalDays';

export interface BooleanSettingDefinition {
  key: string;
  valueType: 'boolean';
  default: boolean;
  description: string;
}

export interface NumberSettingDefinition {
  key: string;
  valueType: 'number';
  default: number;
  min: number;
  max: number;
  /** true = whole numbers only; false = up to 2 decimal places */
  integer: boolean;
  description: string;
}

export type DisbursementSettingDefinition =
  | BooleanSettingDefinition
  | NumberSettingDefinition;

/** SystemConfig keys. `affiliate_commission_approval_days` predates F83 and is kept as-is. */
export const DISBURSEMENT_SETTING_KEYS: Record<
  DisbursementSettingName,
  string
> = {
  enabled: 'disbursement_enabled',
  minimumPayoutUsd: 'disbursement_minimum_payout_usd',
  maxBatchSize: 'disbursement_max_batch_size',
  commissionApprovalDays: 'affiliate_commission_approval_days',
};

/** SystemConfig.category for rows created by the payout settings page. */
export const DISBURSEMENT_SETTINGS_CATEGORY = 'disbursement';

/** Defaults equal pre-F83 behaviour: a missing row changes nothing. */
export const DISBURSEMENT_SETTING_DEFINITIONS: {
  enabled: BooleanSettingDefinition;
  minimumPayoutUsd: NumberSettingDefinition;
  maxBatchSize: NumberSettingDefinition;
  commissionApprovalDays: NumberSettingDefinition;
} = {
  enabled: {
    key: 'disbursement_enabled',
    valueType: 'boolean',
    default: true,
    description:
      'Master switch for automated and manual affiliate payouts (env DISBURSEMENT_ENABLED=false overrides)',
  },
  minimumPayoutUsd: {
    key: 'disbursement_minimum_payout_usd',
    valueType: 'number',
    default: 50,
    min: 1,
    max: 10000,
    integer: false,
    description: 'Minimum approved commission balance (USD) before a payout',
  },
  maxBatchSize: {
    key: 'disbursement_max_batch_size',
    valueType: 'number',
    default: 100,
    min: 1,
    max: 500,
    integer: true,
    description: 'Maximum payments per disbursement batch',
  },
  commissionApprovalDays: {
    key: 'affiliate_commission_approval_days',
    valueType: 'number',
    default: 14,
    min: 0,
    max: 90,
    integer: true,
    description:
      'Days after a commission is earned before it is auto-approved (refund window)',
  },
};

export const DISBURSEMENT_SETTING_NAMES: DisbursementSettingName[] = [
  'enabled',
  'minimumPayoutUsd',
  'maxBatchSize',
  'commissionApprovalDays',
];

/** Automated payout run: 1st of each month, 02:00 UTC (F84). */
export const PAYOUT_CRON_EXPRESSION = '0 2 1 * *';
/** Daily commission approval (refund-window maturity), 02:00 UTC (F84). */
export const APPROVAL_CRON_EXPRESSION = '0 2 * * *';

/** Error code on every 409 raised while payouts are paused. */
export const DISBURSEMENTS_PAUSED_CODE = 'DISBURSEMENTS_PAUSED';

export interface DisbursementSettings {
  /** DB value (default true) */
  enabled: boolean;
  /** true when process.env.DISBURSEMENT_ENABLED === 'false' in THIS service */
  envKillSwitch: boolean;
  /** enabled && !envKillSwitch */
  effectiveEnabled: boolean;
  minimumPayoutUsd: number;
  maxBatchSize: number;
  commissionApprovalDays: number;
}

export interface SettingRow {
  key: string;
  value: string;
}

export interface ResolvedDisbursementSettings {
  settings: DisbursementSettings;
  /** Keys whose stored value was unparseable or out of bounds (default used). */
  invalidKeys: string[];
}

function isTwoDecimalPlaces(value: number): boolean {
  const scaled = value * 100;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

/**
 * Parse one stored value. Returns undefined when unparseable or out of
 * bounds; the caller then uses the default. Never throws.
 */
export function parseDisbursementSettingValue(
  name: DisbursementSettingName,
  raw: string
): boolean | number | undefined {
  const definition: DisbursementSettingDefinition =
    DISBURSEMENT_SETTING_DEFINITIONS[name];
  const text = String(raw).trim();
  if (definition.valueType === 'boolean') {
    const lowered = text.toLowerCase();
    if (lowered === 'true') return true;
    if (lowered === 'false') return false;
    return undefined;
  }
  if (text === '') return undefined;
  const value = Number(text);
  if (!Number.isFinite(value)) return undefined;
  if (value < definition.min || value > definition.max) return undefined;
  if (definition.integer && !Number.isInteger(value)) return undefined;
  if (!definition.integer && !isTwoDecimalPlaces(value)) return undefined;
  return value;
}

/** Serialize a value the way it is stored in SystemConfig.value. */
export function serializeDisbursementSettingValue(
  value: boolean | number
): string {
  return String(value);
}

/**
 * Resolve settings from SystemConfig rows + the env kill switch. Missing
 * rows use the default; malformed rows use the default and are reported in
 * `invalidKeys` so the caller can log them.
 */
export function resolveDisbursementSettings(
  rows: SettingRow[],
  envDisbursementEnabled: string | undefined
): ResolvedDisbursementSettings {
  const byKey = new Map<string, string>();
  for (const row of rows) {
    byKey.set(row.key, row.value);
  }
  const invalidKeys: string[] = [];

  const read = (name: DisbursementSettingName): boolean | number => {
    const definition = DISBURSEMENT_SETTING_DEFINITIONS[name];
    const raw = byKey.get(definition.key);
    if (raw === undefined) return definition.default;
    const parsed = parseDisbursementSettingValue(name, raw);
    if (parsed === undefined) {
      invalidKeys.push(definition.key);
      return definition.default;
    }
    return parsed;
  };

  const enabled = read('enabled') as boolean;
  const envKillSwitch = envDisbursementEnabled === 'false';

  return {
    settings: {
      enabled,
      envKillSwitch,
      effectiveEnabled: enabled && !envKillSwitch,
      minimumPayoutUsd: read('minimumPayoutUsd') as number,
      maxBatchSize: read('maxBatchSize') as number,
      commissionApprovalDays: read('commissionApprovalDays') as number,
    },
    invalidKeys,
  };
}

/** Settings used when the DB read itself fails. */
export function defaultDisbursementSettings(
  envDisbursementEnabled: string | undefined
): DisbursementSettings {
  return resolveDisbursementSettings([], envDisbursementEnabled).settings;
}

/**
 * Next firing of PAYOUT_CRON_EXPRESSION ('0 2 1 * *', UTC) strictly after
 * `from`.
 */
export function getNextPayoutRunDate(from: Date): Date {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth();
  const thisMonth = new Date(Date.UTC(year, month, 1, 2, 0, 0, 0));
  if (thisMonth.getTime() > from.getTime()) return thisMonth;
  return new Date(Date.UTC(year, month + 1, 1, 2, 0, 0, 0));
}
// SHARED-END

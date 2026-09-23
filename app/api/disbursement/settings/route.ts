/**
 * Disbursement Payout Settings API (DECISION-LOG F83, spec §7)
 *
 * GET   /api/disbursement/settings — current values, defaults, bounds,
 *       provenance, effective pause state, provider (read-only), payout
 *       schedule, last 10 changes, and an optimistic-concurrency `version`.
 * PATCH /api/disbursement/settings — change one or more settings. `reason`
 *       is required (D6); a stale `expectedVersion` returns 409
 *       `SETTINGS_STALE`. Each changed key is upserted into `SystemConfig`
 *       with a `SystemConfigHistory` row, plus ONE `DisbursementAuditLog` row,
 *       all inside one `$transaction` (fixes the affiliate route's
 *       non-transactional upsert+history, spec C7).
 *
 * Config write, not a money-movement write — lives in the Next app only (no
 * money-service forwarding flag), matching `/api/admin/settings/affiliate`.
 * Server-side payout logic reads these values uncached via
 * `getDisbursementSettings()` / money-service's `DisbursementSettingsService`.
 *
 * @module app/api/disbursement/settings/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '.prisma/non-market-client';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { prisma } from '@/lib/db/prisma';
import { getDefaultProvider } from '@/lib/disbursement/constants';
import { isProviderAvailable } from '@/lib/disbursement/providers/provider-factory';
import {
  DISBURSEMENT_SETTING_DEFINITIONS,
  DISBURSEMENT_SETTING_KEY_LIST,
  DISBURSEMENT_SETTING_NAMES,
  DISBURSEMENT_SETTINGS_CATEGORY,
  DisbursementSettingName,
  PAYOUT_CRON_EXPRESSION,
  PAYOUT_SCHEDULE_DESCRIPTION,
  getNextPayoutRunDate,
  parseDisbursementSettingValue,
  resolveDisbursementSettings,
  serializeDisbursementSettingValue,
} from '@/lib/disbursement/settings';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const { minimumPayoutUsd: MIN_DEF, maxBatchSize: BATCH_DEF } =
  DISBURSEMENT_SETTING_DEFINITIONS;
const APPROVAL_DEF = DISBURSEMENT_SETTING_DEFINITIONS.commissionApprovalDays;

const patchSchema = z
  .object({
    enabled: z.boolean().optional(),
    minimumPayoutUsd: z
      .number()
      .min(MIN_DEF.min)
      .max(MIN_DEF.max)
      .multipleOf(0.01)
      .optional(),
    maxBatchSize: z
      .number()
      .int()
      .min(BATCH_DEF.min)
      .max(BATCH_DEF.max)
      .optional(),
    commissionApprovalDays: z
      .number()
      .int()
      .min(APPROVAL_DEF.min)
      .max(APPROVAL_DEF.max)
      .optional(),
    reason: z.string().trim().min(5).max(500),
    expectedVersion: z.string().datetime().nullable(),
  })
  .strict()
  .refine(
    (body) =>
      DISBURSEMENT_SETTING_NAMES.some((name) => body[name] !== undefined),
    { message: 'At least one setting must be provided' }
  );

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface ConfigRow {
  key: string;
  value: string;
  updatedBy: string | null;
  updatedAt: Date;
}

async function loadRows(): Promise<ConfigRow[]> {
  return prisma.systemConfig.findMany({
    where: { key: { in: DISBURSEMENT_SETTING_KEY_LIST } },
    select: { key: true, value: true, updatedBy: true, updatedAt: true },
  });
}

/** ISO max(updatedAt) across the setting rows, or null when none exist. */
function computeVersion(rows: ConfigRow[]): string | null {
  let latest: Date | null = null;
  for (const row of rows) {
    if (!latest || row.updatedAt > latest) latest = row.updatedAt;
  }
  return latest ? latest.toISOString() : null;
}

function nameForKey(key: string): DisbursementSettingName | undefined {
  return DISBURSEMENT_SETTING_NAMES.find(
    (name) => DISBURSEMENT_SETTING_DEFINITIONS[name].key === key
  );
}

function errorResponse(error: unknown, fallback: string): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode }
    );
  }
  console.error(`[disbursement-settings] ${fallback}:`, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();

    const [rows, recentChanges, lastChanges] = await Promise.all([
      loadRows(),
      prisma.systemConfigHistory.findMany({
        where: { configKey: { in: DISBURSEMENT_SETTING_KEY_LIST } },
        orderBy: { changedAt: 'desc' },
        take: 10,
      }),
      prisma.systemConfigHistory.findMany({
        where: { configKey: { in: DISBURSEMENT_SETTING_KEY_LIST } },
        orderBy: [{ configKey: 'asc' }, { changedAt: 'desc' }],
        distinct: ['configKey'],
      }),
    ]);

    const { settings } = resolveDisbursementSettings(
      rows,
      process.env['DISBURSEMENT_ENABLED']
    );
    const rowByKey = new Map(rows.map((row) => [row.key, row]));
    const lastChangeByKey = new Map(
      lastChanges.map((change) => [change.configKey, change])
    );

    const describe = (name: DisbursementSettingName) => {
      const definition = DISBURSEMENT_SETTING_DEFINITIONS[name];
      const row = rowByKey.get(definition.key);
      const storedValid =
        row !== undefined &&
        parseDisbursementSettingValue(name, row.value) !== undefined;
      const lastChange = lastChangeByKey.get(definition.key);
      return {
        key: definition.key,
        value: settings[name],
        default: definition.default,
        ...(definition.valueType === 'number'
          ? {
              min: definition.min,
              max: definition.max,
              integer: definition.integer,
            }
          : {}),
        source: storedValid ? 'database' : 'default',
        ...(row && !storedValid ? { invalidStoredValue: row.value } : {}),
        updatedBy: row?.updatedBy ?? null,
        updatedAt: row?.updatedAt.toISOString() ?? null,
        lastChange: lastChange
          ? {
              changedBy: lastChange.changedBy,
              changedAt: lastChange.changedAt.toISOString(),
            }
          : null,
      };
    };

    return NextResponse.json({
      settings: {
        enabled: describe('enabled'),
        minimumPayoutUsd: describe('minimumPayoutUsd'),
        maxBatchSize: describe('maxBatchSize'),
        commissionApprovalDays: describe('commissionApprovalDays'),
      },
      effective: {
        enabled: settings.effectiveEnabled,
        envKillSwitch: settings.envKillSwitch,
      },
      provider: {
        active: getDefaultProvider(),
        available: [
          'MOCK',
          isProviderAvailable('RISE') ? 'RISE' : null,
          isProviderAvailable('WISE') ? 'WISE' : null,
        ].filter(Boolean),
        source: 'env',
        envVar: 'DISBURSEMENT_PROVIDER',
      },
      schedule: {
        cronExpression: PAYOUT_CRON_EXPRESSION,
        description: PAYOUT_SCHEDULE_DESCRIPTION,
        nextRunAt: getNextPayoutRunDate(new Date()).toISOString(),
      },
      recentChanges: recentChanges.map((change) => ({
        id: change.id,
        setting: nameForKey(change.configKey) ?? change.configKey,
        configKey: change.configKey,
        oldValue: change.oldValue,
        newValue: change.newValue,
        changedBy: change.changedBy,
        reason: change.reason,
        changedAt: change.changedAt.toISOString(),
      })),
      version: computeVersion(rows),
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load payout settings');
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PATCH
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAdmin();
    const adminId = session.user.id;
    const adminEmail = session.user.email ?? adminId;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Request body must be valid JSON' },
        { status: 400 }
      );
    }

    const validation = patchSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }
    const input = validation.data;

    const rows = await loadRows();
    const currentVersion = computeVersion(rows);
    if (currentVersion !== input.expectedVersion) {
      return NextResponse.json(
        {
          error: 'Settings were changed by someone else — reload and retry',
          code: 'SETTINGS_STALE',
          version: currentVersion,
        },
        { status: 409 }
      );
    }

    const envValue = process.env['DISBURSEMENT_ENABLED'];
    const { settings: current } = resolveDisbursementSettings(rows, envValue);
    const rowByKey = new Map(rows.map((row) => [row.key, row]));

    const changes: Array<{
      setting: DisbursementSettingName;
      key: string;
      oldValue: string;
      newValue: string;
    }> = [];
    for (const name of DISBURSEMENT_SETTING_NAMES) {
      const next = input[name];
      if (next === undefined || next === current[name]) continue;
      const definition = DISBURSEMENT_SETTING_DEFINITIONS[name];
      changes.push({
        setting: name,
        key: definition.key,
        oldValue:
          rowByKey.get(definition.key)?.value ??
          serializeDisbursementSettingValue(definition.default),
        newValue: serializeDisbursementSettingValue(next),
      });
    }

    if (changes.length === 0) {
      return NextResponse.json({
        changes: [],
        effective: {
          enabled: current.effectiveEnabled,
          envKillSwitch: current.envKillSwitch,
        },
        version: currentVersion,
      });
    }

    const enabledChange = changes.find((c) => c.setting === 'enabled');
    const audit = !enabledChange
      ? { action: 'config.settings_updated', status: 'INFO' as const }
      : enabledChange.newValue === 'false'
        ? { action: 'config.disbursements_paused', status: 'WARNING' as const }
        : { action: 'config.disbursements_resumed', status: 'INFO' as const };

    await prisma.$transaction(async (tx) => {
      for (const change of changes) {
        const definition = DISBURSEMENT_SETTING_DEFINITIONS[change.setting];
        await tx.systemConfig.upsert({
          where: { key: change.key },
          create: {
            key: change.key,
            value: change.newValue,
            valueType: definition.valueType,
            category: DISBURSEMENT_SETTINGS_CATEGORY,
            description: definition.description,
            updatedBy: adminId,
          },
          update: { value: change.newValue, updatedBy: adminId },
        });
        await tx.systemConfigHistory.create({
          data: {
            configKey: change.key,
            oldValue: change.oldValue,
            newValue: change.newValue,
            changedBy: adminEmail,
            reason: input.reason,
          },
        });
      }
      await tx.disbursementAuditLog.create({
        data: {
          action: audit.action,
          status: audit.status,
          actor: adminId,
          details: {
            changes,
            reason: input.reason,
            changedBy: adminEmail,
          } as unknown as Prisma.InputJsonValue,
        },
      });
    });

    const updatedRows = await loadRows();
    const { settings: updated } = resolveDisbursementSettings(
      updatedRows,
      envValue
    );

    return NextResponse.json({
      changes: changes.map(({ setting, oldValue, newValue }) => ({
        setting,
        oldValue,
        newValue,
      })),
      effective: {
        enabled: updated.effectiveEnabled,
        envKillSwitch: updated.envKillSwitch,
      },
      version: computeVersion(updatedRows),
    });
  } catch (error) {
    return errorResponse(error, 'Failed to update payout settings');
  }
}

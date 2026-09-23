'use client';

/**
 * Disbursement Payout Settings — Client Component (DECISION-LOG F83/F84)
 *
 * Replaces the retired placeholder `/admin/disbursement/config`. Every value
 * here is a real `SystemConfig` row (category `disbursement`, plus the
 * pre-existing `affiliate_commission_approval_days`), written through
 * `PATCH /api/disbursement/settings` with a required reason and audited in
 * `SystemConfigHistory` + `DisbursementAuditLog`. Changes apply to the next
 * payout run with no redeploy.
 *
 * Read-only on purpose:
 * - the payment provider (env `DISBURSEMENT_PROVIDER`, redeploy — spec D1);
 * - the env emergency stop `DISBURSEMENT_ENABLED=false`, which this page can
 *   show but never override;
 * - the payout schedule (monthly, fixed in code — F84).
 *
 * Both env values shown here are the WEB APP's (Vercel). money-service reads
 * its own copies of `DISBURSEMENT_ENABLED` / `DISBURSEMENT_PROVIDER`; verify
 * those on Railway directly (feasibility assessment, adjustment A4).
 */

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ToastContainer } from '@/components/ui/toast-container';
import { useToast } from '@/hooks/use-toast';
import { useLocale } from '@/lib/context/locale-context';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type NumericSettingName =
  | 'minimumPayoutUsd'
  | 'maxBatchSize'
  | 'commissionApprovalDays';

interface LastChange {
  changedBy: string;
  changedAt: string;
}

interface SettingMeta<T> {
  key: string;
  value: T;
  default: T;
  min?: number;
  max?: number;
  integer?: boolean;
  source: 'database' | 'default';
  invalidStoredValue?: string;
  updatedBy: string | null;
  updatedAt: string | null;
  lastChange: LastChange | null;
}

interface RecentChange {
  id: string;
  setting: string;
  configKey: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  reason: string | null;
  changedAt: string;
}

interface SettingsResponse {
  settings: {
    enabled: SettingMeta<boolean>;
    minimumPayoutUsd: SettingMeta<number>;
    maxBatchSize: SettingMeta<number>;
    commissionApprovalDays: SettingMeta<number>;
  };
  effective: { enabled: boolean; envKillSwitch: boolean };
  provider: {
    active: string;
    available: string[];
    source: string;
    envVar: string;
  };
  schedule: { cronExpression: string; description: string; nextRunAt: string };
  recentChanges: RecentChange[];
  version: string | null;
}

interface Draft {
  enabled: boolean;
  minimumPayoutUsd: string;
  maxBatchSize: string;
  commissionApprovalDays: string;
}

interface PendingChange {
  setting: keyof Draft;
  from: string;
  to: string;
}

const NUMERIC_SETTINGS: NumericSettingName[] = [
  'minimumPayoutUsd',
  'maxBatchSize',
  'commissionApprovalDays',
];

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function toDraft(data: SettingsResponse): Draft {
  return {
    enabled: data.settings.enabled.value,
    minimumPayoutUsd: String(data.settings.minimumPayoutUsd.value),
    maxBatchSize: String(data.settings.maxBatchSize.value),
    commissionApprovalDays: String(data.settings.commissionApprovalDays.value),
  };
}

/** Parsed number, or null when the text is not a valid value for the field. */
function parseNumeric(text: string, meta: SettingMeta<number>): number | null {
  if (text.trim() === '') return null;
  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  if (meta.min !== undefined && value < meta.min) return null;
  if (meta.max !== undefined && value > meta.max) return null;
  if (meta.integer && !Number.isInteger(value)) return null;
  if (!meta.integer && Math.abs(value * 100 - Math.round(value * 100)) > 1e-6)
    return null;
  return value;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PAGE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function DisbursementSettingsPage(): React.ReactElement {
  const { t, formatDate, formatTimestamp } = useLocale();
  // formatTimestamp() is time-only; audit entries and the next run need the
  // date too (same combination as app/admin/settings/affiliate/page.tsx).
  const formatWhen = (utc: string): string =>
    `${formatDate(utc)} ${formatTimestamp(utc)}`;
  const { toasts, success: showSuccess, removeToast } = useToast();

  const [data, setData] = useState<SettingsResponse | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/disbursement/settings');
      const body = await response.json();
      if (!response.ok) {
        throw new Error(
          body.error ||
            t(
              'admin.disbursement.settings.error_load',
              'Failed to load payout settings'
            )
        );
      }
      setData(body as SettingsResponse);
      setDraft(toDraft(body as SettingsResponse));
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('admin.dashboard.unknown_error', 'Unknown error')
      );
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const fieldErrors = useMemo(() => {
    const errors: Partial<Record<NumericSettingName, string>> = {};
    if (!data || !draft) return errors;
    for (const name of NUMERIC_SETTINGS) {
      const meta = data.settings[name];
      if (parseNumeric(draft[name], meta) === null) {
        errors[name] = t(
          meta.integer
            ? 'admin.disbursement.settings.error_range_integer'
            : 'admin.disbursement.settings.error_range_decimal',
          meta.integer
            ? 'Enter a whole number from {min} to {max}.'
            : 'Enter an amount from {min} to {max}, at most 2 decimal places.'
        )
          .replace('{min}', String(meta.min))
          .replace('{max}', String(meta.max));
      }
    }
    return errors;
  }, [data, draft, t]);

  const pendingChanges = useMemo((): PendingChange[] => {
    if (!data || !draft) return [];
    const changes: PendingChange[] = [];
    if (draft.enabled !== data.settings.enabled.value) {
      changes.push({
        setting: 'enabled',
        from: String(data.settings.enabled.value),
        to: String(draft.enabled),
      });
    }
    for (const name of NUMERIC_SETTINGS) {
      const parsed = parseNumeric(draft[name], data.settings[name]);
      if (parsed !== null && parsed !== data.settings[name].value) {
        changes.push({
          setting: name,
          from: String(data.settings[name].value),
          to: String(parsed),
        });
      }
    }
    return changes;
  }, [data, draft]);

  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  const reasonValid = reason.trim().length >= 5;
  const canSave =
    pendingChanges.length > 0 && !hasFieldErrors && reasonValid && !isSaving;
  const pausing = pendingChanges.some(
    (c) => c.setting === 'enabled' && c.to === 'false'
  );

  const labelFor = (setting: keyof Draft): string => {
    switch (setting) {
      case 'enabled':
        return t(
          'admin.disbursement.settings.enabled_label',
          'Payouts enabled'
        );
      case 'minimumPayoutUsd':
        return t(
          'admin.disbursement.settings.minimum_payout_label',
          'Minimum payout (USD)'
        );
      case 'maxBatchSize':
        return t(
          'admin.disbursement.settings.max_batch_size_label',
          'Max payments per batch'
        );
      default:
        return t(
          'admin.disbursement.settings.approval_days_label',
          'Commission approval window (days)'
        );
    }
  };

  const displayValue = (setting: keyof Draft, value: string): string => {
    if (setting === 'enabled') {
      return value === 'true'
        ? t('admin.disbursement.settings.value_on', 'On')
        : t('admin.disbursement.settings.value_off', 'Off');
    }
    return setting === 'minimumPayoutUsd' ? `$${value}` : value;
  };

  const handleSave = async (): Promise<void> => {
    if (!data || !draft) return;
    const body: Record<string, unknown> = {
      reason: reason.trim(),
      expectedVersion: data.version,
    };
    for (const change of pendingChanges) {
      body[change.setting] =
        change.setting === 'enabled' ? change.to === 'true' : Number(change.to);
    }

    try {
      setIsSaving(true);
      setError(null);
      setNotice(null);
      const response = await fetch('/api/disbursement/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();

      if (response.status === 409 && result.code === 'SETTINGS_STALE') {
        setNotice(
          t(
            'admin.disbursement.settings.stale_reloaded',
            'Settings were changed by someone else — reloaded. Review the current values and save again.'
          )
        );
        await load();
        return;
      }
      if (!response.ok) {
        throw new Error(
          result.error ||
            t(
              'admin.disbursement.settings.error_save',
              'Failed to save payout settings'
            )
        );
      }

      showSuccess(
        t('admin.disbursement.settings.saved_title', 'Payout settings saved'),
        t(
          'admin.disbursement.settings.saved_description',
          'Payout runs and manual actions use the new values from the next run — no redeploy needed. Affiliate pages show a new minimum within 5 minutes.'
        )
      );
      setReason('');
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('admin.disbursement.error_save', 'Failed to save')
      );
    } finally {
      setIsSaving(false);
      setConfirmOpen(false);
    }
  };

  if (isLoading && !data) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-green-500" />
      </div>
    );
  }

  if (!data || !draft) {
    return (
      <Card className="border-red-600 bg-red-500/10">
        <CardContent className="py-4">
          <p className="text-red-500">
            {error ??
              t(
                'admin.disbursement.settings.error_load',
                'Failed to load payout settings'
              )}
          </p>
        </CardContent>
      </Card>
    );
  }

  const { settings, effective, provider, schedule } = data;
  const envKillSwitch = effective.envKillSwitch;
  const pausedByAdmin = !settings.enabled.value;

  const renderMeta = (meta: SettingMeta<number> | SettingMeta<boolean>) => (
    <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
      <p>
        {t(
          'admin.disbursement.settings.default_label',
          'Default: {value}'
        ).replace(
          '{value}',
          typeof meta.default === 'boolean'
            ? meta.default
              ? t('admin.disbursement.settings.value_on', 'On')
              : t('admin.disbursement.settings.value_off', 'Off')
            : String(meta.default)
        )}
      </p>
      {meta.lastChange ? (
        <p>
          {t(
            'admin.disbursement.settings.last_changed',
            'Last changed by {who} on {when}'
          )
            .replace('{who}', meta.lastChange.changedBy)
            .replace('{when}', formatWhen(meta.lastChange.changedAt))}
        </p>
      ) : (
        <p>
          {t(
            'admin.disbursement.settings.never_changed',
            'Never changed — using the default'
          )}
        </p>
      )}
      {meta.invalidStoredValue !== undefined && (
        <p className="text-amber-600 dark:text-amber-400">
          {t(
            'admin.disbursement.settings.invalid_stored',
            'Stored value "{value}" is invalid; the default is in effect.'
          ).replace('{value}', meta.invalidStoredValue)}
        </p>
      )}
    </div>
  );

  const renderNumeric = (
    name: NumericSettingName,
    helper: string,
    step: string
  ) => {
    const meta = settings[name];
    return (
      <div className="grid gap-2 border-t border-border pt-4 sm:grid-cols-3 sm:gap-6">
        <div>
          <Label htmlFor={`setting-${name}`} className="text-foreground">
            {labelFor(name)}
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
        </div>
        <div className="sm:col-span-2">
          <div className="flex items-center gap-3">
            <Input
              id={`setting-${name}`}
              data-testid={`input-${name}`}
              type="number"
              inputMode="decimal"
              step={step}
              min={meta.min}
              max={meta.max}
              value={draft[name]}
              onChange={(e) =>
                setDraft({ ...draft, [name]: e.target.value } as Draft)
              }
              className="max-w-[180px]"
              aria-invalid={fieldErrors[name] ? true : undefined}
            />
            <button
              type="button"
              className="text-xs text-muted-foreground underline hover:text-foreground"
              onClick={() =>
                setDraft({ ...draft, [name]: String(meta.default) } as Draft)
              }
            >
              {t(
                'admin.disbursement.settings.reset_default',
                'Reset to default'
              )}
            </button>
          </div>
          {fieldErrors[name] && (
            <p className="mt-1 text-xs text-red-500">{fieldErrors[name]}</p>
          )}
          {renderMeta(meta)}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* 1. Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          {t('admin.disbursement.nav_settings', 'Payout Settings')}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {t(
            'admin.disbursement.settings.subtitle',
            'Changes apply to the next payout run — no redeploy needed.'
          )}
        </p>
      </div>

      {/* 2. Status banner */}
      {envKillSwitch ? (
        <div
          data-testid="status-banner"
          className="rounded-lg border border-red-600 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400"
        >
          {t(
            'admin.disbursement.settings.banner_env_stop',
            'Payouts stopped at deploy level (DISBURSEMENT_ENABLED=false). This page can’t override it.'
          )}
        </div>
      ) : pausedByAdmin ? (
        <div
          data-testid="status-banner"
          className="rounded-lg border border-amber-500 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400"
        >
          {t(
            'admin.disbursement.settings.banner_paused',
            'Payouts paused by an admin.'
          )}
          {settings.enabled.lastChange && (
            <>
              {' '}
              {t(
                'admin.disbursement.settings.banner_paused_by',
                'Paused by {who} on {when}.'
              )
                .replace('{who}', settings.enabled.lastChange.changedBy)
                .replace(
                  '{when}',
                  formatWhen(settings.enabled.lastChange.changedAt)
                )}
            </>
          )}
        </div>
      ) : (
        <div
          data-testid="status-banner"
          className="rounded-lg border border-emerald-600 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-400"
        >
          {t('admin.disbursement.settings.banner_active', 'Payouts active')}
        </div>
      )}

      {error && (
        <Card className="border-red-600 bg-red-500/10">
          <CardContent className="py-4">
            <p className="text-red-500">{error}</p>
          </CardContent>
        </Card>
      )}
      {notice && (
        <Card className="border-amber-500 bg-amber-500/10">
          <CardContent className="py-4">
            <p className="text-amber-700 dark:text-amber-400">{notice}</p>
          </CardContent>
        </Card>
      )}

      {/* 3. Settings form */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">
            {t('admin.disbursement.settings.form_title', 'Payout rules')}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {t(
              'admin.disbursement.settings.form_description',
              'Stored in the database and audited. Enforced by both the web app and money-service.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Payouts enabled */}
          <div className="grid gap-2 sm:grid-cols-3 sm:gap-6">
            <div>
              <Label htmlFor="setting-enabled" className="text-foreground">
                {labelFor('enabled')}
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                {t(
                  'admin.disbursement.settings.enabled_helper',
                  'When off, the monthly auto-payout run (1st, 02:00 UTC) and all manual batch/pay/execute actions are blocked. Daily commission approval still runs.'
                )}
              </p>
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-center gap-3">
                <Switch
                  id="setting-enabled"
                  data-testid="switch-enabled"
                  aria-label={labelFor('enabled')}
                  checked={draft.enabled}
                  disabled={envKillSwitch}
                  onCheckedChange={(checked) =>
                    setDraft({ ...draft, enabled: checked })
                  }
                />
                <span className="text-sm text-foreground">
                  {draft.enabled
                    ? t('admin.disbursement.settings.value_on', 'On')
                    : t('admin.disbursement.settings.value_off', 'Off')}
                </span>
                {!envKillSwitch && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline hover:text-foreground"
                    onClick={() =>
                      setDraft({ ...draft, enabled: settings.enabled.default })
                    }
                  >
                    {t(
                      'admin.disbursement.settings.reset_default',
                      'Reset to default'
                    )}
                  </button>
                )}
              </div>
              {renderMeta(settings.enabled)}
            </div>
          </div>

          {/* Payout schedule (read-only, F84) */}
          <div className="grid gap-2 border-t border-border pt-4 sm:grid-cols-3 sm:gap-6">
            <div>
              <p className="text-sm font-medium text-foreground">
                {t(
                  'admin.disbursement.settings.schedule_label',
                  'Payout schedule'
                )}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t(
                  'admin.disbursement.settings.schedule_helper',
                  'Fixed in code. Commission approval runs daily at 02:00 UTC.'
                )}
              </p>
            </div>
            <div className="sm:col-span-2" data-testid="payout-schedule">
              <p className="text-sm text-foreground">
                {t(
                  'admin.disbursement.settings.schedule_value',
                  'Monthly — 1st of each month, 02:00 UTC'
                )}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t(
                  'admin.disbursement.settings.next_run',
                  'Next run: {when} ({utc} UTC)'
                )
                  .replace('{when}', formatWhen(schedule.nextRunAt))
                  .replace(
                    '{utc}',
                    schedule.nextRunAt.slice(0, 16).replace('T', ' ')
                  )}
              </p>
            </div>
          </div>

          {renderNumeric(
            'minimumPayoutUsd',
            t(
              'admin.disbursement.settings.minimum_payout_helper',
              'Affiliates need at least this approved balance to be paid. Also shown to affiliates.'
            ),
            '0.01'
          )}
          {renderNumeric(
            'maxBatchSize',
            t(
              'admin.disbursement.settings.max_batch_size_helper',
              'Larger payout runs are split into several batches. With Wise manual funding, each batch is funded separately.'
            ),
            '1'
          )}
          {renderNumeric(
            'commissionApprovalDays',
            t(
              'admin.disbursement.settings.approval_days_helper',
              'Refund window: a commission becomes payable this many days after it is earned.'
            ),
            '1'
          )}
        </CardContent>
      </Card>

      {/* 4. Provider (read-only) */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-foreground">
            {t('admin.disbursement.payment_provider', 'Payment Provider')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              data-testid="provider-active"
              className="bg-blue-500/10 text-blue-600 dark:text-blue-400"
            >
              {provider.active}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {t(
                'admin.disbursement.settings.available_providers',
                'Available:'
              )}{' '}
              {provider.available.join(', ')}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t(
              'admin.disbursement.settings.provider_note',
              'Set by the DISBURSEMENT_PROVIDER environment variable on money-service; changing it requires a redeploy.'
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {t(
              'admin.disbursement.settings.env_scope_note',
              'The provider and the DISBURSEMENT_ENABLED stop shown on this page are the web app’s environment values. money-service reads its own — check them on Railway.'
            )}
          </p>
        </CardContent>
      </Card>

      {/* 5. Reason + Save */}
      <Card className="border-border bg-card">
        <CardContent className="space-y-3 pt-6">
          <Label htmlFor="settings-reason" className="text-foreground">
            {t('admin.disbursement.settings.reason_label', 'Reason for change')}
          </Label>
          <Textarea
            id="settings-reason"
            data-testid="settings-reason"
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t(
              'admin.disbursement.settings.reason_placeholder',
              'Required, at least 5 characters — recorded in the audit history.'
            )}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              data-testid="save-settings"
              disabled={!canSave}
              onClick={() => setConfirmOpen(true)}
            >
              {isSaving
                ? t('Saving...')
                : t('admin.disbursement.settings.save', 'Save changes')}
            </Button>
            {pendingChanges.length > 0 && (
              <Button
                variant="outline"
                disabled={isSaving}
                onClick={() => setDraft(toDraft(data))}
              >
                {t('admin.disbursement.settings.discard', 'Discard changes')}
              </Button>
            )}
            {pendingChanges.length > 0 && !reasonValid && (
              <span className="text-xs text-muted-foreground">
                {t(
                  'admin.disbursement.settings.reason_required',
                  'Enter a reason to save.'
                )}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 6. Confirm dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(
                'admin.disbursement.settings.confirm_title',
                'Confirm payout settings change'
              )}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <ul data-testid="confirm-diff" className="space-y-1">
                  {pendingChanges.map((change) => (
                    <li key={change.setting}>
                      <span className="font-medium text-foreground">
                        {labelFor(change.setting)}
                      </span>
                      : {displayValue(change.setting, change.from)} →{' '}
                      {displayValue(change.setting, change.to)}
                    </li>
                  ))}
                </ul>
                {pausing && (
                  <p className="font-medium text-red-600 dark:text-red-400">
                    {t(
                      'admin.disbursement.settings.confirm_pause_warning',
                      'Pausing blocks the monthly auto-payout run and every manual batch, pay and execute action until payouts are turned back on.'
                    )}
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>
              {t('Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="confirm-save"
              disabled={isSaving}
              onClick={(e) => {
                e.preventDefault();
                void handleSave();
              }}
            >
              {t('admin.disbursement.settings.confirm_save', 'Save')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 7. Recent changes */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-foreground">
            {t('admin.disbursement.settings.recent_changes', 'Recent changes')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentChanges.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t(
                'admin.disbursement.settings.no_changes',
                'No changes recorded yet.'
              )}
            </p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {data.recentChanges.map((change) => (
                <li key={change.id} className="py-2">
                  <p className="text-foreground">
                    <span className="font-medium">
                      {labelFor(change.setting as keyof Draft)}
                    </span>
                    : {change.oldValue} → {change.newValue}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {change.changedBy} · {formatWhen(change.changedAt)}
                    {change.reason ? ` · ${change.reason}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/admin/system/config-history"
            className="mt-3 inline-block text-xs text-muted-foreground underline hover:text-foreground"
          >
            {t(
              'admin.disbursement.settings.full_history',
              'Full configuration history'
            )}
          </Link>
        </CardContent>
      </Card>

      {/* Related settings (§8A.4) */}
      <p className="text-xs text-muted-foreground">
        {t(
          'admin.disbursement.settings.related_prefix',
          'Related settings: pricing, discount and commission rates are on'
        )}{' '}
        <Link
          href="/admin/settings/affiliate"
          className="underline hover:text-foreground"
        >
          {t('admin.disbursement.settings.related_link', 'Affiliate Settings')}
        </Link>
        .
      </p>
    </div>
  );
}

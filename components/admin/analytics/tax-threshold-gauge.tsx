import type { AlertLevel } from '@/lib/admin/analytics/jurisdictions';
import { cn } from '@/lib/utils';
import { getServerLanguage } from '@/lib/i18n/server-locale';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export interface TaxThresholdGaugeProps {
  countryName: string;
  utilizationPct: number | null;
  alertLevel: AlertLevel;
  approxLocalSales: number | null;
  statutoryThreshold: number | null;
  statutoryThresholdCurrency: string;
}

const ALERT_LEVEL_LABEL: Record<AlertLevel, string> = {
  LEVEL_0_SAFE: 'LEVEL 0: SAFE',
  LEVEL_1_WARN: 'LEVEL 1: WARNING',
  LEVEL_2_ACTION: 'LEVEL 2: ACTION REQUIRED',
  LEVEL_3_CRITICAL: 'LEVEL 3: CRITICAL',
  ACTIVE_COLLECTING: 'ACTIVE / COLLECTING',
  NOT_APPLICABLE: 'NO VAT/GST REGIME',
};

const ALERT_LEVEL_TOKEN: Record<AlertLevel, string> = {
  LEVEL_0_SAFE: 'success',
  LEVEL_1_WARN: 'warning',
  LEVEL_2_ACTION: 'warning',
  LEVEL_3_CRITICAL: 'destructive',
  ACTIVE_COLLECTING: 'success',
  NOT_APPLICABLE: 'muted',
};

function fmtLocal(amount: number | null, currency: string): string {
  if (amount === null) return '-';
  return `${currency} ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/**
 * Metric #17 VAT/tax threshold progress meter -- multi-stage color
 * transition driven directly off the API's already-classified `alertLevel`
 * (not recomputed here), so the gauge can never disagree with the
 * surveillance table. `NOT_APPLICABLE` (HK -- no VAT/GST regime) renders
 * text instead of a bar rather than a misleading 0%/full bar.
 */
export async function TaxThresholdGauge({
  countryName,
  utilizationPct,
  alertLevel,
  approxLocalSales,
  statutoryThreshold,
  statutoryThresholdCurrency,
}: TaxThresholdGaugeProps): Promise<React.ReactElement> {
  const dict = getDictionary(await getServerLanguage());
  const token = ALERT_LEVEL_TOKEN[alertLevel];
  const alertLevelLabel = ALERT_LEVEL_LABEL[alertLevel];

  return (
    <div
      className={cn(
        'space-y-2 rounded-xl border p-3.5',
        token === 'success' && 'border-success/30 bg-success/10',
        token === 'warning' && 'border-warning/30 bg-warning/10',
        token === 'destructive' && 'border-destructive/30 bg-destructive/10',
        token === 'muted' && 'bg-muted/30 border-border'
      )}
    >
      <div className="flex items-center justify-between gap-2 font-sans text-sm font-bold">
        <span className="text-foreground">{countryName}</span>
        <span
          className={cn(
            'whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold',
            token === 'success' && 'bg-success/20 text-success',
            token === 'warning' && 'bg-warning/20 text-warning',
            token === 'destructive' && 'bg-destructive/20 text-destructive',
            token === 'muted' && 'bg-muted text-muted-foreground'
          )}
        >
          {dict[alertLevelLabel] ?? alertLevelLabel}
        </span>
      </div>

      {alertLevel === 'NOT_APPLICABLE' ? (
        <p className="text-[11px] text-muted-foreground">
          {dict['analytics.no_vat_regime'] ??
            'No VAT/GST regime applies to digital services in this jurisdiction.'}
        </p>
      ) : (
        <>
          <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>
              {dict['analytics.approx_local_sales'] ?? 'Approx. Local Sales:'}{' '}
              <strong className="text-foreground">
                {fmtLocal(approxLocalSales, statutoryThresholdCurrency)}
              </strong>
              {' / '}
              {dict['Threshold:'] ?? 'Threshold:'}{' '}
              <strong className="text-foreground">
                {statutoryThreshold === null
                  ? (dict['analytics.zero_day_one'] ?? 'Zero (Day 1)')
                  : fmtLocal(statutoryThreshold, statutoryThresholdCurrency)}
              </strong>
            </span>
            <span
              className={cn(
                'font-bold',
                token === 'success' && 'text-success',
                token === 'warning' && 'text-warning',
                token === 'destructive' && 'text-destructive'
              )}
            >
              {utilizationPct !== null ? `${utilizationPct.toFixed(1)}%` : '-'}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full',
                token === 'success' && 'bg-success',
                token === 'warning' && 'bg-warning',
                token === 'destructive' && 'bg-destructive'
              )}
              style={{ width: `${Math.min(utilizationPct ?? 0, 100)}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}

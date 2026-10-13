'use client';

import { useLocale } from '@/lib/context/locale-context';
import type { FxRateProvider } from '@/lib/fx/rate-contract';
import { cn } from '@/lib/utils';

const PROVIDERS: Record<
  Exclude<FxRateProvider, 'fixed'>,
  { name: string; href: string }
> = {
  currencybeacon: {
    name: 'CurrencyBeacon',
    href: 'https://currencybeacon.com/',
  },
  frankfurter: {
    name: 'Frankfurter',
    href: 'https://frankfurter.dev/',
  },
};

export interface FxRateAttributionProps {
  className?: string;
}

/** Attributes the snapshot used for the displayed subscription conversion. */
export function FxRateAttribution({ className }: FxRateAttributionProps) {
  const { t, usdRates, formatDateTime } = useLocale();
  const provider = usdRates?.provider;
  const source = provider && provider !== 'fixed' ? PROVIDERS[provider] : null;
  const updatedAt = usdRates?.rateUpdatedAt;
  const sourceUpdatedAt =
    source && updatedAt && Number.isFinite(Date.parse(updatedAt))
      ? updatedAt
      : null;

  return (
    <div className={cn('space-y-1 text-xs text-muted-foreground', className)}>
      <p>
        {source ? (
          <>
            {t('fx.attribution.source', 'Indicative exchange rates:')}{' '}
            <a
              href={source.href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              {source.name}
            </a>
          </>
        ) : (
          t(
            'fx.attribution.fixed',
            'Indicative prices use reference exchange rates.'
          )
        )}
      </p>
      {sourceUpdatedAt ? (
        <p>
          {t('fx.attribution.updated', 'Source updated:')}{' '}
          <time dateTime={sourceUpdatedAt}>
            {formatDateTime(sourceUpdatedAt)}
          </time>
        </p>
      ) : null}
    </div>
  );
}

/**
 * Country Selector (mobile reference)
 *
 * Mobile card-list version of the monolith's
 * components/payments/CountrySelector.tsx -- lets a subscriber pick one of
 * the 9 dLocal-supported countries for local payment methods instead of
 * the default global card checkout. No geo auto-detect API exists in this
 * seed app, so it starts unselected rather than "detecting...".
 */

import { Check, Globe } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { DLocalCountry } from '@/types/dlocal';
import {
  COUNTRY_FLAGS,
  COUNTRY_NAMES,
  DLOCAL_SUPPORTED_COUNTRIES,
} from '@/lib/dlocal/constants';
import { cn } from '@/lib/utils';

interface CountrySelectorProps {
  /** null / 'GLOBAL' represents the default Stripe card checkout */
  value: DLocalCountry | 'GLOBAL';
  onChange: (country: DLocalCountry | 'GLOBAL') => void;
}

export function CountrySelector({ value, onChange }: CountrySelectorProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Payment region</p>
      <p className="text-xs text-muted-foreground">
        Pay by card anywhere, or use a local payment method in one of{' '}
        {DLOCAL_SUPPORTED_COUNTRIES.length} supported countries.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <Card
          className={cn(
            'cursor-pointer transition-all',
            value === 'GLOBAL'
              ? 'border-primary bg-primary/5 ring-1 ring-primary'
              : 'hover:border-primary/50'
          )}
          onClick={() => onChange('GLOBAL')}
        >
          <CardContent className="flex items-center gap-2 p-3">
            <Globe className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">Global</p>
              <p className="truncate text-xs text-muted-foreground">
                Card via Stripe
              </p>
            </div>
            {value === 'GLOBAL' && (
              <Check className="h-4 w-4 flex-shrink-0 text-primary" />
            )}
          </CardContent>
        </Card>

        {DLOCAL_SUPPORTED_COUNTRIES.map((country) => (
          <Card
            key={country}
            className={cn(
              'cursor-pointer transition-all',
              value === country
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'hover:border-primary/50'
            )}
            onClick={() => onChange(country)}
          >
            <CardContent className="flex items-center gap-2 p-3">
              <span className="text-xl leading-none" aria-hidden="true">
                {COUNTRY_FLAGS[country]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {COUNTRY_NAMES[country]}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Local payment
                </p>
              </div>
              {value === country && (
                <Check className="h-4 w-4 flex-shrink-0 text-primary" />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

'use client';

/**
 * Country Selector Component
 *
 * Dropdown for selecting dLocal-supported countries with:
 * - Auto-detection via geo API
 * - Country flags and names
 * - Only shows dLocal-supported countries
 *
 * @module components/payments/CountrySelector
 */

import { useState, useEffect, useCallback } from 'react';
import type { DLocalCountry } from '@/types/dlocal';
import {
  COUNTRY_NAMES,
  DLOCAL_SUPPORTED_COUNTRIES,
} from '@/lib/dlocal/constants';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface CountrySelectorProps {
  /** Currently selected country */
  value: DLocalCountry | null;
  /** Callback when country is selected */
  onChange: (country: DLocalCountry) => void;
  /** Whether to auto-detect country on mount */
  autoDetect?: boolean;
  /** Whether the selector is disabled */
  disabled?: boolean;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const COUNTRY_FLAGS: Record<DLocalCountry, string> = {
  IN: '🇮🇳',
  NG: '🇳🇬',
  PK: '🇵🇰',
  VN: '🇻🇳',
  ID: '🇮🇩',
  TH: '🇹🇭',
  ZA: '🇿🇦',
  TR: '🇹🇷',
};

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function CountrySelector({
  value,
  onChange,
  autoDetect = true,
  disabled = false,
}: CountrySelectorProps): React.ReactElement {
  const [detecting, setDetecting] = useState(autoDetect && !value);
  const [error, setError] = useState<string | null>(null);

  const detectCountry = useCallback(async (): Promise<void> => {
    try {
      setDetecting(true);
      setError(null);

      const res = await fetch('/api/geo/detect');

      if (!res.ok) {
        throw new Error('Failed to detect country');
      }

      const data = await res.json();

      if (
        data.country &&
        DLOCAL_SUPPORTED_COUNTRIES.includes(data.country as DLocalCountry)
      ) {
        onChange(data.country as DLocalCountry);
      }
    } catch (err) {
      // Silent fail - user can select manually
      console.warn('Country detection failed:', err);
    } finally {
      setDetecting(false);
    }
  }, [onChange]);

  useEffect(() => {
    if (autoDetect && !value) {
      detectCountry();
    }
  }, [autoDetect, value, detectCountry]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const selectedCountry = e.target.value as DLocalCountry;
    if (selectedCountry) {
      onChange(selectedCountry);
      setError(null);
    }
  };

  if (detecting) {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium">Select your country</label>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Detecting your country...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label htmlFor="country-select" className="text-sm font-medium">
        Select your country
      </label>
      <select
        id="country-select"
        value={value || ''}
        onChange={handleChange}
        disabled={disabled}
        className="w-full rounded-lg border border-input bg-background p-3 text-sm ring-offset-background transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Select your country"
      >
        <option value="">Choose a country</option>
        {DLOCAL_SUPPORTED_COUNTRIES.map((country) => (
          <option key={country} value={country}>
            {COUNTRY_FLAGS[country]} {COUNTRY_NAMES[country]}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

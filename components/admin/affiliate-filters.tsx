'use client';

/**
 * Affiliate Filters Component
 *
 * Filter controls for affiliate list.
 *
 * @module components/admin/affiliate-filters
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AffiliateFiltersProps {
  status?: string;
  country?: string;
  paymentMethod?: string;
  onStatusChange: (status: string | undefined) => void;
  onCountryChange: (country: string | undefined) => void;
  onPaymentMethodChange: (method: string | undefined) => void;
}

const STATUSES = [
  { value: 'all', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PENDING_VERIFICATION', label: 'Pending Verification' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const PAYMENT_METHODS = [
  { value: 'all', label: 'All Payment Methods' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'PAYPAL', label: 'PayPal' },
  { value: 'CRYPTOCURRENCY', label: 'Cryptocurrency' },
  { value: 'WISE', label: 'Wise' },
];

const COUNTRIES = [
  { value: 'all', label: 'All Countries' },
  { value: 'US', label: 'United States' },
  { value: 'UK', label: 'United Kingdom' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
];

export function AffiliateFilters({
  status,
  country,
  paymentMethod,
  onStatusChange,
  onCountryChange,
  onPaymentMethodChange,
}: AffiliateFiltersProps) {
  return (
    <div className="flex flex-wrap gap-4">
      <Select
        value={status || 'all'}
        onValueChange={(value) =>
          onStatusChange(value === 'all' ? undefined : value)
        }
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={country || 'all'}
        onValueChange={(value) =>
          onCountryChange(value === 'all' ? undefined : value)
        }
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Country" />
        </SelectTrigger>
        <SelectContent>
          {COUNTRIES.map((c) => (
            <SelectItem key={c.value} value={c.value}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={paymentMethod || 'all'}
        onValueChange={(value) =>
          onPaymentMethodChange(value === 'all' ? undefined : value)
        }
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Payment Method" />
        </SelectTrigger>
        <SelectContent>
          {PAYMENT_METHODS.map((pm) => (
            <SelectItem key={pm.value} value={pm.value}>
              {pm.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

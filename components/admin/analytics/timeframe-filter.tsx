'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLocale } from '@/lib/context/locale-context';

export interface TimeframeOption {
  value: string;
  label: string;
}

export interface TimeframeFilterProps {
  paramName?: string;
  current: string;
  options: TimeframeOption[];
}

/**
 * Date-range filter for BI dashboard pages. Reads/writes a query param
 * (default `timeframe`) via the router -- the Server Component page
 * re-renders automatically when `searchParams` changes, no client-side
 * data-fetching needed here.
 */
export function TimeframeFilter({
  paramName = 'timeframe',
  current,
  options,
}: TimeframeFilterProps): React.ReactElement {
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(value: string): void {
    const params = new URLSearchParams(searchParams.toString());
    params.set(paramName, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="bg-muted/50 flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-1.5 text-xs shadow-inner">
      <span className="text-muted-foreground">
        📅 {t('analytics.range', 'Range:')}
      </span>
      <Select value={current} onValueChange={handleChange}>
        <SelectTrigger className="h-auto w-auto border-none bg-transparent p-0 font-bold text-foreground shadow-none focus:ring-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

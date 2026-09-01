'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useLocale } from '@/lib/context/locale-context';

export interface DonutMarketShareSlice {
  country: string;
  iso: string;
  count: number;
  percentage: number;
}

export interface DonutMarketShareProps {
  data: DonutMarketShareSlice[];
  centerLabel: string;
  centerValue: string;
}

// Cycles through token-derived colors rather than raw hex; OTHERS always
// gets the muted tone last regardless of its numeric rank (assigned below,
// not via this cycle), so the catch-all reads visually as "the rest."
const SLICE_COLORS = [
  'oklch(var(--chart-bullish))',
  'oklch(var(--info))',
  'oklch(var(--warning))',
  'oklch(var(--primary))',
  'oklch(var(--chart-bearish))',
  'oklch(var(--success))',
];
const OTHERS_COLOR = 'oklch(var(--muted-foreground) / 0.4)';

/**
 * Interactive market-share donut (Metrics #18/#19/#22): center total
 * label, hover tooltips, ranked legend. "Other Countries" always renders
 * in a fixed muted tone, last, regardless of its numeric rank.
 */
export function DonutMarketShare({
  data,
  centerLabel,
  centerValue,
}: DonutMarketShareProps): React.ReactElement {
  const { language } = useLocale();
  const formatCount = (value: number): string =>
    new Intl.NumberFormat(language || 'en-GB').format(value);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-52 w-52 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="country"
              innerRadius="60%"
              outerRadius="100%"
              paddingAngle={1}
              stroke="none"
            >
              {data.map((slice, index) => (
                <Cell
                  key={slice.iso}
                  fill={
                    slice.iso === 'OTHERS'
                      ? OTHERS_COLOR
                      : SLICE_COLORS[index % SLICE_COLORS.length]
                  }
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, _name, entry) => [
                `${formatCount(value)} (${(entry.payload as DonutMarketShareSlice).percentage.toFixed(2)}%)`,
                (entry.payload as DonutMarketShareSlice).country,
              ]}
              contentStyle={{
                background: 'oklch(var(--popover))',
                border: '1px solid oklch(var(--border))',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-foreground">
            {centerValue}
          </span>
          <span className="text-[10px] font-bold uppercase text-muted-foreground">
            {centerLabel}
          </span>
        </div>
      </div>

      <div className="w-full flex-1 space-y-1.5 text-xs">
        {data.map((slice, index) => (
          <div
            key={slice.iso}
            className="flex items-center justify-between gap-2"
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    slice.iso === 'OTHERS'
                      ? OTHERS_COLOR
                      : SLICE_COLORS[index % SLICE_COLORS.length],
                }}
              />
              <span className="truncate font-sans text-foreground">
                {slice.country}
              </span>
            </div>
            <span className="whitespace-nowrap font-mono font-semibold text-muted-foreground">
              {formatCount(slice.count)} ({slice.percentage.toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

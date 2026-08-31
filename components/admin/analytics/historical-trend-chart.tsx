'use client';

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface HistoricalTrendPoint {
  monthLabel: string;
  conversionRatePct: number;
  trueChurnRatePct: number;
}

export interface HistoricalTrendChartProps {
  data: HistoricalTrendPoint[];
}

/**
 * Dual-axis 6-month historical trajectory chart (Metrics #7 & #12):
 * Conversion Rate % (left axis, area) vs. True Churn Rate % (right axis,
 * line). Uses `success`/`warning` design tokens, matching the
 * prototype's green-conversion / amber-churn convention.
 */
export function HistoricalTrendChart({
  data,
}: HistoricalTrendChartProps): React.ReactElement {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
        >
          <CartesianGrid
            stroke="oklch(var(--chart-grid))"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="monthLabel"
            tick={{ fontSize: 11, fill: 'oklch(var(--muted-foreground))' }}
            axisLine={{ stroke: 'oklch(var(--border))' }}
            tickLine={false}
          />
          <YAxis
            yAxisId="conversion"
            orientation="left"
            tick={{ fontSize: 11, fill: 'oklch(var(--success))' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}%`}
            width={40}
          />
          <YAxis
            yAxisId="churn"
            orientation="right"
            tick={{ fontSize: 11, fill: 'oklch(var(--warning))' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}%`}
            width={40}
          />
          <Tooltip
            contentStyle={{
              background: 'oklch(var(--popover))',
              border: '1px solid oklch(var(--border))',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number, name: string) => [
              `${value.toFixed(2)}%`,
              name === 'conversionRatePct'
                ? 'Conversion Rate'
                : 'True Churn Rate',
            ]}
          />
          <Area
            yAxisId="conversion"
            type="monotone"
            dataKey="conversionRatePct"
            stroke="oklch(var(--success))"
            fill="oklch(var(--success) / 0.15)"
            strokeWidth={2}
          />
          <Line
            yAxisId="churn"
            type="monotone"
            dataKey="trueChurnRatePct"
            stroke="oklch(var(--warning))"
            strokeWidth={2}
            dot={{ r: 3, fill: 'oklch(var(--warning))' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

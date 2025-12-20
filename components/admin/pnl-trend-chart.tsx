'use client';

/**
 * P&L Trend Chart Component
 *
 * Simple trend visualization for profit and loss over time.
 * Uses a basic SVG chart since recharts is not installed.
 *
 * @module components/admin/pnl-trend-chart
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TrendDataPoint {
  label: string;
  revenue: number;
  costs: number;
  profit: number;
}

interface PnLTrendChartProps {
  data: TrendDataPoint[];
  title?: string;
}

export function PnLTrendChart({ data, title = 'Profit Trend' }: PnLTrendChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxValue = Math.max(...data.flatMap((d) => [d.revenue, d.costs, d.profit]));
  const minValue = Math.min(...data.map((d) => d.profit), 0);
  const range = maxValue - minValue || 1;

  const chartHeight = 200;
  const chartWidth = 600;
  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const xStep = innerWidth / (data.length - 1 || 1);

  const getY = (value: number) =>
    padding.top + innerHeight - ((value - minValue) / range) * innerHeight;

  const createPath = (values: number[]) => {
    return values
      .map((value, i) => `${i === 0 ? 'M' : 'L'} ${padding.left + i * xStep} ${getY(value)}`)
      .join(' ');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <svg width={chartWidth} height={chartHeight} className="min-w-[600px]">
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
              <line
                key={ratio}
                x1={padding.left}
                y1={padding.top + innerHeight * ratio}
                x2={chartWidth - padding.right}
                y2={padding.top + innerHeight * ratio}
                stroke="#e5e7eb"
                strokeDasharray="4,4"
              />
            ))}

            {/* Zero line if needed */}
            {minValue < 0 && (
              <line
                x1={padding.left}
                y1={getY(0)}
                x2={chartWidth - padding.right}
                y2={getY(0)}
                stroke="#9ca3af"
                strokeWidth={2}
              />
            )}

            {/* Revenue line */}
            <path
              d={createPath(data.map((d) => d.revenue))}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={2}
            />

            {/* Costs line */}
            <path
              d={createPath(data.map((d) => d.costs))}
              fill="none"
              stroke="#f97316"
              strokeWidth={2}
            />

            {/* Profit line */}
            <path
              d={createPath(data.map((d) => d.profit))}
              fill="none"
              stroke="#22c55e"
              strokeWidth={2}
            />

            {/* X-axis labels */}
            {data.map((d, i) => (
              <text
                key={d.label}
                x={padding.left + i * xStep}
                y={chartHeight - 10}
                textAnchor="middle"
                className="fill-muted-foreground text-xs"
              >
                {d.label}
              </text>
            ))}

            {/* Legend */}
            <g transform={`translate(${padding.left}, ${chartHeight - 5})`}>
              <circle cx={0} cy={-25} r={4} fill="#3b82f6" />
              <text x={10} y={-21} className="fill-muted-foreground text-xs">Revenue</text>
              <circle cx={80} cy={-25} r={4} fill="#f97316" />
              <text x={90} y={-21} className="fill-muted-foreground text-xs">Costs</text>
              <circle cx={140} cy={-25} r={4} fill="#22c55e" />
              <text x={150} y={-21} className="fill-muted-foreground text-xs">Profit</text>
            </g>
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}

'use client';

/**
 * Code Inventory Chart Component
 *
 * Simple visualization of affiliate code distribution and usage.
 *
 * @module components/admin/code-inventory-chart
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CodeInventoryData {
  active: number;
  used: number;
  expired: number;
  cancelled: number;
}

interface CodeInventoryChartProps {
  data: CodeInventoryData;
}

export function CodeInventoryChart({ data }: CodeInventoryChartProps) {
  const total = data.active + data.used + data.expired + data.cancelled;

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Code Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center text-muted-foreground">
            No codes distributed yet
          </div>
        </CardContent>
      </Card>
    );
  }

  const segments = [
    { label: 'Active', value: data.active, color: '#22c55e', textColor: 'text-green-600' },
    { label: 'Used', value: data.used, color: '#3b82f6', textColor: 'text-blue-600' },
    { label: 'Expired', value: data.expired, color: '#f97316', textColor: 'text-orange-600' },
    { label: 'Cancelled', value: data.cancelled, color: '#ef4444', textColor: 'text-red-600' },
  ].filter((s) => s.value > 0);

  // Calculate bar widths
  const maxValue = Math.max(...segments.map((s) => s.value));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Code Inventory</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Codes:</span>
            <span className="font-medium">{total.toLocaleString()}</span>
          </div>

          {/* Bar chart */}
          <div className="space-y-3">
            {segments.map((segment) => (
              <div key={segment.label} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className={segment.textColor}>{segment.label}</span>
                  <span className="text-muted-foreground">
                    {segment.value.toLocaleString()} ({((segment.value / total) * 100).toFixed(1)}%)
                  </span>
                </div>
                <div className="h-4 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(segment.value / maxValue) * 100}%`,
                      backgroundColor: segment.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Utilization rate */}
          <div className="mt-4 rounded-lg bg-muted p-3">
            <div className="flex justify-between text-sm">
              <span>Utilization Rate:</span>
              <span className="font-medium">
                {((data.used / (data.active + data.used + data.expired)) * 100).toFixed(1)}%
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Percentage of distributed codes that have been used
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

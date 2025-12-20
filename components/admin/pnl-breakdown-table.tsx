'use client';

/**
 * P&L Breakdown Table Component
 *
 * Detailed breakdown of profit and loss by month.
 *
 * @module components/admin/pnl-breakdown-table
 */

interface MonthlyData {
  month: string;
  sales: number;
  grossRevenue: number;
  discounts: number;
  netRevenue: number;
  commissions: number;
  profit: number;
  margin: number;
}

interface PnLBreakdownTableProps {
  data: MonthlyData[];
}

export function PnLBreakdownTable({ data }: PnLBreakdownTableProps) {
  const formatCurrency = (value: number) =>
    `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Month</th>
            <th className="px-4 py-3 text-right font-medium">Sales</th>
            <th className="px-4 py-3 text-right font-medium">Gross Revenue</th>
            <th className="px-4 py-3 text-right font-medium">Discounts</th>
            <th className="px-4 py-3 text-right font-medium">Net Revenue</th>
            <th className="px-4 py-3 text-right font-medium">Commissions</th>
            <th className="px-4 py-3 text-right font-medium">Profit</th>
            <th className="px-4 py-3 text-right font-medium">Margin</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.month} className="border-b hover:bg-muted/25">
              <td className="px-4 py-3 font-medium">{row.month}</td>
              <td className="px-4 py-3 text-right">{row.sales}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(row.grossRevenue)}</td>
              <td className="px-4 py-3 text-right text-orange-600">
                -{formatCurrency(row.discounts)}
              </td>
              <td className="px-4 py-3 text-right">{formatCurrency(row.netRevenue)}</td>
              <td className="px-4 py-3 text-right text-orange-600">
                -{formatCurrency(row.commissions)}
              </td>
              <td className={`px-4 py-3 text-right font-medium ${row.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(row.profit)}
              </td>
              <td className={`px-4 py-3 text-right ${row.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {row.margin.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t bg-muted/50 font-medium">
          <tr>
            <td className="px-4 py-3">Total</td>
            <td className="px-4 py-3 text-right">
              {data.reduce((sum, r) => sum + r.sales, 0)}
            </td>
            <td className="px-4 py-3 text-right">
              {formatCurrency(data.reduce((sum, r) => sum + r.grossRevenue, 0))}
            </td>
            <td className="px-4 py-3 text-right text-orange-600">
              -{formatCurrency(data.reduce((sum, r) => sum + r.discounts, 0))}
            </td>
            <td className="px-4 py-3 text-right">
              {formatCurrency(data.reduce((sum, r) => sum + r.netRevenue, 0))}
            </td>
            <td className="px-4 py-3 text-right text-orange-600">
              -{formatCurrency(data.reduce((sum, r) => sum + r.commissions, 0))}
            </td>
            <td className="px-4 py-3 text-right text-green-600">
              {formatCurrency(data.reduce((sum, r) => sum + r.profit, 0))}
            </td>
            <td className="px-4 py-3 text-right">-</td>
          </tr>
        </tfoot>
      </table>
      {data.length === 0 && (
        <div className="py-8 text-center text-muted-foreground">
          No data available for this period
        </div>
      )}
    </div>
  );
}

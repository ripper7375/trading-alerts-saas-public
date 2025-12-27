'use client';

/**
 * P&L Summary Cards Component
 *
 * Displays key profit & loss metrics in card format.
 *
 * @module components/admin/pnl-summary-cards
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PnLSummaryCardsProps {
  grossRevenue: number;
  discounts: number;
  netRevenue: number;
  totalCommissions: number;
  netProfit: number;
  profitMargin: number;
  /** Commission rate percentage from SystemConfig */
  commissionPercent?: number;
  /** Discount rate percentage from SystemConfig */
  discountPercent?: number;
}

export function PnLSummaryCards({
  grossRevenue,
  discounts,
  netRevenue,
  totalCommissions,
  netProfit,
  profitMargin,
  commissionPercent = 20,
  discountPercent = 20,
}: PnLSummaryCardsProps) {
  const formatCurrency = (value: number) =>
    `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const cards = [
    {
      title: 'Revenue',
      items: [
        { label: 'Gross Revenue', value: formatCurrency(grossRevenue) },
        {
          label: `Discounts Given (${discountPercent}%)`,
          value: `-${formatCurrency(discounts)}`,
          className: 'text-orange-600',
        },
        {
          label: 'Net Revenue',
          value: formatCurrency(netRevenue),
          className: 'font-semibold',
        },
      ],
    },
    {
      title: 'Costs',
      items: [
        { label: 'Total Commissions', value: formatCurrency(totalCommissions) },
        { label: 'Commission Rate', value: `${commissionPercent}%` },
      ],
    },
    {
      title: 'Profit',
      items: [
        {
          label: 'Net Profit',
          value: formatCurrency(netProfit),
          className: netProfit >= 0 ? 'text-green-600' : 'text-red-600',
        },
        {
          label: 'Profit Margin',
          value: `${profitMargin.toFixed(1)}%`,
          className: profitMargin >= 0 ? 'text-green-600' : 'text-red-600',
        },
      ],
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2">
              {card.items.map((item) => (
                <div key={item.label} className="flex justify-between">
                  <dt className="text-sm text-muted-foreground">
                    {item.label}
                  </dt>
                  <dd className={`text-sm ${item.className || ''}`}>
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

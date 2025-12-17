PART 17 - PROMPT 4: Admin Profit & Loss Report

=======================================================
Create an admin P&L (Profit & Loss) report page for affiliate marketing using **Next.js 15 App Router, TypeScript, Tailwind CSS, and shadcn/ui components**.

**CRITICAL: Use SystemConfig for Dynamic Percentages**
- MUST use `useAffiliateConfig()` hook for commission calculations
- All commission-related values should be calculated dynamically

---

## REQUIREMENTS:

### 1. PAGE HEADER:
- Breadcrumb: "Admin > Affiliates > P&L Report" (text-sm, text-gray-500)
- Heading: "Profit & Loss Report - Affiliate Program" (text-3xl, font-bold, text-gray-900)
- Date range selector: Select (Last 3 Months, Last 6 Months, Custom Range)
- Export to PDF button (variant="outline", Download icon)

### 2. DATE TABS:
- Tabs for each month: "Nov 2024" | "Oct 2024" | "Sep 2024"
- Active tab highlighted (bg-blue-600, text-white)
- Click to view detailed breakdown per month

### 3. SUMMARY CARDS (5 cards, responsive grid):

**Card 1: Gross Revenue**
- Icon: TrendingUp (text-green-600)
- Label: "Gross Revenue"
- Value: "$9,918" (text-3xl, font-bold)
- Calculation: Total PRO sales (342 × $29)
- Subtext: "From affiliate-driven sales"

**Card 2: Discounts Given**
- Icon: Tag (text-red-600)
- Label: "Total Discounts"
- Value: "-$1,984" (text-3xl, font-bold, text-red-600)
- Calculation: 342 × ($29 - calculateDiscountedPrice(29))
- Use discountPercent from useAffiliateConfig()

**Card 3: Net Revenue**
- Icon: DollarSign (text-blue-600)
- Label: "Net Revenue"
- Value: "$7,934" (text-3xl, font-bold)
- Calculation: Gross Revenue - Discounts

**Card 4: Total Commissions**
- Icon: Users (text-purple-600)
- Label: "Commission Costs"
- Value: "$1,587" (text-3xl, font-bold)
- Calculation: 342 × commissionAmount (dynamic)
- Breakdown: Paid + Pending

**Card 5: Profit Margin**
- Icon: Percent (text-green-600)
- Label: "Profit Margin"
- Value: "80%" (text-3xl, font-bold, text-green-600)
- Calculation: (Net Revenue - Commissions) / Net Revenue × 100

### 4. REVENUE BREAKDOWN TABLE (Accounting Format):

**Section: Revenue**
- Row 1: Gross Revenue
  * PRO Monthly Upgrades: 342 × $29.00 = $9,918
  * PRO 3-Day Upgrades: 0 × $1.99 = $0
  * Total Gross Revenue: $9,918 (bold)

**Section: Less: Discounts**
- Row 2: Affiliate Code Discounts
  * {discountPercent}% off applied to 342 sales
  * Total: -$1,984 (red text)
- Row 3: Net Revenue
  * $9,918 - $1,984 = $7,934 (bold, green text)

**Section: Less: Costs**
- Row 4: Paid Commissions
  * 200 × ${commissionAmount} = $XXX (calculated dynamically)
- Row 5: Pending Commissions
  * 142 × ${commissionAmount} = $XXX (calculated dynamically)
- Row 6: Total Commission Costs
  * Sum of paid + pending (bold, red text)

**Section: Profit**
- Row 7: Net Profit
  * Net Revenue - Commission Costs
  * Bold, large text, green
- Row 8: Profit Margin %
  * (Net Profit / Net Revenue) × 100
  * Bold, percentage format

### 5. TREND CHART (Line chart):
- Title: "3-Month Trend"
- Chart: 3 lines
  * Line 1: Revenue (green)
  * Line 2: Costs (red)
  * Line 3: Profit (blue)
- Use Recharts LineChart
- X-axis: Months (Sep, Oct, Nov)
- Y-axis: Amount ($)
- Tooltip shows exact values
- Legend at bottom

### 6. DETAILED BREAKDOWN (Expandable sections):
- Accordion component for each metric
- Expand to show daily breakdown
- Example: "Gross Revenue" → Shows daily sales

### 7. RESPONSIVE DESIGN:
- Summary cards: 5 columns desktop, 2-3 tablet, 1 mobile
- Table: Full width, responsive font sizes
- Chart: Full width, stack on mobile

### 8. TECHNICAL REQUIREMENTS:
- Client component ('use client')
- TypeScript with proper types
- Use shadcn/ui Card, Tabs, Button, Accordion components
- Use Recharts for chart
- MUST use useAffiliateConfig() hook
- Calculate all commission values dynamically

---

## SYSTEMCONFIG INTEGRATION:

```typescript
'use client'

import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { TrendingUp, Tag, DollarSign, Users, Percent, Download } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function AdminProfitLossPage() {
  // ✅ CRITICAL: Use SystemConfig hook
  const {
    discountPercent,
    commissionPercent,
    calculateDiscountedPrice
  } = useAffiliateConfig()

  // Sample data
  const totalSales = 342
  const regularPrice = 29.00
  const discountedPrice = calculateDiscountedPrice(regularPrice)
  const commissionAmount = (discountedPrice * (commissionPercent / 100)).toFixed(2)

  // Calculations
  const grossRevenue = totalSales * regularPrice
  const discountPerSale = regularPrice - discountedPrice
  const totalDiscounts = totalSales * discountPerSale
  const netRevenue = grossRevenue - totalDiscounts
  const totalCommissions = totalSales * parseFloat(commissionAmount)
  const netProfit = netRevenue - totalCommissions
  const profitMargin = ((netProfit / netRevenue) * 100).toFixed(1)

  // ... rest of component
}
```

---

## CHECKLIST:
- ✅ Uses useAffiliateConfig hook
- ✅ Calculates discounts dynamically using discountPercent
- ✅ Calculates commissions dynamically using commissionPercent
- ✅ No hardcoded percentages or amounts
- ✅ Accounting-style P&L format
- ✅ 3-month trend chart
- ✅ Responsive design
- ✅ Export to PDF functionality

Generate complete, production-ready code that I can copy and run immediately.

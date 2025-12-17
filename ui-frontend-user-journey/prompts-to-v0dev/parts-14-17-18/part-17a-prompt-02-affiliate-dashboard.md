PART 17 - PROMPT 2: Affiliate Dashboard

=======================================================
Create an affiliate dashboard page for a SaaS affiliate portal using **Next.js 15 App Router, TypeScript, Tailwind CSS, and shadcn/ui components**.

**CRITICAL: Use SystemConfig for Dynamic Percentages**
- MUST use `useAffiliateConfig()` hook for commission calculations
- Commission per sale should be calculated dynamically

---

## REQUIREMENTS:

### 1. PAGE HEADER:
- Welcome message: "Welcome back, {Affiliate Name}" (text-2xl, font-bold, text-gray-900)
- Last login: "Last login: 2 hours ago" (text-sm, text-gray-600)

### 2. STAT CARDS (4 columns, gradient backgrounds):

**Card 1: Active Codes**
- Icon: Tag (text-green-600)
- Label: "Active Codes"
- Value: "12/15" (large text)
- Progress bar: 80% filled (green)
- Subtext: "3 available to distribute"

**Card 2: Codes Used This Month**
- Icon: CheckCircle (text-blue-600)
- Label: "Codes Used This Month"
- Value: "8" (large text)
- Trend: "+3 from last month" (green, ↑ icon)

**Card 3: Total Earnings**
- Icon: DollarSign (text-purple-600)
- Label: "Total Earnings"
- Value: "${totalEarnings}" (large text, calculated dynamically)
- Badge: "Pending" (yellow) or "Paid" (green)
- Calculation: codesUsed × commissionAmount
  * Use commissionAmount = calculateDiscountedPrice(29) * (commissionPercent / 100)

**Card 4: Paid Commissions**
- Icon: Wallet (text-yellow-600)
- Label: "Paid Commissions"
- Value: "${paidAmount}" (large text)
- Subtext: "Last payment: Jan 15, 2024"

### 3. CODE INVENTORY REPORT (Accounting-style table):
- Card title: "Code Inventory Report" (text-lg, font-semibold)
- Subtitle: "Current Month (January 2024)"
- Table rows:
  * Opening Balance (Jan 1): 10 codes
  * + Codes Distributed: 5 codes
  * - Codes Used: 8 codes
  * - Codes Expired: 0 codes
  * = Closing Balance (Current): 12 codes
- Visual progress bar: Active (12) vs Total (15)
- Percentage: "80% active"

### 4. COMMISSION BREAKDOWN (Table):
- Card title: "Recent Commissions" (text-lg, font-semibold)
- Table columns:
  1. Date (formatted: "Jan 15, 2024")
  2. Code Used (e.g., "SAVE20JAN")
  3. User Email (truncated: "user@...")
  4. Commission Amount (${commissionAmount} - calculated dynamically)
  5. Status Badge (Pending: yellow, Paid: green)
- Show last 10 transactions
- "View All" button at bottom

**Commission Calculation:**
- Use useAffiliateConfig() to get commissionPercent
- Calculate: regularPrice = $29, discountedPrice = calculateDiscountedPrice(29)
- Commission = discountedPrice × (commissionPercent / 100)
- Format: ${commissionAmount.toFixed(2)}

### 5. QUICK ACTIONS (Button group):
- "Copy All Active Codes" button (Clipboard icon)
  * Copies all active codes to clipboard
  * Toast success message
- "Download Monthly Report" button (Download icon)
  * Downloads PDF report
- "Share Affiliate Link" button (Share icon)
  * Copies affiliate link: "https://app.com/?ref={affiliateId}"

### 6. PERFORMANCE CHART (Line chart):
- Title: "Commission Earnings Over Time"
- Chart: Last 6 months
- Use Recharts LineChart
- Shows monthly earnings trend
- Green line (gradient fill)

### 7. RESPONSIVE DESIGN:
- Stat cards: 4 columns desktop, 2 tablet, 1 mobile
- Tables: Horizontal scroll on mobile
- Charts: Full width, responsive height

### 8. TECHNICAL REQUIREMENTS:
- Client component ('use client')
- TypeScript with proper types
- Use shadcn/ui Card, Table, Badge, Button, Progress components
- Use lucide-react icons
- Use Recharts for chart
- MUST use useAffiliateConfig() hook

---

## SYSTEMCONFIG INTEGRATION:

```typescript
'use client'

import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tag, CheckCircle, DollarSign, Wallet, Clipboard, Download, Share } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function AffiliateDashboardPage() {
  // ✅ CRITICAL: Use SystemConfig hook
  const {
    commissionPercent,
    calculateDiscountedPrice
  } = useAffiliateConfig()

  // Calculate commission dynamically
  const regularPrice = 29.00
  const discountedPrice = calculateDiscountedPrice(regularPrice)
  const commissionAmount = (discountedPrice * (commissionPercent / 100)).toFixed(2)

  // Mock data
  const activeCodes = 12
  const totalCodes = 15
  const codesUsed = 8
  const totalEarnings = (codesUsed * parseFloat(commissionAmount)).toFixed(2)
  const paidEarnings = "25.60"

  // ... rest of component
}
```

---

## CHECKLIST:
- ✅ Imported useAffiliateConfig hook
- ✅ Calculates commission dynamically
- ✅ No hardcoded commission amounts
- ✅ Uses {commissionPercent}% for calculations
- ✅ Accounting-style inventory report
- ✅ Commission breakdown table
- ✅ Quick action buttons
- ✅ Performance chart
- ✅ Responsive design

Generate complete, production-ready code that I can copy and run immediately.

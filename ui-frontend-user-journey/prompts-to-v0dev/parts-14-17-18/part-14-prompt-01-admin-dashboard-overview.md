PART 14 - PROMPT 1: Admin Dashboard Overview Page

=======================================================
Create a modern admin dashboard overview page for a trading alerts SaaS platform using **Next.js 15 App Router, TypeScript, Tailwind CSS, and shadcn/ui components**.

**CRITICAL: Use SystemConfig for Dynamic Percentages**
- DO NOT hardcode affiliate discount percentages (e.g., "20%")
- DO NOT hardcode affiliate commission percentages (e.g., "20%")
- MUST use `useAffiliateConfig()` hook for all affiliate-related dynamic values
- All affiliate percentages must be dynamic from SystemConfig

---

## REQUIREMENTS:

### 1. PAGE HEADER:
- Breadcrumb: "Admin > Dashboard" (text-sm, text-gray-500)
- Main heading: "Admin Dashboard" (text-4xl, font-bold, text-gray-900)
- Date range selector: Dropdown with options (Last 7 days, Last 30 days, Last 90 days, Custom)
- Refresh button with icon (lucide-react RefreshCw)

### 2. STAT CARDS (Grid layout, 4 columns, responsive):

**Card 1: Total Users**
- Icon: Users (lucide-react, bg-blue-100, text-blue-600, p-3, rounded-lg)
- Label: "Total Users" (text-sm, text-gray-600)
- Value: "1,234" (text-3xl, font-bold, text-gray-900)
- Trend: "+12.5% from last month" (text-sm, text-green-600, with ↑ icon)

**Card 2: FREE Tier Users**
- Icon: UserCheck (lucide-react, bg-green-100, text-green-600, p-3, rounded-lg)
- Label: "FREE Tier Users" (text-sm, text-gray-600)
- Value: "892" (text-3xl, font-bold, text-gray-900)
- Percentage: "72.3% of total" (text-sm, text-gray-500)

**Card 3: PRO Tier Users**
- Icon: Crown (lucide-react, bg-purple-100, text-purple-600, p-3, rounded-lg)
- Label: "PRO Tier Users" (text-sm, text-gray-600)
- Value: "342" (text-3xl, font-bold, text-gray-900)
- Percentage: "27.7% of total" (text-sm, text-gray-500)

**Card 4: Monthly Revenue**
- Icon: DollarSign (lucide-react, bg-yellow-100, text-yellow-600, p-3, rounded-lg)
- Label: "Monthly Revenue (MRR)" (text-sm, text-gray-600)
- Value: "$9,918" (text-3xl, font-bold, text-gray-900)
- Calculation: 342 PRO users × $29/month
- Trend: "+8.2% from last month" (text-sm, text-green-600, with ↑ icon)

### 3. CHARTS SECTION (Two-column layout below stat cards):

**Left Column: Revenue Over Time (Line Chart)**
- Card container with title: "Monthly Recurring Revenue (MRR)" (text-lg, font-semibold, mb-4)
- Chart: Line chart showing last 3 months of MRR
- Data points example: Month 1: $8,500, Month 2: $9,200, Month 3: $9,918
- Use Recharts library (LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer)
- Line color: blue-600
- Gradient fill below line (optional)
- Tooltip shows exact values

**Right Column: User Tier Distribution (Pie Chart)**
- Card container with title: "User Distribution by Tier" (text-lg, font-semibold, mb-4)
- Chart: Pie chart showing FREE vs PRO breakdown
- Data: FREE: 72.3% (892 users), PRO: 27.7% (342 users)
- Use Recharts library (PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer)
- Colors: FREE (gray-400), PRO (gradient blue-600 to purple-600)
- Show percentages and user counts in legend

### 4. RECENT USER ACTIVITY TABLE (Below charts):
- Section heading: "Recent User Activity" (text-2xl, font-bold, mb-4)
- Table using shadcn/ui Table component

**Columns:**
1. Avatar (user image or initials in circle)
2. User Email (text-sm, text-gray-900)
3. Tier Badge (FREE: gray badge, PRO: gradient blue-purple badge)
4. Join Date (text-sm, text-gray-600, formatted as "MMM DD, YYYY")
5. Last Active (text-sm, text-gray-600, formatted as "X hours ago" or "X days ago")
6. Actions (View Details button - ghost variant, small)

**Table Features:**
- Show 10 recent users
- Alternating row colors (hover:bg-gray-50)
- Pagination controls at bottom (Previous, 1, 2, 3, Next)
- "Showing 1-10 of 1,234 users" text

### 5. AFFILIATE PROGRAM STATS (New section - uses SystemConfig):
- Section heading: "Affiliate Program Overview" (text-2xl, font-bold, mb-4)
- 3-column grid:

**Column 1: Discount Rate**
- Icon: Tag (lucide-react, text-green-600)
- Label: "Current Affiliate Discount"
- Value: "{discountPercent}%" (text-2xl, font-bold, text-green-600)
  * Use dynamic discountPercent from useAffiliateConfig()
- Subtext: "Applied to PRO monthly subscriptions" (text-sm, text-gray-500)

**Column 2: Commission Rate**
- Icon: Percent (lucide-react, text-purple-600)
- Label: "Affiliate Commission Rate"
- Value: "{commissionPercent}%" (text-2xl, font-bold, text-purple-600)
  * Use dynamic commissionPercent from useAffiliateConfig()
- Subtext: "Earned per PRO upgrade" (text-sm, text-gray-500)

**Column 3: Active Affiliates**
- Icon: Users (lucide-react, text-blue-600)
- Label: "Active Affiliates"
- Value: "87" (text-2xl, font-bold, text-blue-600)
- Subtext: "12 new this month" (text-sm, text-green-600)

### 6. NAVIGATION SIDEBAR (Left side):
- Links with icons (lucide-react):
  * Dashboard (Home icon) - active state
  * Users (Users icon)
  * API Usage (Activity icon)
  * Error Logs (AlertCircle icon)
  * Affiliates (Handshake icon)
  * Settings (Settings icon)
- Active link: bg-blue-50, text-blue-600, border-l-4 border-blue-600
- Hover: bg-gray-100

### 7. RESPONSIVE DESIGN:
- Stat cards: 4 columns desktop, 2 columns tablet, 1 column mobile
- Charts: Side-by-side desktop, stacked mobile
- Table: Horizontal scroll on mobile
- Sidebar: Collapse to hamburger menu on mobile

### 8. TECHNICAL REQUIREMENTS:
- Component must be client component ('use client')
- Export as default component
- TypeScript with proper types
- Use shadcn/ui Card, Table, Badge, Button components
- Use lucide-react for all icons
- Use Recharts for charts
- MUST import and use useAffiliateConfig() hook
- Smooth transitions and hover effects

---

## SYSTEMCONFIG INTEGRATION:

```typescript
'use client'

import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Users, UserCheck, Crown, DollarSign, Tag, Percent, RefreshCw } from 'lucide-react'
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function AdminDashboardPage() {
  // ✅ CRITICAL: Use SystemConfig hook for dynamic affiliate percentages
  const {
    discountPercent,
    commissionPercent,
    calculateDiscountedPrice,
    isLoading
  } = useAffiliateConfig()

  // Mock data (replace with real API calls)
  const totalUsers = 1234
  const freeUsers = 892
  const proUsers = 342
  const monthlyRevenue = proUsers * 29 // PRO users × $29/month

  // ... rest of component
}
```

---

## CHECKLIST:
- ✅ Imported useAffiliateConfig hook
- ✅ No hardcoded affiliate percentages
- ✅ Uses {discountPercent} for discount display
- ✅ Uses {commissionPercent} for commission display
- ✅ Client component with 'use client' directive
- ✅ Uses shadcn/ui components throughout
- ✅ Responsive design with Tailwind CSS
- ✅ Charts implemented with Recharts

Generate complete, production-ready code that I can copy and run immediately.

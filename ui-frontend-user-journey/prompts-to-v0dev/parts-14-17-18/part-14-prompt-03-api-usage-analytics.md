PART 14 - PROMPT 3: API Usage Analytics Page

=======================================================
Create an API usage analytics page for admin dashboard using **Next.js 15 App Router, TypeScript, Tailwind CSS, and shadcn/ui components**.

---

## REQUIREMENTS:

### 1. PAGE HEADER:
- Breadcrumb: "Admin > API Usage" (text-sm, text-gray-500)
- Main heading: "API Usage Analytics" (text-4xl, font-bold, text-gray-900)
- Date range picker: Select with options (Last 7 days, Last 30 days, Custom Range)
- Export button: "Export Report" (variant="outline", with Download icon)

### 2. STAT CARDS (4 columns, responsive):

**Card 1: Total API Calls**
- Icon: Activity (lucide-react, bg-blue-100, text-blue-600, rounded-lg, p-3)
- Label: "Total API Calls" (text-sm, text-gray-600)
- Value: "1,234,567" (text-3xl, font-bold, text-gray-900)
- Trend: "+15.2% from last period" (text-sm, text-green-600, ↑ icon)

**Card 2: FREE Tier Calls**
- Icon: Users (lucide-react, bg-gray-100, text-gray-600)
- Label: "FREE Tier API Calls" (text-sm, text-gray-600)
- Value: "456,789" (text-3xl, font-bold, text-gray-900)
- Percentage: "37% of total" (text-sm, text-gray-500)

**Card 3: PRO Tier Calls**
- Icon: Crown (lucide-react, bg-purple-100, text-purple-600)
- Label: "PRO Tier API Calls" (text-sm, text-gray-600)
- Value: "777,778" (text-3xl, font-bold, text-gray-900)
- Percentage: "63% of total" (text-sm, text-gray-500)

**Card 4: Average Response Time**
- Icon: Clock (lucide-react, bg-green-100, text-green-600)
- Label: "Avg Response Time" (text-sm, text-gray-600)
- Value: "245ms" (text-3xl, font-bold, text-gray-900)
- Trend: "-12ms from last period" (text-sm, text-green-600, ↓ icon = improvement)

### 3. API CALLS OVER TIME (Area Chart):
- Card title: "API Calls Over Time" (text-lg, font-semibold, mb-4)
- Chart: Stacked area chart showing FREE tier vs PRO tier calls
- Use Recharts library (AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer)
- Two areas:
  * FREE tier: gray-400 fill
  * PRO tier: blue-600 fill
- X-axis: Last 30 days
- Y-axis: Number of calls
- Tooltip shows exact numbers for both tiers
- Legend at bottom

### 4. ENDPOINT USAGE BREAKDOWN (Horizontal Bar Chart):
- Card title: "Top 10 Endpoints by Usage" (text-lg, font-semibold, mb-4)
- Chart: Horizontal bar chart
- Use Recharts library (BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer)
- Bars sorted by usage (highest first)
- Example endpoints:
  * /api/indicators/[symbol]/[timeframe] - 450,123 calls
  * /api/alerts - 320,456 calls
  * /api/watchlist - 180,789 calls
  * /api/tier/symbols - 120,345 calls
  * /api/dashboard/stats - 95,678 calls
  * etc.
- Bar color: gradient from blue-500 to purple-500

### 5. RESPONSE TIME DISTRIBUTION (Line Chart):
- Card title: "Response Time Trend" (text-lg, font-semibold, mb-4)
- Chart: Line chart showing avg response time over last 30 days
- Use Recharts library (LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer)
- Line color: green-600
- Reference line at 500ms (red dashed line) - SLA threshold
- Tooltip shows exact ms value

### 6. USAGE BY ENDPOINT TABLE:
- Section heading: "Detailed Usage by Endpoint" (text-2xl, font-bold, mb-4)
- Table using shadcn/ui Table component

**Columns:**
1. **Endpoint** (text-sm, font-mono, text-gray-900)
   - Example: "/api/indicators/{symbol}/{timeframe}"

2. **Method** (Badge component)
   - GET: blue badge
   - POST: green badge
   - PATCH: yellow badge
   - DELETE: red badge

3. **Total Calls** (text-sm, text-gray-900, right-aligned)
   - Format: "1,234,567"

4. **FREE Tier** (text-sm, text-gray-600, right-aligned)
   - Number of calls from FREE tier users

5. **PRO Tier** (text-sm, text-gray-600, right-aligned)
   - Number of calls from PRO tier users

6. **Avg Response Time** (text-sm, text-gray-900, right-aligned)
   - Format: "245ms"

7. **Error Rate** (Badge component)
   - <1%: green badge (bg-green-100, text-green-700)
   - 1-5%: yellow badge (bg-yellow-100, text-yellow-700)
   - >5%: red badge (bg-red-100, text-red-700)

**Table Features:**
- Sortable columns (click header to sort)
- Show 15 endpoints
- Pagination at bottom
- Hover effect on rows

### 7. ERROR RATE INDICATORS:
- Use color-coded badges for error rates
- Green: <1% (healthy)
- Yellow: 1-5% (warning)
- Red: >5% (critical)

### 8. RESPONSIVE DESIGN:
- Stat cards: 4 columns desktop, 2 columns tablet, 1 column mobile
- Charts: Full width, stack vertically on mobile
- Table: Horizontal scroll on mobile
- Reduce font sizes on mobile

### 9. TECHNICAL REQUIREMENTS:
- Component must be client component ('use client')
- Export as default component
- TypeScript with proper types
- Use shadcn/ui Card, Table, Badge, Button, Select components
- Use lucide-react for all icons
- Use Recharts for all charts
- Mock data for demonstration
- Smooth animations and transitions

---

## TECHNICAL IMPLEMENTATION:

```typescript
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Activity, Users, Crown, Clock, Download, TrendingUp, TrendingDown } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'

export default function ApiUsageAnalyticsPage() {
  const [dateRange, setDateRange] = useState('30')

  // Mock data
  const totalCalls = 1234567
  const freeTierCalls = 456789
  const proTierCalls = 777778
  const avgResponseTime = 245

  // Chart data
  const timeSeriesData = [
    // ... mock time series data for area chart
  ]

  const endpointData = [
    // ... mock endpoint usage data for bar chart
  ]

  const responseTimeData = [
    // ... mock response time data for line chart
  ]

  // ... rest of component
}
```

---

## CHECKLIST:
- ✅ Uses shadcn/ui Card, Table, Badge, Button, Select
- ✅ Client component with 'use client' directive
- ✅ TypeScript with proper interfaces
- ✅ Three different chart types (Area, Bar, Line)
- ✅ Responsive design with Tailwind CSS
- ✅ Color-coded error rate indicators
- ✅ Sortable table columns
- ✅ Date range selector
- ✅ Export functionality placeholder

Generate complete, production-ready code that I can copy and run immediately.

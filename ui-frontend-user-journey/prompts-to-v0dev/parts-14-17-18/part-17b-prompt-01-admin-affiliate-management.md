PART 17 - PROMPT 3: Admin Affiliate Management Page

=======================================================
Create an admin affiliate management page using **Next.js 15 App Router, TypeScript, Tailwind CSS, and shadcn/ui components**.

**CRITICAL: Use SystemConfig for Dynamic Percentages**
- MUST use `useAffiliateConfig()` hook for commission display

---

## REQUIREMENTS:

### 1. PAGE HEADER:
- Breadcrumb: "Admin > Affiliates" (text-sm, text-gray-500)
- Heading: "Affiliate Management" (text-4xl, font-bold, text-gray-900)
- "Add Affiliate" button (right side, variant="default")

### 2. FILTER BAR:
- Search: "Search by name or email..." (with Search icon)
- Filters (flex gap-4):
  * Status: Select (All/Active/Pending/Suspended/Deleted)
  * Country: Select (All/IN/NG/PK/VN/ID/TH/ZA/TR)
  * Payment Method: Select (All/Bank/Crypto/PayPal/Payoneer)
- Clear Filters button (ghost variant)

### 3. DATA TABLE:
Columns:
1. **Avatar** (40x40 circle, initials or image)
2. **Name** (text-sm, font-medium)
3. **Email** (text-sm, text-gray-600)
4. **Country Flag** (emoji flag + code, e.g., "🇮🇳 IN")
5. **Codes** (text-sm)
   - Format: "12/15" with mini progress bar
   - Shows active/total
6. **Earnings** (text-sm)
   - Format: "$50 / $200"
   - Pending / Total
   - Calculate using: codesUsed × commissionAmount (dynamic)
7. **Status Badge**
   - Active: green (bg-green-100, text-green-700)
   - Pending Verification: yellow (bg-yellow-100, text-yellow-700)
   - Suspended: red (bg-red-100, text-red-700)
   - Deleted: gray (bg-gray-100, text-gray-700)
8. **Actions** (DropdownMenu)
   - View Details (Eye icon)
   - Distribute Codes (Gift icon)
   - Suspend Account (Ban icon, text-red-600)
   - Delete (Trash icon, text-red-600)

### 4. PAGINATION:
- Bottom controls
- "Showing 1-20 of 87 affiliates"
- Previous | 1 | 2 | 3 | Next

### 5. SIDEBAR TABS:
- Overview (active)
- Reports (expandable):
  * P&L Report
  * Sales Performance
  * Commission Owings
  * Code Inventory

### 6. MODALS (trigger from actions):

**Distribute Codes Modal:**
- Title: "Distribute Bonus Codes"
- Fields:
  * Code Count: Number input (1-100)
  * Reason: Select (Bonus/Manual/Promotion)
  * Expiry Date: Date picker
- Buttons: Cancel | Distribute Codes

**Suspend Affiliate Modal:**
- Title: "Suspend Affiliate Account"
- Field: Reason (textarea, required)
- Warning text: "This will suspend all active codes"
- Buttons: Cancel | Confirm Suspension

### 7. AFFILIATE STATS BANNER (top of page):
- 4 mini stat cards:
  1. Total Affiliates: 87
  2. Active This Month: 45
  3. Commission Payout: ${totalPending} (calculated dynamically)
  4. Current Commission Rate: {commissionPercent}% (from useAffiliateConfig)

### 8. RESPONSIVE DESIGN:
- Table: Horizontal scroll on mobile
- Sidebar: Collapse to hamburger on mobile
- Stat cards: Stack on mobile

### 9. TECHNICAL REQUIREMENTS:
- Client component ('use client')
- TypeScript with proper types
- Use shadcn/ui Table, Badge, Button, Select, DropdownMenu, Dialog components
- Use lucide-react icons
- MUST use useAffiliateConfig() hook

---

## SYSTEMCONFIG INTEGRATION:

```typescript
'use client'

import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MoreHorizontal, Eye, Gift, Ban, Trash, Search } from 'lucide-react'

export default function AdminAffiliatesPage() {
  // ✅ CRITICAL: Use SystemConfig hook
  const {
    commissionPercent,
    calculateDiscountedPrice
  } = useAffiliateConfig()

  const commissionAmount = (calculateDiscountedPrice(29) * (commissionPercent / 100)).toFixed(2)

  // ... rest of component
}
```

---

## CHECKLIST:
- ✅ Uses useAffiliateConfig hook
- ✅ Commission rate displayed dynamically
- ✅ Earnings calculated with dynamic commission
- ✅ Table with status badges
- ✅ Filter and search functionality
- ✅ Modal dialogs for actions
- ✅ Responsive design

Generate complete, production-ready code that I can copy and run immediately.

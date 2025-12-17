PART 14 - PROMPT 2: Admin Users Management Page

=======================================================
Create an admin users management page for a SaaS platform using **Next.js 15 App Router, TypeScript, Tailwind CSS, and shadcn/ui components**.

---

## REQUIREMENTS:

### 1. PAGE HEADER:
- Breadcrumb: "Admin > Users" (text-sm, text-gray-500)
- Main heading: "User Management" (text-4xl, font-bold, text-gray-900)
- Right side: Export CSV button (variant="outline", with Download icon from lucide-react)

### 2. FILTER BAR (Below header):
- Search bar: "Search by email or name..." (w-full md:w-96, with Search icon)
- Filter dropdowns (flex gap-4):
  * Tier Filter: Select component with options (All Tiers, FREE Only, PRO Only)
  * Status Filter: Select component with options (All Status, Active, Inactive, Suspended)
  * Join Date: Select component with options (All Time, Last 7 days, Last 30 days, Last 90 days)
- Clear Filters button (ghost variant, text-sm)

### 3. DATA TABLE:
Use shadcn/ui Table component with following columns:

**Columns:**
1. **Avatar** (40x40px circle)
   - Show user image or initials
   - Fallback: First letter of email in colored circle

2. **Name** (text-sm, font-medium, text-gray-900)
   - Display full name
   - If no name: "—" (gray dash)

3. **Email** (text-sm, text-gray-600)
   - User email address
   - Truncate if too long with ellipsis

4. **Tier Badge**
   - FREE: Badge with gray background
   - PRO: Badge with gradient bg-blue-600 to bg-purple-600

5. **Join Date** (text-sm, text-gray-600)
   - Format: "MMM DD, YYYY"
   - Example: "Jan 15, 2024"

6. **Last Active** (text-sm, text-gray-600)
   - Format: "X hours ago" or "X days ago"
   - Example: "2 hours ago", "5 days ago"

7. **Subscription Status**
   - Active: Badge (bg-green-100, text-green-700)
   - Cancelled: Badge (bg-red-100, text-red-700)
   - Trial: Badge (bg-yellow-100, text-yellow-700)
   - Free: Badge (bg-gray-100, text-gray-700)

8. **Actions** (dropdown menu)
   - Button: "•••" (MoreHorizontal icon from lucide-react)
   - Dropdown items:
     * View Details (Eye icon)
     * Edit User (Edit icon)
     * Suspend Account (Ban icon, text-red-600)
     * Delete User (Trash icon, text-red-600)

### 4. TABLE FEATURES:
- Sortable columns (name, email, join date) - click header to sort
- Hover effect on rows (hover:bg-gray-50)
- Alternating row colors (subtle)
- Show 20 users per page
- Loading skeleton when fetching data

### 5. PAGINATION (Bottom of table):
- Controls: Previous | 1 | 2 | 3 | ... | 10 | Next
- Info text: "Showing 1-20 of 450 users" (text-sm, text-gray-600)
- Previous/Next buttons (variant="outline")
- Current page highlighted (bg-blue-600, text-white)

### 6. EMPTY STATE (when no users match filters):
- Icon: UserX (lucide-react, text-gray-400, size-12)
- Heading: "No users found" (text-xl, font-semibold, text-gray-900)
- Text: "Try adjusting your filters or search query" (text-sm, text-gray-600)
- Button: "Clear Filters" (variant="outline")

### 7. MODALS (Not shown but mentioned in actions):
- View User Details Modal
- Edit User Modal
- Suspend Account Confirmation
- Delete User Confirmation

### 8. RESPONSIVE DESIGN:
- Desktop: Full table layout
- Tablet: Horizontal scroll
- Mobile: Card layout instead of table
  * Each user as a card with all info stacked
  * Actions dropdown in top-right of card

### 9. TECHNICAL REQUIREMENTS:
- Component must be client component ('use client')
- Export as default component
- TypeScript with proper types (User interface)
- Use shadcn/ui Table, Badge, Button, Select, DropdownMenu components
- Use lucide-react for all icons
- Implement sorting state (useState for sortColumn and sortDirection)
- Implement filter state (useState for tier, status, joinDate)
- Search with debounce (500ms)
- Mock data array with 20 sample users

---

## SAMPLE DATA STRUCTURE:

```typescript
interface User {
  id: string
  name: string | null
  email: string
  tier: 'FREE' | 'PRO'
  joinDate: Date
  lastActive: Date
  subscriptionStatus: 'ACTIVE' | 'CANCELLED' | 'TRIAL' | 'FREE'
  avatarUrl?: string
}
```

---

## TECHNICAL IMPLEMENTATION:

```typescript
'use client'

import { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Search, Download, MoreHorizontal, Eye, Edit, Ban, Trash, ArrowUpDown } from 'lucide-react'

export default function AdminUsersPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [tierFilter, setTierFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortColumn, setSortColumn] = useState<'name' | 'email' | 'joinDate'>('joinDate')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // Mock data
  const users = [
    // ... sample users array
  ]

  // ... rest of component
}
```

---

## CHECKLIST:
- ✅ Uses shadcn/ui Table, Badge, Button, Select, DropdownMenu
- ✅ Client component with 'use client' directive
- ✅ TypeScript with proper interfaces
- ✅ Responsive design (table on desktop, cards on mobile)
- ✅ Search and filter functionality
- ✅ Sortable columns
- ✅ Pagination controls
- ✅ Empty state handling
- ✅ Loading skeleton states

Generate complete, production-ready code that I can copy and run immediately.

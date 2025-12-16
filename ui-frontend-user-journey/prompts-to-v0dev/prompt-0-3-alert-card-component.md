🔔 TASK 3: Alert Card Component
V0.dev Prompt (Copy This Exactly):
======================================================================

Create a reusable alert card component for a Next.js 15 trading app using TypeScript, Tailwind CSS, and shadcn/ui components.

REQUIREMENTS:

1. COMPONENT PROPS (TypeScript Interface):

```typescript
interface AlertCardProps {
  id: string;
  name: string;
  symbol: string;
  targetPrice: number;
  currentPrice: number;
  status: 'active' | 'paused' | 'triggered';
  createdAt: string; // ISO date string
  onViewChart?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}
```

2. CARD STRUCTURE (shadcn/ui Card component):
   - Border: border-gray-200
   - Shadow: shadow-sm
   - Hover: shadow-md (transition)
   - Padding: p-6
   - Background: white
   - Rounded: rounded-lg

3. CARD HEADER (flex, justify-between, items-start):
   - LEFT SIDE:
     - Alert name: text-lg, font-semibold, text-gray-900
     - Symbol badge: inline-flex, bg-blue-100, text-blue-800, px-2, py-1, rounded, text-xs, font-medium
       - Example: "XAUUSD"
   - RIGHT SIDE:
     - Status badge (use shadcn/ui Badge component):
       - Active: 🟢 Active (green background)
       - Paused: ⏸️ Paused (gray background)
       - Triggered: ✅ Triggered (blue background)

4. CARD BODY (space-y-4):
   - TARGET PRICE:
     - Label: "Target Price" (text-sm, text-gray-600)
     - Value: "$2,645.00" (text-3xl, font-bold, text-gray-900)
   - CURRENT PRICE ROW (flex, justify-between):
     - Label: "Current Price" (text-sm, text-gray-600)
     - Value: "$2,650.50" (text-lg, font-semibold)
   - DISTANCE BADGE:
     - Calculate: ((currentPrice - targetPrice) / targetPrice \* 100).toFixed(2)
     - Display: "-$5.50 (-0.21%)"
     - Color logic:
       - < 0.5% away: Green (bg-green-100, text-green-800)
       - 0.5-1% away: Orange (bg-orange-100, text-orange-800)
       - > 1% away: Red (bg-red-100, text-red-800)
     - Size: inline-flex, px-3, py-1, rounded-full, text-sm, font-medium
   - METADATA ROW (text-xs, text-gray-500):
     - Created: "Created 2 hours ago" (use relative time)

5. CARD FOOTER (flex, gap-2, pt-4, border-t):
   - Button 1: "📊 View Chart"
     - Variant: outline
     - Size: sm
     - onClick: calls onViewChart(id)
   - Button 2: "✏️ Edit"
     - Variant: ghost
     - Size: sm
     - onClick: calls onEdit(id)
   - Button 3: "🗑️ Delete"
     - Variant: ghost
     - Size: sm
     - Text color: red-600
     - onClick: calls onDelete(id)

6. DEMO USAGE (Include this in the component file):
   - Create 3 example alerts showing different states:
     - Alert 1: Active, 0.3% away (green badge)
     - Alert 2: Paused, 0.8% away (orange badge)
     - Alert 3: Triggered, 1.5% away (red badge)
   - Render them in a grid (grid-cols-1 md:grid-cols-2 lg:grid-cols-3, gap-4)

7. HELPER FUNCTIONS (include in component):

```typescript
// Calculate distance percentage
const calculateDistance = (target: number, current: number) => {
  const diff = current - target;
  const percent = (diff / target) * 100;
  return { diff, percent };
};

// Get distance badge color
const getDistanceColor = (percent: number) => {
  const absPercent = Math.abs(percent);
  if (absPercent < 0.5) return 'green';
  if (absPercent < 1.0) return 'orange';
  return 'red';
};

// Format relative time
const getRelativeTime = (isoDate: string) => {
  // Simple implementation: "2 hours ago", "1 day ago", etc.
};
```

8. INTERACTIVITY:
   - Buttons show hover states (scale, opacity)
   - Card has subtle hover elevation
   - onClick handlers log to console if props not provided
   - Smooth transitions on all hover states

9. TECHNICAL REQUIREMENTS:
   - Export both the component AND the props interface
   - Fully typed TypeScript
   - Use shadcn/ui Card, Badge, Button components
   - Include example data and demo render
   - Self-contained (works standalone)
   - Include all necessary imports

10. VISUAL POLISH:
    - Professional trading app appearance
    - Clear visual hierarchy
    - Consistent spacing
    - Accessible (proper contrast ratios)
    - Mobile-friendly

EXAMPLE DATA:

```typescript
const mockAlerts: AlertCardProps[] = [
  {
    id: '1',
    name: 'Gold H1 Support B-B1',
    symbol: 'XAUUSD',
    targetPrice: 2645.0,
    currentPrice: 2650.5,
    status: 'active',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  // ... 2 more examples
];
```

Generate complete, production-ready code that I can copy and use immediately in my Next.js app.

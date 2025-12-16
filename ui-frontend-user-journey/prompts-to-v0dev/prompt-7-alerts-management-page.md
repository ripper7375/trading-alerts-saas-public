## **PROMPT 7: Alerts List Page**

===========================================================

Create an alerts management page component for Next.js 15 using TypeScript, Tailwind CSS, and shadcn/ui.

REQUIREMENTS:

1. PAGE HEADER:

Breadcrumb: "Dashboard > Alerts" (text-sm, text-gray-500, mb-4)
Heading: "🔔 Alerts" (text-3xl, font-bold)
Subheading: "Manage your price alerts" (text-gray-600, mb-6)
Action button: "+ Create New Alert" (float right, bg-blue-600, text-white, px-6, py-3, rounded-lg, hover:bg-blue-700, font-semibold)

2. SUMMARY CARDS (3 cards in row):

Grid: grid grid-cols-1 md:grid-cols-3 gap-6, mb-8
Card 1: Active Alerts

Icon: ⏰ (text-4xl)
Label: "Active" (text-gray-600, text-sm, uppercase, font-semibold)
Count: "3/5" (text-4xl, font-bold, text-green-600)
Sublabel: "alerts watching" (text-gray-500, text-sm)
Card: bg-white, rounded-xl, shadow-md, p-6, border-l-4 border-green-500
Card 2: Paused Alerts

Icon: ⏸️ (text-4xl)
Label: "Paused" (text-gray-600, text-sm, uppercase, font-semibold)
Count: "1" (text-4xl, font-bold, text-gray-600)
Sublabel: "temporarily inactive" (text-gray-500, text-sm)
Card: bg-white, rounded-xl, shadow-md, p-6, border-l-4 border-gray-300
Card 3: Triggered (Last 7 days)

Icon: ✅ (text-4xl)
Label: "Triggered" (text-gray-600, text-sm, uppercase, font-semibold)
Count: "2" (text-4xl, font-bold, text-orange-600)
Sublabel: "in last 7 days" (text-gray-500, text-sm)
Card: bg-white, rounded-xl, shadow-md, p-6, border-l-4 border-orange-500

3. FILTERS & TABS (Below summary):

Tabs: Horizontal tabs with underline indicator
"Active (3)" - active: border-b-2 border-blue-600, text-blue-600, font-semibold
"Paused (1)" - text-gray-600, hover:text-gray-900
"Triggered (2)" - text-gray-600, hover:text-gray-900
"All (6)" - text-gray-600, hover:text-gray-900
Right side filters:
Symbol filter dropdown: "All Symbols" | XAUUSD | EURUSD | etc.
Sort dropdown: "Newest First" | "Oldest First" | "Price Near Target"
Search bar: "Search alerts..." (with 🔍 icon, rounded-lg, border-2)

4. ACTIVE ALERTS SECTION:

Section heading: "🟢 Active Alerts (3):" (text-2xl, font-bold, mb-6)
Alert Card Layout (Each card):

Card: bg-white, rounded-xl, shadow-md, hover:shadow-xl, transition, p-6, border-l-4 border-green-500, mb-4
Card Header:

Top row (flex, justify-between):
Left: Status badge + Alert name
Badge: "⏰ Watching" (bg-green-100, text-green-800, px-3, py-1, rounded-full, text-sm, font-semibold)
Name: "Gold H1 Support B-B1" (text-xl, font-bold, text-gray-900, ml-3)
Right: Menu button "⋮" (cursor-pointer, hover:bg-gray-100, rounded-full, p-2)
Dropdown menu appears on click:
📊 View Chart
✏️ Edit Alert
⏸️ Pause Alert
🔕 Mute for 1h
🗑️ Delete Alert
Second row (flex, gap-4, text-sm, text-gray-600, mt-2):
"XAUUSD • H1" (with symbol icon)
"•"
Created time: "Created 2 hours ago"
Card Body (Grid 2 columns):

Left column:

Target Information:
Label: "Target" (text-xs, uppercase, text-gray-500, font-semibold)
Line: "B-B1 Support" (text-lg, font-semibold, text-green-600)
Price: "$2,645.00" (text-2xl, font-bold, text-gray-900)
Tolerance: "±0.10% ($2,642.35-$2,647.65)" (text-sm, text-gray-600)
Alert Type:
Badge: "Near Level" or "Cross Level" or "Fractal" (bg-blue-100, text-blue-800, px-2, py-1, rounded, text-xs)
Right column:

Current Status:
Label: "Current Price" (text-xs, uppercase, text-gray-500, font-semibold)
Price: "$2,650.50" (text-2xl, font-bold, text-gray-900)
Distance: "-$5.50 (-0.21%)" (text-lg, with color based on direction)
Moving toward target: text-orange-600 with ↓ arrow
Moving away: text-gray-600 with ↑ arrow
Distance Indicator (Visual bar):
Progress bar showing price position relative to target
Label: "Distance to target" (text-xs, text-gray-500)
Bar: Full width, height 4px, bg-gray-200
Filled portion: Represents % distance, color changes:
Far (>1%): bg-gray-400
Medium (0.5-1%): bg-yellow-500
Near (<0.5%): bg-orange-500
Very near (<0.2%): bg-red-500, with ⚠️ NEAR badge
Card Footer:

Notifications icons: ✉️ Email | 📱 Push | 💬 SMS (show which are enabled)
Last checked: "Updated 5 seconds ago" (text-xs, text-gray-500)
Action buttons (flex, gap-2, mt-4):
[📊 View Chart] (bg-blue-600, text-white, px-4, py-2, rounded-lg, hover:bg-blue-700)
[✏️ Edit] (border-2, border-gray-300, text-gray-700, px-4, py-2, rounded-lg, hover:border-blue-500)
[🗑️ Delete] (border-2, border-gray-300, text-gray-700, px-4, py-2, rounded-lg, hover:border-red-500, hover:text-red-600)

5. PAUSED ALERTS SECTION:

Section heading: "⏸️ Paused Alerts (1):" (text-2xl, font-bold, mb-6, mt-12)
Same card layout as active alerts, but:
Border color: border-gray-300
Status badge: "⏸️ Paused" (bg-gray-100, text-gray-700)
Grayed out appearance: opacity-70
Additional badge: "Paused 3 hours ago" (text-xs, bg-yellow-100, text-yellow-800)
Resume button instead of Pause: [▶️ Resume] (bg-green-600, hover:bg-green-700)

6. TRIGGERED ALERTS SECTION:

Section heading: "✅ Triggered Alerts (Last 7 days) (2):" (text-2xl, font-bold, mb-6, mt-12)
Same card layout, but:
Border color: border-orange-500
Status badge: "✅ Triggered" (bg-orange-100, text-orange-800)
Additional info row:
"Triggered at: $2,645.80" (text-lg, font-semibold)
"Time: Jan 15, 2025 14:32 UTC" (text-sm, text-gray-600)
Notification status: "✉️ Email sent | 📱 Push notification sent" (text-sm, text-green-600, with checkmarks)
Action buttons:
[📊 View Chart] (same as active)
[🔄 Create Similar] (border-2, border-blue-600, text-blue-600, px-4, py-2, rounded-lg, hover:bg-blue-50)
[🗑️ Archive] (border-2, border-gray-300, text-gray-700, px-4, py-2, rounded-lg, hover:border-red-500)
Auto-archive note: "Will be archived in 23 days" (text-xs, text-gray-500)

7. EMPTY STATES:

If no active alerts:

Card: bg-gray-50, border-2 border-dashed border-gray-300, rounded-xl, p-16, text-center
Icon: 🔔 (text-8xl, opacity-30)
Heading: "No active alerts" (text-2xl, text-gray-500, mb-2)
Message: "Create your first alert to get notified about price movements" (text-gray-400, mb-6)
CTA: [+ Create Your First Alert] (bg-blue-600, text-white, px-8, py-4, rounded-lg, text-lg, hover:bg-blue-700)
If no triggered alerts:

Simple message: "No alerts have triggered in the last 7 days" (text-gray-500, italic) 8. BULK ACTIONS (Select multiple):

Checkbox on each card (top-left corner)
When any selected, show action bar at top (sticky):
"3 alerts selected" (font-semibold)
Buttons: [Pause Selected] [Delete Selected] [Deselect All]
Action bar: bg-blue-600, text-white, rounded-lg, p-4, shadow-lg

9. DELETE CONFIRMATION MODAL:

Modal appears when delete clicked
Heading: "⚠️ Delete Alert?" (text-2xl, font-bold, text-red-600)
Message: "Are you sure you want to delete the alert 'Gold H1 Support B-B1'? This action cannot be undone." (text-gray-700)
Checkbox: "☐ Don't ask me again" (text-sm, text-gray-600)
Buttons:
[Cancel] (border-2, border-gray-300, px-6, py-3, rounded-lg)
[Delete Alert] (bg-red-600, text-white, px-6, py-3, rounded-lg, hover:bg-red-700)

10. RESPONSIVE:

Summary cards: 1 column mobile, 3 columns desktop
Alert cards: Full width always, internal layout adjusts
Target + Current info: Stack vertically on mobile, side-by-side on desktop
Action buttons: Full width on mobile, inline on desktop
Filters: Stack vertically on mobile

11. TECHNICAL:

Export as default component
TypeScript with proper types
Props: userTier ('FREE' | 'PRO'), alerts (array of alert objects)
Use shadcn/ui Card, Button, Badge, Tabs, Checkbox, DropdownMenu components
State for: active tab, selected alerts, filters, sort order
Mock alert data with realistic examples (3 active, 1 paused, 2 triggered)
Mock functions: onViewChart, onEdit, onPause, onDelete, onCreate

Generate complete, production-ready code with comprehensive mock data that I can copy and run immediately.

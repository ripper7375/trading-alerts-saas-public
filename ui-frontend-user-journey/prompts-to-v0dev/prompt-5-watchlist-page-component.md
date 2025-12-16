## **PROMPT 5: Watchlist Page Component**

==================================================

Create a watchlist management page component for Next.js 15 using TypeScript, Tailwind CSS, and shadcn/ui.

REQUIREMENTS:

1. PAGE HEADER:

Breadcrumb: "Dashboard > Watchlist" (text-sm, text-gray-500, mb-4)
Heading: "📋 My Watchlist" (text-3xl, font-bold)
Usage badge: "3/5 slots used" for FREE, "12/50 slots used" for PRO (float right, bg-gray-100, px-4, py-2, rounded-full, font-semibold)
Action button: "+ Add New" (bg-blue-600, text-white, px-6, py-2, rounded-lg, hover:bg-blue-700)

2. ADD ITEM FORM (Collapsible card):

Card: bg-white, rounded-xl, shadow-lg, p-6, mb-8
Heading: "Select Symbol and Timeframe:" (text-xl, font-semibold, mb-4)
Symbol Selector:

Label: "Symbol" (font-medium, text-gray-700, mb-2)
Dropdown: Custom select with search
Options (FREE tier - 5 symbols):
BTCUSD (Bitcoin)
EURUSD (Euro / US Dollar)
USDJPY (US Dollar / Japanese Yen)
US30 (Dow Jones)
XAUUSD (Gold) ✓ Selected
Options (PRO tier - 15 symbols): Add badges "🎉 PRO" to additional symbols
AUDJPY (Australian Dollar / Yen) 🎉
AUDUSD (Australian Dollar / USD) 🎉
ETHUSD (Ethereum) 🎉
GBPJPY (British Pound / Yen) 🎉
GBPUSD (British Pound / USD) 🎉
NDX100 (Nasdaq 100) 🎉
NZDUSD (New Zealand Dollar / USD) 🎉
USDCAD (USD / Canadian Dollar) 🎉
USDCHF (USD / Swiss Franc) 🎉
XAGUSD (Silver) 🎉
Each option: Show icon + name + description
Disabled symbols: Show lock icon 🔒 and "Upgrade to PRO" badge for FREE users
Timeframe Selector:

Label: "Timeframe" (font-medium, text-gray-700, mb-2)
Grid layout: 3 columns on desktop, 2 on mobile
FREE tier (3 timeframes):
H1 (1 Hour) ✓
H4 (4 Hours)
D1 (1 Day)
PRO tier (9 timeframes): Add badges "🎉 PRO"
M5 (5 Minutes) 🎉 PRO
M15 (15 Minutes) 🎉 PRO
M30 (30 Minutes) 🎉 PRO
H1 (1 Hour)
H2 (2 Hours) 🎉 PRO
H4 (4 Hours)
H8 (8 Hours) 🎉 PRO
H12 (12 Hours) 🎉 PRO
D1 (1 Day)
Each button: border-2, rounded-lg, px-4, py-3, text-center, hover:border-blue-600
Selected: bg-blue-50, border-blue-600, text-blue-600, font-semibold
Disabled: opacity-50, cursor-not-allowed, with lock icon
Submit Button:

Button: "Add to Watchlist" (w-full, bg-green-600, hover:bg-green-700, py-3, text-lg, font-semibold, rounded-lg, mt-4)
Disabled when: Symbol+Timeframe combination already exists or slots full

3. ACTIVE WATCHLIST ITEMS:

Section heading: "📊 Active Watchlist Items ({count}/{limit}):" (text-2xl, font-bold, mb-6)
Grid of watchlist items: (grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6)

Each item card:

Card: bg-white, rounded-xl, shadow-md, hover:shadow-xl, transition, p-6, border-l-4
Border color:
Green (border-green-500): Price near support
Red (border-red-500): Price near resistance
Blue (border-blue-500): Normal range
Card content:

Top row:

Symbol + Timeframe: "XAUUSD - H1" (text-2xl, font-bold, text-gray-900)
Menu icon: "⋮" (float right, cursor-pointer) → Opens dropdown: [View Chart] [Remove]
Price section:

Current price: "$2,650.50" (text-3xl, font-bold, text-gray-900)
Change: "+$12.50 (+0.47%)" (text-lg, color depends on positive/negative)
Positive: text-green-600 with ↑ arrow
Negative: text-red-600 with ↓ arrow
Status badge:

"✓ Near B-B1 Support (+0.21%)" (bg-yellow-100, text-yellow-800, rounded-full, px-3, py-1, text-sm)
or "📊 Normal trading range" (bg-blue-100, text-blue-800)
or "⚠️ Near P-P2 Resistance (-0.18%)" (bg-orange-100, text-orange-800)
Last updated: "Updated 5s ago" (text-xs, text-gray-500)

Action buttons (flex gap-2):

[View Chart] (bg-blue-600, text-white, px-4, py-2, rounded-lg, hover:bg-blue-700, text-sm)
[× Remove] (border-2, border-gray-300, text-gray-700, px-4, py-2, rounded-lg, hover:border-red-500, hover:text-red-600, text-sm)

4. EMPTY STATE (If no items):

Card: bg-gray-50, border-2 border-dashed border-gray-300, rounded-xl, p-16, text-center
Icon: 📋 (text-8xl, opacity-30)
Heading: "No watchlist items yet" (text-2xl, text-gray-500, mb-2)
Message: "Add your first symbol and timeframe combination above to start monitoring" (text-gray-400, mb-6)
Info box:
"ℹ️ FREE Tier: You can add up to 5 combinations"
"Upgrade to PRO for 50 watchlist items" (text-sm, text-gray-500)

5. TIER LIMIT INDICATOR (At bottom):

Card: bg-gradient-to-r from-blue-50 to-purple-50, rounded-lg, p-6, mt-8, border-l-4 border-blue-600
FREE users:
"ℹ️ FREE Tier Limits" (text-lg, font-semibold, mb-2)
"You can add up to 5 symbol+timeframe combinations"
"Symbols: 5 available" (list with badges)
"Timeframes: H1, H4, D1 only"
CTA: [Upgrade to PRO for 50 watchlist items] (bg-blue-600, text-white, px-6, py-2, rounded-lg, mt-3)
PRO users:
"⭐ PRO Tier Benefits" (text-lg, font-semibold, mb-2)
"You have 50 watchlist slots with all symbols and timeframes"
Progress: "Using 12/50 slots (24%)" with progress bar

6. RESPONSIVE:

Form: Single column on mobile, side-by-side selectors on desktop
Watchlist grid: 1 column mobile, 2 columns tablet, 3 columns desktop
Cards: Full width on mobile with touch-friendly buttons

7. TECHNICAL:

Export as default component
TypeScript with proper types
Props: userTier ('FREE' | 'PRO'), currentItems (array), onAddItem (function), onRemoveItem (function)
Use shadcn/ui Select, Button, Card, Badge components
State for: selected symbol, selected timeframe, dropdown menus
Validation: Check if symbol+timeframe combo already exists, check tier limits
Mock data for demonstration

Generate complete, production-ready code with sample data that I can copy and run immediately.

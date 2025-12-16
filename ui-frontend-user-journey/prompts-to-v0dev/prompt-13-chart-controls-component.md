## **PROMPT 13: Chart Controls (Symbol & Timeframe Selectors) Component**

==================================================

Create tier-aware chart control components for symbol and timeframe selection in Next.js 15 using TypeScript, Tailwind CSS, and shadcn/ui.

REQUIREMENTS:

1. COMPONENT STRUCTURE (Two separate but related components):

SymbolSelector: Dropdown for choosing trading symbol
TimeframeSelector: Dropdown for choosing timeframe
ChartControls: Container that wraps both selectors

2. CHART CONTROLS CONTAINER:

Layout:

Container: bg-white, rounded-xl, shadow-md, p-4, mb-6
Flex layout: Space between symbol selector and timeframe selector
Responsive: Stack vertically on mobile, horizontal on desktop
Additional Controls (Optional):

Refresh button: "⟳" (circular icon, hover:rotate animation, cursor-pointer)
Loading indicator: When data refreshing, show spinner
Last updated: "Updated 5s ago" (text-xs, text-gray-500)

3. SYMBOL SELECTOR COMPONENT:

Trigger Button:

Layout: flex, items-center, gap-2, border-2 border-gray-300, rounded-lg, px-4, py-2, hover:border-blue-600, cursor-pointer
Content:
Symbol: "XAUUSD" (text-lg, font-bold, text-gray-900)
Name: "Gold" (text-sm, text-gray-600, ml-2)
Dropdown icon: ▼ (ml-auto, text-gray-500)
Active state: border-blue-600, bg-blue-50
Dropdown Menu (Opens on click):

Container: Absolute, top-full, mt-2, w-80, bg-white, rounded-xl, shadow-2xl, border-2 border-gray-200, max-h-96, overflow-auto, z-50
Search Bar (At top of dropdown):

Input: Sticky top, bg-gray-50, border-b-2 border-gray-200, p-3
Placeholder: "🔍 Search symbols..."
Real-time filtering as user types
Symbol Groups (Organized by category):

Group 1: Forex (Expanded by default)

Heading: "💱 Forex" (text-sm, font-semibold, text-gray-700, uppercase, px-4, py-2, bg-gray-100)
Items:
EURUSD - Euro / US Dollar
GBPUSD - British Pound / US Dollar
USDJPY - US Dollar / Japanese Yen
AUDUSD - Australian Dollar / US Dollar 🎉 (PRO badge)
AUDJPY - Australian Dollar / Yen 🎉 (PRO badge)
GBPJPY - British Pound / Yen 🎉 (PRO badge)
NZDUSD - New Zealand Dollar / USD 🎉 (PRO badge)
USDCAD - US Dollar / Canadian Dollar 🎉 (PRO badge)
USDCHF - US Dollar / Swiss Franc 🎉 (PRO badge)
Group 2: Crypto

Heading: "₿ Crypto" (text-sm, font-semibold, text-gray-700, uppercase, px-4, py-2, bg-gray-100)
Items:
BTCUSD - Bitcoin
ETHUSD - Ethereum 🎉 (PRO badge)
Group 3: Indices

Heading: "📊 Indices" (text-sm, font-semibold, text-gray-700, uppercase, px-4, py-2, bg-gray-100)
Items:
US30 - Dow Jones Industrial Average
NDX100 - Nasdaq 100 🎉 (PRO badge)
Group 4: Commodities

Heading: "🏆 Commodities" (text-sm, font-semibold, text-gray-700, uppercase, px-4, py-2, bg-gray-100)
Items:
XAUUSD - Gold
XAGUSD - Silver 🎉 (PRO badge)
Symbol Item Layout:

Each item: flex, items-center, justify-between, px-4, py-3, hover:bg-blue-50, cursor-pointer, transition-colors
Left side:
Symbol code: "XAUUSD" (text-base, font-semibold, text-gray-900)
Full name: "Gold" (text-sm, text-gray-600)
Right side:
Current price: "$2,650.50" (text-sm, font-medium, text-gray-700)
Change: "+$12.50 (+0.47%)" (text-xs, color based on positive/negative)
Positive: text-green-600, with ↑
Negative: text-red-600, with ↓
Selected symbol: bg-blue-100, border-l-4 border-blue-600
Locked Symbols (FREE tier):

Item: opacity-50, cursor-not-allowed, hover:bg-gray-50 (no blue hover)
Badge: "🔒 PRO" (bg-blue-600, text-white, px-2, py-1, rounded, text-xs, font-semibold, ml-2)
Tooltip on hover: "Upgrade to PRO to access this symbol"
Click behavior: Opens upgrade modal instead of selecting

4. TIMEFRAME SELECTOR COMPONENT:

Trigger Button:

Layout: Same style as symbol selector
Content:
Timeframe: "H1" (text-lg, font-bold, text-gray-900)
Description: "1 Hour" (text-sm, text-gray-600, ml-2)
Dropdown icon: ▼ (ml-auto)
Dropdown Menu:

Container: w-64, bg-white, rounded-xl, shadow-2xl, border-2 border-gray-200
Timeframe Grid (No search needed):

Layout: grid grid-cols-3 gap-2, p-4
FREE Tier Timeframes (3 available):

H1 - 1 Hour (Available, default selected)
Card: border-2, rounded-lg, p-3, text-center, cursor-pointer
Selected: border-blue-600, bg-blue-50, text-blue-600, font-semibold
Hover: border-blue-400, bg-blue-50
H4 - 4 Hours (Available)
Same styling as above
D1 - 1 Day (Available)
Same styling as above
PRO Timeframes (6 additional):

M5 - 5 Minutes 🎉 (Locked for FREE)
Card: border-2, border-gray-200, rounded-lg, p-3, text-center, opacity-50, cursor-not-allowed
Badge: "PRO" (bg-blue-600, text-white, text-xs, px-2, py-1, rounded-full, absolute top-1, right-1)
Tooltip: "Upgrade to PRO for M5 charts"
M15 - 15 Minutes 🎉 (Locked)
M30 - 30 Minutes 🎉 (Locked)
H2 - 2 Hours 🎉 (Locked)
H8 - 8 Hours 🎉 (Locked)
H12 - 12 Hours 🎉 (Locked)
Timeframe Card Content:

Code: "H1" (text-xl, font-bold, text-gray-900, mb-1)
Name: "1 Hour" (text-xs, text-gray-600)
If locked: Lock icon 🔒 (text-sm, text-gray-400)
Upgrade Prompt (At bottom of dropdown):

Card: bg-gradient-to-r from-blue-500 to-purple-600, text-white, rounded-lg, p-4, m-4, mt-6
Icon: ⭐ (text-2xl)
Text: "Unlock 6 more timeframes" (text-sm, font-semibold)
Subtext: "Upgrade to PRO for M5-H12" (text-xs, opacity-90)
Button: [Upgrade to PRO] (bg-white, text-blue-600, px-4, py-2, rounded-lg, font-semibold, hover:bg-gray-100, mt-2)

5. TIER VALIDATION LOGIC:

On Symbol Select:

const handleSymbolSelect = (symbol: string) => {
if (userTier === 'FREE' && !FREE_SYMBOLS.includes(symbol)) {
// Show upgrade modal
openUpgradeModal('symbol', symbol)
return
}
// Valid selection
onSymbolChange(symbol)
closeDropdown()
}
On Timeframe Select:

const handleTimeframeSelect = (timeframe: string) => {
if (userTier === 'FREE' && !FREE_TIMEFRAMES.includes(timeframe)) {
// Show upgrade modal
openUpgradeModal('timeframe', timeframe)
return
}
// Valid selection
onTimeframeChange(timeframe)
closeDropdown()
}

6. UPGRADE MODAL (When locked item clicked):

Modal Content:

Backdrop: bg-black/50, backdrop-blur
Modal: max-w-md, bg-white, rounded-2xl, shadow-2xl, p-8, text-center
Close button: "×" (top-right, text-gray-400, hover:text-gray-600, text-2xl, cursor-pointer)
Content:

Icon: 🔒 (text-6xl)
Heading: "Upgrade to PRO" (text-2xl, font-bold, text-gray-900, mb-2)
Message:
For symbol: "AUDJPY is available in PRO tier"
For timeframe: "M5 charts are available in PRO tier"
Description: "Get access to 15 symbols and 9 timeframes with PRO" (text-gray-600, mb-6)
Benefits List:

✅ 15 Trading Symbols (vs 5 on FREE)
✅ 9 Timeframes M5-D1 (vs 3 on FREE)
✅ 20 Alerts (vs 5 on FREE)
✅ Priority Updates (30s vs 60s)
Price:

"$29/month" (text-4xl, font-bold, text-gray-900, mb-1)
"7-day free trial" (text-sm, text-green-600, font-semibold)
Buttons:

[Start Free Trial] (bg-blue-600, text-white, px-8, py-3, rounded-xl, text-lg, font-bold, hover:bg-blue-700, w-full, mb-3)
[Maybe Later] (text-gray-600, hover:underline, text-sm)

7. KEYBOARD NAVIGATION:

Arrow keys: Navigate through dropdown items
Enter: Select highlighted item
Escape: Close dropdown
Tab: Move between selectors
Type to search (for symbols)

8. VISUAL FEEDBACK:

Hover states: All clickable items
Loading state: Spinner when fetching data
Disabled state: Grayed out, cursor-not-allowed
Success animation: Brief highlight when selection changes
Error state: Red border if invalid selection

9. RESPONSIVE:

Desktop: Side-by-side selectors, dropdowns full width
Tablet: Side-by-side, smaller dropdowns
Mobile:
Stacked selectors (vertical)
Full-width dropdowns
Larger tap targets
Simplified layout (hide prices in dropdown)

10. TECHNICAL:

Export three components: ChartControls (wrapper), SymbolSelector, TimeframeSelector
TypeScript with proper types
Props:
userTier: 'FREE' | 'PRO'
selectedSymbol: string
selectedTimeframe: string
onSymbolChange: (symbol: string) => void
onTimeframeChange: (timeframe: string) => void
onUpgradeClick: () => void
Use shadcn/ui Select, Button, Badge, Popover components
Use lucide-react icons (ChevronDown, Lock, TrendingUp, TrendingDown, Search)
State for: dropdown open/closed, search query, hover states
Constants:
FREE_SYMBOLS: ['BTCUSD', 'EURUSD', 'USDJPY', 'US30', 'XAUUSD']
PRO_SYMBOLS: [...FREE_SYMBOLS, 'AUDJPY', 'AUDUSD', 'ETHUSD', 'GBPJPY', 'GBPUSD', 'NDX100', 'NZDUSD', 'USDCAD', 'USDCHF', 'XAGUSD']
FREE_TIMEFRAMES: ['H1', 'H4', 'D1']
PRO_TIMEFRAMES: ['M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'H12', 'D1']
Mock data: Symbol prices and changes

Generate complete, production-ready code with tier validation, upgrade modal, and responsive design that I can copy and run immediately.

## **PROMPT 4: Dashboard Home Content Component**

=========================================================

Create a dashboard home content component for Next.js 15 using TypeScript, Tailwind CSS, and shadcn/ui.

REQUIREMENTS:

1. WELCOME SECTION (Top):

Greeting: "👋 Welcome, {userName}!" (text-3xl, font-bold, text-gray-900)
Tier badge: "FREE TIER 🆓" or "PRO TIER ⭐" (float right, inline-block, rounded-full, px-4, py-2, font-semibold)
FREE: bg-green-500, text-white
PRO: bg-blue-600, text-white

2. QUICK START TIPS (Dismissible card):

Card: bg-blue-50, border-l-4 border-blue-600, rounded-lg, p-6, mb-8
Icon: 💡 or lightbulb icon
Heading: "⚡ Quick Start Tips:" (text-lg, font-semibold, mb-3)
Steps (numbered list):
Add symbols to your Watchlist
View live charts with fractal lines
Create your first alert
Dismiss button: "×" (top-right, text-gray-500, hover:text-gray-700, cursor-pointer)

3. STATS CARDS (4 cards in grid):

Grid: grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6, mb-8
Card 1: Watchlist

Icon: 📋 or list icon (text-4xl)
Label: "Watchlist" (text-gray-600, text-sm, uppercase, font-semibold)
Value: "3/5" (text-4xl, font-bold, text-gray-900)
Sublabel: "symbols" (text-gray-500, text-sm)
Progress bar: (w-full, h-2, bg-gray-200, rounded-full)
Filled: 60% width, bg-blue-600
Card 2: Alerts

Icon: 🔔 or bell icon
Label: "Alerts" (text-gray-600, text-sm, uppercase, font-semibold)
Value: "2/5" (text-4xl, font-bold, text-gray-900)
Sublabel: "active" (text-gray-500, text-sm)
Progress bar: 40% filled, bg-green-600
Card 3: API Usage

Icon: ⚡ or zap icon
Label: "API Usage" (text-gray-600, text-sm, uppercase, font-semibold)
Value: "45/60" (text-4xl, font-bold, text-gray-900)
Sublabel: "req/hour" (text-gray-500, text-sm)
Progress bar: 75% filled, bg-yellow-500
Warning: If >80%, show "⚠️ High usage" (text-orange-600, text-xs)
Card 4: Chart Views

Icon: 📊 or trending icon
Label: "Chart Views" (text-gray-600, text-sm, uppercase, font-semibold)
Value: "24" (text-4xl, font-bold, text-gray-900)
Sublabel: "this week" (text-gray-500, text-sm)
Trend: "+12% from last week" (text-green-600, text-xs, with up arrow ↑)

4. YOUR WATCHLIST SECTION:

Heading: "📊 Your Watchlist" (text-2xl, font-bold, mb-4)
Action button: "+ Add Symbol" (float right, bg-blue-600, text-white, rounded-lg, px-4, py-2, hover:bg-blue-700)
If watchlist has items (3 items):

Card: bg-white, rounded-xl, shadow-sm, hover:shadow-md, transition, p-4
Layout per item:
Left: Symbol + Timeframe (XAUUSD - H1) (text-xl, font-bold)
Center: Current price ($2,650.50) (text-2xl, font-semibold, text-gray-900)
Right:
Change: "+$12.50 (+0.47%)" (text-green-600 if positive, text-red-600 if negative)
Status badge: "✓ Near B-B1 Support (+0.21%)" (text-xs, bg-yellow-100, text-yellow-800, rounded-full, px-2, py-1)
Actions: [View Chart] button (bg-gray-100, hover:bg-gray-200, text-sm, px-3, py-1, rounded)
Last updated: "Updated 3s ago" (text-xs, text-gray-500)
If watchlist is empty:

Empty state card: bg-gray-50, border-2 border-dashed border-gray-300, rounded-xl, p-12, text-center
Icon: 📋 (text-6xl, opacity-50)
Message: "No symbols yet." (text-xl, text-gray-500, mb-2)
Submessage: "Add your first symbol to start monitoring" (text-sm, text-gray-400)
CTA button: [+ Add Symbol to Watchlist] (bg-blue-600, text-white, px-6, py-3, rounded-lg, mt-4, hover:bg-blue-700)

5. RECENT ALERTS SECTION:

Heading: "🔔 Recent Alerts" (text-2xl, font-bold, mb-4, mt-8)
Action: "View All" link (float right, text-blue-600, hover:underline)
If alerts exist (2 items):

Card per alert: bg-white, rounded-lg, shadow-sm, p-4, border-l-4
Active alert: border-green-500
Triggered alert: border-orange-500
Paused alert: border-gray-300
Layout:
Status icon: ⏰ (Watching) | ✅ (Triggered) | ⏸️ (Paused)
Title: "Gold H1 Support B-B1" (text-lg, font-semibold)
Details: "XAUUSD • H1 • Target: $2,645.00" (text-sm, text-gray-600)
Distance: "Current: $2,650.50 | Distance: -$5.50 (-0.21%)" (text-sm)
Time: "Created 2 hours ago" (text-xs, text-gray-500)
If no alerts:

Empty state (same style as watchlist empty state)
Message: "You haven't created any alerts yet."
CTA: [Create Your First Alert] button

6. UPGRADE PROMPT (For FREE users only):

Card: bg-gradient-to-r from-blue-500 to-purple-600, text-white, rounded-xl, p-8, mt-8
Icon: ⭐ (text-5xl)
Heading: "💡 Upgrade to PRO" (text-2xl, font-bold, mb-2)
Description: "Get 15 symbols, 9 timeframes, and 20 alerts for just $29/month" (text-lg, mb-4)
Features (bullet list, text-sm):
15 trading symbols
9 timeframes (M5-D1)
20 active alerts
Priority updates (30s)
CTA button: [Upgrade Now - $29/month] (bg-white, text-blue-600, font-bold, px-8, py-3, rounded-lg, hover:bg-gray-100, shadow-lg)
Link: "See full comparison" (text-white, underline, text-sm, mt-2)

7. RESPONSIVE:

Stats cards: 1 column mobile, 2 columns tablet, 4 columns desktop
Watchlist items: Stack on mobile, horizontal on desktop
Upgrade card: Full width, padding adjusted for mobile

8. TECHNICAL:

Export as default component
TypeScript with proper types
Props: userName, userTier ('FREE' | 'PRO'), stats (object), watchlistItems (array), alerts (array)
Use shadcn/ui Card, Button, Badge, Progress components
State for dismissing quick start tips
Mock data for demonstration

Generate complete, production-ready code with sample data that I can copy and run immediately.

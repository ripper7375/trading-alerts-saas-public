## **PROMPT 14: Empty States Component**

==================================================

Create reusable empty state components for various scenarios in Next.js 15 using TypeScript, Tailwind CSS, and shadcn/ui.

REQUIREMENTS:

1. BASE EMPTY STATE COMPONENT (Reusable):

Container:

Card: bg-gray-50, border-2 border-dashed border-gray-300, rounded-xl, p-12, text-center
Optional: Full height variant for pages (min-h-96, flex, items-center, justify-center)
Props Structure:

interface EmptyStateProps {
icon?: React.ReactNode | string // Emoji or component
title: string
description: string
action?: {
label: string
onClick: () => void
variant?: 'primary' | 'secondary'
}
secondaryAction?: {
label: string
onClick: () => void
}
illustration?: React.ReactNode // Optional custom illustration
}

2. SPECIFIC EMPTY STATE VARIANTS:

VARIANT 1: No Watchlist Items

Icon: 📋 (text-8xl, opacity-30)
Title: "No symbols in your watchlist" (text-2xl, font-bold, text-gray-500, mt-6, mb-2)
Description: "Add your first symbol to start monitoring price movements" (text-gray-400, mb-8, max-w-md, mx-auto)
Primary action: [+ Add Symbol to Watchlist] (bg-blue-600, text-white, px-8, py-3, rounded-lg, text-lg, font-semibold, hover:bg-blue-700, shadow-lg)
Secondary action: "Browse all symbols" (text-blue-600, hover:underline, text-sm, mt-4, cursor-pointer)
Info box (below):
"💡 Quick Tip: Start with popular symbols like XAUUSD (Gold) or EURUSD" (bg-blue-50, border-l-4 border-blue-500, rounded-lg, p-4, mt-8, text-sm, text-blue-800, text-left, max-w-lg, mx-auto)
VARIANT 2: No Active Alerts

Icon: 🔔 (text-8xl, opacity-30)
Title: "No active alerts" (text-2xl, font-bold, text-gray-500, mt-6, mb-2)
Description: "Create your first alert to get notified when price reaches key levels" (text-gray-400, mb-8)
Primary action: [Create Your First Alert] (bg-green-600, text-white, px-8, py-3, rounded-lg, text-lg, font-semibold, hover:bg-green-700, shadow-lg)
Secondary action: "View charts" (text-blue-600, hover:underline, text-sm, mt-4)
Steps guide (below):
Card: bg-white, rounded-xl, shadow-md, p-6, mt-8, max-w-2xl, mx-auto, text-left
Heading: "How to create an alert:" (text-lg, font-semibold, text-gray-900, mb-4)
Steps (numbered):
"Go to Live Charts and select a symbol" (mb-2)
"Click on a fractal line (support/resistance)" (mb-2)
"Configure your alert settings and tolerance" (mb-2)
"Choose notification methods (email, push, SMS)" (mb-2)
"Click 'Create Alert' and wait for notifications!"
VARIANT 3: No Notifications

Icon: 🔕 (text-8xl, opacity-30)
Title: "No notifications yet" (text-2xl, font-bold, text-gray-500, mt-6, mb-2)
Description: "You'll see all your notifications here once you start receiving them" (text-gray-400, mb-8)
Primary action: [Create an Alert] (bg-blue-600, text-white, px-6, py-3, rounded-lg, font-semibold, hover:bg-blue-700)
Note: "✓ Email and push notifications are enabled" (text-sm, text-green-600, mt-6)
VARIANT 4: No Search Results

Icon: 🔍 (text-8xl, opacity-30)
Title: "No results found" (text-2xl, font-bold, text-gray-500, mt-6, mb-2)
Description: "We couldn't find any matches for '{searchQuery}'" (text-gray-400, mb-8)
Suggestions:
Card: bg-white, rounded-lg, border-2 border-gray-200, p-6, mt-6, max-w-md, mx-auto, text-left
Heading: "Try these suggestions:" (text-sm, font-semibold, text-gray-700, mb-3)
List:
"Check your spelling"
"Use different keywords"
"Try more general terms"
"Browse all symbols instead"
Primary action: [Clear Search] (bg-blue-600, text-white, px-6, py-3, rounded-lg, hover:bg-blue-700, mt-6)
Secondary action: "View all symbols" (text-blue-600, hover:underline, text-sm, mt-4)
VARIANT 5: No Billing History

Icon: 📄 (text-8xl, opacity-30)
Title: "No billing history" (text-2xl, font-bold, text-gray-500, mt-6, mb-2)
Description: "You haven't been charged yet. Invoices will appear here after your first payment." (text-gray-400, mb-8)
Info:
Card: bg-yellow-50, border-l-4 border-yellow-500, rounded-lg, p-4, max-w-lg, mx-auto
Text: "🎁 You're currently on a 7-day free trial. Your first charge will be on January 22, 2025." (text-sm, text-yellow-800)
VARIANT 6: No Triggered Alerts (Last 7 Days)

Icon: ✅ (text-8xl, opacity-30)
Title: "No alerts triggered recently" (text-2xl, font-bold, text-gray-500, mt-6, mb-2)
Description: "None of your alerts have been triggered in the last 7 days" (text-gray-400, mb-8)
Stats (optional):
"Active alerts: 3/5" (text-sm, text-gray-600)
"Watching: XAUUSD, EURUSD, BTCUSD" (text-xs, text-gray-500)
Primary action: [View Active Alerts] (bg-blue-600, text-white, px-6, py-3, rounded-lg, hover:bg-blue-700)
VARIANT 7: Connection Error / Failed to Load

Icon: ⚠️ (text-8xl, text-orange-500)
Title: "Failed to load data" (text-2xl, font-bold, text-gray-700, mt-6, mb-2)
Description: "We couldn't load this content. Please check your connection and try again." (text-gray-600, mb-8)
Primary action: [Retry] (bg-blue-600, text-white, px-8, py-3, rounded-lg, hover:bg-blue-700, with ⟳ icon)
Secondary action: "Report issue" (text-blue-600, hover:underline, text-sm, mt-4)
Error code (optional): "Error code: NET_001" (text-xs, text-gray-400, mt-6, font-mono)
VARIANT 8: Feature Coming Soon

Icon: 🚧 (text-8xl, opacity-40)
Title: "Coming Soon" (text-2xl, font-bold, text-gray-600, mt-6, mb-2)
Description: "This feature is currently under development. Check back soon!" (text-gray-500, mb-8)
Timeline badge: "Expected: Q1 2025" (bg-purple-100, text-purple-800, px-4, py-2, rounded-full, text-sm, font-semibold, inline-block, mb-6)
Notification opt-in:
Checkbox: "☐ Notify me when this feature launches" (text-sm, text-gray-700)
Button: [Subscribe to Updates] (bg-purple-600, text-white, px-6, py-2, rounded-lg, hover:bg-purple-700, mt-4)
VARIANT 9: Access Denied / Upgrade Required

Icon: 🔒 (text-8xl, text-gray-400)
Title: "PRO Feature" (text-2xl, font-bold, text-gray-700, mt-6, mb-2)
Description: "This feature is only available for PRO subscribers" (text-gray-600, mb-8)
Benefits list:
Card: bg-gradient-to-r from-blue-50 to-purple-50, rounded-xl, p-6, max-w-md, mx-auto, mb-8
Heading: "Unlock with PRO:" (text-lg, font-semibold, text-gray-900, mb-4)
List (with checkmarks):
✅ "15 Trading Symbols"
✅ "9 Timeframes (M5-D1)"
✅ "20 Active Alerts"
✅ "Priority Chart Updates"
Price: "$29/month" (text-3xl, font-bold, text-gray-900, mb-2)
Trial: "7-day free trial" (text-sm, text-green-600, font-semibold, mb-6)
Primary action: [Upgrade to PRO] (bg-blue-600, text-white, px-8, py-4, rounded-xl, text-lg, font-bold, hover:bg-blue-700, shadow-lg)
Secondary action: "Compare plans" (text-blue-600, hover:underline, text-sm, mt-4)
VARIANT 10: Maintenance Mode

Icon: 🛠️ (text-8xl, opacity-40)
Title: "Under Maintenance" (text-2xl, font-bold, text-gray-700, mt-6, mb-2)
Description: "We're performing scheduled maintenance. We'll be back shortly." (text-gray-600, mb-8)
Countdown (optional): "Estimated time: 15 minutes" (text-lg, font-mono, text-blue-600, mb-6)
Status page link: [Check Status Page] (border-2, border-gray-300, text-gray-700, px-6, py-2, rounded-lg, hover:border-blue-600, hover:text-blue-600)

3. LOADING SKELETON VARIANT (While data loads):

Instead of empty state, show skeleton:
Animated pulse effect
Gray rectangles/circles matching expected content layout
Example for watchlist:
3-5 card skeletons in grid
Each: bg-gray-200, animate-pulse, rounded-lg, h-32
Example for alerts list:
4-6 row skeletons
Each: bg-gray-200, animate-pulse, rounded-lg, h-20, mb-3

4. VISUAL POLISH:

Smooth fade-in animation when empty state appears
Icons with subtle bounce animation
Hover effects on all buttons
Proper spacing and alignment
Consistent color scheme with rest of app

5. RESPONSIVE:

Desktop: Full padding, centered content, max-w-2xl
Tablet: Reduced padding, content still centered
Mobile:
Smaller icons (text-6xl instead of text-8xl)
Smaller text (text-xl instead of text-2xl)
Full-width buttons
Stacked layouts

6. ACCESSIBILITY:

Proper heading hierarchy (h2 for title, p for description)
Buttons have clear labels
Icons have aria-label
Color contrast meets WCAG AA standards
Keyboard navigable

7. TECHNICAL:

Export base EmptyState component and all variants
TypeScript with proper types for props
Use shadcn/ui Button, Card components
Use lucide-react icons where needed (RefreshCw, Search, Bell, etc.)
Reusable and composable
Easy to customize via props

Generate complete, production-ready code with base component and all 10+ variants that I can copy and run immediately.

PROMPT 2: Pricing Page Component

=======================================================
Create a comprehensive pricing page component for a Next.js 15 app using TypeScript, Tailwind CSS, and shadcn/ui.

REQUIREMENTS:

1. PAGE HEADER:
   - Breadcrumb: "Home > Pricing" (text-sm, text-gray-500)
   - Main heading: "Choose Your Plan" (text-5xl, font-bold, gradient text, centered)
   - Subheading: "Start free, upgrade when you need more" (text-xl, text-gray-600, centered)
   - Toggle: Monthly / Yearly (with "Save 17%" badge for yearly)

2. PRICING CARDS (2 columns, centered, max-w-5xl):

   **FREE TIER CARD:**
   - Header:
     - Badge: "FREE TIER 🆓" (bg-green-500, text-white, rounded-full, px-4, py-2)
     - Price: "$0" (text-6xl, font-bold, text-gray-900)
     - Period: "/month" (text-xl, text-gray-500)
   - Features section (with checkmarks ✅):
     - "5 Symbols"
       - Small text: "BTCUSD, EURUSD, USDJPY, US30, XAUUSD"
     - "3 Timeframes"
       - Small text: "H1, H4, D1 only"
     - "5 Active Alerts"
     - "5 Watchlist Items"
     - "60 API Requests/hour"
     - "Email & Push Notifications"
   - CTA Button: "Start Free" (bg-green-600, hover:bg-green-700, w-full, py-4, text-lg)
   - Note: "No credit card required" (text-sm, text-gray-500, centered)

   **PRO TIER CARD:** (with "MOST POPULAR" ribbon)
   - Ribbon: "⭐ MOST POPULAR" (absolute, top-right, bg-blue-600, text-white, px-4, py-1, rounded-bl-lg)
   - Border: border-4 border-blue-600 (highlighted)
   - Header:
     - Badge: "PRO TIER ⭐" (bg-blue-600, text-white, rounded-full, px-4, py-2)
     - Price: "$29" (text-6xl, font-bold, text-gray-900)
     - Period: "/month" (text-xl, text-gray-500)
     - Yearly option: "$290/year (save $58!)"
   - Features section (with checkmarks ✅):
     - "15 Symbols"
       - Small text: "All major pairs + crypto + indices"
     - "9 Timeframes"
       - Small text: "M5, M15, M30, H1, H2, H4, H8, H12, D1"
     - "20 Active Alerts"
     - "50 Watchlist Items"
     - "300 API Requests/hour"
     - "All notification types (Email, Push, SMS)"
     - "Priority chart updates (30s)"
     - "Advanced analytics (Coming Soon)" (with badge: "SOON")
   - CTA Button: "Start 7-Day Trial" (bg-blue-600, hover:bg-blue-700, w-full, py-4, text-lg, pulse animation)
   - Note: "7-day free trial, then $29/month" (text-sm, text-gray-500, centered)

3. DETAILED COMPARISON TABLE (Below cards):
   - Section heading: "Detailed Feature Comparison" (text-3xl, font-bold, centered, mt-16, mb-8)
   - Table (w-full, border):

     Headers: Feature | FREE | PRO

     Rows:
     | Symbols | 5 | 15 |
     | Timeframes | 3 (H1, H4, D1) | 9 (M5-D1) |
     | Active Alerts | 5 | 20 |
     | Watchlist Items | 5 | 50 |
     | API Requests/hour | 60 | 300 |
     | Chart Updates | 60 seconds | 30 seconds |
     | Email Notifications | ✅ | ✅ |
     | Push Notifications | ✅ | ✅ |
     | SMS Notifications | ❌ | ✅ |
     | Priority Support | ❌ | ✅ |
     | Advanced Analytics | ❌ | Coming Soon |

   - Table styling: Striped rows (bg-gray-50/white), hover:bg-blue-50, text-center for values

4. FAQ SECTION (Optional):
   - Heading: "Frequently Asked Questions"
   - 3-4 common questions in accordion format

5. FINAL CTA:
   - Background: bg-blue-50, rounded-xl, p-12, text-center
   - Heading: "Ready to get started?"
   - Subheading: "Join traders using our platform"
   - Buttons: [Start Free] [Contact Sales]

6. RESPONSIVE:
   - Cards: Stack vertically on mobile, side-by-side on desktop
   - Table: Horizontal scroll on mobile
   - Toggle: Full width on mobile

7. TECHNICAL:
   - Export as default component
   - TypeScript with proper types
   - Use shadcn/ui Card, Button, Badge, Table components
   - State for monthly/yearly toggle
   - Smooth transitions and hover effects

Generate complete, production-ready code that I can copy and run immediately.

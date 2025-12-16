## **PROMPT 8: Billing & Subscription Page**

=========================================

Create a billing and subscription management page for Next.js 15 using TypeScript, Tailwind CSS, and shadcn/ui.

REQUIREMENTS:

1. PAGE HEADER:
   - Breadcrumb: "Dashboard > Settings > Billing" (text-sm, text-gray-500, mb-4)
   - Title: "💳 Billing & Subscription" (text-3xl, font-bold, mb-2)
   - Subtitle: "Manage your plan and payment methods" (text-gray-600, mb-8)

2. CURRENT PLAN CARD (Gradient Card - Top Priority):
   - Card: bg-gradient-to-r from-blue-600 to-purple-600, text-white, rounded-2xl, shadow-2xl, p-8, mb-8
   - Badge: "PRO TIER ⭐" + "✓ ACTIVE" (bg-white/20, text-white, rounded-full, px-4, py-2, inline-flex, gap-2)
   - Plan name: "Pro Plan" (text-4xl, font-bold, mt-4)
   - Price: "$29/month" (text-5xl, font-bold, mt-2)
   - Renewal date: "Renews on Feb 15, 2025" (text-xl, text-white/90, mt-2)
   - Member since: "Member since Jan 15, 2025" (text-lg, text-white/80)
   - Features grid (2 columns on desktop, 1 on mobile, mt-6):
     - ✅ 10 Symbols
     - ✅ 9 Timeframes (M5-D1)
     - ✅ 20 Alerts
     - ✅ 50 Watchlist Items
     - ✅ Email & Push Notifications
     - ✅ 300 API Requests/hour

3. PAYMENT METHOD SECTION:
   - Section heading: "💳 Payment Method" (text-2xl, font-bold, mb-6, mt-12)
   - Card: white bg, rounded-xl, shadow-lg, p-6
   - Layout: flex items-center justify-between
   - Left side:
     - Card icon: 💳 with Visa logo
     - "Visa ending in \*\*\*\*4242" (text-xl, font-semibold)
     - "Expires: 12/2026" (text-sm, text-gray-600)
   - Right side:
     - Button: "Update Card" (border-2, border-gray-300, px-4, py-2, rounded-lg, hover:border-blue-600)

4. USAGE STATISTICS:
   - Section heading: "📊 Usage This Month" (text-2xl, font-bold, mb-6, mt-12)
   - Card: white bg, rounded-xl, shadow-lg, p-8
   - Three usage items (stack vertically, gap-6):

   Item 1 - Alerts:
   - Label: "Alerts" with usage "8/20" (float right, text-2xl, font-bold)
   - Progress bar: h-4, bg-gray-200, rounded-full, fill 40% with bg-green-500
   - Text below: "40% used" (text-sm, text-gray-600)

   Item 2 - Watchlist:
   - Label: "Watchlist Items" with usage "12/50" (float right, text-2xl, font-bold)
   - Progress bar: h-4, bg-gray-200, rounded-full, fill 24% with bg-blue-500
   - Text below: "24% used" (text-sm, text-gray-600)

   Item 3 - API Calls:
   - Label: "API Calls (Peak Hour)" with usage "245/300" (float right, text-2xl, font-bold)
   - Progress bar: h-4, bg-gray-200, rounded-full, fill 82% with bg-yellow-500
   - Warning badge: "⚠️ High usage" (text-orange-600, text-xs) next to label
   - Text below: "82% used" (text-sm, text-gray-600)

5. BILLING HISTORY:
   - Section heading: "📄 Billing History" (text-2xl, font-bold, mb-6, mt-12)
   - Card: white bg, rounded-xl, shadow-lg, p-6
   - Table with columns: Date | Description | Amount | Status | Invoice
   - 3 rows of data (striped rows, hover:bg-gray-50):
     - Row 1: Feb 15, 2025 | Pro Plan - Monthly | $29.00 | Paid ✓ (green badge) | [Download PDF] (blue link)
     - Row 2: Jan 15, 2025 | Pro Plan - Monthly | $29.00 | Paid ✓ (green badge) | [Download PDF] (blue link)
     - Row 3: Dec 15, 2024 | Pro Plan - Monthly | $29.00 | Paid ✓ (green badge) | [Download PDF] (blue link)
   - Pagination below: "Page 1 of 3" with [Previous] [Next] buttons (text-sm, text-gray-600)

6. SUBSCRIPTION ACTIONS:
   - Section heading: "⚙️ Manage Subscription" (text-2xl, font-bold, mb-6, mt-12)
   - Card: white bg, rounded-xl, shadow-lg, p-6
   - Grid: 2 columns on desktop, 1 on mobile, gap-6

   Action Card 1:
   - Icon: 💰 (text-4xl, mb-3)
   - Title: "Switch to Annual" (text-lg, font-semibold, mb-2)
   - Description: "Save $58/year by switching" (text-sm, text-gray-600, mb-4)
   - Button: "Switch to Annual" (border-2, border-blue-600, text-blue-600, px-4, py-2, rounded-lg, hover:bg-blue-50, w-full)

   Action Card 2:
   - Icon: ⏸️ (text-4xl, mb-3)
   - Title: "Pause Subscription" (text-lg, font-semibold, mb-2)
   - Description: "Take a break for up to 3 months" (text-sm, text-gray-600, mb-4)
   - Button: "Pause" (border-2, border-gray-300, text-gray-700, px-4, py-2, rounded-lg, hover:border-yellow-500, w-full)

7. DOWNGRADE SECTION (Bottom):
   - Card: bg-gray-50, border-2 border-gray-300, rounded-xl, p-6, mt-12
   - Heading: "Want to downgrade?" (text-xl, font-semibold, text-gray-700, mb-2)
   - Description: "Switch to FREE tier anytime. You'll keep your data but lose PRO features." (text-sm, text-gray-600, mb-4)
   - Warning list (text-sm, text-orange-600):
     - ⚠️ Limited to 5 symbols (currently: 10)
     - ⚠️ Only 3 timeframes (currently: 9)
     - ⚠️ Only 5 alerts (currently: 20)
   - Buttons (flex, gap-3, mt-6):
     - "Keep PRO Plan" (bg-blue-600, text-white, px-6, py-3, rounded-lg, hover:bg-blue-700)
     - "Downgrade to FREE" (border-2, border-gray-300, text-gray-700, px-6, py-3, rounded-lg, hover:border-red-500, hover:text-red-600)

DESIGN NOTES:

- Use gradient card for current plan to make it stand out
- Progress bars use semantic colors: green (healthy), blue (normal), yellow/orange (warning)
- Consistent spacing: mb-12 between major sections, mb-6 for section headings
- All cards use rounded-xl and shadow-lg
- Responsive: stack grids to 1 column on mobile

TECHNICAL:

- Export as default component
- TypeScript with props: tier ('FREE' | 'PRO'), subscriptionStatus ('active' | 'trial' | 'canceled')
- Use shadcn/ui: Card, Button, Badge, Progress, Table
- Mock data included
- Make interactive (buttons should have onClick handlers with console.log)

Generate complete, production-ready code with all sections that I can copy and run immediately.

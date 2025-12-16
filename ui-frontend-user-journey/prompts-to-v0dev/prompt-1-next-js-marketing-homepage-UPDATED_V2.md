PROMPT 1: Homepage / Landing Page (WITH AFFILIATE PROGRAM)

=====================================
Create a modern Next.js 15 marketing homepage component using TypeScript, Tailwind CSS, and shadcn/ui.

REQUIREMENTS:

1. HERO SECTION (Full viewport height):
   - Large heading: "Never Miss a Trading Setup Again" (text-6xl, font-bold, gradient text blue-600 to purple-600)
   - Subheading: "Get alerts when price touches key support/resistance levels based on fractal analysis" (text-xl, text-gray-600, max-w-3xl, centered)
   - Two CTA buttons side-by-side:
     - Primary: "Get Started Free" (bg-blue-600, text-white, rounded-xl, px-8, py-4, text-lg, shadow-lg, hover:bg-blue-700)
     - Secondary: "See Pricing" (border-2, border-gray-300, text-gray-700, rounded-xl, px-8, py-4, text-lg, hover:border-blue-600)
   - Below buttons (text-center, mt-6):
     - "✨ Trusted by 10,000+ traders • 🤝 Join our affiliate program and earn" (text-sm, text-gray-600)
     - "affiliate program" is clickable link → scrolls to affiliate section
   - Background: gradient from blue-50 to white
   - Floating chart mockup image (optional: use placeholder or Icon)

2. FEATURES SECTION (3 columns, responsive):
   - Section heading: "Professional Trading Tools" (text-4xl, font-bold, centered, mb-12)
   - Three feature cards (grid grid-cols-1 md:grid-cols-3 gap-8):

     CARD 1: "📊 Real-time Fractal Analysis"
     - Icon: 📊 (text-6xl)
     - Title: "Real-time Fractal Analysis" (text-2xl, font-semibold)
     - Features list:
       - Horizontal Support/Resistance Lines
       - Diagonal Trendline Detection
       - Multi-point Validation System

     CARD 2: "🔔 Smart Alert System"
     - Icon: 🔔 (text-6xl)
     - Title: "Smart Alert System" (text-2xl, font-semibold)
     - Features list:
       - Price proximity alerts
       - Email & Push notifications
       - Customizable tolerance levels

     CARD 3: "📈 Professional Tools"
     - Icon: 📈 (text-6xl)
     - Title: "Professional Tools" (text-2xl, font-semibold)
     - Features list:
       - 15 Major trading symbols
       - 9 Timeframe options
       - Watchlist management

   - Each card: bg-white, rounded-xl, shadow-lg, p-8, hover:shadow-2xl transition

3. PRICING PREVIEW (2 columns):
   - Section heading: "Simple, Transparent Pricing" (text-4xl, font-bold, centered, mb-12)
   - Two pricing cards (grid grid-cols-1 md:grid-cols-2 gap-8, max-w-4xl, mx-auto):

     CARD 1: FREE TIER
     - Badge: "FREE TIER 🆓" (bg-green-500, text-white, rounded-full, px-4, py-1, inline-block)
     - Price: "$0/month" (text-5xl, font-bold)
     - Features:
       - 5 Symbols
       - 3 Timeframes (H1, H4, D1)
       - 5 Alerts
       - 5 Watchlist items
     - CTA: "Start Free" button

     CARD 2: PRO TIER (WITH AFFILIATE DISCOUNT OPTION)
     - Badge: "PRO TIER ⭐" (bg-blue-600, text-white, rounded-full, px-4, py-1, inline-block)
     - Discount hint banner (BEFORE price):
       - Container: bg-yellow-50, border-l-4 border-yellow-400, p-2, rounded-lg, mb-3
       - Text: "💡 Have a referral code? Get 20% off this month!" (text-sm, font-medium, text-yellow-800)
       - Link: "Apply code →" (text-yellow-600, text-xs, underline)
     - Pricing:
       - Label: "Starting at" (text-sm, text-gray-500, uppercase, font-semibold, mb-1)
       - Price: "from $23.20/month" (text-5xl, font-bold)
       - Details below: "($29/month without referral code)" (text-sm, text-gray-500)
     - Label: "Most Popular" (text-sm, text-blue-600, font-semibold, absolute badge top-right)
     - Features:
       - 15 Symbols
       - 9 Timeframes (M5-D1)
       - 20 Alerts
       - 50 Watchlist items
       - Priority updates
     - CTA: "Start 7-Day Trial" button (highlighted, bg-blue-600)
     - Secondary link below: "Have a referral code? Apply here →" (text-blue-600, text-sm, hover:underline)

4. AFFILIATE PROGRAM SECTION (NEW - Full width):
   - Background: bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50, py-16, px-4
   - Container: max-w-6xl mx-auto, text-center
   - Icon: 🤝 (text-6xl, mb-4)
   - Heading: "Become an Affiliate Partner" (text-4xl, font-bold, bg-gradient-to-r from-blue-600 to-purple-600, bg-clip-text, text-transparent, mb-4)
   - Subheading: "Earn 20% commission for every PRO subscriber you refer" (text-xl, text-gray-700, mb-6)

   Features Grid (3 columns on desktop, 1 on mobile, gap-8, mb-8):

   Column 1:
   - Icon: 💰 (text-4xl, mb-2)
   - Title: "Generous Commissions" (font-semibold, text-lg, mb-1)
   - Text: "Earn 20% of every subscription ($5.80/month per referral)" (text-sm, text-gray-600)

   Column 2:
   - Icon: 🔗 (text-4xl, mb-2)
   - Title: "Easy to Share" (font-semibold, text-lg, mb-1)
   - Text: "Get your unique referral code and share it anywhere" (text-sm, text-gray-600)

   Column 3:
   - Icon: 📊 (text-4xl, mb-2)
   - Title: "Track Performance" (font-semibold, text-lg, mb-1)
   - Text: "Real-time dashboard to monitor your earnings" (text-sm, text-gray-600)

   Stats Row (3 stats, flex justify-center gap-12, mb-8):
   - Stat 1: "500+" (text-3xl, font-bold, text-blue-600) + "Active Affiliates" (text-sm, text-gray-600)
   - Stat 2: "$50K+" (text-3xl, font-bold, text-green-600) + "Paid Out" (text-sm, text-gray-600)
   - Stat 3: "No Approval" (text-3xl, font-bold, text-purple-600) + "Required" (text-sm, text-gray-600)

   CTA Buttons (flex justify-center gap-4):
   - Primary: "Join Affiliate Program" (bg-blue-600, text-white, px-8, py-4, text-lg, rounded-xl, shadow-lg, hover:bg-blue-700)
   - Secondary: "Learn More →" (border-2, border-blue-600, text-blue-600, px-8, py-4, text-lg, rounded-xl, hover:bg-blue-50)

   Fine print (mt-6):
   - "Quick signup • No minimum sales • Monthly payouts" (text-sm, text-gray-500)

5. FOOTER (Full width):
   - Background: bg-gray-900, text-white, py-12, px-4
   - Two-column layout on desktop:

     Left column:
     - Company name: "Trading Alerts" (text-xl, font-bold)
     - Copyright: "© 2025 Trading Alerts. All rights reserved."

     Right column (2 groups, gap-8):

     Group 1 - Product:
     - Pricing
     - Features
     - FAQ

     Group 2 - Partners:
     - Affiliate Program
     - Become a Partner
     - Privacy Policy
     - Terms of Service
     - Contact

6. NAVIGATION BAR (Sticky top):
   - Logo: "📊 Trading Alerts" (text-2xl, font-bold, text-blue-600)
   - Desktop nav links: [Features] [Pricing] [Affiliates] [Login] [Sign Up]
   - "Affiliates" link: text-blue-600, font-medium, hover:underline
   - Right side: [Login] [Sign Up] buttons
   - Mobile: Hamburger menu with all links including "Become an Affiliate"

7. URL PARAMETER SUPPORT (IMPORTANT):
   - If URL contains ?ref=AFFILIATE_CODE parameter:
     - Show green banner at very top of page:
       - bg-green-500, text-white, py-3, px-4, text-center
       - Text: "🎉 Special Offer! Sign up now with code [CODE] and get 20% off your first month!"
       - Code shown in: bg-white/20, px-2, py-1, rounded, font-mono
     - Add pulsing badge to PRO card:
       - Position: absolute, top-left
       - Badge: "20% OFF FIRST MONTH" (bg-green-500, text-white, px-3, py-1, rounded-full, text-xs, font-bold, shadow-lg, animate-pulse)
     - Update pricing to show $23.20 instead of "from $23.20"

8. RESPONSIVE:
   - Hero: Stack vertically on mobile
   - Features: 1 column on mobile, 3 on desktop
   - Pricing: 1 column on mobile, 2 on desktop
   - Affiliate section: 3 columns → 1 column on mobile
   - Footer groups: Stack vertically on mobile

9. TECHNICAL:
   - Export as default component
   - TypeScript with proper types
   - Use Next.js useSearchParams to get ?ref parameter
   - Use shadcn/ui Button, Card components
   - Smooth scroll animations (optional)
   - Add hover effects and transitions

TECHNICAL IMPLEMENTATION:

```typescript
import { useSearchParams } from 'next/navigation'

export default function HomePage() {
  const searchParams = useSearchParams()
  const affiliateCode = searchParams.get('ref')

  // Pricing calculation
  const proPriceMonthly = affiliateCode ? 23.20 : 29.00

  return (
    <div className="min-h-screen flex flex-col">
      {/* Affiliate banner if code present */}
      {affiliateCode && (
        <div className="bg-green-500 text-white py-3 px-4 text-center">
          <p className="text-sm">
            🎉 <strong>Special Offer!</strong> Sign up now with code{" "}
            <code className="bg-white/20 px-2 py-1 rounded">{affiliateCode}</code>
            {" "}and get <strong>20% off your first month!</strong>
          </p>
        </div>
      )}

      {/* Navigation */}
      <nav>{/* ... */}</nav>

      {/* Hero */}
      <section>{/* ... */}</section>

      {/* Features */}
      <section>{/* ... */}</section>

      {/* Pricing with discount */}
      <section>
        {/* PRO card shows $23.20 if affiliateCode present */}
      </section>

      {/* Affiliate program section */}
      <section>{/* ... */}</section>

      {/* Footer */}
      <footer>{/* ... */}</footer>
    </div>
  )
}
```

Generate complete, production-ready code that I can copy and run immediately.

PROMPT 1: Homepage / Landing Page (WITH AFFILIATE PROGRAM)

=====================================
Create a modern Next.js 15 App Router marketing homepage using TypeScript, Tailwind CSS, and shadcn/ui components.

CRITICAL REQUIREMENTS:

- This MUST be a Client Component (use 'use client' directive at top)
- Use Next.js 15 App Router patterns
- Extract URL parameters using useSearchParams from 'next/navigation'
- All sections must have proper IDs for anchor linking
- Mobile-first responsive design

COMPONENT STRUCTURE:

'use client'

import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function HomePage() {
const searchParams = useSearchParams()
const affiliateCode = searchParams.get('ref')
const proPrice = affiliateCode ? '$23.20' : '$29'
const showDiscount = Boolean(affiliateCode)

const scrollToSection = (id: string) => {
document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

return (

<div className="min-h-screen">
{/_ Content sections _/}
</div>
)
}

SECTIONS TO BUILD:

1. AFFILIATE BANNER (conditional - only if ?ref=CODE in URL):
   - Position: Top of page, full width
   - Style: bg-green-500 text-white py-3 px-4 text-center text-sm
   - Content: "🎉 Special Offer! Sign up with code [CODE] and get 20% off PRO forever!"
   - Display CODE in: bg-white/20 px-2 py-1 rounded font-mono

2. NAVIGATION BAR (sticky top-0 z-50):
   - Background: bg-white border-b shadow-sm
   - Container: max-w-7xl mx-auto px-4 py-4
   - Layout: Flex justify-between items-center
   - Logo (left): "📊 Trading Alerts" (text-2xl font-bold text-blue-600)
   - Desktop nav (center): Features | Pricing | Affiliates | Login
   - CTAs (right): Login (text) + Sign Up (Button variant="default")
   - Make "Affiliates" link call scrollToSection('affiliate-section')
   - Mobile: Show hamburger menu icon

3. HERO SECTION (id="hero"):
   - Min height: min-h-screen
   - Background: bg-gradient-to-b from-blue-50 to-white
   - Layout: Flex flex-col items-center justify-center px-4 py-20
   - Heading: "Never Miss a Trading Setup Again"
     - Style: text-5xl md:text-6xl font-bold text-center mb-6
     - Gradient: bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent
   - Subheading: "Get alerts when price touches key support/resistance levels based on fractal analysis"
     - Style: text-xl text-gray-600 text-center max-w-3xl mb-8
   - CTA Buttons (flex gap-4):
     - "Get Started Free" - Button size="lg" className="bg-blue-600"
     - "See Pricing" - Button size="lg" variant="outline"
   - Below buttons (text-center mt-6 text-sm text-gray-600):
     - "✨ Trusted by 10,000+ traders • "
     - Clickable link: "Join our affiliate program" (onClick scrolls to #affiliate-section)

4. FEATURES SECTION (id="features"):
   - Padding: py-20 px-4
   - Background: bg-white
   - Heading: "Professional Trading Tools" (text-4xl font-bold text-center mb-12)
   - Grid: grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto

   Three Cards (each Card with className="p-8 hover:shadow-2xl transition-shadow"):

   Card 1:
   - Icon: 📊 (text-6xl mb-4)
   - Title: "Real-time Fractal Analysis" (text-2xl font-semibold mb-4)
   - List (text-gray-600 space-y-2):
     • Horizontal Support/Resistance Lines
     • Diagonal Trendline Detection
     • Multi-point Validation System

   Card 2:
   - Icon: 🔔 (text-6xl mb-4)
   - Title: "Smart Alert System" (text-2xl font-semibold mb-4)
   - List:
     • Price proximity alerts
     • Email & Push notifications
     • Customizable tolerance levels

   Card 3:
   - Icon: 📈 (text-6xl mb-4)
   - Title: "Professional Tools" (text-2xl font-semibold mb-4)
   - List:
     • 15 Major trading symbols
     • 9 Timeframe options
     • Watchlist management

5. PRICING SECTION (id="pricing"):
   - Padding: py-20 px-4
   - Background: bg-gray-50
   - Heading: "Simple, Transparent Pricing" (text-4xl font-bold text-center mb-12)
   - Grid: grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto

   FREE TIER Card:
   - Badge at top: "FREE TIER 🆓" (bg-green-500 text-white rounded-full px-4 py-1 text-sm inline-block mb-4)
   - Price: "$0" (text-5xl font-bold) + "/month" (text-gray-500)
   - Features list (mt-6 space-y-3):
     ✓ 5 Symbols
     ✓ 3 Timeframes (H1, H4, D1)
     ✓ 5 Alerts
     ✓ 5 Watchlist items
   - Button: "Start Free" (full width, variant="outline")

   PRO TIER Card (relative position for badges):
   - "Most Popular" badge (absolute -top-4 right-4, bg-blue-600 text-white px-3 py-1 rounded-full text-xs)
   - If showDiscount is true, show pulsing badge (absolute -top-4 left-4, bg-green-500 text-white px-3 py-1 rounded-full text-xs animate-pulse): "20% OFF"
   - Badge: "PRO TIER ⭐" (bg-blue-600 text-white rounded-full px-4 py-1 text-sm inline-block mb-4)
   - If showDiscount, show hint banner (bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded mb-4):
     - "💡 You're getting 20% off with your referral code!" (text-sm font-medium text-yellow-800)
   - Price section:
     - Label: "Starting at" (text-sm text-gray-500 uppercase font-semibold)
     - Price: Show {proPrice} (text-5xl font-bold)
     - If NOT showDiscount: "(Regular: $29/month)" (text-sm text-gray-500 mt-1)
   - Features list (mt-6 space-y-3):
     ✓ 15 Symbols
     ✓ 9 Timeframes (M5-D1)
     ✓ 20 Alerts
     ✓ 50 Watchlist items
     ✓ Priority updates
   - Button: "Start 7-Day Trial" (full width, bg-blue-600)
   - Link below: "Have a referral code? Apply here →" (text-sm text-blue-600 hover:underline mt-4)

6. AFFILIATE SECTION (id="affiliate-section"):
   - Background: bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50
   - Padding: py-16 px-4
   - Container: max-w-6xl mx-auto text-center
   - Icon: 🤝 (text-6xl mb-4)
   - Heading: "Become an Affiliate Partner"
     - Style: text-4xl font-bold mb-4
     - Gradient: bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent
   - Subheading: "Earn 20% commission for every PRO subscriber you refer" (text-xl text-gray-700 mb-8)

   Features Grid (grid-cols-1 md:grid-cols-3 gap-8 mb-8):

   Column 1:
   - 💰 (text-4xl mb-2)
   - "Generous Commissions" (font-semibold text-lg mb-1)
   - "Earn 20% of every subscription ($5.80/month per referral)" (text-sm text-gray-600)

   Column 2:
   - 🔗 (text-4xl mb-2)
   - "Easy to Share" (font-semibold text-lg mb-1)
   - "Get your unique referral code and share it anywhere" (text-sm text-gray-600)

   Column 3:
   - 📊 (text-4xl mb-2)
   - "Track Performance" (font-semibold text-lg mb-1)
   - "Real-time dashboard to monitor your earnings" (text-sm text-gray-600)

   Stats Row (flex flex-wrap justify-center gap-12 mb-8):
   - "500+" (text-3xl font-bold text-blue-600) + "Active Affiliates" (text-sm text-gray-600 block)
   - "$50K+" (text-3xl font-bold text-green-600) + "Paid Out" (text-sm text-gray-600 block)
   - "No Approval" (text-3xl font-bold text-purple-600) + "Required" (text-sm text-gray-600 block)

   Buttons (flex gap-4 justify-center):
   - "Join Affiliate Program" (Button size="lg" bg-blue-600)
   - "Learn More →" (Button size="lg" variant="outline")

   Fine print: "Quick signup • No minimum sales • Monthly payouts" (text-sm text-gray-500 mt-6)

7. FOOTER (bg-gray-900 text-white):
   - Padding: py-12 px-4
   - Grid: grid-cols-1 md:grid-cols-4 gap-8 max-w-6xl mx-auto

   Column 1:
   - "Trading Alerts" (text-xl font-bold mb-4)
   - "© 2025 Trading Alerts. All rights reserved." (text-sm text-gray-400)

   Column 2 - Product:
   - "Product" (font-semibold mb-3)
   - Links: Pricing, Features, FAQ (text-gray-400 hover:text-white)

   Column 3 - Partners:
   - "Partners" (font-semibold mb-3)
   - Links: Affiliate Program, Become a Partner (text-gray-400 hover:text-white)

   Column 4 - Legal:
   - "Legal" (font-semibold mb-3)
   - Links: Privacy Policy, Terms of Service, Contact (text-gray-400 hover:text-white)

RESPONSIVE BEHAVIOR:

- Mobile: Stack all sections vertically, hamburger menu
- Tablet: 2-column grids where appropriate
- Desktop: Full 3-column layouts

Generate complete, production-ready React component code with TypeScript.

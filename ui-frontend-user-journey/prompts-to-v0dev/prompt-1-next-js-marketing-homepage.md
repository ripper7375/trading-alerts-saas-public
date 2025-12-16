PROMPT 1: Homepage / Landing Page

=====================================
Create a modern Next.js 15 marketing homepage component using TypeScript, Tailwind CSS, and shadcn/ui.

REQUIREMENTS:

1. HERO SECTION (Full viewport height):
   - Large heading: "Never Miss a Trading Setup Again" (text-6xl, font-bold, gradient text blue-600 to purple-600)
   - Subheading: "Get alerts when price touches key support/resistance levels based on fractal analysis" (text-xl, text-gray-600, max-w-3xl, centered)
   - Two CTA buttons side-by-side:
     - Primary: "Get Started Free" (bg-blue-600, text-white, rounded-xl, px-8, py-4, text-lg, shadow-lg, hover:bg-blue-700)
     - Secondary: "See Pricing" (border-2, border-gray-300, text-gray-700, rounded-xl, px-8, py-4, text-lg, hover:border-blue-600)
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

     CARD 2: PRO TIER
     - Badge: "PRO TIER ⭐" (bg-blue-600, text-white, rounded-full, px-4, py-1, inline-block)
     - Price: "$29/month" (text-5xl, font-bold)
     - Label: "Most Popular" (text-sm, text-blue-600, font-semibold)
     - Features:
       - 15 Symbols
       - 9 Timeframes (M5-D1)
       - 20 Alerts
       - 50 Watchlist items
       - Priority updates
     - CTA: "Start 7-Day Trial" button (highlighted)

4. FOOTER (Full width):
   - Background: bg-gray-900, text-white
   - Company name: "Trading Alerts" (text-xl, font-bold)
   - Copyright: "© 2025 Trading Alerts. All rights reserved."
   - Links: Privacy Policy, Terms of Service, Contact

5. NAVIGATION BAR (Sticky top):
   - Logo: "📊 Trading Alerts" (text-2xl, font-bold, text-blue-600)
   - Right side: [Login] [Sign Up] buttons
   - Mobile: Hamburger menu

6. RESPONSIVE:
   - Hero: Stack vertically on mobile
   - Features: 1 column on mobile, 3 on desktop
   - Pricing: 1 column on mobile, 2 on desktop

7. TECHNICAL:
   - Export as default component
   - TypeScript with proper types
   - Use shadcn/ui Button, Card components
   - Smooth scroll animations (optional)
   - Add hover effects and transitions

Generate complete, production-ready code that I can copy and run immediately.

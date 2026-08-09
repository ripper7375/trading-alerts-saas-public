# main deployment project and complementary component

Main Project (1) - trading-conversational-ai-ui/

Purpose: Full trading interface with resizable panels

Key Features:
Chat panel + Trading chart in resizable layout
Chat sidebar with session history
Trading-focused components (trading-chart.tsx)
Complete UI component library
Missing: Advanced animations, landing page experience

Complementary Component (2) - davintrade-newchat-page-without-sizebar/

Purpose: Beautiful landing/onboarding experience

Key Features:
Animated chat interface with PulsingBorder effects
Modern app sidebar with navigation
DavinTrade branding (logo, mascot SVGs)
Framer Motion animations

Unique Dependencies:
@paper-design/shaders-react (for PulsingBorder animation)
@emotion/is-prop-valid
framer-motion (animations)
@vercel/analytics

Key Differences
Feature Project (1) Project (2)
Trading Chart ✅ Yes ❌ No
Resizable Panels ✅ Yes ❌ No
Animated Landing ❌ No ✅ Yes
PulsingBorder Effect ❌ No ✅ Yes
App Navigation Sidebar ❌ No ✅ Yes
Branding Assets Basic DavinTrade themed

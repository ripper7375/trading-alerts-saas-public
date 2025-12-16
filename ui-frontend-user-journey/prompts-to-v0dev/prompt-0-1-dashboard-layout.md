📋 TASK 1: Dashboard Layout
V0.dev Prompt (Copy This Exactly):

====================================================

Create a complete Next.js 15 App Router dashboard layout component using TypeScript, Tailwind CSS, and shadcn/ui.

REQUIREMENTS:

1. SIDEBAR NAVIGATION (Left Side, 256px width):
   - Background: white with shadow
   - Logo section at top: "📊 Trading Alerts" (bold, blue-600)
   - User tier badge below logo: "FREE TIER 🆓" (green background, small text)
   - Navigation links (with icons):
     - 🏠 Dashboard (default active: bg-blue-50, text-blue-600, font-semibold)
     - 📊 Live Charts
     - 🔔 Alerts
     - 📝 Watchlist
     - ⚙️ Settings
   - Each link: rounded-lg, px-4, py-3, hover:bg-gray-100, cursor-pointer
   - Active state: bg-blue-50, text-blue-600, border-l-4 border-blue-600

2. TOP BAR (Full width, 64px height):
   - Background: white with bottom border
   - Right side: User profile section with:
     - Avatar image (circular, 40px)
     - User name "John Trader" (font-medium)
     - Dropdown icon (▼)
   - Bell icon (notifications) next to profile
   - Make profile section clickable (dropdown menu not required, just make it look clickable)

3. MAIN CONTENT AREA:
   - Background: gray-50
   - Padding: 32px
   - flex-1 (fills remaining space)
   - Contains placeholder: "Dashboard content goes here" (large, gray text)

4. MOBILE RESPONSIVE (< 768px):
   - Sidebar collapses to hamburger menu icon (top-left)
   - Bottom navigation bar appears with 5 icons
   - Top bar stays but profile section simplifies

5. INTERACTIVITY:
   - Navigation links should be clickable (use state to track active link)
   - Clicking a nav link changes the active state visually
   - Sidebar should toggle on mobile (hamburger menu)

6. TECHNICAL REQUIREMENTS:
   - Export as default component
   - Use TypeScript with proper types
   - Use shadcn/ui components where applicable (Button, Avatar, etc.)
   - Include mock state management (useState for active nav item)
   - Fully self-contained (no external dependencies except shadcn/ui)
   - Include all necessary imports

7. VISUAL POLISH:
   - Smooth transitions (transition-colors duration-200)
   - Hover states on all interactive elements
   - Proper spacing and alignment
   - Professional appearance

EXAMPLE STATE STRUCTURE:

```typescript
const [activeNav, setActiveNav] = useState('dashboard');
const [sidebarOpen, setSidebarOpen] = useState(false); // for mobile
```

Generate complete, production-ready code that I can copy and run immediately.

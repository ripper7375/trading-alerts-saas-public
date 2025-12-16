PROMPT 16: User Profile Dropdown Menu Component

======================================================================
Create a user profile dropdown menu component for the top navigation bar in Next.js 15 using TypeScript, Tailwind CSS, and shadcn/ui.

REQUIREMENTS:

1. PROFILE TRIGGER BUTTON (Top bar):

   **Button Layout:**
   - Container: flex, items-center, gap-3, px-3, py-2, rounded-lg, hover:bg-gray-100, cursor-pointer, transition-colors
   - Active state: bg-blue-50, border-2 border-blue-500

   **Content (Left to right):**
   - Avatar:
     - Circular, w-10, h-10, border-2 border-gray-200
     - Image: User profile photo
     - Fallback: User initials (bg-blue-600, text-white, font-bold)
   - User info (Hidden on mobile):
     - Name: "John Trader" (text-sm, font-medium, text-gray-900)
     - Tier badge: "FREE 🆓" or "PRO ⭐" (text-xs, text-gray-600)
   - Dropdown icon: ▼ or ChevronDown (text-gray-500, h-4, w-4)

2. DROPDOWN MENU (Opens on click):

   **Container:**
   - Position: Absolute, top-full, right-0, mt-2
   - Size: w-80 (desktop), w-72 (mobile)
   - Card: bg-white, rounded-xl, shadow-2xl, border-2 border-gray-200
   - Z-index: z-50
   - Animation: Slide down + fade in (transform, opacity, transition-all duration-200)

3. USER INFO SECTION (Top of dropdown):

   **Layout:**
   - Background: bg-gradient-to-r from-blue-600 to-purple-600
   - Padding: p-6
   - Text: text-white

   **Content:**
   - Avatar: Larger version (w-16, h-16, border-4 border-white, shadow-lg, mx-auto, mb-3)
   - Name: "John Trader" (text-xl, font-bold, text-center, mb-1)
   - Email: "john@example.com" (text-sm, opacity-90, text-center, mb-3)
   - Tier badge:
     - FREE: "FREE TIER 🆓" (bg-white/20, px-4, py-2, rounded-full, text-center, inline-block)
     - PRO: "PRO TIER ⭐" (bg-white/20, px-4, py-2, rounded-full, text-center, inline-block)

4. TIER STATUS SECTION (For FREE users):

   **Card (Below user info):**
   - Background: bg-yellow-50, border-l-4 border-yellow-500
   - Padding: p-4, m-4

   **Content:**
   - Heading: "Upgrade to PRO" (text-sm, font-semibold, text-yellow-900, mb-2)
   - Message: "Get 15 symbols, 9 timeframes, and 20 alerts" (text-xs, text-yellow-800, mb-3)
   - Progress bar:
     - Label: "Using 4/5 alerts" (text-xs, text-yellow-800, mb-1)
     - Bar: w-full, h-2, bg-yellow-200, rounded-full
     - Fill: w-[80%], h-2, bg-yellow-600, rounded-full
   - Button: [Upgrade Now] (bg-blue-600, text-white, w-full, py-2, rounded-lg, text-sm, font-semibold, hover:bg-blue-700, mt-3)

5. TIER STATUS SECTION (For PRO users):

   **Card:**
   - Background: bg-blue-50, border-l-4 border-blue-500
   - Padding: p-4, m-4

   **Content:**
   - Heading: "PRO Tier Active ✓" (text-sm, font-semibold, text-blue-900, mb-2)
   - Status:
     - Trial: "Trial ends in 5 days" (text-xs, text-blue-800)
     - Active: "Renews on Feb 15, 2025" (text-xs, text-blue-800)
   - Usage stats:
     - "Alerts: 8/20" (text-xs, text-blue-700, mb-1)
     - "Watchlist: 12/50" (text-xs, text-blue-700)
   - Link: "Manage subscription →" (text-xs, text-blue-600, hover:underline, mt-2, cursor-pointer)

6. MENU ITEMS SECTION:

   **Divider:** border-t-2 border-gray-200, my-2

   **Menu Items (Grouped):**

   Group 1: Account
   - "👤 My Profile"
     - Icon: User icon, text-gray-600
     - Label: "My Profile" (text-sm, font-medium, text-gray-900)
     - Action: Navigate to /dashboard/settings/profile
   - "⚙️ Settings"
     - Icon: Settings icon, text-gray-600
     - Label: "Settings" (text-sm, font-medium, text-gray-900)
     - Action: Navigate to /dashboard/settings

   **Divider**

   Group 2: Billing (For PRO users or show for all)
   - "💳 Billing & Subscription"
     - Icon: CreditCard icon, text-gray-600
     - Label: "Billing & Subscription" (text-sm, font-medium, text-gray-900)
     - Badge: "PRO" (bg-blue-100, text-blue-800, text-xs, px-2, py-0.5, rounded, ml-auto)
     - Action: Navigate to /dashboard/settings/billing

   **Divider**

   Group 3: Help & Support
   - "❓ Help & Support"
     - Icon: HelpCircle icon, text-gray-600
     - Label: "Help & Support" (text-sm, font-medium, text-gray-900)
     - Action: Navigate to /dashboard/settings/help
   - "📖 Documentation"
     - Icon: Book icon, text-gray-600
     - Label: "Documentation" (text-sm, font-medium, text-gray-900)
     - External link icon: ↗ (text-xs, text-gray-400, ml-auto)
     - Action: Open https://docs.tradingalerts.com in new tab
   - "🐛 Report a Bug"
     - Icon: Bug icon, text-gray-600
     - Label: "Report a Bug" (text-sm, font-medium, text-gray-900)
     - Action: Open bug report modal or form

   **Divider**

   Group 4: Preferences
   - "🎨 Appearance"
     - Icon: Palette icon, text-gray-600
     - Label: "Appearance" (text-sm, font-medium, text-gray-900)
     - Sub-label: "Light" (text-xs, text-gray-500, ml-auto)
     - Action: Navigate to /dashboard/settings/appearance
   - "🌐 Language"
     - Icon: Globe icon, text-gray-600
     - Label: "Language" (text-sm, font-medium, text-gray-900)
     - Sub-label: "English" (text-xs, text-gray-500, ml-auto)
     - Action: Navigate to /dashboard/settings/language

   **Divider**

   Group 5: Sign Out
   - "🚪 Sign Out"
     - Icon: LogOut icon, text-red-600
     - Label: "Sign Out" (text-sm, font-medium, text-red-600)
     - Action: Confirm and sign out

7. MENU ITEM STYLING:

   **Default State:**
   - Padding: px-4, py-3
   - Layout: flex, items-center, gap-3
   - Background: transparent
   - Hover: bg-gray-100, transition-colors
   - Cursor: pointer

   **Active/Selected:**
   - Background: bg-blue-50
   - Border left: border-l-4 border-blue-600

   **Icon:**
   - Size: h-5, w-5
   - Color: text-gray-600 (or specific color for sign out)

   **Label:**
   - Font: text-sm, font-medium
   - Color: text-gray-900 (or text-red-600 for sign out)

   **Badge/Sub-label:**
   - Position: ml-auto
   - Style: text-xs, text-gray-500

8. SIGN OUT CONFIRMATION:

   **Modal (Appears when "Sign Out" clicked):**
   - Backdrop: bg-black/50, backdrop-blur
   - Modal: max-w-md, bg-white, rounded-2xl, shadow-2xl, p-8, text-center

   **Content:**
   - Icon: 🚪 or LogOut icon (text-6xl, text-gray-400)
   - Heading: "Sign Out?" (text-2xl, font-bold, text-gray-900, mb-2)
   - Message: "Are you sure you want to sign out of your account?" (text-gray-600, mb-8)

   **Buttons:**
   - [Cancel] (border-2, border-gray-300, text-gray-700, px-6, py-3, rounded-lg, hover:bg-gray-100, mr-3)
   - [Sign Out] (bg-red-600, text-white, px-6, py-3, rounded-lg, hover:bg-red-700, font-semibold)

   **Action:**
   - Call: signOut() from next-auth
   - Redirect to: /login
   - Show toast: "✓ Signed out successfully"

9. KEYBOARD SHORTCUTS (Show hints):

   **At bottom of dropdown:**
   - Card: bg-gray-50, border-t-2 border-gray-200, p-3, text-xs, text-gray-500, text-center
   - Text: "💡 Press '?' for keyboard shortcuts"

   **Shortcuts (Not in this component, but document them):**
   - Cmd/Ctrl + K: Open command palette
   - Cmd/Ctrl + /: Open help
   - Cmd/Ctrl + ,: Open settings
   - Escape: Close dropdown

10. EXTERNAL LINKS HANDLING:
    - Documentation: Opens in new tab (target="\_blank", rel="noopener noreferrer")
    - External icon: ↗ (text-xs, text-gray-400, ml-1)
    - Show external link icon for all external URLs

11. THEME SWITCHER (Quick toggle in dropdown):

    **Option 1: In menu items**
    - Add "🌓 Toggle Dark Mode" item
    - Shows current theme: "Light" or "Dark"
    - Click to toggle

    **Option 2: In user info section**
    - Small toggle switch (top-right of user info card)
    - Sun/Moon icons
    - Smooth transition when toggled

12. RESPONSIVE:
    - Desktop: w-80, full menu with all items
    - Tablet: w-72, slightly narrower
    - Mobile:
      - w-screen, max-w-[90vw]
      - Larger tap targets
      - Simplified tier card
      - Stack user info vertically

13. VISUAL POLISH:
    - Smooth animations (dropdown slide, hover effects)
    - Proper spacing between groups
    - Consistent icon sizes and colors
    - Dividers between logical groups
    - Avatar with subtle border and shadow
    - Gradient background for user info section

14. ACCESSIBILITY:
    - Button has aria-label: "User menu"
    - Dropdown has role="menu"
    - Items have role="menuitem"
    - Keyboard navigation: Arrow keys, Enter to select, Escape to close
    - Focus management: First item focused when opened
    - Screen reader friendly labels

15. CLICK OUTSIDE TO CLOSE:
    - Detect clicks outside dropdown
    - Close dropdown automatically
    - Reset focus to trigger button

16. TECHNICAL:
    - Export as default component
    - TypeScript with proper types
    - Props:
      - user: { name: string, email: string, avatar?: string, tier: 'FREE' | 'PRO' }
      - subscriptionStatus?: { type: 'trial' | 'active' | 'canceled', endsAt?: Date, renewsAt?: Date }
      - usage?: { alerts: { used: number, limit: number }, watchlist: { used: number, limit: number } }
      - onSignOut: () => void
      - onUpgrade?: () => void
    - Use shadcn/ui DropdownMenu, Avatar, Badge, Button components
    - Use lucide-react icons (User, Settings, CreditCard, HelpCircle, Book, Bug, Palette, Globe, LogOut, ExternalLink, ChevronDown)
    - Use next-auth for user session and signOut
    - Use Next.js useRouter for navigation
    - State for: dropdown open/closed, sign out modal
    - Mock user data with realistic values

Generate complete, production-ready code with all menu items, tier badges, and sign-out flow that I can copy and run immediately.

PROMPT 15: Notification Bell Dropdown Component

================================================================
Create a notification bell dropdown component for Next.js 15 using TypeScript, Tailwind CSS, and shadcn/ui.

REQUIREMENTS:

1. BELL ICON BUTTON (Top bar, always visible):

   **Button Design:**
   - Container: Relative position for badge placement
   - Icon: 🔔 or Bell from lucide-react (text-gray-700, h-6, w-6)
   - Button: bg-transparent, hover:bg-gray-100, rounded-full, p-2, transition-colors
   - Active state: bg-blue-50, border-2 border-blue-500

   **Notification Badge:**
   - Position: Absolute, top-0, right-0
   - Badge: If unread notifications > 0
     - Shape: Circular (w-5, h-5, rounded-full)
     - Background: bg-red-500
     - Text: White, text-xs, font-bold, centered
     - Count: Show number (max 9, then "9+")
     - Animation: Subtle pulse animation (animate-pulse) when new notification arrives
   - No badge: If no unread notifications

2. DROPDOWN PANEL (Opens on click):

   **Container:**
   - Position: Absolute, top-full, right-0, mt-2
   - Size: w-96 (desktop), w-screen (mobile, max-w-md)
   - Card: bg-white, rounded-xl, shadow-2xl, border-2 border-gray-200
   - Max height: max-h-[600px], overflow-hidden
   - Z-index: z-50
   - Animation: Slide down + fade in (transform, opacity, transition-all duration-200)

3. DROPDOWN HEADER:

   **Layout:**
   - Background: bg-gradient-to-r from-blue-600 to-purple-600
   - Padding: p-4
   - Text: text-white

   **Content:**
   - Heading: "Notifications" (text-xl, font-bold, mb-1)
   - Count badge: "3 unread" (text-sm, opacity-90)
   - Actions (right side):
     - Mark all as read button: "✓ Mark all read" (text-xs, bg-white/20, hover:bg-white/30, px-3, py-1, rounded-lg, cursor-pointer)

4. TABS (Filter notifications):

   **Tab Bar:**
   - Container: bg-white, border-b-2 border-gray-200, px-4
   - Layout: Flex, gap-4

   **Tabs:**
   - "All" - Show all notifications
   - "Alerts" - Only alert notifications (price triggers)
   - "System" - System messages (upgrades, changes)
   - "Unread" - Only unread notifications

   **Tab Style:**
   - Default: text-gray-600, py-3, border-b-2 border-transparent, hover:text-blue-600, cursor-pointer
   - Active: text-blue-600, border-b-2 border-blue-600, font-semibold

5. NOTIFICATIONS LIST:

   **Container:**
   - Max height: max-h-96, overflow-y-auto
   - Custom scrollbar: thin, blue thumb

   **Individual Notification Item:**

   **Layout:**
   - Container: flex, items-start, gap-4, p-4, border-b border-gray-100, cursor-pointer
   - Hover: bg-blue-50, transition-colors
   - Unread: bg-blue-50/50, border-l-4 border-blue-500
   - Read: bg-white

   **Icon (Left side):**
   - Circular container: w-10, h-10, rounded-full, flex items-center, justify-center
   - Types:
     - Alert triggered: bg-green-100, text-green-600, "✓" or CheckCircle icon
     - Alert warning: bg-orange-100, text-orange-600, "⚠️" or AlertTriangle icon
     - System message: bg-blue-100, text-blue-600, "ℹ️" or Info icon
     - Upgrade prompt: bg-purple-100, text-purple-600, "⭐" or Star icon

   **Content (Middle):**
   - Title: font-semibold, text-gray-900, text-sm, mb-1
     - Unread: Add blue dot "•" before title
   - Message: text-gray-600, text-sm, line-clamp-2 (max 2 lines)
   - Metadata: flex, gap-2, text-xs, text-gray-500, mt-2
     - Time: "5 minutes ago" (relative time)
     - Category badge: Optional (bg-gray-100, px-2, py-0.5, rounded, text-xs)

   **Action (Right side):**
   - Unread indicator: Blue dot (w-2, h-2, bg-blue-500, rounded-full)
   - Or: Menu button "⋮" (text-gray-400, hover:text-gray-600)
     - Dropdown: Mark as read/unread, Delete

6. NOTIFICATION TYPES & EXAMPLES:

**Type 1: Alert Triggered**
Icon: ✓ (green) Title: "Alert Triggered: Gold H1 Support" Message: "XAUUSD has reached $2,645.00 (B-B1 Support). Current price: $2,645.80" Time: "2 minutes ago" Category: "Alert" Action: Click to view chart

**Type 2: Price Near Target**
Icon: ⚠️ (orange) Title: "Price Approaching Target" Message: "EURUSD is $0.0012 away from your alert at $1.0850 (P-P2 Resistance)" Time: "10 minutes ago" Category: "Alert" Action: Click to view chart

**Type 3: System Update**
Icon: ℹ️ (blue) Title: "New Feature Available" Message: "Advanced chart tools are now available for PRO users. Check them out!" Time: "1 hour ago" Category: "System" Action: Click to learn more

**Type 4: Upgrade Prompt**
Icon: ⭐ (purple) Title: "Upgrade to PRO" Message: "You've used 4/5 FREE alerts. Upgrade to PRO for 20 alerts and more features." Time: "3 hours ago" Category: "Upgrade" Action: Click to see plans

**Type 5: Trial Ending**
Icon: ⏰ (yellow) Title: "Trial Ending Soon" Message: "Your 7-day PRO trial ends in 2 days. Update your payment method to continue." Time: "1 day ago" Category: "Billing" Action: Click to manage subscription

7. EMPTY STATE (No notifications):

**Content:**

- Icon: 🔔 (text-6xl, opacity-30, text-center)
- Message: "No notifications yet" (text-lg, text-gray-500, text-center, mb-2)
- Submessage: "We'll notify you about alerts and important updates" (text-sm, text-gray-400, text-center)
- Action: [Create an Alert] button (optional)

8. FOOTER (Bottom of dropdown):

**Layout:**

- Border top: border-t-2 border-gray-200
- Background: bg-gray-50
- Padding: p-4

**Content:**

- Link: "View All Notifications" (text-blue-600, hover:underline, text-center, block, font-semibold)
- Or: "Notification Settings" (text-gray-600, hover:text-blue-600, text-sm, text-center)

9. REAL-TIME UPDATES:

**New Notification Behavior:**

- Toast appears (top-right): "🔔 New notification" (bg-blue-500, text-white, rounded-lg, p-3, shadow-lg)
- Bell icon badge updates (+1 to count)
- Bell icon animates (shake or bounce)
- Sound effect (optional, if user enabled)
- If dropdown open: New item slides in at top with highlight animation

**Polling/WebSocket:**

- Poll every 30 seconds (or use WebSocket)
- Fetch new notifications from: GET /api/notifications
- Update badge and list automatically

10. NOTIFICATION ACTIONS (On click):

**Alert Notification:**

- Mark as read
- Navigate to: /dashboard/charts?symbol={symbol}&timeframe={timeframe}
- Highlight the alert on chart

**Upgrade Notification:**

- Mark as read
- Navigate to: /pricing or /dashboard/settings/billing

**System Notification:**

- Mark as read
- Navigate to: Relevant page or open modal with more info

**Generic:**

- Mark as read on click
- Close dropdown

11. CONTEXT MENU (Right-click or ⋮ menu):

**Menu Options:**

- "Mark as read" (if unread)
- "Mark as unread" (if read)
- "Delete notification"
- "Turn off alerts like this"

**Menu Style:**

- Popover: bg-white, rounded-lg, shadow-xl, border-2 border-gray-200, p-2
- Items: hover:bg-gray-100, px-3, py-2, text-sm, cursor-pointer

12. NOTIFICATION SETTINGS LINK (In dropdown footer):

**Opens Modal or Page:**

- Heading: "Notification Preferences"
- Options:
  - ☑ Browser push notifications
  - ☑ Email notifications
  - ☑ Sound effects
  - ☐ Desktop notifications (requires permission)
- Types to receive:
  - ☑ Alert triggers
  - ☑ Price warnings
  - ☑ System updates
  - ☐ Marketing messages

13. VISUAL POLISH:

- Smooth animations (dropdown slide, badge pulse, item hover)
- Loading skeleton while fetching notifications
- Infinite scroll or "Load More" button if many notifications
- Unread indicator: Blue dot or blue background
- Time formatting: "Just now", "5m ago", "2h ago", "Yesterday", "Jan 15"
- Truncate long messages with "Read more" link

14. RESPONSIVE:

- Desktop: w-96, right-aligned to bell icon
- Tablet: w-80, adjust position if near edge
- Mobile:
  - Full-width dropdown (w-screen, max-w-md)
  - Simplified layout
  - Larger tap targets
  - Swipe to mark as read/delete (optional)

15. ACCESSIBILITY:

- Button has aria-label: "Notifications"
- Badge has aria-label: "3 unread notifications"
- Dropdown has role="menu"
- Items have role="menuitem"
- Keyboard navigation: Arrow keys, Enter to select, Escape to close
- Screen reader announces new notifications

16. TECHNICAL:

- Export as default component
- TypeScript with proper types
- Props:
  - notifications: Array of notification objects
  - unreadCount: number
  - onMarkAsRead: (id: string) => void
  - onMarkAllAsRead: () => void
  - onDelete: (id: string) => void
  - onNotificationClick: (notification: Notification) => void
- Use shadcn/ui Popover, Button, Badge, ScrollArea components
- Use lucide-react icons (Bell, Check, AlertTriangle, Info, Star, MoreVertical)
- State for: dropdown open/closed, active tab, selected notification
- Mock notifications data (5-10 examples with different types)
- Real-time polling with useEffect (every 30s)
- Notification object type:
  ```typescript
  interface Notification {
    id: string;
    type: 'alert' | 'warning' | 'system' | 'upgrade' | 'billing';
    title: string;
    message: string;
    timestamp: Date;
    read: boolean;
    icon?: React.ReactNode;
    action?: {
      label: string;
      url: string;
    };
    metadata?: {
      symbol?: string;
      timeframe?: string;
      category?: string;
    };
  }
  ```

Generate complete, production-ready code with all notification types, real-time updates, and interactions that I can copy and run immediately.

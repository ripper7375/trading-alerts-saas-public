PROMPT 15: Notification Bell Dropdown Component (WITH SYSTEMCONFIG + DISCOUNT CODE REMINDERS)

================================================================
Create a notification bell dropdown component for Next.js 15 using TypeScript, Tailwind CSS, and shadcn/ui.

**CRITICAL: Use SystemConfig for Dynamic Percentages**

- DO NOT hardcode discount percentages (e.g., "20%")
- DO NOT hardcode prices (e.g., "$23.20", "$5.80")
- MUST use `useAffiliateConfig()` hook for all dynamic values
- All discount code reminder notifications MUST use dynamic percentages

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
   - "Billing" - Billing and discount code reminders (NEW)
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
     - Discount code reminder: bg-yellow-100, text-yellow-600, "🎫" or Ticket icon (NEW)

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
Icon: ✓ (green)
Title: "Alert Triggered: Gold H1 Support"
Message: "XAUUSD has reached $2,645.00 (B-B1 Support). Current price: $2,645.80"
Time: "2 minutes ago"
Category: "Alert"
Action: Click to view chart

**Type 2: Price Near Target**
Icon: ⚠️ (orange)
Title: "Price Approaching Target"
Message: "EURUSD is $0.0012 away from your alert at $1.0850 (P-P2 Resistance)"
Time: "10 minutes ago"
Category: "Alert"
Action: Click to view chart

**Type 3: System Update**
Icon: ℹ️ (blue)
Title: "New Feature Available"
Message: "Advanced chart tools are now available for PRO users. Check them out!"
Time: "1 hour ago"
Category: "System"
Action: Click to learn more

**Type 4: Upgrade Prompt**
Icon: ⭐ (purple)
Title: "Upgrade to PRO"
Message: "You've used 4/5 FREE alerts. Upgrade to PRO for 20 alerts and more features."
Time: "3 hours ago"
Category: "Upgrade"
Action: Click to see plans

**Type 5: Trial Ending**
Icon: ⏰ (yellow)
Title: "Trial Ending Soon"
Message: "Your 7-day PRO trial ends in 2 days. Update your payment method to continue."
Time: "1 day ago"
Category: "Billing"
Action: Click to manage subscription

**Type 6: Discount Code Reminder (Day -10) - NEW**
Icon: 🎫 (yellow)
Title: "💰 Save {discountPercent}% on Your Next Payment"
→ Use dynamic discountPercent from useAffiliateConfig()
Message: "Your PRO subscription renews in 10 days. Find a new affiliate code to save ${29 - calculateDiscountedPrice(29)} on your next payment!"
→ Calculate savings dynamically using calculateDiscountedPrice()
Time: "Just now"
Category: "Billing"
Action: Click to enter code in billing settings
CTA Button: "Enter Code Now" (bg-yellow-500, text-white, px-3, py-1, rounded, text-xs, mt-2)

**Type 7: Discount Code Reminder (Day -7) - NEW**
Icon: 🎫 (yellow)
Title: "⏰ 7 Days Until Renewal - Apply Your Code"
Message: "Your next payment is ${29.00} on {renewalDate}. Save {discountPercent}% (${29 - calculateDiscountedPrice(29)}) by entering an affiliate code before renewal!"
→ Use dynamic discountPercent and calculate savings
Time: "5 minutes ago"
Category: "Billing"
Action: Click to enter code in billing settings
CTA Button: "Enter Code" (bg-yellow-500, text-white, px-3, py-1, rounded, text-xs, mt-2)

**Type 8: Discount Code Reminder (Day -3) - URGENT - NEW**
Icon: 🎫 (red/orange gradient)
Title: "🚨 Final Reminder: 3 Days to Save {discountPercent}%"
→ Use dynamic discountPercent
Message: "Your renewal is in 3 days at $29.00. This is your last chance to enter a discount code and save ${29 - calculateDiscountedPrice(29)}. Find codes on social media!"
→ Calculate savings dynamically
Time: "2 hours ago"
Category: "Billing"
Priority: High (highlighted with orange/red border)
Action: Click to enter code in billing settings
CTA Button: "Enter Code NOW" (bg-red-500, text-white, px-3, py-1, rounded, text-xs, mt-2, animate-pulse)

**Type 9: Code Successfully Applied - NEW**
Icon: ✅ (green)
Title: "🎉 Discount Code Applied!"
Message: "Your code is ready for the next payment on {renewalDate}. You'll save ${29 - calculateDiscountedPrice(29)} ({discountPercent}% off)!"
→ Use dynamic values
Time: "Just now"
Category: "Billing"
Action: Click to view billing details

**Type 10: Renewal Without Code - POST REMINDER - NEW**
Icon: ℹ️ (blue)
Title: "Payment Processed: $29.00"
Message: "Your PRO subscription has renewed. Want to save {discountPercent}% next month? Find and enter a new affiliate code before your next renewal!"
→ Use dynamic discountPercent
Time: "1 hour ago"
Category: "Billing"
Action: Click to enter code for next billing

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
- Special handling for discount code reminders: Show immediately when generated

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

**Discount Code Reminder Notification (NEW):**

- Mark as read
- Navigate to: /dashboard/settings/billing (scroll to discount code input box)
- Highlight the input box with pulse animation
- Optional: Pre-focus the input field

**Generic:**

- Mark as read on click
- Close dropdown

11. CONTEXT MENU (Right-click or ⋮ menu):

**Menu Options:**

- "Mark as read" (if unread)
- "Mark as unread" (if read)
- "Delete notification"
- "Turn off alerts like this"
- "Snooze for 1 day" (for discount code reminders - NEW)

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
  - ☑ Discount code reminders (NEW)
  - ☐ Marketing messages

13. VISUAL POLISH:

- Smooth animations (dropdown slide, badge pulse, item hover)
- Loading skeleton while fetching notifications
- Infinite scroll or "Load More" button if many notifications
- Unread indicator: Blue dot or blue background
- Urgent notifications (Day -3 reminder): Orange/red border and pulse animation
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
- Urgent notifications have aria-live="assertive"

16. TECHNICAL:

- Export as default component
- TypeScript with proper types
- MUST import and use useAffiliateConfig() hook for discount-related notifications
- Props:
  - notifications: Array of notification objects
  - unreadCount: number
  - onMarkAsRead: (id: string) => void
  - onMarkAllAsRead: () => void
  - onDelete: (id: string) => void
  - onNotificationClick: (notification: Notification) => void
- Use shadcn/ui Popover, Button, Badge, ScrollArea components
- Use lucide-react icons (Bell, Check, AlertTriangle, Info, Star, Ticket, MoreVertical)
- State for: dropdown open/closed, active tab, selected notification
- Mock notifications data (10-15 examples with different types including discount reminders)
- Real-time polling with useEffect (every 30s)
- Notification object type:
  ```typescript
  interface Notification {
    id: string;
    type:
      | 'alert'
      | 'warning'
      | 'system'
      | 'upgrade'
      | 'billing'
      | 'discount_reminder';
    title: string;
    message: string;
    timestamp: Date;
    read: boolean;
    priority?: 'normal' | 'high' | 'urgent'; // NEW for Day -3 reminders
    icon?: React.ReactNode;
    action?: {
      label: string;
      url: string;
    };
    cta?: {
      // NEW for action buttons
      label: string;
      onClick: () => void;
      className?: string;
    };
    metadata?: {
      symbol?: string;
      timeframe?: string;
      category?: string;
      renewalDate?: string; // NEW for discount reminders
      daysUntilRenewal?: number; // NEW: 10, 7, or 3
    };
  }
  ```

TECHNICAL IMPLEMENTATION:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Bell, Check, AlertTriangle, Info, Star, Ticket, MoreVertical } from 'lucide-react'

interface Notification {
  id: string
  type: 'alert' | 'warning' | 'system' | 'upgrade' | 'billing' | 'discount_reminder'
  title: string
  message: string
  timestamp: Date
  read: boolean
  priority?: 'normal' | 'high' | 'urgent'
  action?: {
    label: string
    url: string
  }
  cta?: {
    label: string
    onClick: () => void
    className?: string
  }
  metadata?: {
    symbol?: string
    timeframe?: string
    category?: string
    renewalDate?: string
    daysUntilRenewal?: number
  }
}

export default function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('all')
  const [notifications, setNotifications] = useState<Notification[]>([])

  // ✅ CRITICAL: Use SystemConfig hook for dynamic percentages
  const {
    discountPercent,
    calculateDiscountedPrice,
    isLoading
  } = useAffiliateConfig()

  const basePrice = 29.00
  const discountedPrice = calculateDiscountedPrice(basePrice)
  const savings = basePrice - discountedPrice

  // Mock data with discount reminder notifications
  useEffect(() => {
    const mockNotifications: Notification[] = [
      {
        id: '1',
        type: 'discount_reminder',
        title: `💰 Save ${discountPercent}% on Your Next Payment`,
        message: `Your PRO subscription renews in 10 days. Find a new affiliate code to save $${savings.toFixed(2)} on your next payment!`,
        timestamp: new Date(Date.now() - 5 * 60000), // 5 mins ago
        read: false,
        priority: 'normal',
        action: {
          label: 'Enter Code Now',
          url: '/dashboard/settings/billing'
        },
        cta: {
          label: 'Enter Code Now',
          onClick: () => router.push('/dashboard/settings/billing'),
          className: 'bg-yellow-500 text-white px-3 py-1 rounded text-xs mt-2'
        },
        metadata: {
          category: 'Billing',
          renewalDate: 'March 15, 2025',
          daysUntilRenewal: 10
        }
      },
      {
        id: '2',
        type: 'alert',
        title: 'Alert Triggered: Gold H1 Support',
        message: 'XAUUSD has reached $2,645.00 (B-B1 Support). Current price: $2,645.80',
        timestamp: new Date(Date.now() - 2 * 60000), // 2 mins ago
        read: false,
        action: {
          label: 'View Chart',
          url: '/dashboard/charts?symbol=XAUUSD&timeframe=H1'
        },
        metadata: {
          symbol: 'XAUUSD',
          timeframe: 'H1',
          category: 'Alert'
        }
      },
      // Add more mock notifications...
    ]

    setNotifications(mockNotifications)
  }, [discountPercent, savings, router])

  const unreadCount = notifications.filter(n => !n.read).length

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    )
  }

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const handleNotificationClick = (notification: Notification) => {
    handleMarkAsRead(notification.id)
    if (notification.action) {
      router.push(notification.action.url)
      setOpen(false)
    }
  }

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'all') return true
    if (activeTab === 'unread') return !n.read
    if (activeTab === 'billing') return n.type === 'billing' || n.type === 'discount_reminder'
    return n.type === activeTab
  })

  if (isLoading) {
    return null
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative bg-transparent hover:bg-gray-100 rounded-full p-2 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-6 w-6 text-gray-700" />
          {unreadCount > 0 && (
            <span
              className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse"
              aria-label={`${unreadCount} unread notifications`}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-96 p-0 rounded-xl shadow-2xl border-2 border-gray-200"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 text-white">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold">Notifications</h3>
              <p className="text-sm opacity-90">{unreadCount} unread</p>
            </div>
            <button
              onClick={handleMarkAllAsRead}
              className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg cursor-pointer"
            >
              ✓ Mark all read
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b-2 border-gray-200 px-4 flex gap-4 overflow-x-auto">
          {['all', 'alert', 'system', 'billing', 'unread'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? 'text-blue-600 border-blue-600 font-semibold'
                  : 'text-gray-600 border-transparent hover:text-blue-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        <ScrollArea className="max-h-96">
          {filteredNotifications.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-6xl opacity-30 mb-4">🔔</div>
              <p className="text-lg text-gray-500 mb-2">No notifications yet</p>
              <p className="text-sm text-gray-400">
                We'll notify you about alerts and important updates
              </p>
            </div>
          ) : (
            filteredNotifications.map(notification => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`flex items-start gap-4 p-4 border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors ${
                  !notification.read ? 'bg-blue-50/50 border-l-4 border-blue-500' : 'bg-white'
                } ${
                  notification.priority === 'urgent' ? 'border-l-4 border-red-500 bg-red-50/30' : ''
                }`}
              >
                {/* Icon */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    notification.type === 'alert'
                      ? 'bg-green-100 text-green-600'
                      : notification.type === 'warning'
                      ? 'bg-orange-100 text-orange-600'
                      : notification.type === 'system'
                      ? 'bg-blue-100 text-blue-600'
                      : notification.type === 'upgrade'
                      ? 'bg-purple-100 text-purple-600'
                      : notification.type === 'discount_reminder'
                      ? 'bg-yellow-100 text-yellow-600'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {notification.type === 'alert' && <Check className="w-5 h-5" />}
                  {notification.type === 'warning' && <AlertTriangle className="w-5 h-5" />}
                  {notification.type === 'system' && <Info className="w-5 h-5" />}
                  {notification.type === 'upgrade' && <Star className="w-5 h-5" />}
                  {notification.type === 'discount_reminder' && <Ticket className="w-5 h-5" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 text-sm mb-1">
                    {!notification.read && <span className="text-blue-500 mr-1">•</span>}
                    {notification.title}
                  </h4>
                  <p className="text-gray-600 text-sm line-clamp-2">{notification.message}</p>

                  {/* CTA Button */}
                  {notification.cta && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        notification.cta!.onClick()
                      }}
                      className={notification.cta.className}
                    >
                      {notification.cta.label}
                    </button>
                  )}

                  {/* Metadata */}
                  <div className="flex gap-2 text-xs text-gray-500 mt-2">
                    <span>{formatTime(notification.timestamp)}</span>
                    {notification.metadata?.category && (
                      <span className="bg-gray-100 px-2 py-0.5 rounded">
                        {notification.metadata.category}
                      </span>
                    )}
                  </div>
                </div>

                {/* Unread indicator */}
                {!notification.read && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                )}
              </div>
            ))
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="border-t-2 border-gray-200 bg-gray-50 p-4 text-center">
          <a
            href="/dashboard/notifications"
            className="text-blue-600 hover:underline font-semibold block"
          >
            View All Notifications
          </a>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function formatTime(date: Date): string {
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'Yesterday'
  return date.toLocaleDateString()
}
```

**SYSTEMCONFIG INTEGRATION CHECKLIST:**

- ✅ Imported useAffiliateConfig hook
- ✅ No hardcoded "20%" or "20.0" anywhere
- ✅ No hardcoded "$23.20", "$5.80" anywhere
- ✅ Uses {discountPercent} for discount percentage displays
- ✅ Uses calculateDiscountedPrice(29) for price calculations
- ✅ All savings calculations are dynamic
- ✅ Discount code reminder notifications use dynamic values
- ✅ Added 5 new notification types for discount code reminders
- ✅ Added "Billing" tab for filtering discount/billing notifications
- ✅ Added CTA buttons with dynamic messages

Generate complete, production-ready code with all notification types including discount code reminders, real-time updates, and interactions that I can copy and run immediately.

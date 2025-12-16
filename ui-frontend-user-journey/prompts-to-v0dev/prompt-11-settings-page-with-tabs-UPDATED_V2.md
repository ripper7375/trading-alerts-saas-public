## **PROMPT 11: Settings Layout with Tabs Component (WITH AFFILIATE DISCOUNT IN BILLING TAB)**

=================================================

Create a settings page layout with tabbed navigation for Next.js 15 using TypeScript, Tailwind CSS, and shadcn/ui.

REQUIREMENTS:

1. PAGE LAYOUT (Full width dashboard layout):

Header Section:

Breadcrumb: "Dashboard > Settings" (text-sm, text-gray-500, mb-4)
Heading: "⚙️ Settings" (text-3xl, font-bold, text-gray-900, mb-2)
Subheading: "Manage your account settings and preferences" (text-gray-600, mb-8)

2. TABS NAVIGATION (Left sidebar on desktop, horizontal on mobile):

Desktop Layout (>= 1024px):

Two-column layout: Tabs (250px fixed width) + Content (flex-1)
Tabs sidebar: bg-white, rounded-xl, shadow-md, p-4, sticky top-4
Tab Items (Vertical list): Each tab button:

Layout: w-full, text-left, px-4, py-3, rounded-lg, transition-all duration-200
Default state: text-gray-700, hover:bg-gray-100
Active state: bg-blue-50, text-blue-600, border-l-4 border-blue-600, font-semibold
Icon + Label layout: flex, items-center, gap-3
Tab list:

"👤 Profile" - Personal information
"🔒 Security" - Password and authentication
"🔔 Notifications" - Email and push preferences
"💳 Billing" - Subscription and payment
"🎨 Appearance" - Theme and display settings
"🌐 Language" - Language preferences
"❓ Help & Support" - FAQs and contact
Mobile Layout (< 1024px):

Horizontal scrollable tabs: overflow-x-auto, flex, gap-2, pb-4, mb-6
Each tab: Compact button with icon + label
Active tab: bg-blue-600, text-white, rounded-lg, px-4, py-2
Inactive tabs: bg-white, border-2 border-gray-200, text-gray-700, rounded-lg, px-4, py-2

3. CONTENT AREA (Right side, flex-1):

Container: bg-white, rounded-xl, shadow-md, p-8, min-h-[600px]
Each section has its own heading and content
Smooth transitions when switching tabs

4. TAB CONTENTS (7 sections):

TAB 1: PROFILE (Default active):

Section heading: "Profile Information" (text-2xl, font-bold, mb-6)
Form with fields:
Profile photo upload: Avatar (circular, 96px) with "Change Photo" button overlay on hover
Full Name input
Email input (with "Verified ✓" badge)
Username input (with availability check)
Bio textarea (optional)
Company/Organization (optional)
Save button: "Save Changes" (bg-blue-600, px-6, py-2, rounded-lg, float right)
Cancel button: "Cancel" (border-2, border-gray-300, px-6, py-2, rounded-lg, mr-3)
TAB 2: SECURITY:

Section heading: "Security Settings" (text-2xl, font-bold, mb-6)
Change Password section:
Current password input
New password input (with strength meter)
Confirm new password input
"Update Password" button
Two-Factor Authentication section:
Status: Enabled/Disabled toggle
"Enable 2FA" button if disabled
QR code and setup instructions if enabling
Active Sessions section:
List of active sessions (device, location, last active)
"Sign out all devices" button
TAB 3: NOTIFICATIONS:

Section heading: "Notification Preferences" (text-2xl, font-bold, mb-6)
Alert Notifications section:
☑ Email notifications (toggle)
☑ Push notifications (toggle)
☐ SMS notifications (PRO only, with 🔒 icon)
Newsletter section:
☑ Trading tips & market insights
☑ Product updates
☐ Promotional offers
Frequency dropdown: "Instant" | "Daily digest" | "Weekly summary"
"Save Preferences" button
TAB 4: BILLING (ENHANCED WITH AFFILIATE DISCOUNT):

Section heading: "Billing & Subscription" (text-2xl, font-bold, mb-6)

CURRENT PLAN CARD (Enhanced):

- Card: border-2 border-blue-600, rounded-xl, p-6
- Header:
  - Badges (flex gap-2):
    - "Current Plan" (bg-blue-100, text-blue-800)
    - "🎉 20% AFFILIATE DISCOUNT" (bg-green-100, text-green-800) - CONDITIONAL
  - Plan name: "Pro Plan" (text-2xl, font-bold, mt-4)

- PRICING DISPLAY (TWO VERSIONS):

  WITHOUT discount:
  - Price: "$29/month" (text-4xl, font-bold)
  - Features list
  - Next billing: "January 15, 2025"

  WITH discount:
  - Container: flex items-baseline gap-3
  - Original price: "$29" (text-2xl, text-gray-400, line-through)
  - Discounted price: "$23.20" (text-4xl, font-bold, text-green-600)
  - Period: "/month"
  - Savings: "You save $5.80/month with referral code" (text-sm, text-green-600, mt-1)
  - Features list (same as without discount)
  - Next billing: "January 15, 2025 ($29.00 without new code, or $23.20 if you apply a new code at renewal)"

  - AFFILIATE DISCOUNT DETAILS (conditional box):
    - Container: bg-green-50, border-l-4 border-green-500, p-3, rounded-lg, mt-4
    - Icon: ℹ️
    - Heading: "Discount Applied This Month" (font-semibold, text-green-800, text-sm)
    - Details: "Applied with code: REF-ABC123XYZ" (text-green-700, text-xs, mt-1)
    - Notice: "Your code gave you 20% off this payment. Find new codes on social media monthly to keep saving!" (text-green-600, text-xs, italic, mt-1)

AFFILIATE BENEFITS CARD (NEW - conditional section):

- Position: AFTER Current Plan, BEFORE Payment Method
- Section subheading: "🎁 Your Affiliate Benefits" (text-lg, font-semibold, mb-4)
- Card: bg-gradient-to-r from-green-50 to-blue-50, rounded-xl, p-6, border-2 border-green-200
- Grid: 3 columns on desktop, 1 on mobile

  Column 1 - Total Saved:
  - Label: "Total Saved So Far" (text-sm, text-gray-600, mb-1)
  - Value: "$17.40" (text-3xl, font-bold, text-green-600)
  - Subtext: "Across 3 billing cycles" (text-xs, text-gray-500)

  Column 2 - Monthly Savings:
  - Label: "Monthly Savings" (text-sm, text-gray-600, mb-1)
  - Value: "$5.80" (text-3xl, font-bold, text-blue-600)
  - Subtext: "20% off regular price" (text-xs, text-gray-500)

  Column 3 - Your Code:
  - Label: "Code Used This Month" (text-sm, text-gray-600, mb-1)
  - Code: "REF-ABC123XYZ" (bg-white, px-3, py-2, rounded-lg, font-mono, text-sm, border border-gray-300)
  - Copy button icon next to code
  - Subtext: "Find new codes on social media for next month's discount" (text-xs, text-gray-500, mt-1)

PAYMENT METHOD:

- Card with payment details (same as original)

USAGE STATISTICS:

- API Calls: 8,456 / 10,000 (progress bar)
- Alerts Sent: 234 / Unlimited (progress bar)

BILLING HISTORY TABLE (Enhanced):

- Table with discount amounts if applicable

WITHOUT discount:
| Dec 15, 2024 | Pro Plan | $29.00 | Paid | Download |
| Nov 15, 2024 | Pro Plan | $29.00 | Paid | Download |

WITH discount:
| Dec 15, 2024 | Pro Plan (20% off) ℹ️ | $23.20 | Paid | Download |
| Nov 15, 2024 | Pro Plan (20% off) ℹ️ | $23.20 | Paid | Download |

- Info icon tooltip: "Original: $29.00 | Discount: -$5.80 | Paid: $23.20"

"Manage Subscription" button → links to full billing page

TAB 5: APPEARANCE:

Section heading: "Appearance Settings" (text-2xl, font-bold, mb-6)
Theme selector:
Three cards: Light | Dark | System (auto)
Each card: Preview image + radio button
Active: border-2 border-blue-600, bg-blue-50
Color scheme selector (optional):
Color swatches: Blue (default) | Purple | Green | Orange
Chart preferences:
Candlestick colors (customize)
Grid line opacity slider
"Apply Changes" button
TAB 6: LANGUAGE:

Section heading: "Language & Region" (text-2xl, font-bold, mb-6)
Language dropdown:
🇺🇸 English (US)
🇬🇧 English (UK)
🇪🇸 Español
🇫🇷 Français
🇩🇪 Deutsch
🇯🇵 日本語
Timezone dropdown (auto-detected)
Date format selector: MM/DD/YYYY | DD/MM/YYYY | YYYY-MM-DD
Time format: 12-hour | 24-hour
Currency display: USD | EUR | GBP | JPY
"Save Settings" button
TAB 7: HELP & SUPPORT:

Section heading: "Help & Support" (text-2xl, font-bold, mb-6)
Quick links section:
"📖 Documentation" → External link
"💬 Live Chat" → Opens chat widget
"📧 Email Support" → Opens email form
"🐛 Report a Bug" → Bug report form
FAQ section (Accordion):
"How do I upgrade to PRO?"
"How do alerts work?"
"Can I change my email?"
"How do I cancel my subscription?"
Contact form:
Subject dropdown
Message textarea
"Send Message" button

5. COMMON ELEMENTS (All tabs):

Unsaved Changes Warning:

When user modifies any field and tries to switch tabs:
Modal: "You have unsaved changes. Do you want to save them before leaving?"
Buttons: [Save & Continue] [Discard Changes] [Cancel]
Save Success Toast:

Appears top-right after saving: bg-green-500, text-white, rounded-lg, p-4, shadow-lg
Message: "✓ Settings saved successfully"
Auto-dismiss after 3 seconds
Error Toast:

Appears top-right on error: bg-red-500, text-white, rounded-lg, p-4, shadow-lg
Message: "⚠️ Failed to save settings. Please try again."

6. NAVIGATION STATE MANAGEMENT:

Use URL query params to track active tab: /settings?tab=profile
Browser back/forward buttons work correctly
Deep linking support: /settings?tab=billing directly opens billing tab
Default to "profile" tab if no query param

7. RESPONSIVE DESIGN:

Desktop (>= 1024px):

Two-column layout (tabs + content)
Fixed width sidebar
Content area takes remaining space
Tablet (768px - 1023px):

Tabs collapse to horizontal scrollable bar at top
Content takes full width below
Mobile (< 768px):

Compact horizontal tabs with icons only (labels on active tab)
Full-width content
Form inputs stack vertically
Buttons full width
Affiliate benefits grid: 3 columns → 1 column

8. VISUAL POLISH:

Smooth tab transitions (fade in/out)
Loading states for API calls
Skeleton loaders while fetching data
Hover effects on all interactive elements
Focus states for keyboard navigation
Proper spacing and alignment

9. ACCESSIBILITY:

Keyboard navigation between tabs (arrow keys)
Focus management when switching tabs
ARIA labels for tabs and panels
Screen reader friendly
Proper heading hierarchy

10. TECHNICAL:

Export as default component
TypeScript with proper types
Props: initialTab (string, optional, default: 'profile'), affiliateDiscount (optional)
Use Next.js useSearchParams for URL state
Use Next.js useRouter for navigation
Use shadcn/ui Tabs, Button, Input, Select, Switch, Textarea components
Use lucide-react icons
State management for: activeTab, formData, unsavedChanges
Mock save functions for each section

TECHNICAL IMPLEMENTATION:

```typescript
'use client'

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

type TabType = "profile" | "security" | "notifications" | "billing" | "appearance" | "language" | "help"

interface AffiliateDiscount {
  active: boolean
  code: string
  discountPercent: number
  monthlySavings: number
  totalSaved: number
  cyclesSaved: number
}

interface SettingsPageProps {
  initialTab?: TabType
  affiliateDiscount?: AffiliateDiscount | null
}

export default function SettingsPage({
  initialTab = "profile",
  affiliateDiscount = null
}: SettingsPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabType>(initialTab)

  // Billing data
  const hasDiscount = affiliateDiscount?.active || false
  const basePrice = 29.00
  const currentPrice = hasDiscount ? basePrice * (1 - affiliateDiscount!.discountPercent / 100) : basePrice

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        {/* ... */}

        {/* Layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Sidebar - Tabs */}
          {/* ... */}

          {/* Content Area */}
          <div className="flex-1">
            <div className="bg-white rounded-xl shadow-md p-6 md:p-8 min-h-[600px]">
              {/* Profile Tab */}
              {activeTab === "profile" && (
                <div>{/* ... profile form ... */}</div>
              )}

              {/* Security Tab */}
              {activeTab === "security" && (
                <div>{/* ... security settings ... */}</div>
              )}

              {/* Notifications Tab */}
              {activeTab === "notifications" && (
                <div>{/* ... notification preferences ... */}</div>
              )}

              {/* Billing Tab - ENHANCED */}
              {activeTab === "billing" && (
                <div className="animate-fade-in">
                  <h2 className="text-2xl font-bold mb-6">Billing & Subscription</h2>

                  {/* Current Plan Card */}
                  <Card className="border-2 border-blue-600 rounded-xl p-6 mb-6">
                    <div className="flex gap-2 mb-4">
                      <Badge className="bg-blue-100 text-blue-800">Current Plan</Badge>
                      {hasDiscount && (
                        <Badge className="bg-green-100 text-green-800">
                          🎉 20% AFFILIATE DISCOUNT
                        </Badge>
                      )}
                    </div>

                    <h3 className="text-2xl font-bold mt-4">Pro Plan</h3>

                    {/* Pricing */}
                    <div className="flex items-baseline gap-3 mt-2">
                      {hasDiscount && (
                        <span className="text-2xl text-gray-400 line-through">$29</span>
                      )}
                      <span className={`text-4xl font-bold ${hasDiscount ? "text-green-600" : ""}`}>
                        ${currentPrice.toFixed(2)}
                      </span>
                      <span className="text-gray-600">/month</span>
                    </div>

                    {hasDiscount && (
                      <p className="text-sm text-green-600 mt-1">
                        You save ${affiliateDiscount!.monthlySavings}/month with referral code
                      </p>
                    )}

                    {/* Features */}
                    <ul className="space-y-2 mt-4">
                      <li className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        Unlimited alerts
                      </li>
                      {/* ... more features ... */}
                    </ul>

                    <p className="text-sm text-gray-600 mt-4">
                      Next billing date: January 15, 2025
                      {hasDiscount && ` ($${basePrice.toFixed(2)} without new code, or $${currentPrice.toFixed(2)} if you apply a new code at renewal)`}
                    </p>

                    {/* Affiliate discount details */}
                    {hasDiscount && (
                      <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded-lg mt-4">
                        <div className="flex items-start gap-2">
                          <span>ℹ️</span>
                          <div>
                            <p className="font-semibold text-green-800 text-sm">Discount Applied This Month</p>
                            <p className="text-green-700 text-xs mt-1">
                              Applied with code: {affiliateDiscount!.code}
                            </p>
                            <p className="text-green-600 text-xs italic mt-1">
                              Your code gave you 20% off this payment. Find new codes on social media monthly to keep saving!
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>

                  {/* Affiliate Benefits Section */}
                  {hasDiscount && (
                    <section className="mb-6">
                      <h3 className="text-lg font-semibold mb-4">🎁 Your Affiliate Benefits</h3>
                      <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {/* Stat 1 */}
                          <div>
                            <p className="text-sm text-gray-600 mb-1">Total Saved So Far</p>
                            <p className="text-3xl font-bold text-green-600">
                              ${affiliateDiscount!.totalSaved}
                            </p>
                            <p className="text-xs text-gray-500">
                              Across {affiliateDiscount!.cyclesSaved} billing cycles
                            </p>
                          </div>

                          {/* Stat 2 */}
                          <div>
                            <p className="text-sm text-gray-600 mb-1">Monthly Savings</p>
                            <p className="text-3xl font-bold text-blue-600">
                              ${affiliateDiscount!.monthlySavings}
                            </p>
                            <p className="text-xs text-gray-500">20% off regular price</p>
                          </div>

                          {/* Stat 3 */}
                          <div>
                            <p className="text-sm text-gray-600 mb-1">Code Used This Month</p>
                            <div className="bg-white px-3 py-2 rounded-lg font-mono text-sm border border-gray-300">
                              {affiliateDiscount!.code}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Find new codes on social media for next month's discount</p>
                          </div>
                        </div>
                      </Card>
                    </section>
                  )}

                  {/* Payment Method */}
                  {/* ... */}

                  {/* Usage Statistics */}
                  {/* ... */}

                  {/* Billing History */}
                  {/* ... */}

                  <Button className="bg-blue-600 hover:bg-blue-700 mt-6">Manage Subscription</Button>
                </div>
              )}

              {/* Appearance Tab */}
              {activeTab === "appearance" && (
                <div>{/* ... appearance settings ... */}</div>
              )}

              {/* Language Tab */}
              {activeTab === "language" && (
                <div>{/* ... language settings ... */}</div>
              )}

              {/* Help Tab */}
              {activeTab === "help" && (
                <div>{/* ... help content ... */}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

Generate complete, production-ready code with all 7 tabs, navigation logic, responsive layout, and affiliate discount support in the billing tab that I can copy and run immediately.

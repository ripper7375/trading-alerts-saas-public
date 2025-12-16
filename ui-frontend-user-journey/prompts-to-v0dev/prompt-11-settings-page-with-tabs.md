## **PROMPT 11: Settings Layout with Tabs Component**

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
TAB 4: BILLING:

Section heading: "Billing & Subscription" (text-2xl, font-bold, mb-6)
Current plan card (similar to billing page prompt #8)
Payment method section
Usage statistics
Billing history table
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
Props: initialTab (string, optional, default: 'profile')
Use Next.js useSearchParams for URL state
Use Next.js useRouter for navigation
Use shadcn/ui Tabs, Button, Input, Select, Switch, Textarea components
Use lucide-react icons
State management for: activeTab, formData, unsavedChanges
Mock save functions for each section

Generate complete, production-ready code with all 7 tabs, navigation logic, and responsive layout that I can copy and run immediately.

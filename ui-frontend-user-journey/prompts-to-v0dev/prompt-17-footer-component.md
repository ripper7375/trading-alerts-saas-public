PROMPT 17: Footer Component (Marketing)

==========================================================
Create a comprehensive footer component for marketing pages in Next.js 15 using TypeScript, Tailwind CSS, and shadcn/ui.

REQUIREMENTS:

1. FOOTER STRUCTURE (4 main sections):
   - Top section: Logo + description + social links
   - Middle section: Link columns (4 columns)
   - Newsletter section: Email subscription
   - Bottom section: Copyright + legal links

2. LAYOUT:

   **Container:**
   - Background: bg-gray-900 (dark theme)
   - Text: text-white
   - Padding: py-16, px-6 (desktop), py-12, px-4 (mobile)
   - Full width: w-full

   **Inner Container:**
   - Max width: max-w-7xl, mx-auto
   - Responsive grid for sections

3. TOP SECTION (Logo + Description + Social):

   **Layout (Grid 2 columns on desktop, 1 on mobile):**

   **Left Column:**
   - Logo section:
     - Logo: "📊" or custom logo image (text-4xl or h-12)
     - Company name: "Trading Alerts" (text-2xl, font-bold, text-white, ml-3)
     - Layout: flex, items-center, mb-4
   - Description/Tagline:
     - Text: "Never miss a trading setup again. Get real-time alerts when price reaches key support and resistance levels." (text-gray-400, text-sm, mb-6, max-w-md)
   - Social Links:
     - Heading: "Follow Us" (text-sm, font-semibold, text-gray-300, mb-3)
     - Icons: Horizontal flex, gap-4
       - Twitter/X: 🐦 or X icon (hover:text-blue-400)
       - LinkedIn: 💼 or LinkedIn icon (hover:text-blue-500)
       - GitHub: 🐙 or GitHub icon (hover:text-gray-400)
       - YouTube: 📺 or YouTube icon (hover:text-red-500)
       - Discord: 💬 or Discord icon (hover:text-indigo-400)
     - Each icon:
       - Container: w-10, h-10, rounded-lg, bg-gray-800, flex items-center, justify-center
       - Hover: bg-gray-700, transform scale-110, transition-all
       - Icon size: h-5, w-5, text-gray-400

4. MIDDLE SECTION (Link Columns):

   **Grid Layout:**
   - Desktop: grid grid-cols-4 gap-8
   - Tablet: grid-cols-2
   - Mobile: grid-cols-1

   **Column 1: Product**
   - Heading: "Product" (text-white, font-semibold, text-sm, uppercase, tracking-wide, mb-4)
   - Links:
     - "Features" → /features
     - "Pricing" → /pricing
     - "How It Works" → /how-it-works
     - "Integrations" → /integrations
     - "API Documentation" → /docs/api
     - "What's New" → /changelog

   **Column 2: Company**
   - Heading: "Company" (same style)
   - Links:
     - "About Us" → /about
     - "Careers" → /careers
     - "Blog" → /blog
     - "Press Kit" → /press
     - "Contact" → /contact
     - "Partners" → /partners

   **Column 3: Resources**
   - Heading: "Resources" (same style)
   - Links:
     - "Help Center" → /help
     - "Documentation" → /docs
     - "Trading Guide" → /guide
     - "Video Tutorials" → /tutorials
     - "Community Forum" → /community
     - "Status Page" → https://status.tradingalerts.com (external)

   **Column 4: Legal**
   - Heading: "Legal" (same style)
   - Links:
     - "Privacy Policy" → /privacy
     - "Terms of Service" → /terms
     - "Cookie Policy" → /cookies
     - "Acceptable Use" → /acceptable-use
     - "Refund Policy" → /refunds
     - "Security" → /security

   **Link Styling:**
   - Default: text-gray-400, text-sm, mb-3, cursor-pointer
   - Hover: text-white, underline, transition-colors
   - Layout: Block, mb-3

5. NEWSLETTER SECTION:

   **Container:**
   - Background: bg-gray-800
   - Border: border-2 border-gray-700
   - Rounded: rounded-xl
   - Padding: p-8
   - Margin: mt-12, mb-8

   **Content:**
   - Heading: "Stay Updated" (text-2xl, font-bold, text-white, mb-2)
   - Description: "Get the latest trading insights, product updates, and exclusive tips delivered to your inbox." (text-gray-400, text-sm, mb-6)

   **Form:**
   - Layout: flex, gap-3 (horizontal on desktop, vertical on mobile)
   - Email input:
     - Placeholder: "Enter your email"
     - Style: flex-1, bg-gray-900, border-2 border-gray-700, text-white, px-4, py-3, rounded-lg
     - Focus: border-blue-500, ring-2 ring-blue-500/50
   - Submit button:
     - Label: "Subscribe" or "→"
     - Style: bg-blue-600, hover:bg-blue-700, text-white, px-8, py-3, rounded-lg, font-semibold, transition-colors
     - Loading state: Spinner + "Subscribing..."

   **Privacy Note:**
   - Text: "We respect your privacy. Unsubscribe at any time." (text-xs, text-gray-500, mt-3)

   **Success State (After subscribe):**
   - Replace form with:
     - Icon: ✅ (text-4xl, text-green-500)
     - Message: "Thanks for subscribing!" (text-lg, font-semibold, text-white)
     - Submessage: "Check your email to confirm your subscription." (text-sm, text-gray-400)

6. BOTTOM SECTION (Copyright + Legal):

   **Layout:**
   - Border top: border-t border-gray-800, mt-12, pt-8
   - Flex: justify-between, items-center (wrap on mobile)

   **Left Side: Copyright**
   - Text: "© 2025 Trading Alerts. All rights reserved." (text-sm, text-gray-400)
   - Optional: "Made with ❤️ for traders worldwide" (text-xs, text-gray-500, mt-1)

   **Right Side: Quick Legal Links**
   - Links: Horizontal, gap-6
     - "Privacy" → /privacy
     - "Terms" → /terms
     - "Cookies" → /cookies
     - "Sitemap" → /sitemap
   - Separator: "·" between links
   - Style: text-sm, text-gray-400, hover:text-white

   **Mobile:**
   - Stack vertically
   - Copyright on top, links below
   - Center alignment

7. ADDITIONAL FEATURES:

   **Trust Badges (Optional, in bottom or top section):**
   - Container: flex, gap-4, items-center, mt-6
   - Badges:
     - "🔒 256-bit SSL" (text-xs, text-gray-500)
     - "✓ GDPR Compliant" (text-xs, text-gray-500)
     - "💳 Stripe Secured" (text-xs, text-gray-500)

   **Language Selector (Optional, in bottom section):**
   - Dropdown:
     - Trigger: "🌐 English (US)" (text-sm, text-gray-400, cursor-pointer)
     - Options: English, Español, Français, Deutsch, 日本語
     - Style: bg-gray-800, rounded-lg, shadow-xl

8. RESPONSIVE BREAKPOINTS:

   **Desktop (>= 1024px):**
   - 4-column grid for links
   - Horizontal newsletter form
   - All content side-by-side

   **Tablet (768px - 1023px):**
   - 2-column grid for links
   - Narrower newsletter section
   - Adjusted spacing

   **Mobile (< 768px):**
   - Single column for all sections
   - Stacked layout
   - Full-width newsletter form
   - Vertical button placement
   - Larger tap targets

9. VISUAL POLISH:
   - Smooth hover transitions on all links
   - Subtle hover effects on social icons
   - Proper spacing between sections
   - Consistent typography
   - Dark theme with good contrast
   - Icons with appropriate colors

10. ACCESSIBILITY:
    - All links have descriptive text
    - Social icons have aria-labels
    - Form has proper labels (even if visually hidden)
    - Keyboard navigable
    - Focus states visible
    - Color contrast meets WCAG AA

11. SEO CONSIDERATIONS:
    - Proper semantic HTML (footer, nav, section tags)
    - Links to important pages (help with site structure)
    - Schema.org markup for organization
    - Sitemap link

12. EXTERNAL LINKS:
    - Status page, documentation (external)
    - Add rel="noopener noreferrer" for security
    - Add external link icon (↗) where appropriate
    - Open in new tab (target="\_blank")

13. NEWSLETTER VALIDATION:
    - Email format validation
    - Show error if invalid: "Please enter a valid email address"
    - Prevent duplicate submissions
    - Show loading state while submitting
    - Success/error feedback

14. MOBILE OPTIMIZATIONS:
    - Accordion-style link groups (optional, collapse by default)
    - Sticky "Back to Top" button (optional)
    - Simplified social links (fewer icons)
    - Touch-friendly spacing

15. TECHNICAL:
    - Export as default component
    - TypeScript with proper types
    - Props:
      - variant?: 'marketing' | 'app' (different layouts for different contexts)
      - showNewsletter?: boolean (optional, default true)
      - showSocial?: boolean (optional, default true)
    - Use shadcn/ui Button, Input components
    - Use lucide-react icons (Twitter, Linkedin, Github, Youtube, MessageCircle/Discord, ExternalLink)
    - Use Next.js Link component for internal navigation
    - Form handling with React Hook Form + Zod (optional)
    - Mock newsletter subscription API call
    - Constants for link groups (easy to maintain)

Generate complete, production-ready code with all sections, responsive layout, and newsletter subscription that I can copy and run immediately.

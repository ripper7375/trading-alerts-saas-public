PART 18 - PROMPT 3: Subscription Renewal Reminder Email Preview

=======================================================
Create an email template preview for dLocal subscription renewal reminder using **React Email, Tailwind CSS, and modern email design**.

**Note:** This is an email template preview component, not a full Next.js page. It simulates how the email will look in an email client.

---

## REQUIREMENTS:

### 1. EMAIL CONTAINER:
- Max-width: 600px
- Background: white
- Border: 1px solid gray-200
- Box shadow: subtle
- Padding: 0 (content has padding)
- Font: system sans-serif

### 2. HEADER SECTION:
- Background: gradient from blue-600 to purple-600
- Padding: 40px 32px
- Logo: "Trading Alerts SaaS" (centered, white text, text-2xl)
- OR: Logo image if available

### 3. HERO SECTION:
- Padding: 40px 32px
- Icon: ⏰ Clock emoji (text-6xl, centered, mb-4)
- Headline: "Your PRO Subscription Expires Soon" (text-3xl, font-bold, text-gray-900, centered, mb-4)
- Subheadline: "Renew now to keep your PRO features" (text-xl, text-gray-600, centered)

### 4. EXPIRY NOTICE (Card):
- Container: border-2 border-yellow-400, bg-yellow-50, rounded-lg, padding 24px, mb-6
- Row 1: "Expiry Date: December 5, 2024" (text-lg, font-semibold, text-gray-900)
- Row 2: "Days Remaining: 3 days" (text-lg, text-gray-700)
- Badge: "3 Days Left" (bg-yellow-500, text-white, rounded-full, px-4, py-2, text-lg, font-bold)

### 5. SUBSCRIPTION DETAILS (Table):
- Container: bg-gray-50, rounded-lg, padding 24px, mb-6
- Table rows (key-value pairs):
  * Current Plan: "PRO Monthly"
  * Price: "$29.00 (₹2,407 INR)" - show both USD and local currency
  * Payment Method: "UPI (dLocal)"
  * Next Renewal: "Manual renewal required"
- Styling: text-sm, gray-700

### 6. FEATURES REMINDER:
- Heading: "What You'll Lose Without PRO:" (text-xl, font-bold, text-gray-900, mb-4)
- List with X icons (red):
  * ✗ Access to 15 symbols (downgrade to 5)
  * ✗ Access to 9 timeframes (downgrade to 3)
  * ✗ 20 alerts capacity (downgrade to 5)
  * ✗ Priority support
- Icons: red color
- Text: text-gray-700, text-base

### 7. CTA BUTTON:
- Large button: "Renew Subscription Now" (width: 100%, max-width: 400px, centered)
- Background: gradient from blue-600 to purple-600
- Text: white, font-bold, text-xl
- Padding: py-4, px-8
- Rounded: rounded-lg
- Link: https://tradingalerts.com/checkout

### 8. ALTERNATIVE ACTION:
- Text: "Or switch to Stripe Auto-Renewal" (text-center, text-blue-600, underline, text-base, mt-4)
- Link: https://tradingalerts.com/settings/billing

### 9. FOOTER SECTION:
- Background: bg-gray-50
- Padding: 32px
- Border-top: 1px solid gray-200

**Payment Note:**
- Icon: ⚠️ Warning emoji
- Text: "dLocal payments require manual renewal (no auto-billing)" (text-sm, text-gray-600, mb-4)

**Support Link:**
- Text: "Need help? Contact Support" (text-sm, text-blue-600, underline, mb-4)

**Unsubscribe:**
- Text: "Unsubscribe from renewal reminders" (text-xs, text-gray-500, underline)

**Company Info:**
- Text: "Trading Alerts SaaS Inc." (text-xs, text-gray-500)
- Address: "123 Trading Street, New York, NY 10001" (text-xs, text-gray-500)

**Social Media Icons:**
- Twitter, Facebook, LinkedIn icons (inline, gray-600)

### 10. EMAIL-SAFE STYLING:
- Use inline styles (no CSS classes in actual email)
- Use table-based layout for email clients
- Avoid flexbox/grid in actual email version
- Use safe web fonts (Arial, Helvetica, sans-serif)
- Use HEX colors, not Tailwind classes

### 11. RESPONSIVE:
- Mobile-friendly (single column)
- Images scale properly
- Text readable on small screens
- Buttons tap-friendly (min 44px height)

---

## TECHNICAL IMPLEMENTATION:

```tsx
import { Html, Head, Body, Container, Section, Heading, Text, Button, Hr, Link } from '@react-email/components'

export default function RenewalReminderEmail() {
  const expiryDate = 'December 5, 2024'
  const daysRemaining = 3
  const price = '$29.00 (₹2,407 INR)'
  const paymentMethod = 'UPI (dLocal)'

  return (
    <Html>
      <Head />
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {/* Header */}
          <Section style={headerStyle}>
            <Heading style={logoStyle}>Trading Alerts SaaS</Heading>
          </Section>

          {/* Hero */}
          <Section style={heroStyle}>
            <Text style={iconStyle}>⏰</Text>
            <Heading style={headlineStyle}>Your PRO Subscription Expires Soon</Heading>
            <Text style={subheadlineStyle}>Renew now to keep your PRO features</Text>
          </Section>

          {/* Expiry Notice */}
          <Section style={noticeStyle}>
            <Text style={noticeTextStyle}>Expiry Date: {expiryDate}</Text>
            <Text style={noticeTextStyle}>Days Remaining: {daysRemaining} days</Text>
            <Button style={badgeStyle}>{daysRemaining} Days Left</Button>
          </Section>

          {/* Subscription Details */}
          <Section style={detailsStyle}>
            <Text style={detailRowStyle}><strong>Current Plan:</strong> PRO Monthly</Text>
            <Text style={detailRowStyle}><strong>Price:</strong> {price}</Text>
            <Text style={detailRowStyle}><strong>Payment Method:</strong> {paymentMethod}</Text>
            <Text style={detailRowStyle}><strong>Next Renewal:</strong> Manual renewal required</Text>
          </Section>

          {/* Features Reminder */}
          <Section style={featuresStyle}>
            <Heading style={featuresHeadingStyle}>What You'll Lose Without PRO:</Heading>
            <Text style={featureItemStyle}>✗ Access to 15 symbols (downgrade to 5)</Text>
            <Text style={featureItemStyle}>✗ Access to 9 timeframes (downgrade to 3)</Text>
            <Text style={featureItemStyle}>✗ 20 alerts capacity (downgrade to 5)</Text>
            <Text style={featureItemStyle}>✗ Priority support</Text>
          </Section>

          {/* CTA Button */}
          <Section style={ctaStyle}>
            <Button style={buttonStyle} href="https://tradingalerts.com/checkout">
              Renew Subscription Now
            </Button>
            <Link href="https://tradingalerts.com/settings/billing" style={linkStyle}>
              Or switch to Stripe Auto-Renewal
            </Link>
          </Section>

          <Hr style={hrStyle} />

          {/* Footer */}
          <Section style={footerStyle}>
            <Text style={warningStyle}>⚠️ dLocal payments require manual renewal (no auto-billing)</Text>
            <Link href="mailto:support@tradingalerts.com" style={supportStyle}>
              Need help? Contact Support
            </Link>
            <Text style={unsubscribeStyle}>
              <Link href="https://tradingalerts.com/unsubscribe">Unsubscribe from renewal reminders</Link>
            </Text>
            <Text style={companyStyle}>Trading Alerts SaaS Inc.</Text>
            <Text style={addressStyle}>123 Trading Street, New York, NY 10001</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// Inline styles (email-safe)
const bodyStyle = { backgroundColor: '#f9fafb', fontFamily: 'Arial, Helvetica, sans-serif' }
const containerStyle = { maxWidth: '600px', margin: '0 auto', backgroundColor: '#ffffff', border: '1px solid #e5e7eb' }
const headerStyle = { background: 'linear-gradient(135deg, #2563eb 0%, #9333ea 100%)', padding: '40px 32px', textAlign: 'center' as const }
const logoStyle = { color: '#ffffff', fontSize: '24px', margin: '0' }
// ... more styles
```

---

## CHECKLIST:
- ✅ Email-safe HTML structure
- ✅ Inline styles (no external CSS)
- ✅ Responsive design
- ✅ Clear expiry warning
- ✅ CTA button prominent
- ✅ Subscription details shown
- ✅ Features reminder list
- ✅ Footer with unsubscribe
- ✅ Mobile-friendly

Generate complete, production-ready email template code that I can use with React Email.

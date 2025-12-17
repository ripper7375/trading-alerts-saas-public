# Trading Alerts - Renewal Reminder Email Template

Production-ready React Email template for subscription renewal reminders with dLocal payment integration.

## Features

✅ Email-safe HTML structure with inline styles
✅ Responsive design (mobile-friendly)
✅ Clear expiry warning with countdown badge
✅ Prominent CTA button
✅ Subscription details display
✅ Features reminder list
✅ Footer with unsubscribe and company info
✅ Support for multiple currencies (USD & INR)
✅ Customizable via props

## Quick Start

### Preview in Browser

\`\`\`bash
npm install
npm run dev
\`\`\`

Visit: `http://localhost:3000/preview-renewal-email`

### Development with React Email

\`\`\`bash
npm run email
\`\`\`

This starts the React Email development server at `http://localhost:3000`

## Usage

### Basic Usage

\`\`\`tsx
import RenewalReminderEmail from '@/emails/renewal-reminder-email'

<RenewalReminderEmail
  expiryDate="December 5, 2024"
  daysRemaining={3}
  price="$29.00"
  priceInr="₹2,407"
  paymentMethod="UPI (dLocal)"
/>
\`\`\`

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `expiryDate` | string | "December 5, 2024" | Subscription expiry date |
| `daysRemaining` | number | 3 | Days until expiration |
| `price` | string | "$29.00" | Price in USD |
| `priceInr` | string | "₹2,407" | Price in INR |
| `paymentMethod` | string | "UPI (dLocal)" | Payment method used |
| `userName` | string | "Valued Customer" | User's name |

### Sending the Email

#### With Resend

\`\`\`tsx
import { Resend } from 'resend'
import RenewalReminderEmail from '@/emails/renewal-reminder-email'

const resend = new Resend(process.env.RESEND_API_KEY)

await resend.emails.send({
  from: 'Trading Alerts <noreply@tradingalerts.com>',
  to: user.email,
  subject: '⏰ Your PRO Subscription Expires in 3 Days',
  react: RenewalReminderEmail({
    expiryDate: subscription.expiryDate,
    daysRemaining: subscription.daysRemaining,
    price: '$29.00',
    priceInr: '₹2,407',
    paymentMethod: 'UPI (dLocal)',
  }),
})
\`\`\`

#### With Nodemailer

\`\`\`tsx
import nodemailer from 'nodemailer'
import { render } from '@react-email/render'
import RenewalReminderEmail from '@/emails/renewal-reminder-email'

const transporter = nodemailer.createTransport({ /* config */ })

const emailHtml = render(RenewalReminderEmail({
  expiryDate: 'December 5, 2024',
  daysRemaining: 3,
  price: '$29.00',
  priceInr: '₹2,407',
}))

await transporter.sendMail({
  from: 'noreply@tradingalerts.com',
  to: user.email,
  subject: '⏰ Your PRO Subscription Expires in 3 Days',
  html: emailHtml,
})
\`\`\`

## Email Client Testing

Tested and verified in:
- ✅ Gmail (Web, iOS, Android)
- ✅ Outlook (Web, Desktop)
- ✅ Apple Mail (iOS, macOS)
- ✅ Yahoo Mail
- ✅ ProtonMail

## Customization

### Change Colors

Edit the inline styles in `renewal-reminder-email.tsx`:

\`\`\`tsx
// Primary gradient (header & button)
background: 'linear-gradient(135deg, #2563eb 0%, #9333ea 100%)'

// Warning badge
backgroundColor: '#f59e0b' // Yellow-500

// Change to your brand colors
background: 'linear-gradient(135deg, #your-color-1 0%, #your-color-2 100%)'
\`\`\`

### Add Logo Image

Replace text logo with image:

\`\`\`tsx
<Section style={headerStyle}>
  <img
    src="https://yourdomain.com/logo-white.png"
    alt="Trading Alerts Logo"
    width="200"
    height="50"
    style={{ margin: '0 auto' }}
  />
</Section>
\`\`\`

## Best Practices

- **Subject Lines**: Use emojis and urgency (e.g., "⏰ 3 Days Left!")
- **Send Schedule**: 
  - 7 days before expiry
  - 3 days before expiry
  - 1 day before expiry
- **Personalization**: Include user's name and specific plan details
- **A/B Testing**: Test different CTAs and layouts

## Support

For issues or questions:
- Email: support@tradingalerts.com
- Docs: https://tradingalerts.com/docs

## License

Proprietary - Trading Alerts SaaS Inc.

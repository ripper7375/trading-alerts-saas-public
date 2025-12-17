PART 17 - PROMPT 1: Affiliate Registration Page

=======================================================
Create an affiliate registration page for a trading alerts SaaS using **Next.js 15 App Router, TypeScript, Tailwind CSS, and shadcn/ui components**.

**CRITICAL: Use SystemConfig for Dynamic Percentages**
- DO NOT hardcode commission percentages (e.g., "$5 per sale" or "20%")
- MUST use `useAffiliateConfig()` hook for commission display
- Commission amount should be calculated dynamically

---

## REQUIREMENTS:

### 1. PAGE LAYOUT:
- Two-column layout: Form (left) + Benefits (right)
- Centered container, max-width 1200px
- Padding: p-8
- Background: gradient from purple-50 to blue-50

### 2. LEFT COLUMN - REGISTRATION FORM:

**Header:**
- Icon: Handshake (lucide-react, text-4xl, text-purple-600, mb-4)
- Heading: "Become an Affiliate Partner" (text-3xl, font-bold, text-gray-900, mb-2)
- Subheading: "Earn ${commissionAmount} for every PRO upgrade using your codes" (text-lg, text-gray-600)
  * Calculate commissionAmount dynamically: calculateDiscountedPrice(29) * (commissionPercent / 100)
  * Use useAffiliateConfig() hook

**Form Fields:**

1. **Full Name** (required)
   - Label: "Full Name" (text-sm, font-medium, text-gray-700)
   - Input: shadcn/ui Input component
   - Placeholder: "John Doe"
   - Error message space below

2. **Email** (required, pre-filled if logged in, disabled)
   - Label: "Email Address" (text-sm, font-medium, text-gray-700)
   - Input: shadcn/ui Input component, disabled state
   - Placeholder: "you@example.com"
   - Helper text: "This is your account email" (text-xs, text-gray-500)

3. **Country** (required, select with flags)
   - Label: "Country" (text-sm, font-medium, text-gray-700)
   - Select: shadcn/ui Select component
   - Options with flag emojis:
     * 🇮🇳 India
     * 🇳🇬 Nigeria
     * 🇵🇰 Pakistan
     * 🇻🇳 Vietnam
     * 🇮🇩 Indonesia
     * 🇹🇭 Thailand
     * 🇿🇦 South Africa
     * 🇹🇷 Turkey
     * 🌍 Other

4. **Payment Method** (required, radio buttons)
   - Label: "Preferred Payment Method" (text-sm, font-medium, text-gray-700)
   - Radio options (shadcn/ui RadioGroup):
     * 🏦 Bank Transfer
     * ₿ Crypto Wallet (BTC/USDT)
     * 💳 PayPal
     * 💰 Payoneer

5. **Payment Details** (required, conditional textarea)
   - Label: "Payment Details" (text-sm, font-medium, text-gray-700)
   - Textarea: shadcn/ui Textarea component
   - Conditional placeholder based on payment method:
     * Bank Transfer: "Bank name, Account number, SWIFT/IFSC code"
     * Crypto Wallet: "Wallet address (BTC or USDT)"
     * PayPal: "PayPal email address"
     * Payoneer: "Payoneer email address"
   - Rows: 4
   - Helper text: "This information will be used to send your commissions" (text-xs, text-gray-500)

6. **Terms & Conditions** (required, checkbox)
   - Checkbox: shadcn/ui Checkbox component
   - Label: "I agree to the Affiliate Terms & Conditions and Privacy Policy" (text-sm, text-gray-700)
   - Links: "Terms & Conditions" and "Privacy Policy" (text-blue-600, underline)

**Submit Button:**
- Button: "Register as Affiliate" (w-full, py-3, text-lg, gradient bg-purple-600 to bg-blue-600, text-white, hover effect, disabled if form invalid)
- Loading state: Spinner + "Registering..." text

### 3. RIGHT COLUMN - BENEFITS SECTION:

**Header:**
- Title: "What You'll Get" (text-2xl, font-bold, text-gray-900, mb-6)

**Benefits List (with icons):**
Each item:
- Icon (lucide-react, text-purple-600, size-6)
- Title (text-lg, font-semibold, text-gray-900)
- Description (text-sm, text-gray-600)

1. **Icon: Gift**
   - Title: "15 Discount Codes Monthly"
   - Description: "Automatically distributed on the 1st of each month. No manual work required!"

2. **Icon: DollarSign**
   - Title: "${commissionAmount} Commission per PRO Upgrade"
   - Description: "Earn {commissionPercent}% of each discounted PRO subscription ({discountPercent}% off applies to customers)"
   - Use dynamic values from useAffiliateConfig()

3. **Icon: LineChart**
   - Title: "Real-time Commission Tracking"
   - Description: "View your earnings dashboard 24/7. Track active codes, used codes, and pending commissions."

4. **Icon: FileText**
   - Title: "Monthly Performance Reports"
   - Description: "Accounting-style reports emailed automatically. Track opening/closing balances like a pro."

5. **Icon: Zap**
   - Title: "No Minimum Payout Threshold"
   - Description: "Get paid whenever you request. No waiting until you reach $100 or $500."

**Commission Flow Illustration (Bottom):**
- Visual diagram:
  * Customer uses your code
  * ↓
  * Gets {discountPercent}% off ($29 → ${calculateDiscountedPrice(29)})
  * ↓
  * You earn ${commissionAmount} commission
  * ↓
  * Payment sent to your account
- Use dynamic values from useAffiliateConfig()
- Styled with arrows, boxes, colors

### 4. RESPONSIVE DESIGN:
- Desktop: Two columns side by side
- Tablet: Stack columns (form on top, benefits below)
- Mobile: Single column, full width, form stacks vertically

### 5. FORM VALIDATION:
- Real-time validation on blur
- Error messages in red below each field
- Disable submit button if:
  * Any required field is empty
  * Email is invalid
  * Terms checkbox not checked
- Success message after submission: Toast notification

### 6. TECHNICAL REQUIREMENTS:
- Component must be client component ('use client')
- Export as default component
- TypeScript with proper types
- Use React Hook Form for form handling
- Use Zod for validation schema
- Use shadcn/ui Form, Input, Select, Textarea, Checkbox, Button components
- MUST import and use useAffiliateConfig() hook
- Toast notification on success

---

## SYSTEMCONFIG INTEGRATION:

```typescript
'use client'

import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Button } from '@/components/ui/button'
import { Handshake, Gift, DollarSign, LineChart, FileText, Zap } from 'lucide-react'

const formSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  country: z.string().min(1, 'Please select a country'),
  paymentMethod: z.enum(['bank', 'crypto', 'paypal', 'payoneer']),
  paymentDetails: z.string().min(10, 'Please provide payment details'),
  termsAccepted: z.boolean().refine((val) => val === true, 'You must accept the terms')
})

export default function AffiliateRegistrationPage() {
  // ✅ CRITICAL: Use SystemConfig hook for dynamic commission
  const {
    discountPercent,
    commissionPercent,
    calculateDiscountedPrice
  } = useAffiliateConfig()

  // Calculate commission amount dynamically
  const regularPrice = 29.00
  const discountedPrice = calculateDiscountedPrice(regularPrice)
  const commissionAmount = (discountedPrice * (commissionPercent / 100)).toFixed(2)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: '',
      email: 'user@example.com', // Pre-filled from session
      country: '',
      paymentMethod: 'bank',
      paymentDetails: '',
      termsAccepted: false
    }
  })

  // ... rest of component
}
```

---

## CHECKLIST:
- ✅ Imported useAffiliateConfig hook
- ✅ No hardcoded commission amounts ($5, etc.)
- ✅ Uses {commissionPercent}% for display
- ✅ Calculates ${commissionAmount} dynamically
- ✅ Uses {discountPercent}% in descriptions
- ✅ Client component with 'use client' directive
- ✅ React Hook Form + Zod validation
- ✅ Responsive two-column layout
- ✅ Country selector with flag emojis
- ✅ Conditional payment details placeholder

Generate complete, production-ready code that I can copy and run immediately.

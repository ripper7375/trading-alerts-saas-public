PART 18 - PROMPT 2: Payment Method Selector Component

=======================================================
Create a payment method selector component grid for emerging markets using **Next.js 15 App Router, TypeScript, Tailwind CSS, and shadcn/ui components**.

---

## REQUIREMENTS:

### 1. COMPONENT HEADER:
- Title: "Choose Payment Method" (text-2xl, font-bold, mb-2)
- Subtitle: "Select your preferred local payment option" (text-gray-600, mb-6)

### 2. PAYMENT METHOD GRID:
- Layout: Grid with 4 columns (desktop), 2 (tablet), 1 (mobile)
- Gap between cards: gap-4
- Each method as a clickable card

### 3. PAYMENT METHOD CARD STRUCTURE:
Each card contains:
- Logo/Icon (centered, 64x64px, mb-3)
- Method name (text-lg, font-semibold, text-gray-900, mb-2)
- Processing time badge (text-xs, rounded-full, px-3, py-1)
  * "Instant" - green (bg-green-100, text-green-700)
  * "1-2 hours" - yellow (bg-yellow-100, text-yellow-700)
- Checkmark icon (top-right corner, only when selected)
  * Check circle icon (lucide-react)
  * Green color (text-green-600)

### 4. CARD STATES:
- Default: border-gray-200, bg-white, hover:shadow-md
- Hover: transform scale-105, shadow-lg, cursor-pointer
- Selected: border-2 border-blue-600, bg-blue-50, checkmark visible
- Transition: all 200ms ease-in-out

### 5. COUNTRY-SPECIFIC PAYMENT METHODS:

**India (IN):**
1. UPI - Logo + "UPI" - Instant
2. Paytm - Logo + "Paytm Wallet" - Instant
3. PhonePe - Logo + "PhonePe" - Instant
4. Net Banking - Bank icon + "Net Banking" - 1-2 hours
5. Card (Stripe) - Card icon + "Card Payment" - Instant (sub: "International cards")

**Nigeria (NG):**
1. Bank Transfer - Bank icon + "Bank Transfer" - 1-2 hours
2. USSD - Phone icon + "USSD" - Instant
3. Paystack - Logo + "Paystack" - Instant
4. Verve - Card icon + "Verve Card" - Instant
5. Card (Stripe) - Card icon + "Card Payment" - Instant

**Pakistan (PK):**
1. JazzCash - Logo + "JazzCash" - Instant
2. Easypaisa - Logo + "Easypaisa" - Instant
3. Card (Stripe) - Card icon + "Card Payment" - Instant

**Indonesia (ID):**
1. GoPay - Logo + "GoPay" - Instant
2. OVO - Logo + "OVO" - Instant
3. Dana - Logo + "Dana" - Instant
4. ShopeePay - Logo + "ShopeePay" - Instant
5. Card (Stripe) - Card icon + "Card Payment" - Instant

**Vietnam (VN):**
1. VNPay - Logo + "VNPay" - Instant
2. MoMo - Logo + "MoMo" - Instant
3. ZaloPay - Logo + "ZaloPay" - Instant
4. Card (Stripe) - Card icon + "Card Payment" - Instant

**Thailand (TH):**
1. TrueMoney - Logo + "TrueMoney" - Instant
2. Rabbit LINE Pay - Logo + "Rabbit LINE Pay" - Instant
3. Thai QR - QR icon + "Thai QR" - Instant
4. Card (Stripe) - Card icon + "Card Payment" - Instant

**South Africa (ZA):**
1. Instant EFT - Bank icon + "Instant EFT" - Instant
2. EFT - Bank icon + "EFT" - 1-2 hours
3. Card (Stripe) - Card icon + "Card Payment" - Instant

**Turkey (TR):**
1. Bank Transfer - Bank icon + "Bank Transfer" - 1-2 hours
2. Local Cards - Card icon + "Turkish Cards" - Instant
3. Card (Stripe) - Card icon + "Card Payment" - Instant

### 6. INTERACTION:
- Click card to select (only one selection allowed - radio behavior)
- Visual feedback on hover and click
- onClick callback to parent component
- Keyboard navigation support (arrow keys)

### 7. ACCESSIBILITY:
- ARIA labels for each card
- Keyboard focus visible (outline-blue-600)
- Screen reader friendly

### 8. TECHNICAL REQUIREMENTS:
- Client component ('use client')
- TypeScript with proper types
- Props:
  * country: 'IN' | 'NG' | 'PK' | 'VN' | 'ID' | 'TH' | 'ZA' | 'TR'
  * selectedMethod: string | null
  * onSelectMethod: (method: string) => void
- Use shadcn/ui Card, Badge components
- Use lucide-react icons
- Responsive grid layout

---

## TECHNICAL IMPLEMENTATION:

```typescript
'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, CreditCard, Building, Smartphone, QrCode } from 'lucide-react'

interface PaymentMethod {
  id: string
  name: string
  icon: React.ReactNode
  processingTime: 'Instant' | '1-2 hours'
  sublabel?: string
}

interface PaymentMethodSelectorProps {
  country: 'IN' | 'NG' | 'PK' | 'VN' | 'ID' | 'TH' | 'ZA' | 'TR'
  selectedMethod: string | null
  onSelectMethod: (method: string) => void
}

const paymentMethodsByCountry: Record<string, PaymentMethod[]> = {
  IN: [
    { id: 'upi', name: 'UPI', icon: <Smartphone />, processingTime: 'Instant' },
    { id: 'paytm', name: 'Paytm Wallet', icon: <Smartphone />, processingTime: 'Instant' },
    { id: 'phonepe', name: 'PhonePe', icon: <Smartphone />, processingTime: 'Instant' },
    { id: 'netbanking', name: 'Net Banking', icon: <Building />, processingTime: '1-2 hours' },
    { id: 'stripe', name: 'Card Payment', icon: <CreditCard />, processingTime: 'Instant', sublabel: 'International cards' }
  ],
  // ... other countries
}

export default function PaymentMethodSelector({
  country,
  selectedMethod,
  onSelectMethod
}: PaymentMethodSelectorProps) {
  const methods = paymentMethodsByCountry[country] || []

  return (
    <div>
      <h3 className="text-2xl font-bold mb-2">Choose Payment Method</h3>
      <p className="text-gray-600 mb-6">Select your preferred local payment option</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {methods.map((method) => (
          <Card
            key={method.id}
            className={`relative cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg ${
              selectedMethod === method.id
                ? 'border-2 border-blue-600 bg-blue-50'
                : 'border border-gray-200 bg-white'
            }`}
            onClick={() => onSelectMethod(method.id)}
          >
            {selectedMethod === method.id && (
              <CheckCircle className="absolute top-2 right-2 text-green-600" size={24} />
            )}
            <CardContent className="flex flex-col items-center p-6 text-center">
              <div className="mb-3 text-gray-700">{method.icon}</div>
              <p className="text-lg font-semibold text-gray-900 mb-2">{method.name}</p>
              {method.sublabel && (
                <p className="text-xs text-gray-500 mb-2">{method.sublabel}</p>
              )}
              <Badge
                variant={method.processingTime === 'Instant' ? 'default' : 'secondary'}
                className={method.processingTime === 'Instant'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
                }
              >
                {method.processingTime}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

---

## CHECKLIST:
- ✅ Grid layout (4 columns desktop, responsive)
- ✅ Payment method cards with logos
- ✅ Processing time badges (color-coded)
- ✅ Selected state with checkmark
- ✅ Hover effects and transitions
- ✅ Country-specific methods
- ✅ TypeScript with proper interfaces
- ✅ Keyboard accessible
- ✅ Single selection (radio behavior)

Generate complete, production-ready code that I can copy and run immediately.

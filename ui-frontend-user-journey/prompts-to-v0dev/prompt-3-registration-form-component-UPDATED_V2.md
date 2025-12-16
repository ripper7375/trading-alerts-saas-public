PROMPT 3: Registration Form Component (WITH AFFILIATE CODE)

==================================================
Create a registration form component for Next.js 15 using TypeScript, Tailwind CSS, shadcn/ui, React Hook Form, and Zod validation.

REQUIREMENTS:

1. FORM LAYOUT (Centered card, max-w-md):
   - Card: bg-white, shadow-xl, rounded-xl, p-8
   - Heading: "Create Your Account" (text-3xl, font-bold, text-center, mb-6)
   - Subheading: "Start trading smarter today" (text-gray-600, text-center, mb-8)

2. FORM FIELDS (All with real-time validation):

   **Full Name Input:**
   - Label: "Full Name" (font-medium, text-gray-700)
   - Input: placeholder="John Trader"
   - Validation:
     - Required (show red error: "Name is required")
     - Min 2 characters (show: "Name must be at least 2 characters")
   - Success: Green checkmark icon appears on right

   **Email Input:**
   - Label: "Email Address" (font-medium, text-gray-700)
   - Input: type="email", placeholder="john@example.com"
   - Validation:
     - Required (show: "Email is required")
     - Valid email format (show: "Invalid email format")
   - Success: Green checkmark icon

   **Password Input:**
   - Label: "Password" (font-medium, text-gray-700)
   - Input: type="password" with toggle show/hide icon (eye icon)
   - Validation requirements shown below input:
     - ✅/❌ At least 8 characters
     - ✅/❌ One uppercase letter
     - ✅/❌ One lowercase letter
     - ✅/❌ One number
   - Live validation: Check marks turn green as requirements met

   **Confirm Password Input:**
   - Label: "Confirm Password" (font-medium, text-gray-700)
   - Input: type="password"
   - Validation:
     - Required (show: "Please confirm your password")
     - Must match password (show: "Passwords do not match")
   - Success: Green checkmark icon

   **Referral Code Input (OPTIONAL - NEW FIELD):**
   - Position: AFTER Confirm Password, BEFORE Terms Checkbox
   - Label: "Referral Code (Optional)" (font-medium, text-gray-700)
   - Helper text: "Have an affiliate code? Get 20% off this month!" (text-xs, text-blue-600, mb-1)
   - Input section (flex items-center gap-2):
     - Text input:
       - placeholder="REF-ABC123XYZ"
       - Auto-uppercase transformation
       - Pattern: REF-XXXXXXXXXXXX (15 chars total)
       - className: "flex-1"
     - Verify button:
       - Text: "Verify"
       - className: "px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 text-sm font-medium"
       - Enabled when input >= 15 characters
       - onClick: Verify code (API call or mock)

   - States:
     1. Empty (default): Normal border
     2. Typing: Normal border, verify button enabled when length >= 15
     3. Valid code (after verify):
        - Input: border-green-500, bg-green-50
        - Green checkmark icon on right
        - Success message: "✅ Valid code! You'll get 20% off PRO ($23.20/month instead of $29)" (text-sm, text-green-600, mt-1)
        - Discount badge: "🎉 20% DISCOUNT APPLIED" (bg-green-100, text-green-800, px-3, py-1, rounded-full, text-sm, font-semibold, mt-2, inline-block)
     4. Invalid code:
        - Input: border-red-500, bg-red-50
        - Red X icon on right
        - Error message: "❌ Invalid or expired referral code" (text-sm, text-red-600, mt-1)
     5. Pre-filled from URL (?ref=CODE):
        - Auto-fill input on component mount
        - Auto-verify the code
        - Show success state if valid

3. TERMS CHECKBOX:
   - Checkbox: "I agree to the Terms of Service and Privacy Policy"
   - Links: "Terms of Service" and "Privacy Policy" (text-blue-600, underline, clickable)
   - Validation: Required (show: "You must agree to terms")

4. SUBMIT BUTTON:
   - Button: "Create Account" (w-full, bg-blue-600, hover:bg-blue-700, py-3, text-lg, font-semibold, rounded-lg)
   - Loading state: Shows spinner and "Creating account..." when submitting
   - Disabled state: When form invalid (bg-gray-300, cursor-not-allowed)

5. FOOTER LINKS:
   - Text: "Already have an account?" (text-gray-600, text-center, mt-6)
   - Link: "Login" (text-blue-600, font-semibold, hover:underline)
   - Separator: "—" (text-gray-300)
   - Link: "Forgot password?" (text-blue-600, hover:underline)
   - Separator: "—" (text-gray-300)
   - Link: "Don't have a referral code? Join our Affiliate Program" (text-blue-600, hover:underline, text-sm)

6. SUCCESS MESSAGE (TWO VERSIONS):
   - After successful submit, show:
     - Green checkmark animation
     - Message: "Account created successfully!"
     - WITH discount: "🎉 20% discount activated! You'll pay $23.20/month for PRO." (NEW)
     - Redirect text: "Redirecting to dashboard..."

7. VALIDATION SCHEMA (Zod):

```typescript
const registrationSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email format'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
    referralCode: z.string().optional(), // NEW: Optional affiliate code
    agreedToTerms: z
      .boolean()
      .refine((val) => val === true, 'You must agree to terms'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
```

8. VISUAL POLISH:
   - Real-time validation (validate on blur and change)
   - Error messages: text-red-600, text-sm, mt-1, with error icon
   - Success indicators: Green checkmark icon (lucide-react Check icon)
   - Smooth transitions: transition-all duration-200
   - Focus states: ring-2 ring-blue-500
   - Password strength indicator (optional color bar)

9. RESPONSIVE:
   - Full width on mobile with padding
   - Centered card on desktop
   - Touch-friendly tap targets (min-height: 44px)
   - Referral code input + verify button: Stack vertically on very small screens (<360px)

10. TECHNICAL:
    - Use React Hook Form for form management
    - Use Zod for validation schema
    - Use shadcn/ui Input, Button, Checkbox, Label components
    - TypeScript with proper types
    - Export as default component
    - Include useState for form state, loading, referral code validation

TECHNICAL IMPLEMENTATION:

```typescript
'use client'

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useSearchParams } from "next/navigation"

const registrationSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email format"),
    password: z.string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string(),
    referralCode: z.string().optional(),
    agreedToTerms: z.boolean().refine((val) => val === true, "You must agree to terms")
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  })

type RegistrationFormData = z.infer<typeof registrationSchema>

export default function RegistrationForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  // Referral code state
  const [referralCode, setReferralCode] = useState('')
  const [verifiedCode, setVerifiedCode] = useState<string | null>(null)
  const [isCodeValid, setIsCodeValid] = useState(false)
  const [codeError, setCodeError] = useState('')

  const searchParams = useSearchParams()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, touchedFields, isValid },
  } = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
  })

  // Pre-fill referral code from URL
  useEffect(() => {
    const refCode = searchParams.get('ref')
    if (refCode) {
      setReferralCode(refCode)
      setValue('referralCode', refCode)
      verifyCode(refCode)
    }
  }, [searchParams, setValue])

  // Verify referral code
  const verifyCode = async (code: string) => {
    // Mock validation (replace with API call)
    const isValid = code.startsWith('REF-') && code.length === 15

    if (isValid) {
      setIsCodeValid(true)
      setVerifiedCode(code)
      setCodeError('')
    } else {
      setIsCodeValid(false)
      setVerifiedCode(null)
      setCodeError('Invalid or expired referral code')
    }
  }

  const onSubmit = async (data: RegistrationFormData) => {
    setIsLoading(true)

    // Include affiliate code if verified
    const submitData = {
      ...data,
      referralCode: verifiedCode || null,
      discountApplied: isCodeValid,
    }

    console.log("Form submitted:", submitData)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000))

    setIsLoading(false)
    setIsSuccess(true)

    // Simulate redirect
    setTimeout(() => {
      console.log("Redirecting to dashboard...")
    }, 2000)
  }

  // Success screen
  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md bg-white shadow-xl rounded-xl p-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 animate-bounce">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Account created successfully!</h2>
            {isCodeValid && (
              <p className="text-green-600 font-medium mb-2">
                🎉 20% discount activated! You'll pay $23.20/month for PRO.
              </p>
            )}
            <p className="text-gray-600">Redirecting to dashboard...</p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md bg-white shadow-xl rounded-xl p-8">
        <h1 className="text-3xl font-bold text-center mb-6 text-gray-900">Create Your Account</h1>
        <p className="text-gray-600 text-center mb-8">Start trading smarter today</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Full Name */}
          {/* ... */}

          {/* Email */}
          {/* ... */}

          {/* Password */}
          {/* ... */}

          {/* Confirm Password */}
          {/* ... */}

          {/* REFERRAL CODE - NEW FIELD */}
          <div>
            <Label htmlFor="referralCode">Referral Code (Optional)</Label>
            <p className="text-xs text-blue-600 mb-1">
              Have an affiliate code? Get 20% off this month!
            </p>
            <div className="flex items-center gap-2 mt-1">
              <Input
                id="referralCode"
                type="text"
                placeholder="REF-ABC123XYZ"
                value={referralCode}
                onChange={(e) => {
                  const upper = e.target.value.toUpperCase()
                  setReferralCode(upper)
                  setValue('referralCode', upper)
                }}
                className={`flex-1 ${
                  isCodeValid
                    ? "border-green-500 bg-green-50"
                    : codeError
                      ? "border-red-500 bg-red-50"
                      : ""
                }`}
              />
              <Button
                type="button"
                onClick={() => verifyCode(referralCode)}
                disabled={referralCode.length < 15}
                className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 text-sm font-medium"
              >
                Verify
              </Button>
            </div>
            {isCodeValid && (
              <>
                <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  Valid code! You'll get 20% off PRO ($23.20/month instead of $29)
                </p>
                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold mt-2 inline-block">
                  🎉 20% DISCOUNT APPLIED
                </span>
              </>
            )}
            {codeError && (
              <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                <XCircle className="w-4 h-4" />
                {codeError}
              </p>
            )}
          </div>

          {/* Terms Checkbox */}
          {/* ... */}

          {/* Submit Button */}
          {/* ... */}
        </form>

        {/* Footer Links */}
        <div className="text-center mt-6 space-y-2">
          <p className="text-gray-600 text-sm">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-600 font-semibold hover:underline">
              Login
            </Link>
          </p>
          <div className="flex items-center justify-center gap-2 text-sm">
            <span className="text-gray-300">—</span>
            <Link href="/forgot-password" className="text-blue-600 hover:underline">
              Forgot password?
            </Link>
            <span className="text-gray-300">—</span>
            <Link href="/affiliate/join" className="text-blue-600 hover:underline text-xs">
              Don't have a referral code? Join our Affiliate Program
            </Link>
          </div>
        </div>
      </Card>
    </div>
  )
}
```

Generate complete, production-ready code with all imports that I can copy and run immediately.

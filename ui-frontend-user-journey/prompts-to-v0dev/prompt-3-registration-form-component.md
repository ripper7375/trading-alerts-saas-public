PROMPT 3: Registration Form Component

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

6. SUCCESS MESSAGE:
   - After successful submit, show:
     - Green checkmark animation
     - Message: "Account created successfully!"
     - Redirect text: "Redirecting to dashboard..."

7. VALIDATION SCHEMA (Zod):

```typescript
const registrationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email format"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string(),
  agreedToTerms: z.boolean().refine((val) => val === true, "You must agree to terms")
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
})

8. VISUAL POLISH:
Real-time validation (validate on blur and change)
Error messages: text-red-600, text-sm, mt-1, with error icon
Success indicators: Green checkmark icon (lucide-react Check icon)
Smooth transitions: transition-all duration-200
Focus states: ring-2 ring-blue-500
Password strength indicator (optional color bar)

9. RESPONSIVE:
Full width on mobile with padding
Centered card on desktop
Touch-friendly tap targets (min-height: 44px)

10.TECHNICAL:
Use React Hook Form for form management
Use Zod for validation schema
Use shadcn/ui Input, Button, Checkbox, Label components
TypeScript with proper types
Export as default component
Include useState for form state and loading


Generate complete, production-ready code with all imports that I can copy and run immediately.
```

PROMPT 9: Login Form Component

===============================================
Create a login form component for Next.js 15 using TypeScript, Tailwind CSS, shadcn/ui, React Hook Form, and Zod validation.

REQUIREMENTS:

1. FORM LAYOUT (Centered card, max-w-md):
   - Card: bg-white, shadow-xl, rounded-xl, p-8
   - Heading: "Welcome Back" (text-3xl, font-bold, text-center, mb-2)
   - Subheading: "Sign in to your Trading Alerts account" (text-gray-600, text-center, mb-8)

2. FORM FIELDS (All with real-time validation):

   **Email Input:**
   - Label: "Email Address" (font-medium, text-gray-700, mb-2)
   - Input: type="email", placeholder="john@example.com"
   - Validation:
     - Required (show red error: "Email is required")
     - Valid email format (show: "Invalid email format")
   - Error icon: ⚠️ (text-red-600, right side of input)
   - Success: Green checkmark icon (✓)

   **Password Input:**
   - Label: "Password" (font-medium, text-gray-700, mb-2)
   - Input: type="password" with toggle show/hide icon (eye icon from lucide-react)
   - Placeholder: "Enter your password"
   - Validation:
     - Required (show: "Password is required")
     - Min 8 characters (show: "Password must be at least 8 characters")
   - Toggle button: Eye icon (absolute right-3, cursor-pointer, text-gray-500, hover:text-gray-700)
     - Closed eye: Password hidden
     - Open eye: Password visible

   **Remember Me Checkbox:**
   - Checkbox with label: "☐ Remember me for 30 days" (text-sm, text-gray-600)
   - Checked state: ☑ (bg-blue-600, border-blue-600)

3. FORGOT PASSWORD LINK:
   - Position: Float right, aligned with "Remember me"
   - Link: "Forgot password?" (text-sm, text-blue-600, hover:underline, font-medium)
   - Opens forgot password page/modal

4. SUBMIT BUTTON:
   - Button: "Sign In" (w-full, bg-blue-600, hover:bg-blue-700, py-3, text-lg, font-semibold, rounded-lg, shadow-lg)
   - Loading state:
     - Shows spinner (lucide-react Loader2 icon, animate-spin)
     - Text: "Signing in..." (opacity-70)
     - Disabled: cursor-not-allowed
   - Disabled state: When form invalid (bg-gray-300, cursor-not-allowed)

5. DIVIDER:
   - Horizontal line with text: "OR" (text-gray-400, text-sm, my-6)
   - Visual: —————— OR —————— (centered)

6. SOCIAL LOGIN BUTTONS (Optional):
   - Button 1: "Continue with Google" (w-full, border-2, border-gray-300, py-3, rounded-lg, hover:bg-gray-50, flex items-center, justify-center, gap-3, mb-3)
     - Icon: Google logo (🔍 or actual SVG)
     - Text: "Continue with Google" (font-medium, text-gray-700)
   - Button 2: "Continue with GitHub" (same style)
     - Icon: GitHub logo (or lucide-react Github icon)
     - Text: "Continue with GitHub"

7. FOOTER LINKS:
   - Text: "Don't have an account?" (text-gray-600, text-center, mt-6)
   - Link: "Sign up for free" (text-blue-600, font-semibold, hover:underline, ml-1)
   - Arrow: "→" (ml-1, inline)

8. ERROR HANDLING:

   **Invalid Credentials:**
   - Alert banner at top of form: bg-red-50, border-l-4 border-red-500, rounded-lg, p-4, mb-6
   - Icon: ⚠️ (text-red-600, text-xl)
   - Message: "Invalid email or password. Please try again." (text-red-800, font-medium)
   - Close button: "×" (absolute right, cursor-pointer, text-red-600, hover:text-red-800)

   **Account Locked:**
   - Alert: bg-orange-50, border-orange-500
   - Message: "Your account has been locked due to too many failed login attempts. Please reset your password or contact support."
   - Link: "Reset password" (text-blue-600, underline)

   **Server Error:**
   - Alert: bg-red-50, border-red-500
   - Message: "Something went wrong. Please try again later."

9. SUCCESS STATE:
   - After successful login:
     - Form fades out
     - Success animation: Large checkmark (✅, scale up + fade in, text-6xl, text-green-600)
     - Message: "Welcome back!" (text-2xl, font-bold, text-gray-900)
     - Submessage: "Redirecting to dashboard..." (text-gray-600)
     - Auto-redirect after 1.5 seconds

10. VALIDATION SCHEMA (Zod):

```typescript
const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  rememberMe: z.boolean().optional()
})


11. VISUAL POLISH:

Real-time validation (validate on blur and change)
Error messages: text-red-600, text-sm, mt-1, with ⚠️ icon
Success indicators: Green checkmark icon (✓, text-green-600)
Smooth transitions: transition-all duration-200
Focus states: ring-2 ring-blue-500 on inputs
Hover effects: All buttons and links
Password strength indicator (optional): Show weak/medium/strong bar below password

12. RESPONSIVE:

Full width on mobile with padding
Centered card on desktop
Touch-friendly tap targets (min-height: 44px)
Social buttons stack on mobile, side-by-side on desktop (optional)

13. ACCESSIBILITY:

All inputs have proper labels
Error messages linked to inputs (aria-describedby)
Focus management (first input focused on mount)
Keyboard navigation support
Screen reader friendly

14. TECHNICAL:

Use React Hook Form for form management
Use Zod for validation schema
Use shadcn/ui Input, Button, Checkbox, Label components
Use lucide-react for icons (Eye, EyeOff, Loader2, Check, AlertCircle)
TypeScript with proper types
Export as default component
Props: onSuccess (function), onForgotPassword (function)
Mock authentication function (simulates API call with setTimeout)


Generate complete, production-ready code with all imports and mock authentication that I can copy and run immediately.
```

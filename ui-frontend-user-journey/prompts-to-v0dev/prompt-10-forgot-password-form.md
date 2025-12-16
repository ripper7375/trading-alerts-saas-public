## **PROMPT 10: Forgot Password Form Component**

===================================================

Create a forgot password flow component for Next.js 15 using TypeScript, Tailwind CSS, shadcn/ui, React Hook Form, and Zod validation.

REQUIREMENTS:

1. MULTI-STEP FLOW (3 Steps):

Step 1: Enter email address
Step 2: Email sent confirmation
Step 3: Password reset form (if coming from email link)

2. STEP 1: REQUEST RESET (Initial form):

Layout (Centered card, max-w-md):

Card: bg-white, shadow-xl, rounded-xl, p-8
Back button: "← Back to login" (top-left, text-sm, text-blue-600, hover:underline, cursor-pointer)
Icon: 🔒 or Lock icon (text-6xl, text-center, mb-4)
Heading: "Forgot Password?" (text-3xl, font-bold, text-center, mb-2)
Subheading: "No worries, we'll send you reset instructions" (text-gray-600, text-center, mb-8)
Email Input:

Label: "Email Address" (font-medium, text-gray-700, mb-2)
Input: type="email", placeholder="john@example.com", autofocus
Validation:
Required (show: "Email is required")
Valid email format (show: "Invalid email format")
Helper text: "Enter the email address associated with your account" (text-xs, text-gray-500, mt-1)
Submit Button:

Button: "Send Reset Link" (w-full, bg-blue-600, hover:bg-blue-700, py-3, text-lg, font-semibold, rounded-lg, shadow-lg, mt-6)
Loading state: Spinner + "Sending..."
Disabled when: Email invalid or empty
Info Box:

Card: bg-blue-50, border-l-4 border-blue-500, rounded-lg, p-4, mt-6
Icon: ℹ️ (text-blue-600)
Text: "You'll receive an email with a link to reset your password. The link will expire in 1 hour." (text-sm, text-blue-800)

3. STEP 2: EMAIL SENT CONFIRMATION (After submit):

Success State:

Large checkmark animation: ✅ (text-8xl, text-green-600, scale-up animation, text-center)
Heading: "Check Your Email" (text-3xl, font-bold, text-center, mt-6, mb-2)
Message: "We've sent password reset instructions to:" (text-gray-600, text-center, mb-2)
Email display: "john@example.com" (text-lg, font-semibold, text-gray-900, text-center, bg-gray-100, px-4, py-2, rounded-lg, inline-block)
Instructions:

Card: bg-white, border-2 border-gray-200, rounded-xl, p-6, mt-8
Heading: "Next Steps:" (text-lg, font-semibold, text-gray-900, mb-4)
Ordered list:
"Open the email from Trading Alerts" (text-gray-700, mb-2)
"Click the 'Reset Password' button" (text-gray-700, mb-2)
"Create your new password" (text-gray-700)
Didn't Receive Email Section:

Text: "Didn't receive the email?" (text-gray-600, text-center, mt-8, mb-3)
Buttons:
"Resend Email" (border-2, border-blue-600, text-blue-600, px-6, py-2, rounded-lg, hover:bg-blue-50, inline-block, mr-3)
"Try Another Email" (border-2, border-gray-300, text-gray-700, px-6, py-2, rounded-lg, hover:bg-gray-50, inline-block)
Note: "Check your spam folder" (text-xs, text-gray-500, text-center, mt-4)
Back to Login:

Link: "← Back to login" (text-blue-600, hover:underline, text-center, block, mt-8)

4. STEP 3: RESET PASSWORD FORM (Accessed via email link):

Layout (Same card style):

Icon: 🔑 or Key icon (text-6xl, text-center, mb-4)
Heading: "Create New Password" (text-3xl, font-bold, text-center, mb-2)
Subheading: "Choose a strong password for your account" (text-gray-600, text-center, mb-8)
New Password Input:

Label: "New Password" (font-medium, text-gray-700, mb-2)
Input: type="password" with toggle show/hide icon
Validation requirements shown below (live validation):
✅/❌ At least 8 characters
✅/❌ One uppercase letter
✅/❌ One lowercase letter
✅/❌ One number
✅/❌ One special character (!@#$%^&\*)
Password strength indicator:
Weak: bg-red-500, w-1/3 of bar
Medium: bg-yellow-500, w-2/3 of bar
Strong: bg-green-500, w-full
Confirm Password Input:

Label: "Confirm New Password" (font-medium, text-gray-700, mb-2)
Input: type="password" with toggle
Validation:
Required
Must match new password (show: "Passwords do not match")
Success: Green checkmark when passwords match
Submit Button:

Button: "Reset Password" (w-full, bg-blue-600, hover:bg-blue-700, py-3, text-lg, font-semibold, rounded-lg, shadow-lg, mt-6)
Loading state: Spinner + "Resetting..."
Success state: Checkmark + "Password reset!"
Token Validation:

If token expired:
Alert: bg-red-50, border-l-4 border-red-500, p-4, rounded-lg
Icon: ⚠️ (text-red-600)
Message: "This password reset link has expired. Please request a new one." (text-red-800)
Button: "Request New Link" (bg-blue-600, text-white, px-6, py-2, rounded-lg, mt-4)
If token invalid:
Alert: bg-red-50, border-red-500
Message: "Invalid password reset link. Please request a new one."

5. SUCCESS STATE (After password reset):

Large checkmark: ✅ (text-8xl, text-green-600, animate)
Heading: "Password Reset Successful!" (text-3xl, font-bold, text-center, mt-6, mb-2)
Message: "Your password has been successfully reset. You can now log in with your new password." (text-gray-600, text-center, mb-8)
Button: "Go to Login" (bg-blue-600, text-white, px-8, py-3, rounded-lg, text-lg, font-semibold, hover:bg-blue-700, shadow-lg)
Auto-redirect: After 3 seconds

6. ERROR HANDLING:

Email Not Found:

Alert: bg-yellow-50, border-yellow-500
Message: "No account found with that email address. Please check and try again."
Link: "Create an account" (text-blue-600, underline)
Too Many Requests:

Alert: bg-orange-50, border-orange-500
Message: "Too many password reset requests. Please wait 10 minutes before trying again."
Countdown timer: "Try again in 9:32" (text-orange-800, font-mono)
Server Error:

Alert: bg-red-50, border-red-500
Message: "Something went wrong. Please try again later."

7. VALIDATION SCHEMA (Zod):

// Step 1: Email request
const emailSchema = z.object({
email: z.string().email("Invalid email format")
})

// Step 3: Password reset
const resetPasswordSchema = z.object({
password: z.string()
.min(8, "Password must be at least 8 characters")
.regex(/[A-Z]/, "Password must contain at least one uppercase letter")
.regex(/[a-z]/, "Password must contain at least one lowercase letter")
.regex(/[0-9]/, "Password must contain at least one number")
.regex(/[!@#$%^&*]/, "Password must contain at least one special character"),
confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
message: "Passwords do not match",
path: ["confirmPassword"]
})

8. VISUAL POLISH:

Smooth transitions between steps (fade in/out)
Loading animations (spinner)
Success animations (checkmark scale up)
Real-time validation feedback
Password strength meter with color coding
All states have appropriate icons and colors

9. RESPONSIVE:

Full width on mobile
Centered card on desktop
Touch-friendly buttons
Readable text sizes on all devices

10. TECHNICAL:

Use React Hook Form for forms
Use Zod for validation
Use shadcn/ui components
Use lucide-react icons
TypeScript with proper types
State management for step flow (useState)
Mock API calls with setTimeout
URL token parsing (useSearchParams or useParams)
Export as default component

Generate complete, production-ready code with all three steps and state management that I can copy and run immediately.

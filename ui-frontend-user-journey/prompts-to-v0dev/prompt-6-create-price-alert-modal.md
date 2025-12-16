PROMPT 6: Create Alert Modal/Form

=============================================
Create an alert creation modal component for Next.js 15 using TypeScript, Tailwind CSS, shadcn/ui, React Hook Form, and Zod validation.

REQUIREMENTS:

1. MODAL OVERLAY:
   - Backdrop: fixed inset-0, bg-black/50, backdrop-blur-sm, z-50
   - Modal container: Centered, max-w-2xl, bg-white, rounded-2xl, shadow-2xl, p-8
   - Animation: Slide up from bottom with fade-in (transition-all duration-300)
   - Close button: "×" (top-right, text-gray-400, hover:text-gray-600, text-3xl, cursor-pointer)
   - Close on: ESC key, click outside, or close button

2. MODAL HEADER:
   - Icon: 🔔 (text-5xl, mb-4)
   - Heading: "Create Price Alert" (text-3xl, font-bold, text-gray-900, mb-2)
   - Subheading: "Get notified when price reaches your target" (text-gray-600, mb-6)

3. FORM FIELDS (Pre-filled from chart click):

   **Symbol Field (Locked):**
   - Label: "Symbol" (font-medium, text-gray-700, mb-2)
   - Display: "XAUUSD" in locked input (bg-gray-100, cursor-not-allowed, opacity-70)
   - Lock icon: 🔒 (right side of input)
   - Note: "(Selected from chart)" (text-xs, text-gray-500, mt-1)

   **Timeframe Field (Locked):**
   - Label: "Timeframe" (font-medium, text-gray-700, mb-2)
   - Display: "H1" in locked input (bg-gray-100, cursor-not-allowed, opacity-70)
   - Lock icon: 🔒
   - Note: "(Selected from chart)" (text-xs, text-gray-500, mt-1)

   **Alert Type (Radio buttons):**
   - Label: "Alert Type" (font-medium, text-gray-700, mb-3)
   - Options (vertical stack):
     - ◉ "Price near Support/Resistance" (selected by default)
       - Description: "Alert when price comes within tolerance range" (text-sm, text-gray-500, ml-6)
     - ○ "Price crosses Support/Resistance"
       - Description: "Alert only when price breaks through the level" (text-sm, text-gray-500, ml-6)
     - ○ "New fractal detected"
       - Description: "Alert when new fractal pattern forms" (text-sm, text-gray-500, ml-6)
   - Styling: Each option in a card (border-2, rounded-lg, p-4, hover:border-blue-500, cursor-pointer)
   - Selected: border-blue-600, bg-blue-50

   **Target Line (Dropdown):**
   - Label: "Target Line" (font-medium, text-gray-700, mb-2)
   - Dropdown: Pre-selected with clicked line from chart
   - Options (with visual indicators):
     - "🔴 P-P1: $2,655.20 (Resistance)" - red color indicator
     - "🟢 B-B1: $2,645.00 (Support)" - green color indicator (selected)
     - "🔵 B-P1: $2,648.30 (Ascending Support)" - blue color indicator
     - "🟠 P-B1: $2,652.50 (Descending Resistance)" - orange color indicator
   - Each option shows: Type | Price | Line Name
   - Search enabled in dropdown

   **Tolerance Slider:**
   - Label: "Tolerance" (font-medium, text-gray-700, mb-2)
   - Slider: Range 0.05% to 1.00% (default: 0.10%)
   - Visual: bg-gray-200, rounded-full, h-2
   - Thumb: w-5, h-5, bg-blue-600, rounded-full, shadow-md
   - Value display: "± 0.10%" (text-2xl, font-bold, text-blue-600, mb-2)
   - Dollar amount: "(±$2.65)" (text-gray-600)
   - Range preview box (bg-blue-50, border-2 border-blue-200, rounded-lg, p-4, mt-3):
     - "Alert will trigger when price reaches:"
     - "$2,642.35 - $2,647.65" (text-xl, font-bold, text-gray-900)
     - Visual range bar showing current price position

   **Notification Methods (Checkboxes):**
   - Label: "Notification Method" (font-medium, text-gray-700, mb-3)
   - Options (with icons):
     - ☑ "Email" (checked by default) - icon: ✉️
     - ☑ "Push Notification" (checked by default) - icon: 📱
     - ☐ "SMS (PRO only) 🔒" (disabled for FREE users, checked for PRO) - icon: 💬
       - Hover tooltip: "Upgrade to PRO to enable SMS notifications"
   - At least one must be selected (validation)

   **Alert Name (Optional):**
   - Label: "Alert Name (optional)" (font-medium, text-gray-700, mb-2)
   - Input: Auto-filled with "Gold H1 Support B-B1" (editable)
   - Placeholder: "e.g., Gold H1 Support B-B1"
   - Character limit: 50 characters
   - Counter: "24/50" (text-xs, text-gray-500, float right)

4. TIER VALIDATION WARNING (Bottom of form):
   - Card: bg-yellow-50, border-l-4 border-yellow-500, rounded-lg, p-4, mb-6
   - FREE users:
     - "⚠️ Alerts Used: 4/5 (FREE Tier)" (text-yellow-800, font-semibold)
     - Progress bar: 80% filled, bg-yellow-500
     - Note: "You have 1 alert remaining. Upgrade to PRO for 20 alerts." (text-sm, text-yellow-700)
     - Link: "See upgrade options" (text-blue-600, underline)
   - PRO users:
     - "✓ Alerts Used: 8/20 (PRO Tier)" (text-green-800, font-semibold)
     - Progress bar: 40% filled, bg-green-500

5. VALIDATION RULES (Zod Schema):

```typescript
const alertSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  timeframe: z.string().min(1, "Timeframe is required"),
  alertType: z.enum(['near', 'cross', 'fractal'], { errorMap: () => ({ message: "Select an alert type" }) }),
  targetLine: z.string().min(1, "Select a target line"),
  tolerance: z.number().min(0.05).max(1.0),
  notifications: z.object({
    email: z.boolean(),
    push: z.boolean(),
    sms: z.boolean()
  }).refine(data => data.email || data.push || data.sms, {
    message: "Select at least one notification method"
  }),
  name: z.string().max(50, "Name must be 50 characters or less").optional()
})


6. ACTION BUTTONS (Bottom):

Layout: Flex, justify-end, gap-4
Cancel button: "Cancel" (border-2, border-gray-300, text-gray-700, px-6, py-3, rounded-lg, hover:bg-gray-100)
Submit button: "Create Alert" (bg-blue-600, text-white, px-8, py-3, rounded-lg, hover:bg-blue-700, font-semibold, shadow-lg)
Loading state: Button shows spinner + "Creating..." (disabled)
Success state: Button shows checkmark + "Created!" (green, 1 second before closing modal)

7. SUCCESS ANIMATION (After submit):

Modal content fades out
Large checkmark animation appears (✅, scale up + fade in)
Success message: "Alert created successfully!" (text-2xl, font-bold, text-green-600)
Sub-message: "You'll be notified when price reaches $2,645.00 ±0.10%" (text-gray-600)
Auto-close after 2 seconds with fade-out


8. ERROR HANDLING:

If user at tier limit:
Show error modal: "❌ Alert limit reached"
Message: "You've reached your FREE tier limit of 5 alerts. Upgrade to PRO for 20 alerts."
Button: [Upgrade to PRO] [Manage Existing Alerts]
If symbol/timeframe not in tier:
Show error: "🔒 This symbol/timeframe requires PRO tier"
Button: [Upgrade to PRO]
Network errors:
Show toast notification: "Failed to create alert. Please try again."
Keep modal open with form data intact

9. RESPONSIVE:

Desktop: max-w-2xl, centered
Tablet: max-w-lg, full padding
Mobile: Full screen modal (h-screen, overflow-scroll)
Header sticky at top
Buttons sticky at bottom
Scrollable content in middle

10. TECHNICAL:

Export as default component
TypeScript with proper types
Props: isOpen (boolean), onClose (function), prefilledData (object with symbol, timeframe, targetLine from chart click), userTier ('FREE' | 'PRO'), currentAlertCount (number)
Use React Hook Form for form management
Use Zod for validation
Use shadcn/ui Dialog, Button, RadioGroup, Checkbox, Slider, Select components
State for: form data, loading, success, errors
Mock onSubmit handler that simulates API call


Generate complete, production-ready code with all imports and mock data that I can copy and run immediately.
```

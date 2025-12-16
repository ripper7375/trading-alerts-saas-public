PROMPT 12: Profile Settings Form Component

========================================
Create a comprehensive profile settings form component for Next.js 15 using TypeScript, Tailwind CSS, shadcn/ui, React Hook Form, and Zod validation.

REQUIREMENTS:

1. FORM LAYOUT (Full width, organized sections):
   - Container: bg-white, rounded-xl, shadow-lg, p-8, max-w-4xl, mx-auto
   - Section heading: "Profile Information" (text-2xl, font-bold, text-gray-900, mb-8)

2. PROFILE PHOTO SECTION (Top):

   **Layout:**
   - Flex layout: Photo on left, upload controls on right
   - Avatar: Circular, 120px diameter, border-4 border-gray-200, shadow-lg
   - Default: User initials if no photo (bg-blue-600, text-white, text-4xl, font-bold)

   **Upload Controls:**
   - Current photo display with hover overlay:
     - Hover: Semi-transparent dark overlay with "Change Photo" text
     - Camera icon: 📷 (text-4xl, opacity-80)
   - Buttons below:
     - [Upload New Photo] (bg-blue-600, text-white, px-4, py-2, rounded-lg, hover:bg-blue-700)
     - [Remove Photo] (border-2, border-gray-300, text-gray-700, px-4, py-2, rounded-lg, hover:border-red-500, hover:text-red-600)

   **Upload Modal (when Upload clicked):**
   - Modal: max-w-md, bg-white, rounded-2xl, shadow-2xl, p-6
   - Heading: "Upload Profile Photo" (text-xl, font-bold, mb-4)
   - Drag & drop area:
     - Border: border-2 border-dashed border-gray-300, rounded-xl, p-8, text-center
     - Icon: 📸 (text-6xl, opacity-50)
     - Text: "Drag & drop your photo here" (text-gray-600, mb-2)
     - Subtext: "or click to browse" (text-sm, text-gray-500)
     - Accepted: JPG, PNG, GIF (max 5MB)
   - Preview area (after file selected):
     - Show cropped preview (circular, 200px)
     - Zoom slider: "Zoom: [====|====] 100%" (adjust crop)
     - Position: Drag to reposition
   - Buttons:
     - [Cancel] (border-2, border-gray-300, px-6, py-2, rounded-lg)
     - [Upload Photo] (bg-blue-600, text-white, px-6, py-2, rounded-lg, disabled until file selected)

3. PERSONAL INFORMATION SECTION:

   **Full Name Input:**
   - Label: "Full Name" (font-medium, text-gray-700, mb-2)
   - Input: placeholder="John Trader", value pre-filled
   - Validation:
     - Required (show: "Name is required")
     - Min 2 characters
     - Max 50 characters
   - Character counter: "24/50" (text-xs, text-gray-500, float right)

   **Email Address Input:**
   - Label: "Email Address" (font-medium, text-gray-700, mb-2)
   - Input: type="email", value pre-filled
   - Status badge: "✓ Verified" (bg-green-100, text-green-800, px-2, py-1, rounded, text-xs, font-semibold, inline-block, ml-2)
   - If not verified: "⚠️ Not Verified" (bg-yellow-100, text-yellow-800) + [Resend Verification] link
   - Note: "Used for login and notifications" (text-xs, text-gray-500, mt-1)
   - Change email link: "Change email address" (text-blue-600, text-sm, hover:underline)

   **Username Input (Optional):**
   - Label: "Username (optional)" (font-medium, text-gray-700, mb-2)
   - Input: placeholder="john_trader", with @ prefix displayed
   - Validation:
     - 3-20 characters
     - Alphanumeric and underscores only
     - No spaces
   - Availability check (real-time):
     - Checking: "Checking..." (text-gray-500, text-xs, with spinner)
     - Available: "✓ Available" (text-green-600, text-xs)
     - Taken: "✗ Username taken" (text-red-600, text-xs)
   - Preview: "Your profile URL: tradingalerts.com/@john_trader" (text-xs, text-gray-500, mt-1)

4. PROFESSIONAL INFORMATION SECTION:

   **Company/Organization:**
   - Label: "Company or Organization (optional)" (font-medium, text-gray-700, mb-2)
   - Input: placeholder="Acme Trading Co."

   **Job Title:**
   - Label: "Job Title (optional)" (font-medium, text-gray-700, mb-2)
   - Input: placeholder="Professional Trader"

   **Bio/About:**
   - Label: "Bio (optional)" (font-medium, text-gray-700, mb-2)
   - Textarea: rows={4}, placeholder="Tell us about yourself and your trading experience..."
   - Character limit: 500 characters
   - Counter: "150/500" (text-xs, text-gray-500, float right)
   - Helper text: "This will be visible on your public profile (if enabled)" (text-xs, text-gray-500, mt-1)

5. LOCATION & TIMEZONE SECTION:

   **Country/Region:**
   - Label: "Country/Region" (font-medium, text-gray-700, mb-2)
   - Select dropdown with search:
     - Options: All countries with flags
     - Example: "🇺🇸 United States"
     - Search enabled for quick filtering

   **Timezone:**
   - Label: "Timezone" (font-medium, text-gray-700, mb-2)
   - Select dropdown: Pre-filled with auto-detected timezone
   - Options grouped by region:
     - Americas
     - Europe
     - Asia
     - etc.
   - Current time preview: "Current time: 14:32 PST" (text-xs, text-gray-500, mt-1)

6. PREFERENCES SECTION:

   **Language Preference:**
   - Label: "Language" (font-medium, text-gray-700, mb-2)
   - Select: 🇺🇸 English | 🇪🇸 Español | 🇫🇷 Français | etc.

   **Date Format:**
   - Label: "Date Format" (font-medium, text-gray-700, mb-2)
   - Radio buttons (horizontal):
     - ◉ MM/DD/YYYY (01/15/2025)
     - ○ DD/MM/YYYY (15/01/2025)
     - ○ YYYY-MM-DD (2025-01-15)
   - Preview: "Preview: January 15, 2025" (text-xs, text-gray-500, mt-1)

   **Time Format:**
   - Label: "Time Format" (font-medium, text-gray-700, mb-2)
   - Radio buttons (horizontal):
     - ◉ 12-hour (2:30 PM)
     - ○ 24-hour (14:30)

   **Currency Display:**
   - Label: "Currency" (font-medium, text-gray-700, mb-2)
   - Select: USD $ | EUR € | GBP £ | JPY ¥ | etc.

7. PRIVACY SETTINGS SECTION:

   **Profile Visibility:**
   - Label: "Profile Visibility" (font-medium, text-gray-700, mb-2)
   - Radio buttons (vertical, with descriptions):
     - ◉ "Public"
       - Description: "Anyone can view your profile and trading stats" (text-sm, text-gray-600, ml-6)
     - ○ "Private"
       - Description: "Only you can see your profile" (text-sm, text-gray-600, ml-6)
     - ○ "Connections Only"
       - Description: "Only users you follow can view your profile" (text-sm, text-gray-600, ml-6)

   **Show Trading Stats:**
   - Checkbox: "☑ Show my trading statistics on public profile" (text-sm, text-gray-700)
   - Note: "Includes total alerts, chart views, and join date" (text-xs, text-gray-500, ml-6, mt-1)

   **Show Email:**
   - Checkbox: "☐ Make my email address public" (text-sm, text-gray-700)
   - Warning: "⚠️ Not recommended for privacy reasons" (text-xs, text-orange-600, ml-6, mt-1)

8. SOCIAL LINKS SECTION (Optional):

   **Twitter/X:**
   - Label: "Twitter/X (optional)" (font-medium, text-gray-700, mb-2)
   - Input with prefix: "https://twitter.com/" + input field

   **LinkedIn:**
   - Label: "LinkedIn (optional)" (font-medium, text-gray-700, mb-2)
   - Input with prefix: "https://linkedin.com/in/" + input field

   **Website:**
   - Label: "Website (optional)" (font-medium, text-gray-700, mb-2)
   - Input: placeholder="https://yourwebsite.com"
   - Validation: Must be valid URL

9. ACTION BUTTONS (Bottom, sticky on scroll):

   **Button Group:**
   - Background: bg-white, border-t-2 border-gray-200, p-6, sticky bottom-0, shadow-lg
   - Layout: Flex, justify-end, gap-4

   **Buttons:**
   - [Cancel] (border-2, border-gray-300, text-gray-700, px-6, py-3, rounded-lg, hover:bg-gray-100)
     - Reverts all changes
     - Shows confirmation if changes detected
   - [Save Changes] (bg-blue-600, text-white, px-8, py-3, rounded-lg, hover:bg-blue-700, font-semibold, shadow-lg)
     - Disabled when: No changes or validation errors
     - Loading state: Spinner + "Saving..."
     - Success state: Checkmark + "Saved!" (2 seconds)

10. UNSAVED CHANGES WARNING:
    - When user tries to leave with unsaved changes:
      - Modal: "You have unsaved changes"
      - Message: "Are you sure you want to leave? Your changes will be lost."
      - Buttons: [Stay & Save] [Leave Without Saving] [Cancel]

11. VALIDATION SCHEMA (Zod):

```typescript
const profileSchema = z.object({
  fullName: z.string().min(2).max(50),
  email: z.string().email(),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/).optional(),
  company: z.string().max(100).optional(),
  jobTitle: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  country: z.string().min(1),
  timezone: z.string().min(1),
  language: z.string().min(1),
  dateFormat: z.enum(['MDY', 'DMY', 'YMD']),
  timeFormat: z.enum(['12h', '24h']),
  currency: z.string().min(1),
  profileVisibility: z.enum(['public', 'private', 'connections']),
  showStats: z.boolean(),
  showEmail: z.boolean(),
  socialTwitter: z.string().url().optional().or(z.literal('')),
  socialLinkedIn: z.string().url().optional().or(z.literal('')),
  socialWebsite: z.string().url().optional().or(z.literal(''))
})

12. SUCCESS FEEDBACK:

Toast notification (top-right): "✓ Profile updated successfully!" (bg-green-500, text-white, p-4, rounded-lg, shadow-lg)
Auto-dismiss after 3 seconds
Confetti animation (optional)

13. ERROR HANDLING:

Username taken: Show error below field
Email already exists: Show error with "Use different email" suggestion
Upload failed: "Failed to upload photo. Please try again." (toast)
Server error: "Failed to save profile. Please try again later." (toast)

14. RESPONSIVE:

Desktop: Two-column layout for some sections (e.g., First name | Last name)
Tablet: Single column with full-width inputs
Mobile: Full-width everything, larger tap targets
Photo section: Stack vertically on mobile

15. TECHNICAL:

Export as default component
TypeScript with proper types
Use React Hook Form for form management
Use Zod for validation
Use shadcn/ui Input, Textarea, Select, Button, RadioGroup, Checkbox, Avatar components
Use lucide-react icons (Camera, Check, X, AlertCircle)
State for: form data, photo upload, unsaved changes
Mock API calls (save profile, upload photo, check username availability)
File upload with image cropping (use react-image-crop or similar)


Generate complete, production-ready code with all sections, validation, and image upload functionality that I can copy and run immediately.
```

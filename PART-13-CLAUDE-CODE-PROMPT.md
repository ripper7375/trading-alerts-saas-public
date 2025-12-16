# Part 13: Settings System - Claude Code Build Prompt

**Project:** Trading Alerts SaaS V7
**Task:** Build Part 13 (Settings System) autonomously
**Files to Build:** 17 files
**Estimated Time:** 4 hours
**Current Status:** Parts 6-12 complete and merged to main

---

## YOUR MISSION

You are Claude Code, tasked with building **Part 13: Settings System** for the Trading Alerts SaaS V7 project. You will build 17 files autonomously following all project policies, architecture rules, and quality standards.

**Your approach:**
1. Read ALL essential files listed below (policies, architecture, requirements)
2. Build files one-by-one in the specified order
3. Follow coding patterns from policy files
4. Validate each file after creation (TypeScript, ESLint, Prettier)
5. Commit each file individually with descriptive commit messages
6. Test the settings pages after all files are built

---

## ESSENTIAL FILES TO READ FIRST

**CRITICAL:** Read these files in order before writing any code. These files contain the "AI constitution" that guides all development.

### 1. **Project Overview & Current State**
```
PROGRESS-part-2.md                   # Current project status (Parts 6-12 complete)
README.md                            # Project overview
ARCHITECTURE-compress.md             # System architecture and design patterns (compressed)
IMPLEMENTATION-GUIDE.md              # Implementation best practices
```

### 2. **Policy Files (MUST READ - These are your rules)**
```
docs/policies/00-tier-specifications.md              # FREE vs PRO tier rules (CRITICAL)
docs/policies/01-approval-policies.md                # When to approve/fix/escalate
docs/policies/02-quality-standards.md                # TypeScript, error handling standards
docs/policies/03-architecture-rules.md               # File structure, architecture patterns
docs/policies/04-escalation-triggers.md              # When to ask for human help
docs/policies/05-coding-patterns-part-1.md           # Copy-paste ready code patterns (Part 1)
docs/policies/05-coding-patterns-part-2.md           # Copy-paste ready code patterns (Part 2)
docs/policies/06-aider-instructions.md               # Build workflow instructions
```

### 3. **Part 13 Requirements & Build Order**
```
docs/build-orders/part-13-settings.md                # Build order for all 17 files
docs/implementation-guides/v5_part_m.md              # Settings system business logic
```

### 4. **OpenAPI Specifications**
```
docs/trading_alerts_openapi.yaml                     # Next.js API contracts
```

### 5. **Seed Code References (CRITICAL - Use these patterns)**
```
seed-code/v0-components/settings-page-with-tabs-v3/app/settings/page.tsx      # Settings with tabs
seed-code/v0-components/profile-settings-form/app/profile/settings/page.tsx   # Profile form
seed-code/v0-components/profile-settings-form/components/photo-upload-modal.tsx
seed-code/v0-components/profile-settings-form/components/unsaved-changes-modal.tsx
seed-code/v0-components/billing-and-subscription-page-v3/app/billing/page.tsx # Billing page
```

### 6. **Validation & Testing**
```
VALIDATION-SETUP-GUIDE.md                            # Validation tools and process
CLAUDE.md                                            # Automated validation guide
```

### 7. **Previous Work (for context and dependencies)**
```
docs/build-orders/part-05-authentication.md          # Authentication (DEPENDENCY)
docs/build-orders/part-12-ecommerce.md               # Billing/subscriptions (DEPENDENCY)
```

---

## PART 13 - FILES TO BUILD (In Order)

Build these 17 files in sequence:

### **Settings Pages (8 pages)**

### **File 1/17:** `app/(dashboard)/settings/layout.tsx`
- Settings layout with sidebar navigation
- Tabs: Profile, Appearance, Account, Privacy, Billing, Language, Help
- Mobile-responsive collapsible sidebar
- Active tab highlighting
- **Reference Seed Code:** `seed-code/v0-components/settings-page-with-tabs-v3/app/settings/page.tsx`
- **Commit:** `feat(settings): add settings layout`

### **File 2/17:** `app/(dashboard)/settings/profile/page.tsx`
- Profile editing (name, email, avatar)
- Photo upload with drag-and-drop
- Username availability check
- Real-time form validation
- Unsaved changes warning
- **Reference Seed Code:** `seed-code/v0-components/profile-settings-form/app/profile/settings/page.tsx`
- **Commit:** `feat(settings): add profile settings page`

### **File 3/17:** `app/(dashboard)/settings/appearance/page.tsx`
- Theme selection: Light, Dark, System
- Color scheme selector
- Chart preferences (candlestick colors, grid opacity)
- Apply changes immediately (no save button needed)
- **Commit:** `feat(settings): add appearance settings`

### **File 4/17:** `app/(dashboard)/settings/account/page.tsx`
- Change password section (current, new, confirm)
- Password strength indicator
- Two-factor authentication toggle
- Active sessions list
- Delete account section with confirmation
- **Commit:** `feat(settings): add account settings`

### **File 5/17:** `app/(dashboard)/settings/privacy/page.tsx`
- Profile visibility (Public/Private/Connections Only)
- Data export request button
- Show trading statistics toggle
- Show email publicly toggle
- **Commit:** `feat(settings): add privacy settings`

### **File 6/17:** `app/(dashboard)/settings/billing/page.tsx`
- Current subscription card (FREE/PRO)
- Upgrade/Cancel buttons
- Payment method display
- Invoice history table
- Usage statistics (alerts, watchlist, API calls)
- Affiliate discount display
- **Reference Seed Code:** `seed-code/v0-components/billing-and-subscription-page-v3/app/billing/page.tsx`
- **Commit:** `feat(settings): add billing settings for 2-tier system`

### **File 7/17:** `app/(dashboard)/settings/language/page.tsx`
- Language selection dropdown
- Timezone selection
- Date format (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD)
- Time format (12-hour, 24-hour)
- Currency display
- **Commit:** `feat(settings): add language settings`

### **File 8/17:** `app/(dashboard)/settings/help/page.tsx`
- Quick links (Documentation, Live Chat, Email Support, Report Bug)
- FAQ accordion
- Contact form (subject, message)
- **Commit:** `feat(settings): add help page`

### **API Routes (6 routes)**

### **File 9/17:** `app/api/user/profile/route.ts`
- **GET:** Get user profile
- **PATCH:** Update profile (name, email, avatar)
- Email change triggers verification email
- Avatar upload validation (max 5MB, JPG/PNG/GIF)
- **Commit:** `feat(api): add profile update endpoint`

### **File 10/17:** `app/api/user/preferences/route.ts`
- **GET:** Get user preferences
- **PUT:** Update preferences (theme, language, timezone, etc.)
- Validate preference values
- **Commit:** `feat(api): add preferences endpoint`

### **File 11/17:** `app/api/user/password/route.ts`
- **POST:** Change password
- Validate current password
- Enforce password requirements (8+ chars, uppercase, lowercase, number)
- Send notification email after change
- **Commit:** `feat(api): add password change endpoint`

### **File 12/17:** `app/api/user/account/deletion-request/route.ts`
- **POST:** Request account deletion
- Create deletion request record
- Send confirmation email with link
- Return request ID
- **Commit:** `feat(api): add account deletion request`

### **File 13/17:** `app/api/user/account/deletion-confirm/route.ts`
- **POST:** Confirm account deletion
- Verify token from email
- Schedule account deletion (24 hours)
- Return success
- **Commit:** `feat(api): add account deletion confirmation`

### **File 14/17:** `app/api/user/account/deletion-cancel/route.ts`
- **POST:** Cancel deletion request
- Mark request as cancelled
- Return success
- **Commit:** `feat(api): add account deletion cancellation`

### **Utilities & Providers (3 files)**

### **File 15/17:** `lib/preferences/defaults.ts`
- Default user preferences object
- Preference types and enums
- Merge function for preferences
- **Commit:** `feat(settings): add default preferences`

### **File 16/17:** `components/providers/theme-provider.tsx`
- Dark mode provider using next-themes
- System preference detection
- Theme context
- **Commit:** `feat(settings): add theme provider`

### **File 17/17:** `components/providers/websocket-provider.tsx`
- WebSocket connection provider
- Connection state management
- Reconnection logic
- Context for real-time updates
- **Commit:** `feat(settings): add WebSocket provider`

---

## GIT WORKFLOW

### **Branch Strategy**
```bash
# Create new branch (MUST start with 'claude/' and end with session ID)
git checkout -b claude/settings-system-{SESSION_ID}

# Build files one by one, commit each file individually
# After all 17 files complete:
git push -u origin claude/settings-system-{SESSION_ID}
```

### **Commit Message Format**
Use conventional commits:
```
feat(settings): add settings layout
feat(settings): add profile settings page
feat(api): add profile update endpoint
fix(settings): correct TypeScript type error in preferences
```

### **Push Requirements**
- Branch MUST start with `claude/`
- Branch MUST end with session ID
- Push ONLY after all validations pass
- Create PR after push (do NOT merge to main directly)

---

## VALIDATION REQUIREMENTS

After building each file, run validation:

```bash
# Validate TypeScript types
npm run validate:types

# Validate code quality
npm run validate:lint

# Validate formatting
npm run validate:format

# Run all validations together
npm run validate
```

### **Auto-Fix Minor Issues**
```bash
# Auto-fix ESLint and Prettier issues
npm run fix
```

### **Validation Must Pass Before Committing**
- 0 TypeScript errors
- 0 ESLint errors (warnings OK if < 3)
- All files properly formatted
- No unused imports
- All functions have return types

---

## KEY REQUIREMENTS FOR PART 13

### **1. Settings Navigation Structure**

**Sidebar Tabs:**
```typescript
const settingsTabs = [
  { id: 'profile', icon: '👤', label: 'Profile', href: '/settings/profile' },
  { id: 'appearance', icon: '🎨', label: 'Appearance', href: '/settings/appearance' },
  { id: 'account', icon: '🔒', label: 'Account', href: '/settings/account' },
  { id: 'privacy', icon: '👁️', label: 'Privacy', href: '/settings/privacy' },
  { id: 'billing', icon: '💳', label: 'Billing', href: '/settings/billing' },
  { id: 'language', icon: '🌐', label: 'Language', href: '/settings/language' },
  { id: 'help', icon: '❓', label: 'Help', href: '/settings/help' },
];
```

### **2. User Preferences Model**

```typescript
interface UserPreferences {
  // Appearance
  theme: 'light' | 'dark' | 'system';
  colorScheme: 'blue' | 'purple' | 'green' | 'orange';

  // Language & Region
  language: string;           // e.g., 'en-US'
  timezone: string;           // e.g., 'America/New_York'
  dateFormat: 'MDY' | 'DMY' | 'YMD';
  timeFormat: '12h' | '24h';
  currency: string;           // e.g., 'USD'

  // Privacy
  profileVisibility: 'public' | 'private' | 'connections';
  showStats: boolean;
  showEmail: boolean;

  // Notifications (from Part 8)
  emailNotifications: boolean;
  pushNotifications: boolean;
}
```

### **3. Profile Validation Rules**

```typescript
// Zod schema for profile updates
const profileUpdateSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  username: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/).optional(),
  bio: z.string().max(500).optional(),
  company: z.string().max(100).optional(),
  avatarUrl: z.string().url().optional(),
});
```

### **4. Password Requirements**

```typescript
// Password validation
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain uppercase letter')
  .regex(/[a-z]/, 'Password must contain lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

function getPasswordStrength(password: string): 'weak' | 'medium' | 'strong' {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score < 3) return 'weak';
  if (score < 5) return 'medium';
  return 'strong';
}
```

### **5. Account Deletion Flow**

**Step 1: Request Deletion**
- User clicks "Delete Account" button
- Confirmation modal appears with warnings
- User confirms → POST /api/user/account/deletion-request
- Email sent with confirmation link
- 7-day grace period to cancel

**Step 2: Confirm Deletion (via email link)**
- User clicks link in email
- POST /api/user/account/deletion-confirm with token
- Account scheduled for deletion in 24 hours
- All user data deleted (GDPR compliance)

**Step 3: Cancel Deletion (optional)**
- User can cancel within 7 days
- POST /api/user/account/deletion-cancel

### **6. TypeScript Compliance (CRITICAL)**
- NO `any` types allowed
- All function parameters typed
- All return types specified
- Use Prisma-generated types where applicable
- Use proper React types (`FC`, `ReactNode`, etc.)

---

## TESTING REQUIREMENTS

After building all 17 files:

### **1. Start Development Server**
```bash
npm run dev
# Should start on http://localhost:3000
```

### **2. Manual Testing Checklist**
- [ ] Visit `http://localhost:3000/settings/profile`
- [ ] Verify settings layout loads with sidebar
- [ ] Test all tab navigation (Profile → Help)
- [ ] Update profile name and save
- [ ] Change theme (Light/Dark/System) - should apply immediately
- [ ] Change password with valid inputs
- [ ] Request account deletion and check email
- [ ] Cancel deletion request
- [ ] Check billing page shows correct tier
- [ ] Test language/timezone changes
- [ ] Submit help form

### **3. API Testing**
```bash
# GET profile
curl http://localhost:3000/api/user/profile

# PATCH profile
curl -X PATCH http://localhost:3000/api/user/profile \
  -H "Content-Type: application/json" \
  -d '{"name": "New Name"}'

# PUT preferences
curl -X PUT http://localhost:3000/api/user/preferences \
  -H "Content-Type: application/json" \
  -d '{"theme": "dark", "language": "en-US"}'

# POST password change
curl -X POST http://localhost:3000/api/user/password \
  -H "Content-Type: application/json" \
  -d '{"currentPassword": "...", "newPassword": "..."}'

# POST deletion request
curl -X POST http://localhost:3000/api/user/account/deletion-request
```

### **4. Console Checks**
- [ ] No console errors
- [ ] No React hydration warnings
- [ ] API calls return correct status codes

### **5. TypeScript Build**
```bash
npm run build
# Should complete with 0 errors
```

---

## CODING PATTERNS TO FOLLOW

### **Pattern 1: Settings Layout**
```typescript
// app/(dashboard)/settings/layout.tsx
'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface SettingsLayoutProps {
  children: React.ReactNode;
}

const settingsTabs = [
  { id: 'profile', icon: '👤', label: 'Profile', href: '/settings/profile' },
  { id: 'appearance', icon: '🎨', label: 'Appearance', href: '/settings/appearance' },
  { id: 'account', icon: '🔒', label: 'Account', href: '/settings/account' },
  { id: 'privacy', icon: '👁️', label: 'Privacy', href: '/settings/privacy' },
  { id: 'billing', icon: '💳', label: 'Billing', href: '/settings/billing' },
  { id: 'language', icon: '🌐', label: 'Language', href: '/settings/language' },
  { id: 'help', icon: '❓', label: 'Help', href: '/settings/help' },
];

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <nav className="text-sm text-gray-500 mb-4">
          Dashboard &gt; Settings
        </nav>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600 mb-8">
          Manage your account settings and preferences
        </p>

        {/* Layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <div className="hidden lg:block w-64 flex-shrink-0">
            <div className="bg-white rounded-xl shadow-md p-4 sticky top-4">
              <nav className="space-y-2">
                {settingsTabs.map((tab) => (
                  <Link
                    key={tab.id}
                    href={tab.href}
                    className={cn(
                      'w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center gap-3',
                      pathname === tab.href
                        ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600 font-semibold'
                        : 'text-gray-700 hover:bg-gray-100'
                    )}
                  >
                    <span className="text-xl">{tab.icon}</span>
                    <span>{tab.label}</span>
                  </Link>
                ))}
              </nav>
            </div>
          </div>

          {/* Mobile Tabs */}
          <div className="lg:hidden overflow-x-auto">
            <div className="flex gap-2 pb-4">
              {settingsTabs.map((tab) => (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap',
                    pathname === tab.href
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border-2 border-gray-200 text-gray-700'
                  )}
                >
                  <span>{tab.icon}</span>
                  <span className="text-sm">{tab.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1">
            <div className="bg-white rounded-xl shadow-md p-6 md:p-8 min-h-[600px]">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### **Pattern 2: Profile API Route**
```typescript
// app/api/user/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

const profileUpdateSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  email: z.string().email().optional(),
  username: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/).optional(),
  bio: z.string().max(500).optional(),
  company: z.string().max(100).optional(),
  avatarUrl: z.string().url().optional(),
});

export async function GET(): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        tier: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = profileUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { name, email, username, bio, company, avatarUrl } = validation.data;

    // Check email uniqueness if changing
    if (email && email !== session.user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: 'Email already in use' },
          { status: 409 }
        );
      }

      // TODO: Send verification email to new address
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(avatarUrl && { image: avatarUrl }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        tier: true,
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
```

### **Pattern 3: Password Change Route**
```typescript
// app/api/user/password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db/prisma';
import { hash, compare } from 'bcryptjs';
import { z } from 'zod';

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[a-z]/, 'Password must contain lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = passwordChangeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = validation.data;

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true, email: true, name: true },
    });

    if (!user || !user.password) {
      return NextResponse.json(
        { error: 'User not found or uses OAuth' },
        { status: 400 }
      );
    }

    // Verify current password
    const isValid = await compare(currentPassword, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 401 }
      );
    }

    // Hash new password
    const hashedPassword = await hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: hashedPassword },
    });

    // TODO: Send password changed notification email

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Password change error:', error);
    return NextResponse.json(
      { error: 'Failed to change password' },
      { status: 500 }
    );
  }
}
```

### **Pattern 4: Preferences Route**
```typescript
// app/api/user/preferences/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import { DEFAULT_PREFERENCES } from '@/lib/preferences/defaults';

const preferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  colorScheme: z.enum(['blue', 'purple', 'green', 'orange']).optional(),
  language: z.string().optional(),
  timezone: z.string().optional(),
  dateFormat: z.enum(['MDY', 'DMY', 'YMD']).optional(),
  timeFormat: z.enum(['12h', '24h']).optional(),
  currency: z.string().optional(),
  profileVisibility: z.enum(['public', 'private', 'connections']).optional(),
  showStats: z.boolean().optional(),
  showEmail: z.boolean().optional(),
});

export async function GET(): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userPreferences = await prisma.userPreferences.findUnique({
      where: { userId: session.user.id },
    });

    // Merge with defaults
    const preferences = {
      ...DEFAULT_PREFERENCES,
      ...(userPreferences?.preferences as Record<string, unknown> || {}),
    };

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('Get preferences error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = preferencesSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const preferences = validation.data;

    // Upsert preferences
    const updated = await prisma.userPreferences.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        preferences: preferences as Record<string, unknown>,
      },
      update: {
        preferences: preferences as Record<string, unknown>,
      },
    });

    return NextResponse.json({
      preferences: {
        ...DEFAULT_PREFERENCES,
        ...(updated.preferences as Record<string, unknown>),
      },
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}
```

### **Pattern 5: Default Preferences**
```typescript
// lib/preferences/defaults.ts

export interface UserPreferences {
  // Appearance
  theme: 'light' | 'dark' | 'system';
  colorScheme: 'blue' | 'purple' | 'green' | 'orange';

  // Language & Region
  language: string;
  timezone: string;
  dateFormat: 'MDY' | 'DMY' | 'YMD';
  timeFormat: '12h' | '24h';
  currency: string;

  // Privacy
  profileVisibility: 'public' | 'private' | 'connections';
  showStats: boolean;
  showEmail: boolean;

  // Notifications
  emailNotifications: boolean;
  pushNotifications: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  // Appearance
  theme: 'system',
  colorScheme: 'blue',

  // Language & Region
  language: 'en-US',
  timezone: 'America/New_York',
  dateFormat: 'MDY',
  timeFormat: '12h',
  currency: 'USD',

  // Privacy
  profileVisibility: 'private',
  showStats: false,
  showEmail: false,

  // Notifications
  emailNotifications: true,
  pushNotifications: true,
};

export function mergePreferences(
  defaults: UserPreferences,
  custom: Partial<UserPreferences>
): UserPreferences {
  return { ...defaults, ...custom };
}
```

### **Pattern 6: Theme Provider**
```typescript
// components/providers/theme-provider.tsx
'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { type ThemeProviderProps } from 'next-themes/dist/types';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
```

### **Pattern 7: Account Deletion Request**
```typescript
// app/api/user/account/deletion-request/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db/prisma';
import { randomBytes } from 'crypto';

export async function POST(): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for existing pending request
    const existingRequest = await prisma.accountDeletionRequest.findFirst({
      where: {
        userId: session.user.id,
        status: 'PENDING',
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        {
          error: 'Deletion already requested',
          message: 'You already have a pending deletion request',
          requestId: existingRequest.id,
        },
        { status: 400 }
      );
    }

    // Generate confirmation token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create deletion request
    const request = await prisma.accountDeletionRequest.create({
      data: {
        userId: session.user.id,
        token,
        status: 'PENDING',
        expiresAt,
      },
    });

    // TODO: Send confirmation email with token link
    const confirmationUrl = `${process.env.NEXTAUTH_URL}/account/confirm-deletion?token=${token}`;
    const cancelUrl = `${process.env.NEXTAUTH_URL}/account/cancel-deletion?token=${token}`;

    console.log('[AccountDeletion] Confirmation URL:', confirmationUrl);
    console.log('[AccountDeletion] Cancel URL:', cancelUrl);

    return NextResponse.json({
      success: true,
      message: 'Deletion request created. Check your email for confirmation.',
      requestId: request.id,
      expiresAt,
    });
  } catch (error) {
    console.error('Deletion request error:', error);
    return NextResponse.json(
      { error: 'Failed to create deletion request' },
      { status: 500 }
    );
  }
}
```

---

## CRITICAL RULES

### **DO:**
- Read ALL policy files before writing code
- Use consistent settings layout across all pages
- Implement unsaved changes warnings
- Apply theme changes immediately (no save needed)
- Validate all form inputs with Zod
- Use TypeScript strictly (no `any` types)
- Reference seed code for component patterns
- Validate after each file
- Commit each file individually
- Use shadcn/ui components consistently
- Test thoroughly before pushing

### **DON'T:**
- Skip reading policy files
- Use `any` types
- Skip authentication checks in API routes
- Allow invalid preferences to be saved
- Skip validation on password changes
- Commit multiple files at once (commit one-by-one)
- Push without validation passing
- Push to main branch directly (use feature branch)
- Skip testing

---

## SUCCESS CRITERIA

Part 13 is complete when:

- All 17 files created and committed
- All TypeScript validations pass (0 errors)
- All ESLint checks pass
- Settings layout loads at `/settings/profile` without errors
- All 7 settings tabs navigate correctly
- Profile can be edited and saved
- Theme changes apply immediately
- Password change works with validation
- Account deletion flow works (request → confirm → cancel)
- Billing page shows correct tier (FREE/PRO)
- Preferences save and load correctly
- All API endpoints work
- All manual tests pass
- Code pushed to feature branch
- PR created (ready for review)

---

## PROGRESS TRACKING

Use the TodoWrite tool to track your progress:

```
1. Read all policy and architecture files
2. Build File 1/17: app/(dashboard)/settings/layout.tsx
3. Build File 2/17: app/(dashboard)/settings/profile/page.tsx
4. Build File 3/17: app/(dashboard)/settings/appearance/page.tsx
5. Build File 4/17: app/(dashboard)/settings/account/page.tsx
6. Build File 5/17: app/(dashboard)/settings/privacy/page.tsx
7. Build File 6/17: app/(dashboard)/settings/billing/page.tsx
8. Build File 7/17: app/(dashboard)/settings/language/page.tsx
9. Build File 8/17: app/(dashboard)/settings/help/page.tsx
10. Build File 9/17: app/api/user/profile/route.ts
11. Build File 10/17: app/api/user/preferences/route.ts
12. Build File 11/17: app/api/user/password/route.ts
13. Build File 12/17: app/api/user/account/deletion-request/route.ts
14. Build File 13/17: app/api/user/account/deletion-confirm/route.ts
15. Build File 14/17: app/api/user/account/deletion-cancel/route.ts
16. Build File 15/17: lib/preferences/defaults.ts
17. Build File 16/17: components/providers/theme-provider.tsx
18. Build File 17/17: components/providers/websocket-provider.tsx
19. Run full validation suite
20. Test settings manually
21. Push to feature branch
22. Create pull request
```

---

## START HERE

1. **First, read these files in order:**
   - `PROGRESS-part-2.md` - Understand current state
   - `docs/policies/00-tier-specifications.md` - Learn tier system (CRITICAL)
   - `docs/policies/05-coding-patterns-part-1.md` - Learn code patterns
   - `docs/policies/05-coding-patterns-part-2.md` - More code patterns
   - `docs/build-orders/part-13-settings.md` - Understand Part 13
   - `docs/implementation-guides/v5_part_m.md` - Settings business logic
   - Seed code files for component patterns

2. **Then, create your git branch:**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b claude/settings-system-{SESSION_ID}
   ```

3. **Start building File 1/17:**
   - Read the build order for File 1
   - Reference seed code
   - Write the file following patterns
   - Validate: `npm run validate`
   - Fix any issues: `npm run fix`
   - Commit: `git commit -m "feat(settings): add settings layout"`

4. **Repeat for Files 2-17**

5. **After all files complete:**
   - Run final validation
   - Test manually
   - Push to remote
   - Create PR

---

## WHEN TO ASK FOR HELP

Escalate to the user if:

- Critical security issues found
- Ambiguous requirements (can't determine correct approach)
- Missing dependencies or seed code
- Validation errors you can't resolve
- Database schema questions
- Theme provider integration issues
- WebSocket implementation questions
- Account deletion flow questions

Otherwise, work autonomously following the policies!

---

**Good luck! Build Part 13 with quality and precision. The user trusts you to follow all policies and deliver production-ready code.**

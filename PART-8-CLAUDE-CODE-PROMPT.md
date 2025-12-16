# Part 8: Dashboard & Layout Components - Claude Code Build Prompt

**Project:** Trading Alerts SaaS V7
**Task:** Build Part 8 (Dashboard & Layout Components) autonomously
**Files to Build:** 9 files
**Estimated Time:** 3 hours
**Current Status:** Parts 6 & 7 complete and merged to main

---

## 🎯 YOUR MISSION

You are Claude Code, tasked with building **Part 8: Dashboard & Layout Components** for the Trading Alerts SaaS V7 project. You will build 9 files autonomously following all project policies, architecture rules, and quality standards.

**Your approach:**

1. Read ALL essential files listed below (policies, architecture, requirements)
2. Build files one-by-one in the specified order
3. Follow coding patterns from policy files
4. Validate each file after creation (TypeScript, ESLint, Prettier)
5. Commit each file individually with descriptive commit messages
6. Test the dashboard after all files are built

---

## 📋 ESSENTIAL FILES TO READ FIRST

**CRITICAL:** Read these files in order before writing any code. These files contain the "AI constitution" that guides all development.

### 1️⃣ **Project Overview & Current State**

```
PROGRESS.md                  # Current project status (Parts 6 & 7 complete)
README.md                    # Project overview
ARCHITECTURE.md              # System architecture and design patterns
IMPLEMENTATION-GUIDE.md      # Implementation best practices
```

### 2️⃣ **Policy Files (MUST READ - These are your rules)**

```
docs/policies/00-tier-specifications.md              # FREE vs PRO tier rules
docs/policies/01-approval-policies.md                # When to approve/fix/escalate
docs/policies/02-quality-standards.md                # TypeScript, error handling standards
docs/policies/03-architecture-rules.md               # File structure, architecture patterns
docs/policies/04-escalation-triggers.md              # When to ask for human help
docs/policies/05-coding-patterns.md                  # Copy-paste ready code patterns
docs/policies/06-aider-instructions.md               # Build workflow instructions
```

### 3️⃣ **Part 8 Requirements & Build Order**

```
docs/build-orders/part-08-dashboard.md               # Build order for all 9 files
docs/implementation-guides/v5_part_h.md              # Detailed specifications for Part 8
```

### 4️⃣ **OpenAPI Specifications**

```
docs/trading_alerts_openapi.yaml                     # Next.js API contracts
docs/flask_mt5_openapi.yaml                          # Flask MT5 API contracts
```

### 5️⃣ **Seed Code References (for patterns and components)**

```
seed-code/next-shadcn-dashboard-starter/             # Dashboard layout patterns
seed-code/v0-components/dashboard-home-component/    # Dashboard home component
seed-code/v0-components/footer-component/            # Footer component reference
seed-code/saas-starter/                              # SaaS authentication patterns
```

### 6️⃣ **Validation & Testing**

```
VALIDATION-SETUP-GUIDE.md                            # Validation tools and process
CLAUDE.md                                            # Aider automated validation guide
```

### 7️⃣ **Previous Work (for context)**

```
docs/build-orders/part-05-authentication.md          # Authentication (dependency)
docs/build-orders/part-04-tier-system.md             # Tier system (dependency)
docs/build-orders/part-06-flask-mt5.md               # Flask service (Parts 6 complete)
docs/build-orders/part-07-indicators-api.md          # Indicators API (Part 7 complete)
```

---

## 📦 PART 8 - FILES TO BUILD (In Order)

Build these 9 files in sequence:

### **File 1/9:** `app/(dashboard)/layout.tsx`

- Dashboard layout with sidebar
- Show tier badge in header
- Tier-based menu items (hide PRO features for FREE users)
- **Commit:** `feat(dashboard): add layout with tier badge`

### **File 2/9:** `app/(dashboard)/dashboard/page.tsx`

- Dashboard overview page with stats cards
- Stats: alerts count, watchlists, tier info
- Recent alerts widget
- Watchlist widget
- **Reference:** `seed-code/v0-components/dashboard-home-component/`
- **Commit:** `feat(dashboard): add overview page`

### **File 3/9:** `components/layout/header.tsx`

- Top header with logo
- User menu (tier badge, settings, logout)
- Notification bell
- **Commit:** `feat(layout): add header with tier display`

### **File 4/9:** `components/layout/sidebar.tsx`

- Navigation menu with active link highlighting
- Hide PRO features for FREE tier users
- **Commit:** `feat(layout): add sidebar with tier-based menu`

### **File 5/9:** `components/layout/mobile-nav.tsx`

- Mobile navigation drawer
- Same tier-based logic as sidebar
- **Commit:** `feat(layout): add mobile navigation`

### **File 6/9:** `components/layout/footer.tsx`

- Dashboard footer with links and copyright
- **Reference:** `seed-code/v0-components/footer-component/`
- **Commit:** `feat(layout): add footer`

### **File 7/9:** `components/dashboard/stats-card.tsx`

- Reusable stats card component
- Props: icon, title, value, change percentage
- **Commit:** `feat(dashboard): add stats card component`

### **File 8/9:** `components/dashboard/recent-alerts.tsx`

- Recent alerts widget showing last 5 alerts
- Link to full alerts page
- **Commit:** `feat(dashboard): add recent alerts widget`

### **File 9/9:** `components/dashboard/watchlist-widget.tsx`

- Watchlist preview widget
- Shows top watchlists
- Link to full watchlist page
- **Commit:** `feat(dashboard): add watchlist widget`

---

## 🔧 GIT WORKFLOW

### **Branch Strategy**

```bash
# Create new branch (MUST start with 'claude/' and end with session ID)
git checkout -b claude/dashboard-layout-01PyqZfNHS1Kdj5ii9BmFW2c

# Build files one by one, commit each file individually
# After all 9 files complete:
git push -u origin claude/dashboard-layout-01PyqZfNHS1Kdj5ii9BmFW2c
```

### **Commit Message Format**

Use conventional commits:

```
feat(dashboard): add layout with tier badge
feat(layout): add header with tier display
fix(dashboard): correct TypeScript type error in stats card
```

### **Push Requirements**

- ✅ Branch MUST start with `claude/`
- ✅ Branch MUST end with session ID
- ✅ Push ONLY after all validations pass
- ✅ Create PR after push (do NOT merge to main directly)

---

## ✅ VALIDATION REQUIREMENTS

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

- ✅ 0 TypeScript errors
- ✅ 0 ESLint errors (warnings OK if < 3)
- ✅ All files properly formatted
- ✅ No unused imports
- ✅ All functions have return types

---

## 🎯 KEY REQUIREMENTS FOR PART 8

### **1. Tier-Based UI (CRITICAL)**

- ✅ Show user's tier badge in header (FREE or PRO)
- ✅ Hide PRO features in navigation for FREE users
- ✅ Dashboard stats must reflect tier limitations:
  - FREE: 5 symbols, 3 timeframes
  - PRO: 15 symbols, 9 timeframes

### **2. TypeScript Compliance (CRITICAL)**

- ✅ NO `any` types allowed
- ✅ All function parameters typed
- ✅ All return types specified
- ✅ Import types from generated OpenAPI types where applicable
- ✅ Use proper React types (`FC`, `ReactNode`, etc.)

### **3. Authentication Integration**

- ✅ Use `getServerSession()` in server components
- ✅ Use `useSession()` in client components
- ✅ Redirect to login if not authenticated
- ✅ Show loading state while checking session

### **4. Component Patterns**

- ✅ Use shadcn/ui components (Button, Card, Badge, etc.)
- ✅ Use Lucide icons for consistency
- ✅ Follow Next.js 14 App Router patterns
- ✅ Server components by default, mark client components with `"use client"`

### **5. Error Handling**

- ✅ Try-catch blocks in async operations
- ✅ User-friendly error messages
- ✅ Loading states for async operations
- ✅ Error boundaries where appropriate

### **6. Responsive Design**

- ✅ Mobile-first approach
- ✅ Use Tailwind responsive classes (`sm:`, `md:`, `lg:`)
- ✅ Mobile navigation for small screens
- ✅ Desktop sidebar for large screens

---

## 🧪 TESTING REQUIREMENTS

After building all 9 files:

### **1. Start Development Server**

```bash
npm run dev
# Should start on http://localhost:3000
```

### **2. Manual Testing Checklist**

- [ ] Visit `http://localhost:3000/dashboard`
- [ ] Verify dashboard loads without errors
- [ ] Check tier badge displays correctly in header
- [ ] Verify navigation menu shows/hides based on tier
- [ ] Test mobile navigation (resize browser to mobile width)
- [ ] Check stats cards display placeholder data
- [ ] Verify recent alerts widget renders
- [ ] Verify watchlist widget renders
- [ ] Test logout functionality
- [ ] Check responsive layout on mobile/tablet/desktop

### **3. Console Checks**

- [ ] No console errors
- [ ] No React hydration warnings
- [ ] No missing key props warnings

### **4. TypeScript Build**

```bash
npm run build
# Should complete with 0 errors
```

---

## 📝 CODING PATTERNS TO FOLLOW

### **Pattern 1: Server Component with Session**

```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/login');
  }

  const tier = session.user.tier; // 'FREE' or 'PRO'

  return (
    <div>
      {/* Dashboard content */}
    </div>
  );
}
```

### **Pattern 2: Client Component with Session**

```typescript
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function Header() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return <div>Loading...</div>;
  }

  const tier = session?.user?.tier || 'FREE';

  return (
    <header>
      {/* Header content */}
      <Badge>{tier}</Badge>
    </header>
  );
}
```

### **Pattern 3: Tier-Based Navigation**

```typescript
const navigationItems = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    tier: 'FREE',
  },
  { name: 'Charts', href: '/charts', icon: LineChart, tier: 'FREE' },
  { name: 'Alerts', href: '/alerts', icon: Bell, tier: 'FREE' },
  { name: 'Watchlist', href: '/watchlist', icon: Eye, tier: 'FREE' },
  {
    name: 'Advanced Analytics',
    href: '/analytics',
    icon: BarChart,
    tier: 'PRO',
  }, // PRO only
  {
    name: 'Custom Indicators',
    href: '/indicators',
    icon: TrendingUp,
    tier: 'PRO',
  }, // PRO only
];

// Filter based on user tier
const userTier = session?.user?.tier || 'FREE';
const allowedItems = navigationItems.filter((item) => {
  if (item.tier === 'PRO') {
    return userTier === 'PRO';
  }
  return true; // FREE tier items shown to everyone
});
```

### **Pattern 4: Stats Card Component**

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: number; // Percentage change
  icon: LucideIcon;
}

export function StatsCard({ title, value, change, icon: Icon }: StatsCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change !== undefined && (
          <p className={`text-xs ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {change >= 0 ? '+' : ''}{change}% from last month
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

---

## 🚨 CRITICAL RULES

### **DO:**

- ✅ Read ALL policy files before writing code
- ✅ Follow tier-based access control patterns
- ✅ Use TypeScript strictly (no `any` types)
- ✅ Validate after each file
- ✅ Commit each file individually
- ✅ Reference seed code for component patterns
- ✅ Use shadcn/ui components consistently
- ✅ Test thoroughly before pushing

### **DON'T:**

- ❌ Skip reading policy files
- ❌ Use `any` types
- ❌ Commit multiple files at once (commit one-by-one)
- ❌ Push without validation passing
- ❌ Hardcode tier logic (use constants from policies)
- ❌ Create components from scratch if seed code exists
- ❌ Push to main branch directly (use feature branch)
- ❌ Skip testing

---

## 🎯 SUCCESS CRITERIA

Part 8 is complete when:

- ✅ All 9 files created and committed
- ✅ All TypeScript validations pass (0 errors)
- ✅ All ESLint checks pass
- ✅ Dashboard loads at `/dashboard` without errors
- ✅ Tier badge displays correctly
- ✅ Navigation adapts to user tier
- ✅ Mobile navigation works
- ✅ All manual tests pass
- ✅ Code pushed to feature branch
- ✅ PR created (ready for review)

---

## 📊 PROGRESS TRACKING

Use the TodoWrite tool to track your progress:

```
1. Read all policy and architecture files
2. Build File 1/9: app/(dashboard)/layout.tsx
3. Build File 2/9: app/(dashboard)/dashboard/page.tsx
4. Build File 3/9: components/layout/header.tsx
5. Build File 4/9: components/layout/sidebar.tsx
6. Build File 5/9: components/layout/mobile-nav.tsx
7. Build File 6/9: components/layout/footer.tsx
8. Build File 7/9: components/dashboard/stats-card.tsx
9. Build File 8/9: components/dashboard/recent-alerts.tsx
10. Build File 9/9: components/dashboard/watchlist-widget.tsx
11. Run full validation suite
12. Test dashboard manually
13. Push to feature branch
14. Create pull request
```

---

## 🚀 START HERE

1. **First, read these files in order:**
   - `PROGRESS.md` - Understand current state
   - `docs/policies/00-tier-specifications.md` - Learn tier system
   - `docs/policies/05-coding-patterns.md` - Learn code patterns
   - `docs/build-orders/part-08-dashboard.md` - Understand Part 8
   - `docs/implementation-guides/v5_part_h.md` - Detailed specs

2. **Then, create your git branch:**

   ```bash
   git checkout main
   git pull origin main
   git checkout -b claude/dashboard-layout-01PyqZfNHS1Kdj5ii9BmFW2c
   ```

3. **Start building File 1/9:**
   - Read the build order for File 1
   - Reference seed code if needed
   - Write the file following patterns
   - Validate: `npm run validate`
   - Fix any issues: `npm run fix`
   - Commit: `git commit -m "feat(dashboard): add layout with tier badge"`

4. **Repeat for Files 2-9**

5. **After all files complete:**
   - Run final validation
   - Test manually
   - Push to remote
   - Create PR

---

## 💬 WHEN TO ASK FOR HELP

Escalate to the user if:

- 🚨 Critical security issues found
- 🚨 Ambiguous requirements (can't determine correct approach)
- 🚨 Missing dependencies or seed code
- 🚨 Validation errors you can't resolve
- 🚨 Architectural decisions needed (e.g., state management approach)

Otherwise, work autonomously following the policies!

---

**Good luck! Build Part 8 with quality and precision. The user trusts you to follow all policies and deliver production-ready code.** 🚀

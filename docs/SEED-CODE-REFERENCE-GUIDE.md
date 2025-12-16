# Seed Code Reference Guide for Aider & Claude Code

**Created:** 2025-11-18
**Purpose:** Quick lookup guide to find the right seed code for any implementation issue
**For:** Aider and Claude Code autonomous development

---

## 📖 How to Use This Guide

When you encounter an implementation issue:

1. **Identify your issue category** from the table of contents below
2. **Find the relevant seed files** for that category
3. **Read the seed files** to understand implementation patterns
4. **Adapt the patterns** to match your specific requirements
5. **Only escalate** if seed code doesn't provide the pattern you need

### ⚠️ Important: Handling Document Conflicts

If you encounter conflicting information between documents:

- **Check git commit dates:** `git log --oneline -- path/to/document.md`
- **Use most recent version** as source of truth
- **Precedence:** Policy docs > Implementation guides > Technical docs > Seed code
- **Reference:** See `docs/policies/04-escalation-triggers.md` section "Handling Document Conflicts"

**Example:** If one doc says "3 symbols" (older) and another says "5 symbols" (newer), use the newer version (5 symbols).

---

## 📑 Quick Lookup Table

| Issue Category          | Jump To                                          | Common Scenarios                              |
| ----------------------- | ------------------------------------------------ | --------------------------------------------- |
| Authentication          | [→ Section 1](#1-authentication-patterns)        | Login, signup, OAuth, session management      |
| Dashboard Layout        | [→ Section 2](#2-dashboard-layout-patterns)      | Dashboard structure, sidebar, navigation      |
| API Routes              | [→ Section 3](#3-api-routes-patterns)            | REST endpoints, validation, error handling    |
| Forms                   | [→ Section 4](#4-form-patterns)                  | Form validation, Zod schemas, React Hook Form |
| Billing & Subscriptions | [→ Section 5](#5-billing--subscription-patterns) | Stripe, payments, subscriptions, upgrades     |
| UI Components           | [→ Section 6](#6-ui-component-patterns)          | Buttons, cards, modals, tables                |
| Flask/MT5 Integration   | [→ Section 7](#7-flaskmt5-patterns)              | Market data, indicators, Python/Flask         |
| Error Handling          | [→ Section 8](#8-error-handling-patterns)        | Try-catch, error boundaries, user messages    |
| Loading States          | [→ Section 9](#9-loading-state-patterns)         | Skeletons, spinners, suspense                 |
| State Management        | [→ Section 10](#10-state-management-patterns)    | React state, URL params, server state         |

---

## 1. Authentication Patterns

### When to Use

- Implementing login/signup pages (Part 5)
- Adding OAuth providers
- Session management
- Protected routes
- User authentication logic

### Seed Files to Check

#### Primary: SaaS Starter Auth

```
seed-code/saas-starter/app/(login)/
├── actions.ts              # Server actions for login/signup
├── sign-in/page.tsx        # Login page with form
└── sign-up/page.tsx        # Signup page with form
```

**What you'll find:**

- Complete login/signup forms
- Server action patterns for authentication
- Error handling for auth failures
- Loading states during submission
- Redirect logic after successful auth

#### Secondary: Dashboard Starter Auth

```
seed-code/next-shadcn-dashboard-starter/src/app/auth/
├── sign-in/[[...sign-in]]/page.tsx   # Clerk-based login
└── sign-up/[[...sign-up]]/page.tsx   # Clerk-based signup
```

**What you'll find:**

- OAuth integration patterns (Google, GitHub)
- Social login buttons
- Alternative auth provider patterns

### Key Patterns to Extract

1. **Form Structure:**

```typescript
// From sign-in/page.tsx
<form action={loginAction}>
  <Input name="email" type="email" required />
  <Input name="password" type="password" required />
  <Button type="submit">Sign In</Button>
</form>
```

2. **Server Actions:**

```typescript
// From actions.ts
export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  // Auth logic...
}
```

3. **Error Handling:**

```typescript
try {
  await signIn(credentials);
} catch (error) {
  if (error.type === 'CredentialsSignin') {
    return { error: 'Invalid credentials' };
  }
  return { error: 'Something went wrong' };
}
```

### Adaptation Notes

- Replace Clerk patterns with NextAuth if using our auth system
- Adapt to our OpenAPI spec (`/api/auth/login`, `/api/auth/register`)
- Add tier selection to signup form (FREE vs PRO)
- Reference `docs/policies/08-google-oauth-implementation-rules.md`

---

## 2. Dashboard Layout Patterns

### When to Use

- Creating dashboard pages (Part 11, 12, 13, 14)
- Building sidebar navigation
- Implementing header with user menu
- Creating page layouts

### Seed Files to Check

#### Primary: SaaS Starter Dashboard

```
seed-code/saas-starter/app/(dashboard)/
├── layout.tsx      # Dashboard shell with sidebar
└── page.tsx        # Dashboard home page
```

**What you'll find:**

- Complete dashboard layout structure
- Sidebar with navigation links
- Header with user menu
- Responsive design patterns
- Route group patterns

#### Secondary: Dashboard Starter

```
seed-code/next-shadcn-dashboard-starter/src/app/dashboard/
├── layout.tsx                # Main dashboard layout
├── page.tsx                  # Dashboard overview
└── overview/layout.tsx       # Nested layout example
```

**What you'll find:**

- Parallel routes patterns
- Loading states per section
- Error boundaries
- Breadcrumb navigation

#### Tertiary: V0 Components

```
seed-code/v0-components/layouts/
├── dashboard-layout.tsx    # Complete dashboard shell
└── dashboard-page.tsx      # Page wrapper component
```

**What you'll find:**

- Modern dashboard UI patterns
- Responsive sidebar
- Mobile-friendly navigation

### Key Patterns to Extract

1. **Dashboard Layout Structure:**

```typescript
// From layout.tsx
export default function DashboardLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1">
        <Header />
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
```

2. **Sidebar Navigation:**

```typescript
const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Alerts', href: '/dashboard/alerts', icon: BellIcon },
  { name: 'Watchlist', href: '/dashboard/watchlist', icon: StarIcon },
];
```

3. **Protected Route:**

```typescript
export default async function DashboardLayout({ children }) {
  const session = await getServerSession()
  if (!session) redirect('/login')
  return <DashboardShell>{children}</DashboardShell>
}
```

### Adaptation Notes

- Customize navigation items for Trading Alerts (Dashboard, Alerts, Watchlist, Charts, Settings)
- Add tier badge to sidebar (FREE/PRO indicator)
- Include notification bell in header
- Reference `docs/ui-components-map.md` for component mapping

---

## 3. API Routes Patterns

### When to Use

- Creating API endpoints (Part 7, 8, 9, 10, 11)
- Implementing REST endpoints
- Adding validation and error handling
- Database operations

### Seed Files to Check

```
seed-code/saas-starter/app/api/
├── user/route.ts              # CRUD operations example
├── team/route.ts              # Relationship queries example
├── stripe/
│   ├── checkout/route.ts      # POST endpoint with external API
│   └── webhook/route.ts       # Webhook handling example
```

**What you'll find:**

- Next.js 15 App Router API patterns
- GET, POST, PATCH, DELETE handlers
- Request validation
- Database queries with Prisma
- Error handling patterns
- Response formatting
- Webhook validation
- External API integration

### Key Patterns to Extract

1. **Basic API Route Structure:**

```typescript
// From user/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // 1. Authentication
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Database query
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    // 3. Return response
    return NextResponse.json(user);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

2. **POST with Validation:**

```typescript
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validation
    const validated = schema.parse(body);

    // Create resource
    const resource = await prisma.resource.create({
      data: validated,
    });

    return NextResponse.json(resource, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    // ...
  }
}
```

3. **Webhook Handling:**

```typescript
// From stripe/webhook/route.ts
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    // Handle event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      // ...
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json({ error: 'Webhook error' }, { status: 400 });
  }
}
```

### Adaptation Notes

- Match OpenAPI specs (`trading_alerts_openapi.yaml`)
- Add tier validation before restricted operations
- Use generated types from `lib/api-client`
- Reference `docs/policies/05-coding-patterns.md` for our specific patterns

---

## 4. Form Patterns

### When to Use

- Creating forms (login, signup, alert creation, settings)
- Adding form validation
- Implementing React Hook Form
- Using Zod schemas

### Seed Files to Check

```
seed-code/next-shadcn-dashboard-starter/src/components/forms/
├── demo-form.tsx          # Complete form example with all field types
├── form-input.tsx         # Text input with validation
├── form-select.tsx        # Dropdown with validation
├── form-checkbox.tsx      # Checkbox group
├── form-date-picker.tsx   # Date picker with calendar
└── form-file-upload.tsx   # File upload
```

**What you'll find:**

- React Hook Form setup
- Zod schema validation
- Error message display
- Loading states during submission
- Success/error toasts
- Accessible form patterns

### Key Patterns to Extract

1. **Form Setup:**

```typescript
// From demo-form.tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const formSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'At least 8 characters'),
})

type FormData = z.infer<typeof formSchema>

export function MyForm() {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  async function onSubmit(data: FormData) {
    try {
      const res = await fetch('/api/endpoint', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      toast.success('Success!')
    } catch (error) {
      toast.error('Error!')
    }
  }

  return <Form form={form} onSubmit={onSubmit}>...</Form>
}
```

2. **Form Field Component:**

```typescript
// From form-input.tsx
<FormField
  control={form.control}
  name="email"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Email</FormLabel>
      <FormControl>
        <Input placeholder="you@example.com" {...field} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

3. **Async Form Submission:**

```typescript
const { isSubmitting } = form.formState

return (
  <Button type="submit" disabled={isSubmitting}>
    {isSubmitting ? (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Submitting...
      </>
    ) : (
      'Submit'
    )}
  </Button>
)
```

### Adaptation Notes

- Create Zod schemas matching OpenAPI request types
- Add tier-specific validation (e.g., symbol restrictions)
- Use shadcn/ui form components
- Reference `docs/policies/02-quality-standards.md` for validation standards

---

## 5. Billing & Subscription Patterns

### When to Use

- Implementing Part 15 (Billing & Subscription)
- Creating pricing page
- Implementing Stripe checkout
- Handling subscription webhooks
- Upgrade/downgrade flows

### Seed Files to Check

```
seed-code/saas-starter/app/(dashboard)/pricing/
├── page.tsx              # Pricing comparison page
└── submit-button.tsx     # Checkout button component

seed-code/saas-starter/app/api/stripe/
├── checkout/route.ts     # Create Stripe checkout session
└── webhook/route.ts      # Handle Stripe webhooks
```

**What you'll find:**

- Pricing page with FREE/PRO tiers
- Stripe checkout session creation
- Subscription webhook handling
- Upgrade button implementation
- Current plan display
- Billing portal redirect

### Key Patterns to Extract

1. **Pricing Page:**

```typescript
// From pricing/page.tsx
const plans = [
  {
    name: 'FREE',
    price: '$0',
    features: ['Feature 1', 'Feature 2'],
    cta: 'Current Plan',
    disabled: true,
  },
  {
    name: 'PRO',
    price: '$29',
    features: ['All FREE features', 'Feature 3', 'Feature 4'],
    cta: 'Upgrade to PRO',
    disabled: false,
  },
]

return (
  <div className="grid md:grid-cols-2 gap-8">
    {plans.map((plan) => (
      <Card key={plan.name}>
        <h3>{plan.name}</h3>
        <p>{plan.price}</p>
        <ul>{plan.features.map((f) => <li>{f}</li>)}</ul>
        <SubmitButton plan={plan.name} disabled={plan.disabled} />
      </Card>
    ))}
  </div>
)
```

2. **Checkout Session Creation:**

```typescript
// From stripe/checkout/route.ts
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  const { priceId } = await req.json();

  const checkoutSession = await stripe.checkout.sessions.create({
    customer_email: session.user.email,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_URL}/dashboard?upgraded=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/pricing`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
```

3. **Webhook Handling:**

```typescript
// From stripe/webhook/route.ts
switch (event.type) {
  case 'checkout.session.completed':
    const session = event.data.object;
    await prisma.user.update({
      where: { email: session.customer_email },
      data: {
        tier: 'PRO',
        stripeCustomerId: session.customer,
        stripeSubscriptionId: session.subscription,
      },
    });
    break;

  case 'customer.subscription.deleted':
    const subscription = event.data.object;
    await prisma.user.update({
      where: { stripeCustomerId: subscription.customer },
      data: { tier: 'FREE' },
    });
    break;
}
```

### Adaptation Notes

- Match our tier system (FREE: 5 symbols, PRO: 15 symbols)
- Add dLocal integration for emerging markets
- Reference `docs/SUBSCRIPTION-MODEL-CLARIFICATION.md`
- Reference `docs/policies/07-dlocal-integration-rules.md`

---

## 6. UI Component Patterns

### When to Use

- Building reusable components (Part 2, 3, 4)
- Creating charts, cards, modals
- Implementing navigation, headers
- Building dashboard widgets

### Seed Files to Check

```
seed-code/v0-components/
├── README.md                      # Component mapping guide
├── charts/trading-chart.tsx       # TradingView chart integration
├── alerts/alert-card.tsx          # Alert display card
└── layouts/
    ├── dashboard-layout.tsx       # Dashboard shell
    └── dashboard-page.tsx         # Page wrapper

seed-code/next-shadcn-dashboard-starter/src/components/layout/
├── header.tsx                     # Top header with breadcrumbs
├── app-sidebar.tsx                # Collapsible sidebar
└── user-nav.tsx                   # User dropdown menu
```

**What you'll find:**

- Complete component examples
- Responsive design patterns
- Shadcn/ui usage
- TradingView widget integration
- Card layouts
- Navigation patterns

### Key Patterns to Extract

1. **Trading Chart Component:**

```typescript
// From charts/trading-chart.tsx
import { useEffect, useRef } from 'react'

export function TradingChart({ symbol, timeframe }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const widget = new TradingView.widget({
      container: containerRef.current,
      symbol,
      interval: timeframe,
      // ... widget config
    })

    return () => widget.remove()
  }, [symbol, timeframe])

  return <div ref={containerRef} className="h-full" />
}
```

2. **Alert Card Component:**

```typescript
// From alerts/alert-card.tsx
export function AlertCard({ alert }: { alert: Alert }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{alert.symbol} - {alert.timeframe}</CardTitle>
          <Badge variant={alert.isActive ? 'default' : 'secondary'}>
            {alert.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p>Condition: {alert.condition}</p>
        <p>Created: {formatDate(alert.createdAt)}</p>
      </CardContent>
      <CardFooter>
        <Button onClick={handleEdit}>Edit</Button>
        <Button variant="destructive" onClick={handleDelete}>Delete</Button>
      </CardFooter>
    </Card>
  )
}
```

3. **User Menu Dropdown:**

```typescript
// From user-nav.tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
      <Avatar>
        <AvatarImage src={user.image} />
        <AvatarFallback>{user.name[0]}</AvatarFallback>
      </Avatar>
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={() => router.push('/settings')}>
      Settings
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => signOut()}>
      Log out
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### Adaptation Notes

- Use our color scheme and branding
- Add tier indicators to components
- Reference `docs/ui-components-map.md` for production mapping
- Match OpenAPI response types for data props

---

## 7. Flask/MT5 Patterns

### When to Use

- Implementing Part 6 (Flask MT5 Service)
- Fetching market data from MT5
- Implementing indicator calculations
- Creating Flask API endpoints
- Python/Flask integration

### Seed Files to Check

```
seed-code/market_ai_engine.py     # Complete Flask + MT5 example
```

**What you'll find:**

- Flask app structure
- MetaTrader 5 initialization
- Market data fetching
- Indicator calculations (RSI, MACD, MA, Bollinger Bands)
- Error handling for MT5 connections
- API endpoint patterns
- Data formatting for frontend

### Key Patterns to Extract

1. **MT5 Initialization:**

```python
# From market_ai_engine.py
import MetaTrader5 as mt5

def initialize_mt5():
    if not mt5.initialize():
        print(f"MT5 initialization failed: {mt5.last_error()}")
        return False
    return True
```

2. **Fetch Market Data:**

```python
def get_symbol_data(symbol, timeframe, bars=100):
    try:
        # Convert timeframe
        mt5_timeframe = {
            'M5': mt5.TIMEFRAME_M5,
            'H1': mt5.TIMEFRAME_H1,
            'D1': mt5.TIMEFRAME_D1,
        }[timeframe]

        # Fetch rates
        rates = mt5.copy_rates_from_pos(symbol, mt5_timeframe, 0, bars)

        if rates is None:
            return None

        # Convert to DataFrame
        df = pd.DataFrame(rates)
        df['time'] = pd.to_datetime(df['time'], unit='s')

        return df
    except Exception as e:
        print(f"Error fetching data: {e}")
        return None
```

3. **Calculate Indicators:**

```python
def calculate_rsi(df, period=14):
    delta = df['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    return rsi

def calculate_indicators(df):
    df['rsi'] = calculate_rsi(df, 14)
    df['macd'], df['signal'] = calculate_macd(df)
    df['bb_upper'], df['bb_middle'], df['bb_lower'] = calculate_bollinger_bands(df)
    return df
```

4. **Flask API Endpoint:**

```python
from flask import Flask, jsonify, request

app = Flask(__name__)

@app.route('/api/chart-data', methods=['GET'])
def get_chart_data():
    symbol = request.args.get('symbol')
    timeframe = request.args.get('timeframe')

    if not symbol or not timeframe:
        return jsonify({'error': 'Missing parameters'}), 400

    df = get_symbol_data(symbol, timeframe)
    if df is None:
        return jsonify({'error': 'Failed to fetch data'}), 500

    df = calculate_indicators(df)

    return jsonify({
        'symbol': symbol,
        'timeframe': timeframe,
        'data': df.to_dict(orient='records')
    })
```

### Adaptation Notes

- Match our OpenAPI spec (`docs/flask_mt5_openapi.yaml`)
- Add multi-MT5 terminal support (reference `docs/flask-multi-mt5-implementation.md`)
- Implement health checks for MT5 connections
- Add error handling for disconnected terminals
- Reference `docs/admin-mt5-dashboard-implementation.md` for monitoring

---

## 8. Error Handling Patterns

### When to Use

- Adding try-catch blocks
- Implementing error boundaries
- Showing user-friendly error messages
- Logging errors
- Handling API failures

### Key Patterns from Seed Code

1. **API Route Error Handling:**

```typescript
// From seed-code/saas-starter/app/api/user/route.ts
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = await prisma.user.create({ data: body });
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    // Prisma specific errors
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 409 }
      );
    }

    // Validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    // Generic error
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

2. **Frontend Error Handling:**

```typescript
// From form patterns
async function onSubmit(data: FormData) {
  try {
    const res = await fetch('/api/endpoint', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Request failed');
    }

    const result = await res.json();
    toast.success('Success!');
    router.push('/dashboard');
  } catch (error) {
    toast.error(error.message || 'Something went wrong');
    console.error('Submission error:', error);
  }
}
```

### Adaptation Notes

- Always log errors to console for debugging
- Use user-friendly error messages (not technical details)
- Return appropriate HTTP status codes
- Reference `docs/policies/02-quality-standards.md` for error handling standards

---

## 9. Loading State Patterns

### When to Use

- Adding loading spinners
- Implementing skeleton screens
- Using React Suspense
- Showing progress indicators

### Key Patterns from Seed Code

1. **Button Loading State:**

```typescript
const [isLoading, setIsLoading] = useState(false)

<Button disabled={isLoading}>
  {isLoading ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Loading...
    </>
  ) : (
    'Submit'
  )}
</Button>
```

2. **Skeleton Loading:**

```typescript
// From dashboard patterns
{isLoading ? (
  <div className="space-y-4">
    <Skeleton className="h-20 w-full" />
    <Skeleton className="h-20 w-full" />
    <Skeleton className="h-20 w-full" />
  </div>
) : (
  <AlertList alerts={alerts} />
)}
```

3. **Suspense Boundaries:**

```typescript
// From dashboard patterns
import { Suspense } from 'react'

export default function Page() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  )
}
```

---

## 10. State Management Patterns

### When to Use

- Managing client state
- Syncing state with URLs
- Server state with React Query
- Global state

### Key Patterns from Seed Code

1. **URL State Management:**

```typescript
// From dashboard patterns
import { useSearchParams, useRouter } from 'next/navigation';

const searchParams = useSearchParams();
const router = useRouter();

const currentTab = searchParams.get('tab') || 'all';

function setTab(tab: string) {
  const params = new URLSearchParams(searchParams);
  params.set('tab', tab);
  router.push(`?${params.toString()}`);
}
```

2. **React State:**

```typescript
const [alerts, setAlerts] = useState<Alert[]>([]);
const [isLoading, setIsLoading] = useState(true);

useEffect(() => {
  async function fetchAlerts() {
    setIsLoading(true);
    try {
      const res = await fetch('/api/alerts');
      const data = await res.json();
      setAlerts(data);
    } finally {
      setIsLoading(false);
    }
  }
  fetchAlerts();
}, []);
```

---

## 🔄 Quick Decision Tree

Use this decision tree to quickly find the right seed code:

```
What are you building?
│
├─ Authentication page?
│  └─ → Section 1: Authentication Patterns
│
├─ Dashboard page?
│  └─ → Section 2: Dashboard Layout Patterns
│
├─ API endpoint?
│  ├─ User management? → Section 3: API Routes
│  ├─ Billing/payment? → Section 5: Billing Patterns
│  └─ Chart/indicator data? → Section 7: Flask/MT5 Patterns
│
├─ Form?
│  └─ → Section 4: Form Patterns
│
├─ UI component?
│  └─ → Section 6: UI Component Patterns
│
├─ Error handling?
│  └─ → Section 8: Error Handling Patterns
│
├─ Loading state?
│  └─ → Section 9: Loading State Patterns
│
└─ State management?
   └─ → Section 10: State Management Patterns
```

---

## 📚 Additional Resources

When seed code doesn't fully answer your question, check these:

1. **Implementation Guides:** `docs/implementation-guides/v5_part_*.md`
2. **Technical Docs:** `docs/AFFILIATE-MARKETING-DESIGN.md`, `docs/SYSTEMCONFIG-USAGE-GUIDE.md`, etc.
3. **OpenAPI Specs:** `trading_alerts_openapi.yaml`, `docs/flask_mt5_openapi.yaml`
4. **Policies:** `docs/policies/01-approval-policies.md` through `08-google-oauth-implementation-rules.md`

---

## ✅ Before Escalating

Checklist before escalating to human:

- [ ] Checked seed code for my issue category
- [ ] Read relevant implementation guide
- [ ] Reviewed OpenAPI spec
- [ ] Checked technical documentation
- [ ] Reviewed coding patterns policy
- [ ] Still can't find the answer

Only escalate if ALL boxes are checked!

---

**Last Updated:** 2025-11-18
**Version:** 1.0.0
**Maintained by:** Trading Alerts SaaS V7 Team

# Quality Standards for Aider with MiniMax M2

## Purpose

This document defines what "good code" looks like for the Trading Alerts SaaS project. These standards ensure maintainability, security, and performance while being beginner-friendly with clear explanations of WHY each standard matters, not just WHAT the standard is.

---

## 1. TYPESCRIPT STANDARDS

### 1.1 Types vs Interfaces - When to Use Each

**Use `type` when:**

- Defining unions: `type Status = 'active' | 'inactive' | 'pending'`
- Defining utility types: `type Partial<T>`, `type Pick<T, K>`
- Aliasing primitives: `type UserId = string`
- Defining function signatures: `type Handler = (req: Request) => Response`

**Use `interface` when:**

- Defining object shapes: `interface User { id: string; name: string }`
- Extending other interfaces: `interface Admin extends User { permissions: string[] }`
- Defining class contracts: `class UserService implements IUserService { ... }`

**Why this matters:** Interfaces support declaration merging and extension, which is useful for object-oriented patterns. Types are more flexible for complex compositions. Following this convention makes code intentions clear.

**Examples:**

```typescript
// ✅ GOOD - Use type for unions
type UserTier = 'FREE' | 'PRO';
type Timeframe =
  | 'M5'
  | 'M15'
  | 'M30'
  | 'H1'
  | 'H2'
  | 'H4'
  | 'H8'
  | 'H12'
  | 'D1';

// ✅ GOOD - Use interface for object shapes
interface Alert {
  id: string;
  userId: string;
  symbol: string;
  timeframe: Timeframe;
  condition: string;
  isActive: boolean;
  createdAt: Date;
}

// ✅ GOOD - Use type for function signatures
type CreateAlertHandler = (data: CreateAlertInput) => Promise<Alert>;

// ❌ BAD - Don't use type for simple object shapes when interface is clearer
type Alert = {
  // Should be interface
  id: string;
  userId: string;
  // ...
};
```

---

### 1.2 No 'any' Types - Why and Alternatives

**Rule:** Never use `any` except in rare, justified cases with JSDoc explanation.

**Why this matters:** `any` disables TypeScript's type checking, defeating the purpose of using TypeScript. It allows bugs to slip through that would be caught at compile time.

**Alternatives to `any`:**

```typescript
// ❌ BAD - Using any
function processData(data: any) {
  return data.map((item: any) => item.value);
}

// ✅ GOOD - Use unknown for truly unknown types
function processData(data: unknown) {
  if (Array.isArray(data)) {
    return data.map((item) => {
      if (typeof item === 'object' && item !== null && 'value' in item) {
        return item.value;
      }
      throw new Error('Invalid item structure');
    });
  }
  throw new Error('Data must be an array');
}

// ✅ GOOD - Use generic types
function processData<T extends { value: string }>(data: T[]) {
  return data.map((item) => item.value);
}

// ✅ ACCEPTABLE - any with JSDoc explanation for third-party untyped library
/**
 * Wraps untyped legacy library function
 * @param config - Configuration object (any type due to legacy library lack of types)
 * @returns Initialized client
 */
function initLegacyClient(config: any): LegacyClient {
  // Justified use of any - legacy library has no type definitions
  return legacyLib.init(config);
}
```

---

### 1.3 Handling null/undefined Safely

**Rule:** Always handle null/undefined explicitly. Use optional chaining and nullish coalescing.

**Why this matters:** `null` and `undefined` are the most common causes of runtime errors in JavaScript. TypeScript's strict null checks catch these at compile time if you use proper patterns.

**Patterns:**

```typescript
// ❌ BAD - Assuming values exist
function getUserEmail(userId: string) {
  const user = users.find((u) => u.id === userId);
  return user.email; // Error if user is undefined!
}

// ✅ GOOD - Optional chaining + nullish coalescing
function getUserEmail(userId: string): string | null {
  const user = users.find((u) => u.id === userId);
  return user?.email ?? null; // Safe: returns null if user undefined
}

// ✅ GOOD - Explicit null check with type narrowing
function getUserEmail(userId: string): string {
  const user = users.find((u) => u.id === userId);
  if (!user) {
    throw new Error(`User ${userId} not found`);
  }
  return user.email; // TypeScript knows user is defined here
}

// ✅ GOOD - Using optional chaining in session handling
export async function GET(req: Request) {
  const session = await getServerSession();
  const userId = session?.user?.id; // Safe: undefined if session or user null

  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // userId is definitely string here
  const alerts = await getAlerts(userId);
  return Response.json(alerts);
}
```

---

### 1.4 TypeScript Good vs Bad Examples

```typescript
// ❌ BAD EXAMPLE - Multiple issues
function createAlert(data) {
  // No parameter types
  const alert = {
    id: Math.random(), // Should use proper ID generation
    ...data,
    createdAt: new Date(),
  };
  return db.save(alert); // No return type, no error handling
}

// ✅ GOOD EXAMPLE - Properly typed
/**
 * Creates a new alert with validation and tier checking
 * @param userId - User's unique identifier
 * @param data - Alert creation data
 * @returns Promise resolving to created alert
 * @throws ForbiddenError if user's tier cannot access symbol/timeframe
 */
async function createAlert(
  userId: string,
  data: CreateAlertInput
): Promise<Alert> {
  // Validate tier access
  await validateChartAccess(data.symbol, data.timeframe, userId);

  try {
    const alert = await prisma.alert.create({
      data: {
        id: cuid(), // Proper ID generation
        userId,
        symbol: data.symbol,
        timeframe: data.timeframe,
        condition: data.condition,
        isActive: true,
        createdAt: new Date(),
      },
    });

    return alert;
  } catch (error) {
    console.error('Failed to create alert:', error);
    throw new Error('Failed to create alert');
  }
}
```

---

## 2. ERROR HANDLING STANDARDS

### 2.1 try/catch in All API Routes

**Rule:** Every API route must wrap async operations in try/catch blocks.

**Why this matters:** Unhandled errors crash the server or return cryptic 500 errors. Proper error handling keeps the app running and provides useful feedback to users and developers.

**Pattern:**

```typescript
// app/api/alerts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

export async function GET(req: NextRequest) {
  try {
    // 1. Authentication
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Business logic
    const alerts = await prisma.alert.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    });

    // 3. Success response
    return NextResponse.json(alerts);
  } catch (error) {
    // 4. Error handling
    console.error('GET /api/alerts error:', error);

    // Don't expose internal error details to client
    return NextResponse.json(
      { error: 'Failed to fetch alerts. Please try again.' },
      { status: 500 }
    );
  }
}
```

---

### 2.2 User-Friendly Error Messages

**Rule:** Never expose raw error objects or internal details to users. Return helpful, actionable error messages.

**Why this matters:** Raw error messages can expose security details, confuse users, or reveal implementation details. User-friendly messages improve UX and security.

**Good vs Bad:**

```typescript
// ❌ BAD - Exposing internal errors
catch (error) {
  return Response.json({ error: error.message }, { status: 500 });
  // Might expose: "Connection to database failed at 192.168.1.5:5432"
  // Security risk! + Not helpful to user
}

// ✅ GOOD - User-friendly messages
catch (error) {
  console.error('Database connection failed:', error);  // Log for debugging

  return Response.json({
    error: 'Unable to connect to the database',
    message: 'Please try again in a moment. If the problem persists, contact support.',
  }, { status: 500 });
}

// ✅ BETTER - Differentiate error types
catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Handle known Prisma errors
    if (error.code === 'P2002') {
      return Response.json({
        error: 'An alert with these settings already exists',
        message: 'Try modifying the symbol or timeframe',
      }, { status: 409 });
    }
  }

  // Generic error for unknown issues
  console.error('Unexpected error:', error);
  return Response.json({
    error: 'An unexpected error occurred',
    message: 'Please try again. If the problem persists, contact support.',
  }, { status: 500 });
}
```

---

### 2.3 Logging Errors Properly

**Rule:** Log errors with context (user ID, action attempted, timestamp) for debugging.

**Why this matters:** Logs are your primary debugging tool in production. Good logs help you understand what went wrong and for which user.

**Pattern:**

```typescript
// ✅ GOOD - Contextual error logging
export async function POST(req: Request) {
  const session = await getServerSession();
  const userId = session?.user?.id;

  try {
    const body = await req.json();
    const alert = await createAlert(userId, body);
    return Response.json(alert);
  } catch (error) {
    // Log with context
    console.error('POST /api/alerts error:', {
      userId, // Who experienced the error
      action: 'create_alert', // What they were trying to do
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return Response.json(
      { error: 'Failed to create alert. Please try again.' },
      { status: 500 }
    );
  }
}

// For production, consider structured logging library like Pino or Winston
```

---

### 2.4 Error Handling Example Patterns

```typescript
// Pattern 1: Validation errors (400 Bad Request)
import { z } from 'zod';

const createAlertSchema = z.object({
  symbol: z.string().min(1),
  timeframe: z.enum(['M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'H12', 'D1']),
  condition: z.string().min(1).max(500),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validate input
    const result = createAlertSchema.safeParse(body);
    if (!result.success) {
      return Response.json(
        {
          error: 'Invalid input',
          details: result.error.issues,
        },
        { status: 400 }
      ); // 400 Bad Request for validation errors
    }

    // Proceed with validated data
    const alert = await createAlert(result.data);
    return Response.json(alert);
  } catch (error) {
    console.error('POST /api/alerts error:', error);
    return Response.json({ error: 'Failed to create alert' }, { status: 500 });
  }
}

// Pattern 2: Authentication errors (401 Unauthorized)
export async function GET(req: Request) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return Response.json(
      { error: 'You must be logged in to view alerts' },
      { status: 401 } // 401 Unauthorized
    );
  }

  // Continue...
}

// Pattern 3: Authorization errors (403 Forbidden)
export async function GET(
  req: Request,
  { params }: { params: { symbol: string; timeframe: string } }
) {
  const session = await getServerSession();
  const userTier = session?.user?.tier || 'FREE';

  try {
    // Check if user's tier can access this symbol/timeframe
    validateChartAccess(userTier, params.symbol, params.timeframe);
  } catch (error) {
    return Response.json(
      {
        error: `${userTier} tier cannot access ${params.symbol} on ${params.timeframe}`,
        message: 'Upgrade to PRO for access to all symbols and timeframes',
      },
      { status: 403 }
    ); // 403 Forbidden for tier restrictions
  }

  // Continue...
}

// Pattern 4: Not found errors (404 Not Found)
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const alert = await prisma.alert.findUnique({
      where: { id: params.id },
    });

    if (!alert) {
      return Response.json(
        { error: 'Alert not found' },
        { status: 404 } // 404 Not Found
      );
    }

    return Response.json(alert);
  } catch (error) {
    console.error('GET /api/alerts/[id] error:', error);
    return Response.json({ error: 'Failed to fetch alert' }, { status: 500 });
  }
}
```

---

## 3. DOCUMENTATION STANDARDS

### 3.1 JSDoc on All Public Functions

**Rule:** Every exported function, component, and class must have JSDoc comments.

**Why this matters:** JSDoc shows up in IDE autocomplete, helping developers understand how to use your code without reading the implementation. It's self-documenting code.

**Pattern:**

````typescript
/**
 * Creates a new alert for a user with tier validation
 *
 * Validates that the user's tier (FREE or PRO) has access to the
 * specified symbol and timeframe before creating the alert.
 *
 * @param userId - User's unique identifier from session
 * @param data - Alert creation input (symbol, timeframe, condition)
 * @returns Promise resolving to created Alert object
 * @throws {ForbiddenError} If user's tier cannot access symbol/timeframe
 * @throws {ValidationError} If input data is invalid
 *
 * @example
 * ```typescript
 * const alert = await createAlert('user123', {
 *   symbol: 'EURUSD',
 *   timeframe: 'H1',
 *   condition: 'RSI > 70'
 * });
 * ```
 */
export async function createAlert(
  userId: string,
  data: CreateAlertInput
): Promise<Alert> {
  // Implementation
}
````

---

### 3.2 What Makes a Good Comment

**Good comments explain WHY, not WHAT.**

```typescript
// ❌ BAD - Explains what (obvious from code)
// Loop through alerts
for (const alert of alerts) {
  // Check if alert is active
  if (alert.isActive) {
    // Send notification
    sendNotification(alert);
  }
}

// ✅ GOOD - Explains why (non-obvious reasoning)
// Only notify for active alerts to avoid spamming users with
// notifications from paused/deleted alerts they're no longer monitoring
for (const alert of alerts) {
  if (alert.isActive) {
    await sendNotification(alert);
  }
}

// ✅ GOOD - Explains business logic
// FREE tier users can only have 5 alerts total (business requirement)
// to encourage PRO upgrades while still providing value
const alertCount = await prisma.alert.count({ where: { userId } });
if (userTier === 'FREE' && alertCount >= 5) {
  throw new ForbiddenError(
    'FREE tier limited to 5 alerts. Upgrade to PRO for 20 alerts.'
  );
}
```

---

### 3.3 What to Document vs What's Obvious

**Document:**

- Business logic and rules
- Non-obvious algorithms
- Workarounds for bugs/limitations
- Security considerations
- Performance optimizations
- Magic numbers

**Don't document:**

- Obvious code (`i++` doesn't need "increment i")
- Language features (`const x = 5` doesn't need "declare constant")
- Standard patterns everyone knows

```typescript
// ✅ GOOD - Document business rules
export const TIER_LIMITS = {
  FREE: {
    symbols: 5, // BTCUSD, EURUSD, USDJPY, US30, XAUUSD
    timeframes: 3, // H1, H4, D1 only
    maxAlerts: 5, // Limit to encourage PRO upgrades
    maxWatchlist: 5,
    rateLimit: 60, // requests per hour
  },
  PRO: {
    symbols: 15, // All symbols including AUDJPY, GBPJPY, etc.
    timeframes: 9, // All timeframes including M5, H12
    maxAlerts: 20,
    maxWatchlist: 50,
    rateLimit: 300, // requests per hour
  },
} as const;

// ❌ BAD - Over-documenting obvious code
// Declare a constant called userId
const userId = session.user.id; // No comment needed - obvious

// ❌ BAD - Redundant comment
// Return the response
return Response.json(data); // No comment needed - obvious
```

---

### 3.4 Documentation Examples

````typescript
// ✅ EXCELLENT - Component with comprehensive JSDoc
/**
 * Alert creation form with tier-aware symbol/timeframe selection
 *
 * Displays only symbols and timeframes available to the user's tier.
 * FREE users see 5 symbols × 3 timeframes. PRO users see all 15 × 9.
 *
 * Validates input client-side before submission. Shows validation errors
 * inline. Disables submit button while creating alert.
 *
 * @param onSuccess - Callback fired when alert successfully created
 * @param onError - Callback fired when alert creation fails
 *
 * @example
 * ```tsx
 * <AlertForm
 *   onSuccess={(alert) => router.push(`/alerts/${alert.id}`)}
 *   onError={(error) => toast.error(error.message)}
 * />
 * ```
 */
export function AlertForm({ onSuccess, onError }: AlertFormProps) {
  // Implementation
}
````

---

## 4. REACT COMPONENT STANDARDS

### 4.1 Server vs Client Components in Next.js 15

**Default: Server Components**

**Use Server Components (default) when:**

- Component doesn't need interactivity (buttons, forms, state)
- Fetching data from database or API
- Rendering static content
- SEO important

**Use Client Components ('use client') when:**

- Using React hooks (useState, useEffect, etc.)
- Handling user interactions (onClick, onChange)
- Using browser APIs (localStorage, window)
- Using third-party libraries that require client-side (charts, etc.)

**Why this matters:** Server Components reduce JavaScript bundle size, improve initial page load, and enhance SEO. Only use Client Components when necessary.

**Examples:**

```typescript
// ✅ GOOD - Server Component (default, no 'use client')
// app/dashboard/page.tsx
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db/prisma';

export default async function DashboardPage() {
  const session = await getServerSession();

  // Data fetching in Server Component
  const alerts = await prisma.alert.findMany({
    where: { userId: session?.user?.id },
  });

  return (
    <div>
      <h1>Dashboard</h1>
      <AlertList alerts={alerts} />  {/* Pass data to Client Component */}
    </div>
  );
}

// ✅ GOOD - Client Component (needs interactivity)
// components/alerts/alert-list.tsx
'use client';

import { useState } from 'react';

export function AlertList({ alerts }: { alerts: Alert[] }) {
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  return (
    <div>
      {alerts.map(alert => (
        <div
          key={alert.id}
          onClick={() => setSelectedAlert(alert)}  // Needs onClick
          className={selectedAlert?.id === alert.id ? 'bg-blue-100' : ''}
        >
          {alert.symbol} - {alert.timeframe}
        </div>
      ))}
    </div>
  );
}

// ❌ BAD - Using 'use client' unnecessarily
'use client';  // Not needed! No hooks or interactivity

export function AlertCard({ alert }: { alert: Alert }) {
  return (
    <div>
      <h3>{alert.symbol}</h3>
      <p>{alert.condition}</p>
    </div>
  );
}
```

---

### 4.2 State Management Patterns

**Rule:** Keep state as local as possible. Use global state only when necessary.

**State management options (in order of preference):**

1. **Local state (useState)** - For component-specific state
2. **URL state (searchParams)** - For shareable state (filters, pagination)
3. **Context** - For subtree-wide state (theme, settings)
4. **Zustand/Redux** - For true global state (rare in Next.js 15)

**Why this matters:** Local state is easiest to understand and debug. Global state adds complexity and should be avoided unless truly needed.

```typescript
// ✅ GOOD - Local state for component-specific data
'use client';

export function AlertForm() {
  const [symbol, setSymbol] = useState('EURUSD');
  const [timeframe, setTimeframe] = useState('H1');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State stays in this component only
}

// ✅ GOOD - URL state for shareable filters
'use client';

import { useSearchParams, useRouter } from 'next/navigation';

export function AlertsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const symbol = searchParams.get('symbol') || 'all';

  function setSymbol(newSymbol: string) {
    const params = new URLSearchParams(searchParams);
    params.set('symbol', newSymbol);
    router.push(`/alerts?${params.toString()}`);
  }

  // URL state is shareable via link
}

// ✅ GOOD - Context for subtree state (theme, user preferences)
'use client';

const ThemeContext = createContext<Theme>('light');

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

---

### 4.3 Loading and Error States

**Rule:** Every data-fetching component must show loading and error states.

**Why this matters:** Loading states improve perceived performance. Error states prevent blank screens and guide users when things go wrong.

**Pattern:**

```typescript
'use client';

export function AlertsDisplay() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAlerts() {
      try {
        setIsLoading(true);
        setError(null);

        const res = await fetch('/api/alerts');
        if (!res.ok) throw new Error('Failed to fetch alerts');

        const data = await res.json();
        setAlerts(data);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');

      } finally {
        setIsLoading(false);
      }
    }

    fetchAlerts();
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Spinner />
        <p className="ml-2">Loading alerts...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="border border-red-300 bg-red-50 p-4 rounded">
        <p className="text-red-800">Error: {error}</p>
        <button onClick={() => window.location.reload()}>
          Try Again
        </button>
      </div>
    );
  }

  // Success state
  return (
    <div>
      {alerts.length === 0 ? (
        <p>No alerts yet. Create your first alert!</p>
      ) : (
        alerts.map(alert => <AlertCard key={alert.id} alert={alert} />)
      )}
    </div>
  );
}
```

---

### 4.4 Component Examples

```typescript
// ✅ EXCELLENT - Complete component with all standards

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

const alertSchema = z.object({
  symbol: z.string().min(1, 'Symbol required'),
  timeframe: z.enum(['M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'H12', 'D1']),
  condition: z.string().min(1, 'Condition required').max(500, 'Condition too long'),
});

type AlertFormData = z.infer<typeof alertSchema>;

interface AlertFormProps {
  /** Callback fired when alert successfully created */
  onSuccess?: (alert: Alert) => void;
  /** Callback fired when alert creation fails */
  onError?: (error: Error) => void;
}

/**
 * Alert creation form with validation and tier checking
 *
 * Validates input client-side with Zod. Shows inline error messages.
 * Disables submit button while creating alert. Redirects to alert
 * detail page on success.
 *
 * @param onSuccess - Optional callback fired after successful creation
 * @param onError - Optional callback fired on creation failure
 */
export function AlertForm({ onSuccess, onError }: AlertFormProps) {
  const router = useRouter();

  // Form state
  const [formData, setFormData] = useState<AlertFormData>({
    symbol: 'EURUSD',
    timeframe: 'H1',
    condition: '',
  });

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate with Zod
    const result = alertSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach(issue => {
        if (issue.path[0]) {
          fieldErrors[issue.path[0] as string] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrors({});

      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create alert');
      }

      const alert = await res.json();

      // Success
      onSuccess?.(alert);
      router.push(`/alerts/${alert.id}`);

    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      onError?.(err);
      setErrors({ submit: err.message });

    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Symbol selection */}
      <div>
        <label htmlFor="symbol" className="block text-sm font-medium">
          Symbol
        </label>
        <Select
          id="symbol"
          value={formData.symbol}
          onChange={(value) => setFormData({ ...formData, symbol: value })}
        >
          {/* Options populated based on user tier */}
        </Select>
        {errors.symbol && (
          <p className="text-sm text-red-600 mt-1">{errors.symbol}</p>
        )}
      </div>

      {/* Timeframe selection */}
      <div>
        <label htmlFor="timeframe" className="block text-sm font-medium">
          Timeframe
        </label>
        <Select
          id="timeframe"
          value={formData.timeframe}
          onChange={(value) => setFormData({ ...formData, timeframe: value as Timeframe })}
        >
          {/* Options populated based on user tier */}
        </Select>
        {errors.timeframe && (
          <p className="text-sm text-red-600 mt-1">{errors.timeframe}</p>
        )}
      </div>

      {/* Condition input */}
      <div>
        <label htmlFor="condition" className="block text-sm font-medium">
          Condition
        </label>
        <input
          id="condition"
          type="text"
          value={formData.condition}
          onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
          placeholder="e.g., RSI > 70"
          className="w-full border rounded px-3 py-2"
        />
        {errors.condition && (
          <p className="text-sm text-red-600 mt-1">{errors.condition}</p>
        )}
      </div>

      {/* Submit error */}
      {errors.submit && (
        <div className="border border-red-300 bg-red-50 p-3 rounded">
          <p className="text-red-800">{errors.submit}</p>
        </div>
      )}

      {/* Submit button */}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating...' : 'Create Alert'}
      </Button>
    </form>
  );
}
```

---

## 5. API ROUTE STRUCTURE

### 5.1 Standard Pattern for All Routes

**Every API route follows this structure:**

```typescript
1. Imports
2. Input validation schema (Zod)
3. Handler function:
   a. Authentication check
   b. Input validation
   c. Tier validation (if applicable)
   d. Business logic
   e. Response
4. Error handling (try/catch wrapping all)
```

**Complete example:**

```typescript
// app/api/alerts/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { validateChartAccess } from '@/lib/tier/validation';

// 1. Input validation schema
const createAlertSchema = z.object({
  symbol: z.string().min(1).max(20),
  timeframe: z.enum(['M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'H12', 'D1']),
  condition: z.string().min(1).max(500),
});

// 2. GET handler - Fetch all alerts
export async function GET(req: NextRequest) {
  try {
    // a. Authentication
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // c. Business logic (no tier validation needed - viewing own alerts)
    const alerts = await prisma.alert.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    });

    // d. Response matching OpenAPI schema
    return NextResponse.json(alerts);
  } catch (error) {
    console.error('GET /api/alerts error:', { error });
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}

// 3. POST handler - Create alert
export async function POST(req: NextRequest) {
  try {
    // a. Authentication
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // b. Input validation
    const body = await req.json();
    const result = createAlertSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.issues },
        { status: 400 }
      );
    }

    const { symbol, timeframe, condition } = result.data;
    const userTier = session.user.tier || 'FREE';

    // c. Tier validation
    try {
      validateChartAccess(userTier, symbol, timeframe);
    } catch (tierError) {
      return NextResponse.json(
        {
          error: `${userTier} tier cannot access ${symbol} on ${timeframe}`,
          message: 'Upgrade to PRO for access to all symbols and timeframes',
        },
        { status: 403 }
      );
    }

    // Check alert limit
    const alertCount = await prisma.alert.count({
      where: { userId: session.user.id },
    });

    const maxAlerts = userTier === 'PRO' ? 20 : 5;
    if (alertCount >= maxAlerts) {
      return NextResponse.json(
        {
          error: `${userTier} tier allows maximum ${maxAlerts} alerts`,
          message:
            userTier === 'FREE' ? 'Upgrade to PRO for 20 alerts' : undefined,
        },
        { status: 403 }
      );
    }

    // d. Business logic
    const alert = await prisma.alert.create({
      data: {
        userId: session.user.id,
        symbol,
        timeframe,
        condition,
        isActive: true,
      },
    });

    // e. Response matching OpenAPI schema
    return NextResponse.json(alert, { status: 201 });
  } catch (error) {
    console.error('POST /api/alerts error:', { error });
    return NextResponse.json(
      { error: 'Failed to create alert' },
      { status: 500 }
    );
  }
}
```

---

## 6. NAMING CONVENTIONS

### 6.1 File Naming

```
✅ CORRECT:
- Components: alert-form.tsx, user-profile.tsx (kebab-case)
- API routes: route.ts, [id]/route.ts (Next.js convention)
- Utils: date-helpers.ts, tier-validation.ts (kebab-case)
- Types: alert.types.ts, user.types.ts (kebab-case)

❌ INCORRECT:
- AlertForm.tsx (PascalCase for files - don't do this)
- alert_form.tsx (snake_case - don't do this)
- alertForm.tsx (camelCase - don't do this)
```

---

### 6.2 Function Naming

```typescript
✅ CORRECT - camelCase:
function createAlert(data: CreateAlertInput) { }
function getUserProfile(userId: string) { }
async function fetchIndicatorData(symbol: string) { }

❌ INCORRECT:
function CreateAlert() { }  // PascalCase reserved for components
function create_alert() { }  // snake_case not used in TypeScript
```

---

### 6.3 Component Naming

```typescript
✅ CORRECT - PascalCase:
export function AlertForm() { }
export function UserDashboard() { }
export function TradingChart() { }

❌ INCORRECT:
export function alertForm() { }  // camelCase
export function alert_form() { }  // snake_case
```

---

### 6.4 Constants Naming

```typescript
✅ CORRECT - UPPER_SNAKE_CASE:
const MAX_ALERTS_FREE = 5;
const MAX_ALERTS_PRO = 20;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export const TIER_LIMITS = {
  FREE: { maxAlerts: 5, maxWatchlist: 5 },
  PRO: { maxAlerts: 20, maxWatchlist: 50 },
} as const;

❌ INCORRECT:
const maxAlertsFree = 5;  // camelCase for constants
const MaxAlertsFree = 5;  // PascalCase for constants
```

---

## 7. PERFORMANCE STANDARDS

### 7.1 Database Query Optimization

```typescript
// ❌ BAD - N+1 query problem
const users = await prisma.user.findMany();
for (const user of users) {
  const alerts = await prisma.alert.findMany({ where: { userId: user.id } });
  // Processing...
}

// ✅ GOOD - Single query with include
const users = await prisma.user.findMany({
  include: {
    alerts: true, // Fetch all alerts in one query
  },
});

// ✅ GOOD - Pagination for large datasets
const alerts = await prisma.alert.findMany({
  where: { userId },
  take: 20, // Limit results
  skip: page * 20, // Offset for pagination
  orderBy: { createdAt: 'desc' },
});

// ✅ GOOD - Select only needed fields
const users = await prisma.user.findMany({
  select: {
    id: true,
    email: true,
    tier: true,
    // Don't fetch password, createdAt, etc. if not needed
  },
});
```

---

### 7.2 React Rendering Optimization

```typescript
// ❌ BAD - Re-renders on every parent render
function AlertList({ alerts }) {
  return alerts.map(alert => <AlertCard alert={alert} />);
}

// ✅ GOOD - Memoize expensive components
import { memo } from 'react';

const AlertCard = memo(function AlertCard({ alert }: { alert: Alert }) {
  // Only re-renders if alert object changes
  return <div>{alert.symbol} - {alert.timeframe}</div>;
});

// ✅ GOOD - Memoize expensive calculations
import { useMemo } from 'react';

function AlertStats({ alerts }: { alerts: Alert[] }) {
  const stats = useMemo(() => {
    // Expensive calculation only runs when alerts change
    return {
      total: alerts.length,
      active: alerts.filter(a => a.isActive).length,
      bySymbol: alerts.reduce((acc, a) => {
        acc[a.symbol] = (acc[a.symbol] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }, [alerts]);

  return <div>{/* Use stats */}</div>;
}
```

---

### 7.3 When to Use useMemo/useCallback

**useMemo - For expensive calculations:**

```typescript
// Use when:
const expensiveResult = useMemo(() => {
  // Complex calculations
  // Array transformations
  // Object creations in loops
  return heavyComputation(data);
}, [data]);

// Don't use for simple operations:
const doubled = useMemo(() => value * 2, [value]); // ❌ Overkill
const doubled = value * 2; // ✅ Just calculate it
```

**useCallback - For stable function references:**

```typescript
// ✅ Use when passing callbacks to memoized children
const MemoizedChild = memo(Child);

function Parent() {
  // Without useCallback, new function on every render = child re-renders
  const handleClick = useCallback(() => {
    doSomething();
  }, []);

  return <MemoizedChild onClick={handleClick} />;
}

// ❌ Don't use for callbacks that don't affect memoization
function Parent() {
  const handleClick = useCallback(() => {
    doSomething();
  }, []);

  // Child is not memoized, so useCallback provides no benefit
  return <div onClick={handleClick}>Click me</div>;
}
```

---

## 8. SECURITY CHECKLIST

Every file must pass this security checklist:

### 8.1 Authentication Checks

```typescript
// ✅ All protected routes check authentication
export async function GET(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Continue...
}
```

---

### 8.2 Input Validation

```typescript
// ✅ Validate ALL user inputs with Zod
import { z } from 'zod';

const schema = z.object({
  symbol: z.string().min(1).max(20),
  timeframe: z.enum([...]),
});

const result = schema.safeParse(input);
if (!result.success) {
  return Response.json({ error: 'Invalid input' }, { status: 400 });
}
```

---

### 8.3 SQL Injection Prevention

```typescript
// ✅ Prisma prevents SQL injection automatically
const user = await prisma.user.findUnique({
  where: { email: userInput }, // Safe - Prisma parameterizes queries
});

// ❌ NEVER use raw SQL with user input
await prisma.$executeRaw`SELECT * FROM users WHERE email = ${userInput}`; // DON'T DO THIS
```

---

### 8.4 XSS Prevention

```typescript
// ✅ React escapes values automatically
<div>{userInput}</div>  // Safe - React escapes HTML

// ⚠️  Dangerous - only use with trusted, sanitized content
<div dangerouslySetInnerHTML={{ __html: userInput }} />  // Requires sanitization!

// ✅ If you must render HTML, sanitize first
import DOMPurify from 'isomorphic-dompurify';

const sanitized = DOMPurify.sanitize(userInput);
<div dangerouslySetInnerHTML={{ __html: sanitized }} />
```

---

### 8.5 Tier Validation

```typescript
// ✅ Every symbol/timeframe endpoint validates tier
import { validateChartAccess } from '@/lib/tier/validation';

const session = await getServerSession();
const userTier = session?.user?.tier || 'FREE';

validateChartAccess(userTier, symbol, timeframe); // Throws if unauthorized
```

---

## Summary

These quality standards ensure:

- **Type Safety**: Catch bugs at compile time
- **Error Resilience**: Graceful handling of failures
- **Maintainability**: Clear documentation and patterns
- **Performance**: Optimized queries and rendering
- **Security**: Authentication, validation, tier enforcement

**Follow these standards for every file. Quality here = quality everywhere!**

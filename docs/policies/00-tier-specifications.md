# Tier System Specifications

## Tier Limits (Exact Values)

### FREE Tier

- **Symbols:** 5 (BTCUSD, EURUSD, USDJPY, US30, XAUUSD)
- **Timeframes:** 3 (H1, H4, D1)
- **Chart Combinations:** 15 (5 symbols × 3 timeframes)
- **Max Alerts:** 5
- **Max Watchlist Items:** 5 (symbol+timeframe combinations)
- **API Rate Limit:** 60 requests/hour (1 per minute average)
- **Price:** $0/month

### PRO Tier

- **Symbols:** 15 (AUDJPY, AUDUSD, BTCUSD, ETHUSD, EURUSD, GBPJPY, GBPUSD, NDX100, NZDUSD, US30, USDCAD, USDCHF, USDJPY, XAGUSD, XAUUSD)
- **Timeframes:** 9 (M5, M15, M30, H1, H2, H4, H8, H12, D1)
- **Chart Combinations:** 135 (15 symbols × 9 timeframes)
- **Max Alerts:** 20
- **Max Watchlist Items:** 50 (symbol+timeframe combinations)
- **API Rate Limit:** 300 requests/hour (5 per minute average)
- **Price:** $29/month
- **Trial Period:** 7-day free trial (no credit card required during trial)
- **Trial Features:** Full PRO tier access during trial period

## Trial Period Specifications

### Trial Activation

- **Trigger:** User clicks "Start 7-Day Trial" button on pricing page
- **Duration:** 7 days (168 hours) from activation
- **Credit Card:** Not required during trial period (optional)
- **Access:** Full PRO tier features immediately upon activation
- **Conversion:** Auto-converts to paid PRO subscription ($29/month) after trial expires (if payment method added)
- **Cancellation:** User can cancel anytime during trial with no charge

### Trial User States

```typescript
enum TrialStatus {
  NOT_STARTED = "NOT_STARTED"     // User has not started trial yet
  ACTIVE = "ACTIVE"                // Trial is currently active (within 7 days)
  EXPIRED = "EXPIRED"              // Trial period ended, no payment method
  CONVERTED = "CONVERTED"          // Trial converted to paid subscription
  CANCELLED = "CANCELLED"          // User cancelled trial before expiration
}
```

### Trial Database Fields

The following fields should be added to the User model in Prisma schema:

```typescript
model User {
  // ... existing fields ...

  // Trial Period Management
  trialStatus       TrialStatus  @default(NOT_STARTED)
  trialStartDate    DateTime?    // When user started trial
  trialEndDate      DateTime?    // When trial expires (trialStartDate + 7 days)
  trialConvertedAt  DateTime?    // When trial converted to paid
  trialCancelledAt  DateTime?    // When user cancelled trial
  hasUsedFreeTrial  Boolean      @default(false)  // Prevent multiple trials

  // ... rest of fields ...
}
```

**Note:** The User model already has `hasUsedStripeTrial` and `stripeTrialStartedAt` fields for Stripe-specific trials. The above fields provide a provider-agnostic trial system.

### Trial Access Control Logic

#### Check if User is in Active Trial

```typescript
function isInActiveTrial(user: User): boolean {
  if (user.trialStatus !== 'ACTIVE') {
    return false;
  }

  if (!user.trialStartDate || !user.trialEndDate) {
    return false;
  }

  const now = new Date();
  return now >= user.trialStartDate && now <= user.trialEndDate;
}
```

#### Get Effective User Tier (Includes Trial)

```typescript
function getEffectiveTier(user: User): UserTier {
  // If user is in active trial, grant PRO access
  if (isInActiveTrial(user)) {
    return 'PRO';
  }

  // Otherwise, use actual tier
  return user.tier;
}
```

#### Validate Trial Eligibility

```typescript
function canStartTrial(user: User): boolean {
  // User must not have used free trial before
  if (user.hasUsedFreeTrial) {
    return false;
  }

  // User must not already be on PRO tier
  if (user.tier === 'PRO') {
    return false;
  }

  // User must not have active trial
  if (user.trialStatus === 'ACTIVE') {
    return false;
  }

  return true;
}
```

#### Start Trial

```typescript
async function startTrial(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (!canStartTrial(user)) {
    throw new ForbiddenError('User is not eligible for trial');
  }

  const now = new Date();
  const trialEndDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days

  await prisma.user.update({
    where: { id: userId },
    data: {
      trialStatus: 'ACTIVE',
      trialStartDate: now,
      trialEndDate: trialEndDate,
      hasUsedFreeTrial: true,
    },
  });
}
```

#### Check for Expired Trials (Cron Job)

```typescript
async function checkExpiredTrials(): Promise<void> {
  const now = new Date();

  // Find all active trials that have expired
  const expiredTrials = await prisma.user.findMany({
    where: {
      trialStatus: 'ACTIVE',
      trialEndDate: {
        lte: now,
      },
    },
    include: {
      subscription: true,
    },
  });

  for (const user of expiredTrials) {
    // If user has active paid subscription, convert trial
    if (user.subscription && user.subscription.status === 'ACTIVE') {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          trialStatus: 'CONVERTED',
          trialConvertedAt: now,
          tier: 'PRO', // Ensure tier is PRO
        },
      });
    } else {
      // No payment method - trial expired, downgrade to FREE
      await prisma.user.update({
        where: { id: user.id },
        data: {
          trialStatus: 'EXPIRED',
          tier: 'FREE', // Downgrade to FREE tier
        },
      });
    }
  }
}
```

### Trial Conversion Flow

#### Scenario 1: User Adds Payment During Trial

1. User starts 7-day trial → `trialStatus = ACTIVE`, full PRO access
2. User adds payment method during trial → Subscription created, `status = TRIALING`
3. After 7 days → Cron job converts trial → `trialStatus = CONVERTED`, `tier = PRO`, subscription charged

#### Scenario 2: User Does Not Add Payment

1. User starts 7-day trial → `trialStatus = ACTIVE`, full PRO access
2. User does not add payment method
3. After 7 days → Cron job expires trial → `trialStatus = EXPIRED`, `tier = FREE`

#### Scenario 3: User Cancels Trial Early

1. User starts 7-day trial → `trialStatus = ACTIVE`, full PRO access
2. User clicks "Cancel Trial" → `trialStatus = CANCELLED`, `tier = FREE`

### Trial Business Rules

**Rule 1: One Trial Per User**

- Each user can only start ONE free trial ever
- Tracked via `hasUsedFreeTrial` field
- Applies even if user creates new account with same email (fraud prevention)

**Rule 2: Trial Access Level**

- During trial: Full PRO tier access (all 15 symbols, all 9 timeframes, 20 alerts, etc.)
- After trial expires without payment: Immediate downgrade to FREE tier
- After trial converts to paid: Continue PRO tier access

**Rule 3: Trial Cancellation**

- User can cancel trial anytime before expiration
- Immediate downgrade to FREE tier upon cancellation
- No charges if cancelled before trial ends
- Cannot restart trial after cancellation

**Rule 4: Trial Notifications**

- Day 1: "Welcome to your 7-day PRO trial!"
- Day 5: "2 days left in your trial. Add payment to continue PRO access."
- Day 7: "Trial ending today. Add payment to keep PRO features."
- Day 8 (if no payment): "Your trial has ended. Downgraded to FREE tier."

### Trial UI/UX Requirements

**Pricing Page:**

- PRO tier card shows: "Start 7-Day Trial" button
- Subtext: "7-day free trial, then $29/month"
- Note: "No credit card required"

**During Trial (Dashboard):**

- Show banner: "🎉 You're on a PRO trial! X days remaining. [Add Payment Method] [Cancel Trial]"
- User tier display: "PRO (Trial)" with countdown

**Trial Expiring (Last 2 Days):**

- Show urgent banner: "⏰ Your trial ends in X days. Add payment to keep PRO access."
- Highlight "Add Payment Method" button

**After Trial Expires:**

- Show banner: "Your trial has ended. Upgrade to PRO to regain access to 15 symbols and advanced features."
- User tier display: "FREE"

### Trial Validation in API Endpoints

All tier-restricted endpoints must use `getEffectiveTier()` instead of directly checking `user.tier`:

```typescript
// ❌ BAD - Does not account for trials
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });

  if (user.tier !== 'PRO') {
    return NextResponse.json({ error: 'PRO tier required' }, { status: 403 });
  }
  // ...
}

// ✅ GOOD - Accounts for trials
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });

  const effectiveTier = getEffectiveTier(user);
  if (effectiveTier !== 'PRO') {
    return NextResponse.json({ error: 'PRO tier required' }, { status: 403 });
  }
  // ...
}
```

## Symbol List (Alphabetically Ordered)

### FREE Tier Symbols (5 total)

```typescript
const FREE_SYMBOLS = [
  'BTCUSD', // Crypto - Bitcoin
  'EURUSD', // Forex Major - Euro/Dollar
  'USDJPY', // Forex Major - Dollar/Yen
  'US30', // Index - Dow Jones Industrial Average
  'XAUUSD', // Commodities - Gold
] as const;
```

### PRO Tier Symbols (15 total)

```typescript
const PRO_SYMBOLS = [
  'AUDJPY', // NEW - Forex Cross - Australian Dollar/Japanese Yen
  'AUDUSD', // Forex Major - Australian Dollar/US Dollar
  'BTCUSD', // Crypto - Bitcoin
  'ETHUSD', // Crypto - Ethereum
  'EURUSD', // Forex Major - Euro/Dollar
  'GBPJPY', // NEW - Forex Cross - British Pound/Japanese Yen
  'GBPUSD', // Forex Major - British Pound/Dollar
  'NDX100', // Index - Nasdaq 100
  'NZDUSD', // NEW - Forex Major - New Zealand Dollar/US Dollar
  'US30', // Index - Dow Jones Industrial Average
  'USDCAD', // NEW - Forex Major - US Dollar/Canadian Dollar
  'USDCHF', // NEW - Forex Major - US Dollar/Swiss Franc
  'USDJPY', // Forex Major - Dollar/Yen
  'XAGUSD', // Commodities - Silver
  'XAUUSD', // Commodities - Gold
] as const;
```

## Timeframe List

### FREE Tier Timeframes (3 total)

```typescript
const FREE_TIMEFRAMES = [
  'H1', // 1 Hour
  'H4', // 4 Hours
  'D1', // Daily
] as const;
```

### PRO Tier Timeframes (9 total)

```typescript
const PRO_TIMEFRAMES = [
  'M5', // NEW - 5 Minutes (scalping)
  'M15', // 15 Minutes
  'M30', // 30 Minutes
  'H1', // 1 Hour
  'H2', // 2 Hours
  'H4', // 4 Hours
  'H8', // 8 Hours
  'H12', // NEW - 12 Hours (swing trading)
  'D1', // Daily
] as const;
```

## Access Control Logic

### Symbol Validation

```typescript
function canAccessSymbol(tier: UserTier, symbol: string): boolean {
  if (tier === 'PRO') {
    return PRO_SYMBOLS.includes(symbol);
  }
  // FREE tier
  return FREE_SYMBOLS.includes(symbol);
}

function getAccessibleSymbols(tier: UserTier): readonly string[] {
  return tier === 'PRO' ? PRO_SYMBOLS : FREE_SYMBOLS;
}

function validateSymbolAccess(tier: UserTier, symbol: string): void {
  if (!canAccessSymbol(tier, symbol)) {
    throw new ForbiddenError(
      `${tier} tier cannot access ${symbol}. Available symbols: ${getAccessibleSymbols(tier).join(', ')}`
    );
  }
}
```

### Timeframe Validation

```typescript
function canAccessTimeframe(tier: UserTier, timeframe: string): boolean {
  if (tier === 'PRO') {
    return PRO_TIMEFRAMES.includes(timeframe);
  }
  // FREE tier
  return FREE_TIMEFRAMES.includes(timeframe);
}

function getAccessibleTimeframes(tier: UserTier): readonly string[] {
  return tier === 'PRO' ? PRO_TIMEFRAMES : FREE_TIMEFRAMES;
}

function validateTimeframeAccess(tier: UserTier, timeframe: string): void {
  if (!canAccessTimeframe(tier, timeframe)) {
    throw new ForbiddenError(
      `${tier} tier cannot access ${timeframe} timeframe. Available timeframes: ${getAccessibleTimeframes(tier).join(', ')}`
    );
  }
}
```

### Combined Symbol + Timeframe Validation

```typescript
function validateChartAccess(
  tier: UserTier,
  symbol: string,
  timeframe: string
): void {
  // Check symbol access first
  validateSymbolAccess(tier, symbol);

  // Check timeframe access
  validateTimeframeAccess(tier, timeframe);

  // Both checks passed - access granted
}
```

## Rate Limiting Implementation

**Strategy:** Sliding window counter per user
**Reset:** Hourly rolling window
**Response:** HTTP 429 Too Many Requests
**Headers:**

- `X-RateLimit-Limit: 60` (or 300)
- `X-RateLimit-Remaining: 45`
- `X-RateLimit-Reset: 1699632000` (Unix timestamp)

**Enforcement:**

- Apply to all `/api/*` endpoints except `/api/system/health`
- Track by userId from session
- Store in Redis or PostgreSQL
- Middleware checks before route handler

**Error Response:**

```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again later.",
  "retryAfter": 3600
}
```

## Alert & Watchlist Limits

### Alert Limits

```typescript
const ALERT_LIMITS = {
  FREE: 5,
  PRO: 20,
} as const;

function canCreateAlert(tier: UserTier, currentAlertCount: number): boolean {
  return currentAlertCount < ALERT_LIMITS[tier];
}
```

### Watchlist Item Limits

```typescript
const WATCHLIST_ITEM_LIMITS = {
  FREE: 5, // Max 5 symbol+timeframe combinations
  PRO: 50, // Max 50 symbol+timeframe combinations
} as const;

function canAddWatchlistItem(
  tier: UserTier,
  currentItemCount: number
): boolean {
  return currentItemCount < WATCHLIST_ITEM_LIMITS[tier];
}
```

## Chart Combination Calculations

### FREE Tier

- 5 symbols × 3 timeframes = **15 possible chart combinations**
- Each combination is a unique symbol+timeframe pair
- Example combinations:
  - BTCUSD + H1
  - EURUSD + H4
  - XAUUSD + D1
  - etc. (15 total)

### PRO Tier

- 15 symbols × 9 timeframes = **135 possible chart combinations**
- Includes all FREE combinations plus 120 additional combinations
- PRO-only timeframes (M5, H12) accessible only to PRO users
- PRO-only symbols (AUDJPY, GBPJPY, NZDUSD, USDCAD, USDCHF, etc.) accessible only to PRO users

## Validation Rules

### Rule 1: Symbol Access

- ❌ FREE tier CANNOT access: AUDJPY, AUDUSD, ETHUSD, GBPJPY, GBPUSD, NDX100, NZDUSD, USDCAD, USDCHF, XAGUSD
- ✅ FREE tier CAN access: BTCUSD, EURUSD, USDJPY, US30, XAUUSD
- ✅ PRO tier CAN access: All 15 symbols

### Rule 2: Timeframe Access

- ❌ FREE tier CANNOT access: M5, M15, M30, H2, H8, H12
- ✅ FREE tier CAN access: H1, H4, D1
- ✅ PRO tier CAN access: All 9 timeframes

### Rule 3: Chart Access

- Chart access requires BOTH symbol AND timeframe validation
- Example: FREE user accessing XAUUSD + M5 → ❌ DENIED (M5 not allowed)
- Example: FREE user accessing AUDUSD + H1 → ❌ DENIED (AUDUSD not allowed)
- Example: FREE user accessing EURUSD + H4 → ✅ ALLOWED (both valid)
- Example: PRO user accessing GBPJPY + M5 → ✅ ALLOWED (both valid)

## Implementation Checklist

### Backend Validation (CRITICAL)

- [ ] Implement `canAccessSymbol()` in tier service
- [ ] Implement `canAccessTimeframe()` in tier service
- [ ] Implement `validateChartAccess()` in tier service
- [ ] Implement `getEffectiveTier()` in tier service (accounts for trials)
- [ ] Implement `isInActiveTrial()` in tier service
- [ ] Implement `canStartTrial()` in tier service
- [ ] Implement `startTrial()` in tier service
- [ ] Add middleware for `/api/indicators/{symbol}/{timeframe}` endpoint
- [ ] Add middleware for watchlist item creation
- [ ] Add middleware for alert creation
- [ ] Validate on BOTH Next.js API routes AND Flask MT5 service
- [ ] Update ALL tier checks to use `getEffectiveTier()` instead of `user.tier`

### Trial Period Management

- [ ] Add trial database fields to User model (trialStatus, trialStartDate, trialEndDate, etc.)
- [ ] Create `/api/trial/start` endpoint to start trial
- [ ] Create `/api/trial/cancel` endpoint to cancel trial
- [ ] Implement cron job to check for expired trials daily
- [ ] Implement trial-to-paid conversion logic
- [ ] Implement trial expiration and downgrade logic
- [ ] Add trial notification system (Day 1, Day 5, Day 7, Day 8)

### Frontend UI (User Experience)

- [ ] Disable PRO-only symbols in FREE tier dropdowns
- [ ] Disable PRO-only timeframes in FREE tier selectors
- [ ] Show "Upgrade to PRO" badge on locked options
- [ ] Display current tier limits in Settings page
- [ ] Show upgrade prompt when limit reached
- [ ] Add "Start 7-Day Trial" button on pricing page
- [ ] Show trial countdown banner during active trial
- [ ] Show trial expiring warning (last 2 days)
- [ ] Show trial expired notification
- [ ] Display "PRO (Trial)" badge during trial period

### Error Messages

- [ ] Symbol access denied: "FREE tier cannot access {symbol}. Upgrade to PRO for access to all 15 symbols."
- [ ] Timeframe access denied: "FREE tier cannot access {timeframe} timeframe. Upgrade to PRO for access to all 9 timeframes."
- [ ] Alert limit reached: "FREE tier allows maximum 5 alerts. Upgrade to PRO for 20 alerts."
- [ ] Watchlist limit reached: "FREE tier allows maximum 5 watchlist items. Upgrade to PRO for 50 items."
- [ ] Trial already used: "You have already used your free trial. Upgrade to PRO for $29/month."
- [ ] Trial not eligible: "You are not eligible for a free trial. Contact support for assistance."

## Testing Scenarios

### Symbol Access Tests

```typescript
// FREE tier tests
expect(canAccessSymbol('FREE', 'BTCUSD')).toBe(true);
expect(canAccessSymbol('FREE', 'EURUSD')).toBe(true);
expect(canAccessSymbol('FREE', 'AUDJPY')).toBe(false); // PRO-only
expect(canAccessSymbol('FREE', 'GBPJPY')).toBe(false); // PRO-only

// PRO tier tests
expect(canAccessSymbol('PRO', 'BTCUSD')).toBe(true);
expect(canAccessSymbol('PRO', 'AUDJPY')).toBe(true);
expect(canAccessSymbol('PRO', 'GBPJPY')).toBe(true);
```

### Timeframe Access Tests

```typescript
// FREE tier tests
expect(canAccessTimeframe('FREE', 'H1')).toBe(true);
expect(canAccessTimeframe('FREE', 'H4')).toBe(true);
expect(canAccessTimeframe('FREE', 'M5')).toBe(false); // PRO-only
expect(canAccessTimeframe('FREE', 'H12')).toBe(false); // PRO-only

// PRO tier tests
expect(canAccessTimeframe('PRO', 'H1')).toBe(true);
expect(canAccessTimeframe('PRO', 'M5')).toBe(true);
expect(canAccessTimeframe('PRO', 'H12')).toBe(true);
```

### Chart Access Tests

```typescript
// FREE tier valid combinations
expect(() => validateChartAccess('FREE', 'EURUSD', 'H1')).not.toThrow();
expect(() => validateChartAccess('FREE', 'XAUUSD', 'D1')).not.toThrow();

// FREE tier invalid combinations
expect(() => validateChartAccess('FREE', 'AUDJPY', 'H1')).toThrow(
  'cannot access AUDJPY'
);
expect(() => validateChartAccess('FREE', 'EURUSD', 'M5')).toThrow(
  'cannot access M5'
);
expect(() => validateChartAccess('FREE', 'AUDJPY', 'M5')).toThrow(); // Both invalid

// PRO tier all valid
expect(() => validateChartAccess('PRO', 'AUDJPY', 'M5')).not.toThrow();
expect(() => validateChartAccess('PRO', 'GBPJPY', 'H12')).not.toThrow();
```

### Trial Period Tests

```typescript
// Trial eligibility tests
const freeUser = {
  tier: 'FREE',
  hasUsedFreeTrial: false,
  trialStatus: 'NOT_STARTED',
};
const usedTrialUser = {
  tier: 'FREE',
  hasUsedFreeTrial: true,
  trialStatus: 'EXPIRED',
};
const proUser = {
  tier: 'PRO',
  hasUsedFreeTrial: false,
  trialStatus: 'NOT_STARTED',
};

expect(canStartTrial(freeUser)).toBe(true); // FREE user, never used trial
expect(canStartTrial(usedTrialUser)).toBe(false); // Already used trial
expect(canStartTrial(proUser)).toBe(false); // Already PRO

// Active trial tests
const now = new Date();
const activeTrialUser = {
  tier: 'FREE',
  trialStatus: 'ACTIVE',
  trialStartDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
  trialEndDate: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000), // 4 days from now
};
const expiredTrialUser = {
  tier: 'FREE',
  trialStatus: 'ACTIVE',
  trialStartDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
  trialEndDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
};

expect(isInActiveTrial(activeTrialUser)).toBe(true);
expect(isInActiveTrial(expiredTrialUser)).toBe(false);

// Effective tier tests
expect(getEffectiveTier(activeTrialUser)).toBe('PRO'); // Trial gives PRO access
expect(getEffectiveTier(expiredTrialUser)).toBe('FREE'); // Expired trial = FREE
expect(getEffectiveTier(proUser)).toBe('PRO'); // PRO user stays PRO

// Trial access tests (FREE user on trial should access PRO features)
const trialUser = {
  tier: 'FREE',
  trialStatus: 'ACTIVE',
  trialStartDate: now,
  trialEndDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
};

const effectiveTier = getEffectiveTier(trialUser);
expect(canAccessSymbol(effectiveTier, 'AUDJPY')).toBe(true); // PRO-only symbol
expect(canAccessTimeframe(effectiveTier, 'M5')).toBe(true); // PRO-only timeframe
expect(() => validateChartAccess(effectiveTier, 'GBPJPY', 'M5')).not.toThrow();
```

# V5 Part K: Alerts System - Implementation Guide

**For:** Trading Alerts SaaS V7
**Part:** 11 - Alerts
**Total Files:** 10 files
**Complexity:** Medium
**Last Updated:** 2025-11-21

---

## Overview

This guide provides the business logic and requirements for implementing the alerts system in the Trading Alerts SaaS V7 project.

### Purpose

Alerts allow users to set price-based conditions on trading symbols and receive notifications when those conditions are met. The system must enforce tier-based limits and validate symbol access.

### Key Features

- Create price alerts with customizable conditions
- Tier-based alert limits (FREE: 5 alerts, PRO: 20 alerts)
- Symbol validation (only tier-allowed symbols)
- Background job to check alert conditions
- Real-time notifications when alerts trigger
- Alert management (view, edit, delete)

---

## Business Requirements

### 1. Tier-Based Alert Limits

**FREE Tier:**

- Maximum 5 active alerts
- Can only create alerts for tier-allowed symbols (XAUUSD only in V5)
- All 7 timeframes available (M15, M30, H1, H2, H4, H8, D1)

**PRO Tier:**

- Maximum 20 active alerts
- Can create alerts for all 10 PRO symbols
- All 7 timeframes available

**Validation Rules:**

- When creating an alert, check user's current alert count against tier limit
- Return 403 Forbidden if limit exceeded with message: "You have reached your alert limit. Upgrade to PRO for more alerts."
- When creating an alert, validate symbol is allowed for user's tier
- Return 403 Forbidden if symbol not allowed with message: "This symbol is not available on your tier. Upgrade to PRO."

### 2. Alert Conditions

**Supported Condition Types:**

- `price_above`: Alert triggers when price goes above target value
- `price_below`: Alert triggers when price goes below target value
- `price_equals`: Alert triggers when price equals target value (with ±0.5% tolerance)

**Alert Data Model:**

```typescript
interface Alert {
  id: string;
  userId: string;
  symbol: string; // e.g., "XAUUSD"
  timeframe: string; // e.g., "H1"
  conditionType: 'price_above' | 'price_below' | 'price_equals';
  targetValue: number; // Target price
  status: 'active' | 'triggered' | 'cancelled';
  triggeredAt?: Date; // When alert was triggered
  createdAt: Date;
  updatedAt: Date;
}
```

### 3. Alert Checking Logic

**Background Job:**

- Runs every 1 minute
- Fetches all active alerts
- For each alert:
  1. Get current price for symbol/timeframe from MT5 service
  2. Check if condition is met
  3. If condition met:
     - Update alert status to 'triggered'
     - Set triggeredAt timestamp
     - Send notification to user (WebSocket + email)
     - Create notification record in database

**Condition Checking:**

```typescript
function checkCondition(
  currentPrice: number,
  conditionType: string,
  targetValue: number
): boolean {
  switch (conditionType) {
    case 'price_above':
      return currentPrice > targetValue;
    case 'price_below':
      return currentPrice < targetValue;
    case 'price_equals':
      // Allow 0.5% tolerance
      const tolerance = targetValue * 0.005;
      return Math.abs(currentPrice - targetValue) <= tolerance;
    default:
      return false;
  }
}
```

### 4. Alert Notifications

**When Alert Triggers:**

**Real-time Notification (WebSocket):**

```typescript
{
  type: 'alert_triggered',
  data: {
    alertId: 'alert-123',
    symbol: 'XAUUSD',
    timeframe: 'H1',
    condition: 'price_above',
    targetValue: 2450.00,
    currentPrice: 2451.25,
    triggeredAt: '2025-11-21T10:30:00Z'
  }
}
```

**Email Notification:**

- Subject: "🔔 Alert Triggered: {symbol} {condition} {targetValue}"
- Body: Include symbol, timeframe, condition, target value, current price, timestamp
- Include link to view chart

### 5. Alert Management API

**POST /api/alerts**

- Create new alert
- Validate tier limits
- Validate symbol access
- Return 201 Created with alert object

**GET /api/alerts**

- List user's alerts
- Filter by status (active/triggered/cancelled)
- Sort by createdAt descending

**GET /api/alerts/[id]**

- Get single alert details
- Verify alert belongs to user

**PATCH /api/alerts/[id]**

- Update alert condition or target value
- Only allow updates for active alerts
- Re-validate symbol access

**DELETE /api/alerts/[id]**

- Delete alert
- Update status to 'cancelled'
- Verify alert belongs to user

---

## UI/UX Requirements

### Alerts List Page

**Display:**

- Table/list of all user alerts
- Columns: Symbol, Timeframe, Condition, Target, Status, Created Date
- Filter by status (Active/Triggered/Cancelled)
- Create Alert button (prominent)

**Status Badges:**

- Active: Blue badge
- Triggered: Green badge with checkmark
- Cancelled: Gray badge

### Create Alert Form

**Fields:**

1. **Symbol Selector** (dropdown)
   - Show only tier-allowed symbols
   - Display tier badge next to symbol name

2. **Timeframe Selector** (dropdown)
   - All 7 timeframes: M15, M30, H1, H2, H4, H8, D1

3. **Condition Type** (radio buttons or dropdown)
   - Price goes above
   - Price goes below
   - Price equals

4. **Target Value** (number input)
   - Label: "Target Price"
   - Placeholder: "Enter target price"
   - Validation: Must be positive number

**Validation:**

- Before submit, check alert count vs tier limit
- Show warning if at limit
- Disable submit button if limit reached with upgrade prompt

**Success:**

- Show success message: "Alert created successfully!"
- Redirect to alerts list
- Show notification bell badge update (if on dashboard)

---

## Error Handling

### Common Errors

**Alert Limit Exceeded:**

```json
{
  "error": "Alert limit exceeded",
  "message": "You have reached your alert limit (5/5). Upgrade to PRO for 20 alerts.",
  "code": "ALERT_LIMIT_EXCEEDED",
  "upgradeUrl": "/pricing"
}
```

**Symbol Not Allowed:**

```json
{
  "error": "Symbol not allowed",
  "message": "EURUSD is not available on the FREE tier. Upgrade to PRO to access 10 symbols.",
  "code": "SYMBOL_NOT_ALLOWED",
  "upgradeUrl": "/pricing"
}
```

**Invalid Target Value:**

```json
{
  "error": "Invalid target value",
  "message": "Target value must be a positive number",
  "code": "INVALID_TARGET_VALUE"
}
```

---

## Integration Points

### With Other Parts

**Part 4 (Tier System):**

- Use `validateTierAccess()` to check symbol access
- Use tier limits constants

**Part 6 (Flask MT5 Service):**

- Fetch current prices for symbols/timeframes
- Endpoint: `GET /api/mt5/price?symbol={symbol}&timeframe={timeframe}`

**Part 11 (Notifications):**

- Send WebSocket notification when alert triggers
- Create notification record in database

**Part 12 (Email):**

- Send email notification when alert triggers
- Use alert email template

---

## Testing Requirements

### Unit Tests

**Alert Creation:**

- Test tier limit enforcement
- Test symbol validation
- Test target value validation

**Condition Checking:**

- Test price_above condition
- Test price_below condition
- Test price_equals condition with tolerance

### Integration Tests

**Alert Lifecycle:**

1. Create alert (should succeed)
2. Check alert triggers correctly
3. Verify notification sent
4. Verify alert status updated

**Tier Limits:**

1. Create 5 alerts as FREE user
2. Attempt to create 6th alert (should fail)
3. Upgrade to PRO
4. Create more alerts (should succeed up to 20)

---

## Performance Considerations

### Background Job Optimization

**Batch Processing:**

- Fetch all active alerts in single query
- Group alerts by symbol/timeframe
- Fetch prices for unique symbol/timeframe combinations only
- Check conditions for all alerts with same symbol/timeframe

**Caching:**

- Cache current prices for 1 minute
- Reduce API calls to MT5 service

**Scaling:**

- If >1000 active alerts, process in batches of 100
- Consider Redis queue for alert checking

---

## Security Considerations

### Authorization

**All Alert Endpoints:**

- Require authentication (valid session)
- Verify alert belongs to authenticated user
- Return 401 Unauthorized if not authenticated
- Return 403 Forbidden if user doesn't own alert

### Data Validation

**Input Sanitization:**

- Validate symbol format (uppercase, valid format)
- Validate timeframe (must be one of 7 allowed)
- Validate condition type (must be one of 3 types)
- Validate target value (positive number, reasonable range)

---

## Migration from V4

**Changes:**

- Remove ENTERPRISE tier references
- Update tier limits (5/20 instead of 5/15/30)
- Update symbol validation to use new tier system

**No Breaking Changes:**

- Alert data model unchanged
- API endpoints unchanged
- Background job logic unchanged

---

## Summary

The Alerts System provides users with automated price monitoring and notifications. Key implementation focus:

1. ✅ **Tier-based limits** - 5 alerts (FREE) vs 20 alerts (PRO)
2. ✅ **Symbol validation** - Only tier-allowed symbols
3. ✅ **Background checking** - Every 1 minute
4. ✅ **Real-time notifications** - WebSocket + Email
5. ✅ **User-friendly UI** - Clear limits, upgrade prompts

**Priority:** High - Core feature for user engagement and retention.

---

**Reference:** This guide works with `docs/build-orders/part-11-alerts.md` for file-by-file build instructions.

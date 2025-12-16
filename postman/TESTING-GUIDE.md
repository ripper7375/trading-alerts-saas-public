# API Testing Guide for Trading Alerts SaaS

## Overview

This guide provides **step-by-step testing scenarios** for your Trading Alerts SaaS APIs. Use this in Phase 3 when testing your application with Postman.

---

## 🎯 Testing Objectives

### What to Test

1. ✅ **Functionality** - Does the endpoint do what it's supposed to?
2. ✅ **Security** - Does authentication and authorization work?
3. ✅ **Validation** - Are invalid inputs rejected properly?
4. ✅ **Tier Restrictions** - Do FREE/PRO limits work correctly?
5. ✅ **Error Handling** - Are errors returned with helpful messages?
6. ✅ **Performance** - Do requests complete quickly?

### Testing Phases

- **Phase 3A:** Unit test each endpoint individually
- **Phase 3B:** Integration test complete user flows
- **Phase 3C:** Load test with multiple requests
- **Phase 4:** Test in staging environment before production

---

## 📋 Test Scenarios

### Scenario 1: New User Registration and Login

**Goal:** Verify a new user can sign up, log in, and access their profile.

#### Test 1.1: Sign Up

**Endpoint:** `POST /api/auth/signup`

**Request Body:**

```json
{
  "email": "test@example.com",
  "password": "SecurePass123!",
  "name": "Test User"
}
```

**Expected Response:**

- Status: `201 Created`
- Body:
  ```json
  {
    "user": {
      "id": "user_abc123",
      "email": "test@example.com",
      "name": "Test User",
      "tier": "FREE"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```

**Validations:**

- ✅ Status code is 201
- ✅ Response includes user object with ID
- ✅ Default tier is "FREE"
- ✅ Token is returned
- ✅ Password is NOT included in response

**Save the token:** Copy the `token` value and save it in your Postman environment variable `authToken`.

---

#### Test 1.2: Login

**Endpoint:** `POST /api/auth/login`

**Request Body:**

```json
{
  "email": "test@example.com",
  "password": "SecurePass123!"
}
```

**Expected Response:**

- Status: `200 OK`
- Body: Same format as signup response

**Validations:**

- ✅ Status code is 200
- ✅ Token is returned
- ✅ User data matches signup data

---

#### Test 1.3: Get User Profile

**Endpoint:** `GET /api/users/profile`

**Headers:**

```
Authorization: Bearer {{authToken}}
```

**Expected Response:**

- Status: `200 OK`
- Body:
  ```json
  {
    "id": "user_abc123",
    "email": "test@example.com",
    "name": "Test User",
    "tier": "FREE",
    "createdAt": "2024-01-15T10:30:00Z"
  }
  ```

**Validations:**

- ✅ Status code is 200
- ✅ User data is correct
- ✅ Tier is "FREE"

---

### Scenario 2: Alert Management (FREE Tier)

**Goal:** Verify FREE tier users can create alerts with tier restrictions.

#### Test 2.1: Create Alert (Valid Symbol)

**Endpoint:** `POST /api/alerts`

**Headers:**

```
Authorization: Bearer {{authToken}}
Content-Type: application/json
```

**Request Body:**

```json
{
  "symbol": "BTCUSD",
  "timeframe": "H1",
  "condition": "RSI_OVERSOLD",
  "threshold": 30,
  "enabled": true
}
```

**Expected Response:**

- Status: `201 Created`
- Body:
  ```json
  {
    "id": "alert_xyz789",
    "userId": "user_abc123",
    "symbol": "BTCUSD",
    "timeframe": "H1",
    "condition": "RSI_OVERSOLD",
    "threshold": 30,
    "enabled": true,
    "createdAt": "2024-01-15T10:35:00Z"
  }
  ```

**Validations:**

- ✅ Status code is 201
- ✅ Alert is created with correct data
- ✅ Alert ID is returned
- ✅ `userId` matches current user

---

#### Test 2.2: Create Alert (Invalid Symbol for FREE Tier)

**Endpoint:** `POST /api/alerts`

**Request Body:**

```json
{
  "symbol": "GBPUSD",
  "timeframe": "H1",
  "condition": "RSI_OVERSOLD",
  "threshold": 30,
  "enabled": true
}
```

**Expected Response:**

- Status: `403 Forbidden`
- Body:
  ```json
  {
    "error": "Forbidden",
    "message": "Symbol GBPUSD is not available for FREE tier. Upgrade to PRO to access this symbol.",
    "availableSymbols": ["BTCUSD", "EURUSD", "USDJPY", "US30", "XAUUSD"]
  }
  ```

**Validations:**

- ✅ Status code is 403
- ✅ Error message explains tier restriction
- ✅ Available symbols for FREE tier are listed

---

#### Test 2.3: Create Alert (Invalid Timeframe for FREE Tier)

**Endpoint:** `POST /api/alerts`

**Request Body:**

```json
{
  "symbol": "BTCUSD",
  "timeframe": "M15",
  "condition": "RSI_OVERSOLD",
  "threshold": 30,
  "enabled": true
}
```

**Expected Response:**

- Status: `403 Forbidden`
- Body:
  ```json
  {
    "error": "Forbidden",
    "message": "Timeframe M15 is not available for FREE tier. Upgrade to PRO to access this timeframe.",
    "availableTimeframes": ["H1", "H4", "D1"]
  }
  ```

**Validations:**

- ✅ Status code is 403
- ✅ Error message explains tier restriction
- ✅ Available timeframes for FREE tier are listed

---

#### Test 2.4: Get All Alerts

**Endpoint:** `GET /api/alerts`

**Headers:**

```
Authorization: Bearer {{authToken}}
```

**Expected Response:**

- Status: `200 OK`
- Body:
  ```json
  {
    "alerts": [
      {
        "id": "alert_xyz789",
        "userId": "user_abc123",
        "symbol": "BTCUSD",
        "timeframe": "H1",
        "condition": "RSI_OVERSOLD",
        "threshold": 30,
        "enabled": true,
        "createdAt": "2024-01-15T10:35:00Z"
      }
    ],
    "total": 1
  }
  ```

**Validations:**

- ✅ Status code is 200
- ✅ Array of alerts is returned
- ✅ Only current user's alerts are shown

---

#### Test 2.5: Update Alert

**Endpoint:** `PUT /api/alerts/{alertId}`

**Headers:**

```
Authorization: Bearer {{authToken}}
Content-Type: application/json
```

**Request Body:**

```json
{
  "threshold": 35,
  "enabled": false
}
```

**Expected Response:**

- Status: `200 OK`
- Body: Updated alert object

**Validations:**

- ✅ Status code is 200
- ✅ Threshold is updated to 35
- ✅ Enabled is updated to false
- ✅ Other fields remain unchanged

---

#### Test 2.6: Delete Alert

**Endpoint:** `DELETE /api/alerts/{alertId}`

**Headers:**

```
Authorization: Bearer {{authToken}}
```

**Expected Response:**

- Status: `204 No Content`
- Body: Empty

**Validations:**

- ✅ Status code is 204
- ✅ Alert is deleted (verify with GET /api/alerts)

---

### Scenario 3: Subscription Management

**Goal:** Verify users can upgrade to PRO tier.

#### Test 3.1: Get Current Subscription

**Endpoint:** `GET /api/subscriptions/current`

**Headers:**

```
Authorization: Bearer {{authToken}}
```

**Expected Response:**

- Status: `200 OK`
- Body:
  ```json
  {
    "userId": "user_abc123",
    "tier": "FREE",
    "status": "active",
    "limits": {
      "symbols": ["BTCUSD", "EURUSD", "USDJPY", "US30", "XAUUSD"],
      "timeframes": ["H1", "H4", "D1"],
      "maxAlerts": 10
    }
  }
  ```

**Validations:**

- ✅ Status code is 200
- ✅ Current tier is "FREE"
- ✅ Limits match FREE tier specifications

---

#### Test 3.2: Upgrade to PRO Tier

**Endpoint:** `POST /api/subscriptions/checkout`

**Headers:**

```
Authorization: Bearer {{authToken}}
Content-Type: application/json
```

**Request Body:**

```json
{
  "tier": "PRO",
  "priceId": "price_1234567890"
}
```

**Expected Response:**

- Status: `200 OK`
- Body:
  ```json
  {
    "sessionId": "cs_test_1234567890",
    "url": "https://checkout.stripe.com/pay/cs_test_1234567890"
  }
  ```

**Validations:**

- ✅ Status code is 200
- ✅ Stripe checkout session is created
- ✅ Redirect URL is returned

**Note:** In test mode, you can complete the Stripe checkout with test card `4242 4242 4242 4242`.

---

#### Test 3.3: Verify PRO Tier After Upgrade

**Endpoint:** `GET /api/subscriptions/current`

**Expected Response:**

- Status: `200 OK`
- Body:
  ```json
  {
    "userId": "user_abc123",
    "tier": "PRO",
    "status": "active",
    "limits": {
      "symbols": [
        "BTCUSD",
        "EURUSD",
        "USDJPY",
        "GBPUSD",
        "USDCHF",
        "AUDUSD",
        "NZDUSD",
        "USDCAD",
        "US30",
        "US500",
        "USTEC",
        "XAUUSD",
        "XAGUSD",
        "USOIL",
        "UKOUSD"
      ],
      "timeframes": ["M5", "M15", "M30", "H1", "H2", "H4", "H8", "H12", "D1"],
      "maxAlerts": 50
    }
  }
  ```

**Validations:**

- ✅ Tier is now "PRO"
- ✅ All 15 symbols are available
- ✅ All 9 timeframes are available
- ✅ Max alerts increased to 50

---

#### Test 3.4: Create Alert with PRO Symbol

**Endpoint:** `POST /api/alerts`

**Request Body:**

```json
{
  "symbol": "GBPUSD",
  "timeframe": "M15",
  "condition": "RSI_OVERSOLD",
  "threshold": 30,
  "enabled": true
}
```

**Expected Response:**

- Status: `201 Created`
- Body: Alert created successfully

**Validations:**

- ✅ Status code is 201
- ✅ PRO-only symbol is now accessible
- ✅ PRO-only timeframe is now accessible

---

### Scenario 4: Flask MT5 Service Integration

**Goal:** Verify MT5 service provides market data and indicators.

#### Test 4.1: Get Symbol Information

**Endpoint:** `GET /api/mt5/symbols/BTCUSD`

**Headers:**

```
X-User-Tier: FREE
```

**Expected Response:**

- Status: `200 OK`
- Body:
  ```json
  {
    "symbol": "BTCUSD",
    "description": "Bitcoin vs US Dollar",
    "digits": 2,
    "point": 0.01,
    "bid": 43250.5,
    "ask": 43251.5,
    "spread": 1.0,
    "volume": 1250000
  }
  ```

**Validations:**

- ✅ Status code is 200
- ✅ Symbol data is returned
- ✅ Real-time bid/ask prices are included

---

#### Test 4.2: Get Indicator Data (RSI)

**Endpoint:** `GET /api/mt5/indicators/rsi`

**Query Parameters:**

```
symbol=BTCUSD
timeframe=H1
period=14
```

**Headers:**

```
X-User-Tier: FREE
```

**Expected Response:**

- Status: `200 OK`
- Body:
  ```json
  {
    "indicator": "RSI",
    "symbol": "BTCUSD",
    "timeframe": "H1",
    "period": 14,
    "values": [
      { "time": "2024-01-15T10:00:00Z", "value": 65.32 },
      { "time": "2024-01-15T09:00:00Z", "value": 62.18 },
      { "time": "2024-01-15T08:00:00Z", "value": 58.94 }
    ]
  }
  ```

**Validations:**

- ✅ Status code is 200
- ✅ RSI values are returned
- ✅ Data is sorted by time (newest first)

---

#### Test 4.3: Get Indicator Data (Invalid Symbol for FREE Tier)

**Endpoint:** `GET /api/mt5/indicators/rsi`

**Query Parameters:**

```
symbol=GBPUSD
timeframe=H1
period=14
```

**Headers:**

```
X-User-Tier: FREE
```

**Expected Response:**

- Status: `403 Forbidden`
- Body:
  ```json
  {
    "error": "Forbidden",
    "message": "Symbol GBPUSD is not available for FREE tier."
  }
  ```

**Validations:**

- ✅ Status code is 403
- ✅ Tier restriction is enforced in Flask service

---

### Scenario 5: Dashboard Data Aggregation

**Goal:** Verify dashboard endpoint returns aggregated data.

#### Test 5.1: Get Dashboard Data

**Endpoint:** `GET /api/dashboard`

**Headers:**

```
Authorization: Bearer {{authToken}}
```

**Expected Response:**

- Status: `200 OK`
- Body:
  ```json
  {
    "user": {
      "name": "Test User",
      "tier": "FREE"
    },
    "stats": {
      "totalAlerts": 1,
      "activeAlerts": 0,
      "triggeredToday": 0
    },
    "recentAlerts": [
      {
        "id": "alert_xyz789",
        "symbol": "BTCUSD",
        "timeframe": "H1",
        "condition": "RSI_OVERSOLD",
        "triggeredAt": null
      }
    ],
    "marketOverview": {
      "BTCUSD": { "price": 43250.5, "change24h": 2.3 },
      "EURUSD": { "price": 1.0945, "change24h": -0.5 }
    }
  }
  ```

**Validations:**

- ✅ Status code is 200
- ✅ User stats are accurate
- ✅ Recent alerts are listed
- ✅ Market overview is included

---

## 🔒 Security Testing

### Test: Missing Authorization Header

**Any protected endpoint** (e.g., `GET /api/alerts`)

**Headers:** (none)

**Expected Response:**

- Status: `401 Unauthorized`
- Body:
  ```json
  {
    "error": "Unauthorized",
    "message": "Authentication required"
  }
  ```

**Validations:**

- ✅ Status code is 401
- ✅ Helpful error message

---

### Test: Invalid/Expired Token

**Any protected endpoint** (e.g., `GET /api/alerts`)

**Headers:**

```
Authorization: Bearer invalid_token_xyz
```

**Expected Response:**

- Status: `401 Unauthorized`
- Body:
  ```json
  {
    "error": "Unauthorized",
    "message": "Invalid or expired token"
  }
  ```

**Validations:**

- ✅ Status code is 401
- ✅ Invalid tokens are rejected

---

### Test: Accessing Another User's Data

**Endpoint:** `GET /api/alerts/{anotherUsersAlertId}`

**Headers:**

```
Authorization: Bearer {{authToken}}
```

**Expected Response:**

- Status: `404 Not Found` or `403 Forbidden`
- Body:
  ```json
  {
    "error": "Not Found",
    "message": "Alert not found"
  }
  ```

**Validations:**

- ✅ Users cannot access other users' data
- ✅ Proper error code returned

---

## ✅ Testing Checklist

Use this checklist to track your testing progress:

### Authentication & Authorization

- [ ] Sign up with valid data
- [ ] Sign up with duplicate email (should fail)
- [ ] Login with valid credentials
- [ ] Login with invalid credentials (should fail)
- [ ] Access protected endpoint without token (should fail)
- [ ] Access protected endpoint with invalid token (should fail)

### Alert Management (FREE Tier)

- [ ] Create alert with valid FREE symbol
- [ ] Create alert with PRO symbol (should fail)
- [ ] Create alert with valid FREE timeframe
- [ ] Create alert with PRO timeframe (should fail)
- [ ] Get all alerts
- [ ] Get specific alert by ID
- [ ] Update alert
- [ ] Delete alert

### Alert Management (PRO Tier)

- [ ] Upgrade to PRO tier
- [ ] Create alert with PRO symbol
- [ ] Create alert with PRO timeframe
- [ ] Verify all 15 symbols are accessible
- [ ] Verify all 9 timeframes are accessible

### MT5 Integration

- [ ] Get symbol information for FREE symbol
- [ ] Get symbol information for PRO symbol (FREE user should fail)
- [ ] Get RSI indicator data
- [ ] Get MACD indicator data
- [ ] Get Bollinger Bands indicator data
- [ ] Verify tier restrictions work in Flask service

### Dashboard

- [ ] Get dashboard data
- [ ] Verify stats are accurate
- [ ] Verify market overview is included

### Error Handling

- [ ] Test missing required fields
- [ ] Test invalid data types
- [ ] Test invalid enum values
- [ ] Test exceeding limits (e.g., max alerts)

---

## 📊 Test Results Template

Use this template to document your test results:

```markdown
## Test Session: [Date]

### Environment

- Next.js: http://localhost:3000
- Flask MT5: http://localhost:5001
- User: test@example.com
- Tier: FREE / PRO

### Results

| Test ID | Endpoint                      | Expected | Actual | Status  | Notes |
| ------- | ----------------------------- | -------- | ------ | ------- | ----- |
| 1.1     | POST /api/auth/signup         | 201      | 201    | ✅ PASS | -     |
| 1.2     | POST /api/auth/login          | 200      | 200    | ✅ PASS | -     |
| 2.1     | POST /api/alerts              | 201      | 201    | ✅ PASS | -     |
| 2.2     | POST /api/alerts (PRO symbol) | 403      | 403    | ✅ PASS | -     |
| ...     | ...                           | ...      | ...    | ...     | ...   |

### Summary

- Total Tests: 30
- Passed: 28
- Failed: 2
- Pass Rate: 93.3%

### Issues Found

1. [Issue #1 description]
2. [Issue #2 description]
```

---

## 💡 Testing Tips

1. **Test in order:** Follow the scenarios sequentially to build up test data
2. **Save tokens:** Always save auth tokens in Postman variables
3. **Document failures:** Take screenshots and note exact error messages
4. **Test edge cases:** Don't just test happy paths
5. **Test both tiers:** Create separate users for FREE and PRO testing
6. **Use Postman Tests:** Write automated test scripts in Postman
7. **Export collections:** Save your tested collections with examples

---

**💡 Beginner Insight:** Testing might seem tedious, but it's your safety net! Each test you run prevents a bug from reaching your users. Think of it as quality insurance for your SaaS!

# Postman Collections for Trading Alerts SaaS

## Overview

This folder contains instructions and documentation for setting up **Postman collections** to test your Trading Alerts SaaS APIs. Postman is a powerful tool that lets you test your API endpoints without writing any code!

## What is Postman?

**For Beginners:** Postman is like a "web browser for APIs." Instead of visiting websites, you use it to:

- Send requests to your API endpoints
- See the responses
- Test if everything works correctly
- Debug issues before they reach production

Think of it as a testing laboratory for your backend!

## Why Use Postman?

1. ✅ **Test APIs instantly** - No need to build a frontend first
2. ✅ **Auto-generated collections** - Import from OpenAPI specs
3. ✅ **Save time** - Test all 50+ endpoints in minutes
4. ✅ **Catch bugs early** - Find issues before users do
5. ✅ **Document APIs** - Share collections with team members

## What You'll Import

Your project has **2 OpenAPI specification files** that will become 2 Postman collections:

### 1. Next.js API Collection

**File:** `docs/trading_alerts_openapi.yaml`
**Endpoints:** ~38 endpoints including:

- Authentication (login, signup, logout)
- User profile management
- Alerts CRUD operations
- Subscriptions and billing
- Dashboard data
- And more...

### 2. Flask MT5 Service Collection

**File:** `docs/flask_mt5_openapi.yaml`
**Endpoints:** ~12 endpoints including:

- Market data retrieval
- Technical indicators (RSI, MACD, Bollinger Bands)
- Symbol information
- Historical data
- And more...

---

## 📥 Step-by-Step Setup Guide

### Prerequisites

1. **Download Postman:**
   - Visit: https://www.postman.com/downloads/
   - Download for Windows/Mac/Linux
   - Install and launch Postman
   - Create a free account (sign up)

2. **Have your OpenAPI files ready:**
   - These are already in your `docs/` folder
   - You'll import them into Postman

---

### Step 1: Import Next.js API Collection (10 minutes)

1. **Launch Postman**

2. **Click "Import" button** (top-left corner of Postman)

3. **Select "files" tab**

4. **Click "Upload Files"**

5. **Navigate to your project:**

   ```
   trading-alerts-saas-v7/docs/trading_alerts_openapi.yaml
   ```

6. **Select the file and click "Open"**

7. **Review import settings:**
   - Import As: `Postman Collection`
   - Click "Import"

8. **Success!** 🎉
   You'll see a new collection called **"Trading Alerts API"** (or similar) in the left sidebar with all 38 endpoints organized by category!

---

### Step 2: Configure Variables for Next.js API (5 minutes)

After importing, you need to set up **environment variables** so Postman knows where to send requests.

1. **Click on the collection name** in the left sidebar

2. **Click "Variables" tab**

3. **Add these variables:**

| Variable Name | Initial Value           | Current Value           | Description             |
| ------------- | ----------------------- | ----------------------- | ----------------------- |
| `baseUrl`     | `http://localhost:3000` | `http://localhost:3000` | Next.js dev server URL  |
| `authToken`   | (leave empty)           | (leave empty)           | JWT token after login   |
| `userId`      | (leave empty)           | (leave empty)           | Current user ID         |
| `tier`        | `FREE`                  | `FREE`                  | User tier (FREE or PRO) |

4. **Click "Save"**

**💡 How to use variables:**

- Postman will automatically use `{{baseUrl}}` in all requests
- After logging in, you'll copy the auth token and paste it into `{{authToken}}`
- This saves you from updating URLs in every single request!

---

### Step 3: Import Flask MT5 Service Collection (10 minutes)

Repeat the import process for the Flask API:

1. **Click "Import" button** again

2. **Select "files" tab**

3. **Upload file:**

   ```
   trading-alerts-saas-v7/docs/flask_mt5_openapi.yaml
   ```

4. **Click "Import"**

5. **Success!** 🎉
   You'll see a new collection called **"Flask MT5 Service"** with all MT5 endpoints!

---

### Step 4: Configure Variables for Flask MT5 API (5 minutes)

1. **Click on the "Flask MT5 Service" collection**

2. **Click "Variables" tab**

3. **Add these variables:**

| Variable Name | Initial Value           | Current Value           | Description                   |
| ------------- | ----------------------- | ----------------------- | ----------------------------- |
| `baseUrl`     | `http://localhost:5001` | `http://localhost:5001` | Flask service URL             |
| `userTier`    | `FREE`                  | `FREE`                  | User tier for tier validation |

4. **Click "Save"**

---

### Step 5: Export Collections (Optional, 10 minutes)

**Why export?** So you can share collections with team members or save them for later.

**For each collection:**

1. **Right-click the collection name** in left sidebar

2. **Click "Export"**

3. **Choose format:** "Collection v2.1" (recommended)

4. **Save to:**
   - Next.js API: `postman/nextjs-api.postman_collection.json`
   - Flask MT5: `postman/flask-mt5.postman_collection.json`

5. **Commit to Git:**
   ```bash
   git add postman/*.json
   git commit -m "Add exported Postman collections"
   git push
   ```

**Note:** You can skip this step in Phase 1. You'll export collections after testing them in Phase 3.

---

## 🧪 How to Test Your APIs (Phase 3)

Once you've built your application in Phase 3, here's how to test it:

### Testing Workflow

1. **Start your development servers:**

   ```bash
   # Terminal 1: Start Next.js
   npm run dev

   # Terminal 2: Start Flask MT5 Service
   cd mt5-service
   python app.py
   ```

2. **Open Postman**

3. **Test authentication first:**
   - Expand the "Auth" folder in your collection
   - Click "POST /api/auth/signup"
   - Click "Send"
   - Copy the `authToken` from the response
   - Paste it into your collection's `authToken` variable

4. **Test other endpoints:**
   - All endpoints will now use your auth token automatically
   - Click any endpoint → Click "Send" → See the response!

### Example: Testing Alert Creation

1. **Click: POST /api/alerts**

2. **Go to "Body" tab**

3. **Ensure "raw" and "JSON" are selected**

4. **Paste this request:**

   ```json
   {
     "symbol": "BTCUSD",
     "timeframe": "H1",
     "condition": "RSI_OVERSOLD",
     "threshold": 30
   }
   ```

5. **Click "Send"**

6. **Check the response:**
   - ✅ Status 201 Created → Success!
   - ❌ Status 400 Bad Request → Check your request body
   - ❌ Status 401 Unauthorized → Update your authToken
   - ❌ Status 403 Forbidden → Check tier restrictions

---

## 📚 Understanding Postman Collections

### Collection Structure

```
📁 Trading Alerts API
  ├── 📁 Auth
  │   ├── POST /api/auth/signup
  │   ├── POST /api/auth/login
  │   └── POST /api/auth/logout
  │
  ├── 📁 Users
  │   ├── GET /api/users/profile
  │   └── PUT /api/users/profile
  │
  ├── 📁 Alerts
  │   ├── GET /api/alerts
  │   ├── POST /api/alerts
  │   ├── GET /api/alerts/{id}
  │   ├── PUT /api/alerts/{id}
  │   └── DELETE /api/alerts/{id}
  │
  └── ... (more folders)
```

### Request Components

Each request in Postman has:

1. **Method** - GET, POST, PUT, DELETE
2. **URL** - The endpoint (uses `{{baseUrl}}` variable)
3. **Headers** - Authorization, Content-Type, etc.
4. **Body** - Data to send (for POST/PUT requests)
5. **Params** - Query parameters (?param=value)

### Response Components

After sending a request, you'll see:

1. **Status Code** - 200 OK, 201 Created, 400 Bad Request, etc.
2. **Headers** - Response headers
3. **Body** - JSON response data
4. **Time** - How long the request took
5. **Size** - Response size

---

## 🔍 Testing Strategy

### Testing Order (Recommended)

Test endpoints in this order to build up your test data:

1. ✅ **Auth endpoints** - Sign up and login first
2. ✅ **User profile** - Verify user data
3. ✅ **Subscriptions** - Test tier upgrades
4. ✅ **Alerts** - Create, read, update, delete alerts
5. ✅ **Dashboard** - Verify aggregated data
6. ✅ **MT5 Service** - Test indicator data
7. ✅ **Market data** - Test real-time data

### Testing Checklist for Each Endpoint

For every endpoint, test:

- ✅ **Happy path** - Normal successful request
- ✅ **Missing auth token** - Should return 401
- ✅ **Invalid data** - Should return 400 with error message
- ✅ **Tier restrictions** - FREE users can't access PRO features
- ✅ **Edge cases** - Empty arrays, null values, etc.

---

## 🐛 Troubleshooting

### Issue: "Could not send request"

**Cause:** Your development server isn't running.

**Solution:**

```bash
# Start Next.js server
npm run dev

# Start Flask server
cd mt5-service && python app.py
```

### Issue: "401 Unauthorized"

**Cause:** Missing or expired auth token.

**Solution:**

1. Test the login endpoint first
2. Copy the token from the response
3. Update the `authToken` variable in your collection

### Issue: "Connection refused"

**Cause:** Wrong base URL or port.

**Solution:**

- Check your `baseUrl` variable
- Verify servers are running on correct ports:
  - Next.js: `http://localhost:3000`
  - Flask: `http://localhost:5001`

### Issue: "403 Forbidden"

**Cause:** Tier restriction - FREE user trying to access PRO feature.

**Solution:**

- This is expected behavior!
- Test with a PRO tier user or update subscription

### Issue: "404 Not Found"

**Cause:** Endpoint doesn't exist or wrong URL.

**Solution:**

- Double-check the endpoint path
- Ensure you've built that endpoint in your code
- Check for typos in the URL

---

## 💡 Beginner Tips

### Tip 1: Use Collections to Stay Organized

Don't create individual requests! Always import from OpenAPI specs so your collection matches your API documentation.

### Tip 2: Save Responses as Examples

After getting a successful response:

1. Click "Save Response"
2. Give it a name like "Example: Successful Alert Creation"
3. Now you have documentation with real examples!

### Tip 3: Use Environments for Different Stages

Create multiple environments:

- **Local** - `http://localhost:3000`
- **Staging** - `https://staging.your-app.com`
- **Production** - `https://your-app.com`

Switch between them easily!

### Tip 4: Test as You Build

Don't wait until everything is done! Test each endpoint immediately after building it. This catches bugs early.

### Tip 5: Use Postman Console for Debugging

Open Postman Console (View → Show Postman Console) to see:

- Full request details
- Response headers
- Network timing
- Errors and warnings

---

## 📖 Additional Resources

### Postman Documentation

- **Getting Started:** https://learning.postman.com/docs/getting-started/introduction/
- **Testing APIs:** https://learning.postman.com/docs/sending-requests/requests/
- **Variables:** https://learning.postman.com/docs/sending-requests/variables/

### Your Project Documentation

- **OpenAPI Specs:** `docs/trading_alerts_openapi.yaml` and `docs/flask_mt5_openapi.yaml`
- **API Architecture:** `ARCHITECTURE.md`
- **Quality Standards:** `docs/policies/02-quality-standards.md`

---

## 🎯 Next Steps

### Phase 1 (Now)

- ✅ Read this guide
- ✅ Install Postman
- ✅ Import both OpenAPI specs
- ✅ Configure variables
- ✅ Get familiar with the UI

### Phase 3 (When Building)

- Test each endpoint as you build it
- Update variables as needed
- Save successful responses as examples
- Export collections and commit to Git
- Use collections for manual QA testing

---

## 📝 Summary

**What you learned:**

- What Postman is and why it's useful
- How to import OpenAPI specs into Postman
- How to configure collection variables
- How to test API endpoints
- Best practices for API testing

**Time saved:**

- Without Postman: 10+ hours manually testing with curl or code
- With Postman: 30 minutes to set up, instant testing thereafter

**Value for V7 workflow:**

- Aider builds endpoints → You test in Postman → Catch bugs fast → Ship quality code

---

**💡 Beginner Insight:** Postman turns API testing from a tedious chore into a fun, visual experience. You'll wonder how you ever developed without it!

**Questions?** If you're confused about any step, ask Claude Chat for clarification!

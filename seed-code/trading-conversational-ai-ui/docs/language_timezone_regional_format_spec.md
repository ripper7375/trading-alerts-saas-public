# Architectural Specification: Language, Timezone & Regional Format Stack

> **Purpose**: This document defines the clear division of development responsibilities between **Server-Side (Claude Code)** in the main codebase (`D:\SaaS Project\trading-alerts-saas-public\`) and **Client-Side (Antigravity)** in the UI seed codebase (`D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui\`).

---

## 🏛️ Division of Development Responsibilities

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        DAVINTRADE HYBRID i18n STACK DIVISION                           │
├───────────────────────────────────────────┬────────────────────────────────────────────┤
│ SERVER-SIDE (Claude Code)                 │ CLIENT-SIDE (Antigravity)                  │
│ Location: Main Repo (`app/api/`, `prisma/`) │ Location: UI Repo (`seed-code/`)          │
│ • Database Models (`UserPreference`)      │ • `LocaleProvider` React 19 Context        │
│ • REST APIs (`GET/PUT /api/user/pref`)    │ • Dynamic Country URL Routing (`middleware`)│
│ • IP-Based GeoIP Server Header Parsing    │ • Automatic IP-Based GeoIP Auto-Detection  │
│ • AI Prompt Language Injection Middleware │ • `<T>` Centralized Auto-Lookup Engine     │
│ • dLocal & Stripe Multi-Currency Handlers │ • Dynamic UTC Timestamp & Date Formatters  │
│ • Part 05 Dual Auth Middleware Sync       │ • Dedicated UK English (`en-GB`) + `en-US` │
│ • Server Validation & Security            │ • dLocal 8 Emerging Market Currencies      │
└───────────────────────────────────────────┴────────────────────────────────────────────┘
```

---

## 1. ⚡ Frontend Architecture & Centralized Propagation

The Client-Side UI utilizes a 3-tier hybrid architecture to ensure 100% complete language propagation across all pages, components, overlays, charts, and AI outputs:

1. **Dynamic Country URL Prefix Routing (`middleware.ts`)**:
   - Implements Next.js Proxy/Middleware rewrite for all 372 country-prefixed route combinations in `page-inventories.xlsx` (e.g. `/th/settings/help`, `/gb/alerts`, `/vn/pricing`, `/in/dashboard`).
   - Preserves browser address bar URLs while activating that country's language, timezone, currency, and date format automatically.

2. **Automatic IP-Based GeoIP Location & Language Auto-Detection**:
   - For unauthenticated users entering without a country prefix, the system auto-detects their country via IP address (GeoIP).
   - Thai users (`TH`) auto-load in Thai/THB/Asia/Bangkok; Vietnamese users (`VN`) in Vietnamese/VND/Asia/Ho_Chi_Minh; UK users (`GB`) in UK English/GBP/Europe/London.

3. **Method 1: Centralized `<T>` Component & Text-Based Auto-Lookup**:
   - Developers can wrap UI text in `<T>Ask AI about M5 Chart</T>` or call `t('PNG Download')`.
   - The engine automatically resolves text strings dynamically against lazy-loaded dictionaries (`en-GB.json`, `th.json`, `vi.json`, `es.json`, etc.) with **0kB** external dependency bloat.

4. **Method 2: AI System Prompt Language Injection**:
   - Dynamic LLM outputs (Gemini 3.6 Flash, Claude Sonnet 5, DeepSeek V4 market commentary, trade setup rationales) are generated in the active language by injecting `userPreference.language` into the system prompt at the backend layer.

---

## 2. 🇬🇧 Tier-1 Priority & dLocal Emerging Market Regions (12 Supported Countries)

The client & server stack explicitly supports the **United Kingdom 🇬🇧 (Tier-1 CFD & Prop Firm Market)** plus all **8 dLocal emerging market countries**:

| Country / Region               | Code | Language / Locale         | Currency | Symbol | Timezone              | Default Date Format | Example Amount |
| ------------------------------ | ---- | ------------------------- | -------- | ------ | --------------------- | ------------------- | -------------- |
| 🇬🇧 **United Kingdom (Tier-1)** | `GB` | `en-GB` (British English) | `GBP`    | `£`    | `Europe/London`       | `DD/MM/YYYY`        | £850.00        |
| 🇮🇳 **India**                   | `IN` | `hi` (Hindi)              | `INR`    | `₹`    | `Asia/Kolkata`        | `DD/MM/YYYY`        | ₹4,200         |
| 🇳🇬 **Nigeria**                 | `NG` | `en-US`                   | `NGN`    | `₦`    | `Africa/Lagos`        | `DD/MM/YYYY`        | ₦75,000        |
| 🇵🇰 **Pakistan**                | `PK` | `ur` (Urdu)               | `PKR`    | `Rs`   | `Asia/Karachi`        | `DD/MM/YYYY`        | Rs14,000       |
| 🇻🇳 **Vietnam**                 | `VN` | `vi` (Vietnamese)         | `VND`    | `₫`    | `Asia/Ho_Chi_Minh`    | `DD/MM/YYYY`        | ₫1,200,000     |
| 🇮🇩 **Indonesia**               | `ID` | `id` (Indonesian)         | `IDR`    | `Rp`   | `Asia/Jakarta`        | `DD/MM/YYYY`        | Rp750,000      |
| 🇹🇭 **Thailand**                | `TH` | `th` (Thai)               | `THB`    | `฿`    | `Asia/Bangkok`        | `DD/MM/YYYY`        | ฿1,750         |
| 🇿🇦 **South Africa**            | `ZA` | `en-US`                   | `ZAR`    | `R`    | `Africa/Johannesburg` | `DD/MM/YYYY`        | R900           |
| 🇹🇷 **Turkey**                  | `TR` | `tr` (Turkish)            | `TRY`    | `₺`    | `Europe/Istanbul`     | `DD/MM/YYYY`        | ₺1,700         |
| 🇺🇸 _United States_             | `US` | `en-US`                   | `USD`    | `$`    | `America/New_York`    | `MM/DD/YYYY`        | $1,000.00      |
| 🇪🇺 _Eurozone_                  | `EU` | `de` (German) / `es`      | `EUR`    | `€`    | `Europe/Berlin`       | `DD/MM/YYYY`        | €950.00        |
| 🇯🇵 _Japan_                     | `JP` | `ja` (Japanese)           | `JPY`    | `¥`    | `Asia/Tokyo`          | `YYYY-MM-DD`        | ¥150,000       |

---

## 3. ⚙️ Server-Side Requirements (Claude Code Back-End Tasks)

Claude Code should implement the following server-side models, API endpoints, LLM middlewares, and payment handlers in the main codebase:

### A. Prisma Database Schema (`prisma/schema.prisma`)

```prisma
model UserPreference {
  id                String   @id @default(cuid())
  userId            String   @unique
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Regional & Language Preferences
  countryCode       String   @default("GB") // GB, IN, NG, PK, VN, ID, TH, ZA, TR, US, EU, JP
  language          String   @default("en-GB") // en-GB, en-US, es, th, hi, vi, id, ur, tr, pt, ja, de
  timezone          String   @default("Europe/London") // IANA Timezone identifier
  dateFormat        String   @default("DMY") // DMY (UK/dLocal standard), MDY, YMD
  timeFormat        String   @default("24h") // 12h, 24h
  currency          String   @default("GBP") // GBP, USD, INR, NGN, PKR, VND, IDR, THB, ZAR, TRY, EUR, JPY

  // Appearance & Chart Preferences
  theme             String   @default("dark")
  accentColor       String   @default("amber")
  chartUpColor      String   @default("#10b981")
  chartDownColor    String   @default("#ef4444")
  gridOpacity       Int      @default(25)

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

### B. REST API Endpoints & Server-Side GeoIP Detection (`app/api/user/preferences/route.ts`)

- **`GET /api/user/preferences`**:
  - **Auth**: Integrates cleanly with Part 05 Auth (Session Cookie or Bearer Token).
  - **Server GeoIP Resolution**: Reads `cf-ipcountry` or `x-vercel-ip-country` HTTP request headers to auto-resolve guest country if no DB session exists.
  - **Response**:
    ```json
    {
      "preferences": {
        "countryCode": "GB",
        "language": "en-GB",
        "timezone": "Europe/London",
        "dateFormat": "DMY",
        "timeFormat": "24h",
        "currency": "GBP"
      }
    }
    ```

- **`PUT /api/user/preferences`**:
  - **Auth**: Required (Part 05 Auth protected).
  - **Request Body**: `{ countryCode, language, timezone, dateFormat, timeFormat, currency }`

### C. AI System Prompt Language Middleware (`app/api/ai/chat/route.ts`)

When invoking LLM completion handlers (Gemini, Claude, DeepSeek, GPT), Claude Code's server route must inject the user's active language into the system directive:

```typescript
// Server-Side LLM Middleware Prompt Injection
const userLang = userPreferences?.language || 'en-GB';

const systemPrompt = `
You are DavinTrade AI, an expert technical market analyst.
SYSTEM DIRECTIVE: Respond directly in the user's preferred language: ${userLang} (e.g. Thai, Vietnamese, UK English, Spanish, Hindi).
Maintain accurate financial and technical trading terminology.
`;
```

### D. dLocal & Stripe Multi-Currency Payment Backend Integration

When serving `/api/checkout` or initializing payment gateways:

1. Read `userPreference.currency` (`GBP`, `INR`, `VND`, `THB`, `NGN`, `PKR`, `IDR`, `ZAR`, `TRY`).
2. Pass the matching local currency code to the dLocal payment API / Stripe checkout session payload.

---

## 🔒 Part 05 Dual Auth Decoupling Strategy

- The client-side `LocaleProvider` operates **independently of auth state**.
- On startup, it checks `localStorage` or fetches `GET /api/user/preferences` with `credentials: 'include'`.
- If Part 05 Auth session is logged in, settings sync with PostgreSQL.
- If logged out / guest, settings function seamlessly in local memory with zero authorization errors or page crashes!

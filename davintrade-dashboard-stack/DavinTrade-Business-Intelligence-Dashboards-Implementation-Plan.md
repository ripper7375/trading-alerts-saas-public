# Master Technical Implementation Plan: DavinTrade Multi-Dashboard Business Intelligence System (25 Metrics) — v4.0

**Document Type:** Senior Engineering & Product Architecture Specification (Comprehensive Production-Grade)  
**Target Platform:** DavinTrade **Next.js 16.3.3 App Router** (React 19, Turbopack, React Server Components, Server Actions), PostgreSQL (Prisma ORM), Tailwind CSS, Recharts, Shadcn UI  
**Target Executor:** Claude Code / Full-Stack Engineering Team  
**Primary Base Currency:** USD

### Primary Master References & Visual Artifacts:

1. **Master Excel Workbook (25 Metrics Catalog, Thresholds & Data Tables):**
   - [`davintrade-dashboard-stack/countries-vat-and-business-dashboard.xlsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/davintrade-dashboard-stack/countries-vat-and-business-dashboard.xlsx)
   - _(Original Location: [`davintrade-vat-and-affiliate-commission-stack/countries-vat-and-business-dashboard.xlsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/davintrade-vat-and-affiliate-commission-stack/countries-vat-and-business-dashboard.xlsx))_
2. **Interactive Executive Visual Dashboard Prototypes (5-in-1 Multi-Tab Previews):**
   - 🌙 **Dark Theme Interactive Preview:** [`davintrade-dashboard-stack/davintrade-dashboards-interactive-preview.html`](file:///d:/SaaS%20Project/trading-alerts-saas-public/davintrade-dashboard-stack/davintrade-dashboards-interactive-preview.html)
   - ☀️ **Light Theme Interactive Preview:** [`davintrade-dashboard-stack/davintrade-dashboards-light-theme.html`](file:///d:/SaaS%20Project/trading-alerts-saas-public/davintrade-dashboard-stack/davintrade-dashboards-light-theme.html)
3. **Visual Design Layout & Presentation Inspirations:**
   - Design Folder: [`davintrade-dashboard-stack/dashboard-design`](file:///d:/SaaS%20Project/trading-alerts-saas-public/davintrade-dashboard-stack/dashboard-design) (`command-centre.webp`, `global-superstore.jpeg`, `sales-dashboard.jfif`, `10-kpi-in-dashboard.jfif`)

---

## 1. Executive Summary & Dashboard Topology (Admin Portal Exclusive)

> [!IMPORTANT]
> **Admin Portal Exclusivity & RBAC Enforcement:**  
> All 5 dashboards and associated backend analytics API routes (`/api/admin/analytics/*`) are strictly built inside the **DavinTrade Backoffice Admin Portal (`/admin/*`)**. Access is strictly protected by administrator role verification (`session.user.role === 'ADMIN'`). These administrative views are integrated directly into the `app/admin/layout.tsx` navigation system and are never exposed to standard public/trading users.

This specification defines the complete end-to-end implementation of the **DavinTrade Business Administration Analytics & Surveillance System** in the Backoffice Admin Portal. Based on the 25 business metrics cataloged in the business requirements, the architecture synthesizes these metrics into **5 specialized, high-cohesion dashboards** (4 deep-dive domain dashboards + 1 unified Executive Command Center).

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                DAVINTRADE ADMIN BUSINESS INTELLIGENCE                             │
├───────────────────────────────┬──────────────────────────────────┬───────────────────────────────┤
│  DB1: Revenue & Growth        │  DB2: User Base & Funnel         │  DB3: Regional & Tax Intel    │
│  (/admin/dashboards/revenue)  │  (/admin/dashboards/users)       │  (/admin/dashboards/regional) │
│  - Monthly/Quarterly Sales    │  - Free vs PRO MoM Dynamics      │  - Country User/Sales Ranks   │
│  - Trailing 3M / 3Q Run-Rates │  - Overall Conversion %          │  - Donut Market Share %       │
│  - %YoY Monthly & Quarterly   │  - True Churn % (Excl. Trials)   │  - VAT Threshold Surveillance │
│  - ARPPU & MRR/ARR Run-Rates  │  - 6-Month Trailing Trajectory   │  - "Other Countries" Grouping │
├───────────────────────────────┴──────────────────────────────────┴───────────────────────────────┤
│  DB4: Affiliate Partner Network (/admin/dashboards/affiliates)                                   │
│  - Total Partner Growth MoM | Free vs PRO Tier Ratio | Avg Monthly Commission                     │
│  - Top 20 Privacy-Preserving Leaderboard (Masked Partner ID + Country, Names/Contact Redacted)   │
│  - Geographic Partner Distribution (17 Primary Jurisdictions + "Other Countries")                │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│  DB5: Executive Business Command Center (/admin/dashboards/executive & Root /admin)              │
│  - Unified Glass Pane synthesising Top KPIs, RAG Health Status, Revenue Run-Rate, Global Heatmap   │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Key Architecture, Privacy & Geographic Taxonomy Rules (v4.0 Specifications)

### 2.1 Geographic Taxonomy & "Other Countries" Aggregation Strategy

All geographical grouping in the database queries, backend analytics workers, API endpoints, data tables, and donut charts must adhere to the **17 Primary Statutory Jurisdictions + "Other Countries"** rule:

1. **The 17 Primary Statutory Jurisdictions (Whitelisted):**
   - **`EU`**: European Union (All 27 member states aggregated: `AT, BE, BG, HR, CY, CZ, DK, EE, FI, FR, DE, GR, HU, IE, IT, LV, LT, LU, MT, NL, PL, PT, RO, SK, SI, ES, SE`)
   - **`GB`**: United Kingdom (UK)
   - **`US`**: United States (50 States)
   - **`TH`**: Thailand
   - **`SG`**: Singapore
   - **`HK`**: Hong Kong
   - **`JP`**: Japan
   - **`TW`**: Taiwan
   - **`KR`**: South Korea
   - **`ID`**: Indonesia
   - **`IN`**: India
   - **`VN`**: Vietnam
   - **`ZA`**: South Africa
   - **`TR`**: Turkey
   - **`PK`**: Pakistan
   - **`NG`**: Nigeria
   - **`AE`**: United Arab Emirates (UAE)

2. **The "Other Countries" Catch-All Rule:**
   - Any user, session, transaction, invoice, or affiliate partner originating from a country code outside the 17 primary jurisdictions above (e.g., `CA, AU, BR, MX, MY, PH, NZ, CH, NO`, or `UNKNOWN`/null) is **automatically grouped and summed under `"Other Countries"` (ISO Key: `OTHERS`)**.
   - In ranked tables and donut charts, the 17 primary jurisdictions are ranked by their individual metrics, and `"Other Countries"` appears as a distinct consolidated row/slice ensuring that the total user base and global revenue always sum to 100%.

#### SQL Geographic Normalization Snippet

```sql
-- Reusable SQL expression for Jurisdiction Normalization
CASE
  WHEN UPPER("country") IN ('AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','EU') THEN 'European Union'
  WHEN UPPER("country") IN ('GB','UK') THEN 'United Kingdom'
  WHEN UPPER("country") = 'US' THEN 'United States'
  WHEN UPPER("country") = 'TH' THEN 'Thailand'
  WHEN UPPER("country") = 'SG' THEN 'Singapore'
  WHEN UPPER("country") = 'HK' THEN 'Hong Kong'
  WHEN UPPER("country") = 'JP' THEN 'Japan'
  WHEN UPPER("country") = 'TW' THEN 'Taiwan'
  WHEN UPPER("country") = 'KR' THEN 'South Korea'
  WHEN UPPER("country") = 'ID' THEN 'Indonesia'
  WHEN UPPER("country") = 'IN' THEN 'India'
  WHEN UPPER("country") = 'VN' THEN 'Vietnam'
  WHEN UPPER("country") = 'ZA' THEN 'South Africa'
  WHEN UPPER("country") = 'TR' THEN 'Turkey'
  WHEN UPPER("country") = 'PK' THEN 'Pakistan'
  WHEN UPPER("country") = 'NG' THEN 'Nigeria'
  WHEN UPPER("country") = 'AE' THEN 'United Arab Emirates'
  ELSE 'Other Countries'
END AS jurisdiction_name,
CASE
  WHEN UPPER("country") IN ('AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','EU') THEN 'EU'
  WHEN UPPER("country") IN ('GB','UK') THEN 'GB'
  WHEN UPPER("country") IN ('US','TH','SG','HK','JP','TW','KR','ID','IN','VN','ZA','TR','PK','NG','AE') THEN UPPER("country")
  ELSE 'OTHERS'
END AS jurisdiction_iso
```

### 2.2 Privacy-Preserving Leaderboard Architecture (Metric #25)

In compliance with GDPR, UK Data Protection Act 2018, and global data privacy standards:

- **Redaction of PII:** Full names, email addresses, phone numbers, and physical contact details are **strictly redacted** from the leaderboard view and API response.
- **Anonymized Masked Partner Identifier:** Uses the format `Partner #[ISO]-[UniqueHash4]` (e.g. `Partner #TH-8821`, `Partner #GB-4019`, `Partner #US-7712`).
- **Demographic Preservation:** The **Country Name** and **Country ISO** are retained for regional performance analysis.

### 2.3 Next.js 16.3.3 App Router Framework Alignment

- Built on Next.js 16.3.3 with React 19, Turbopack, and asynchronous request headers/cookies handling (`await headers()`, `await cookies()`).
- Data fetching optimized with React Server Components and `unstable_cache` with a 5-minute TTL.

---

## 3. Master 25 Metrics Catalog & Data Lineage Matrix

| Metric # | Metric Title / Description                                  | Target Dashboard    | Business Domain      | Primary DB Tables                | Aggregation Formula & Logic                                                                                                             | UI Component                                  |
| :------: | :---------------------------------------------------------- | :------------------ | :------------------- | :------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------- |
|  **#1**  | Total Users Comparison (MoM)                                | **DB2: User Base**  | Customer Base        | `User`                           | $\text{COUNT}(u.id) \text{ where } u.\text{createdAt} \le M_{\text{end}} \text{ vs } M_{-1\text{end}}$                                  | Comparison KPI Card                           |
|  **#2**  | Total Users Growth Rate (% MoM)                             | **DB2: User Base**  | Customer Base        | `User`                           | $\frac{\text{Total Users}_M - \text{Total Users}_{M-1}}{\text{Total Users}_{M-1}} \times 100$                                           | Trend Badge & Sparkline                       |
|  **#3**  | FREE Users Count Comparison (MoM)                           | **DB2: User Base**  | Customer Base        | `User`                           | $\text{COUNT}(u.id) \text{ WHERE } u.\text{tier} = \text{'FREE'}$ (Current vs. Prior Month)                                             | Comparison KPI Card                           |
|  **#4**  | FREE Users Growth Rate (% MoM)                              | **DB2: User Base**  | Customer Base        | `User`                           | $\frac{\text{Free Users}_M - \text{Free Users}_{M-1}}{\text{Free Users}_{M-1}} \times 100$                                              | Trend Badge & Area Chart                      |
|  **#5**  | PRO Users Count Comparison (MoM)                            | **DB2: User Base**  | Customer Base        | `User`, `Subscription`           | $\text{COUNT}(u.id) \text{ WHERE } u.\text{tier} = \text{'PRO'}$ (Current vs. Prior Month)                                              | Comparison KPI Card                           |
|  **#6**  | PRO Users Growth Rate (% MoM)                               | **DB2: User Base**  | Customer Base        | `User`, `Subscription`           | $\frac{\text{Pro Users}_M - \text{Pro Users}_{M-1}}{\text{Pro Users}_{M-1}} \times 100$                                                 | Trend Badge & Line Chart                      |
|  **#7**  | **Overall Conversion Rate (FREE $\to$ PRO % + 6M History)** | **DB2: User Base**  | Conversion Funnel    | `User`, `Subscription`           | $\frac{\text{Total PRO Users}}{\text{Total User Base}} \times 100$ evaluated monthly for trailing 6 months ($M_0 \dots M_{-5}$)         | Radial Gauge + 6M Historical Trend Line Chart |
|  **#8**  | Monthly Sales in USD (3-Month Trailing)                     | **DB1: Revenue**    | Sales Performance    | `Invoice`, `Payment`             | $\sum(\text{amountTotal})$ in $M_0, M_{-1}, M_{-2}$ comparative trailing breakdown                                                      | Multi-Bar Comparison Chart + KPI              |
|  **#9**  | Quarterly Sales in USD (3-Quarter Trailing)                 | **DB1: Revenue**    | Sales Performance    | `Invoice`, `Payment`             | $\sum(\text{amountTotal})$ in $Q_0, Q_{-1}, Q_{-2}$ comparative trailing breakdown                                                      | Quarterly Bar Chart                           |
| **#10**  | Sales Growth %YoY on Monthly Basis                          | **DB1: Revenue**    | Growth Velocity      | `Invoice`, `Payment`             | $\frac{\text{Sales Month}_M - \text{Sales Month}_{M-12}}{\text{Sales Month}_{M-12}} \times 100$                                         | YoY Trend Line Chart                          |
| **#11**  | Sales Growth %YoY on Quarterly Basis                        | **DB1: Revenue**    | Growth Velocity      | `Invoice`, `Payment`             | $\frac{\text{Sales Qtr}_Q - \text{Sales Qtr}_{Q-4}}{\text{Sales Qtr}_{Q-4}} \times 100$                                                 | YoY Comparison Bar Chart                      |
| **#12**  | **True Churn Rate (% PRO $\to$ FREE + 6M History)**         | **DB2: User Base**  | Retention & Churn    | `Subscription`, `User`           | $\frac{\text{Cancelled Paid Subscriptions in Month}}{\text{Active Paid Subscriptions at Month Start}} \times 100$ for trailing 6 months | Churn Gauge + 6M Historical Area Chart        |
| **#13**  | Country Ranking by Total Users                              | **DB3: Regional**   | Regional Analysis    | `UserSession`, `User`            | $\text{COUNT}(\text{DISTINCT } u.id)$ for 17 jurisdictions + "Other Countries"                                                          | Ranked Table with Flags                       |
| **#14**  | Country Ranking by FREE Users                               | **DB3: Regional**   | Regional Analysis    | `UserSession`, `User`            | $\text{COUNT}(\text{DISTINCT } u.id) \text{ WHERE tier='FREE'}$ for 17 jurisdictions + "Other Countries"                                | Ranked Table                                  |
| **#15**  | Country Ranking by PRO Users                                | **DB3: Regional**   | Regional Analysis    | `UserSession`, `User`            | $\text{COUNT}(\text{DISTINCT } u.id) \text{ WHERE tier='PRO'}$ for 17 jurisdictions + "Other Countries"                                 | Ranked Table                                  |
| **#16**  | Country Ranking by Sales Revenue in USD                     | **DB3: Regional**   | Regional Performance | `Invoice`, `Payment`             | $\sum(\text{amountTotal})$ for 17 jurisdictions + "Other Countries"                                                                     | Ranked Sales Table & Bar                      |
| **#17**  | **VAT / Sales Tax Threshold Warnings & FX**                 | **DB3: Regional**   | Tax Compliance       | `v_country_trailing_12m_sales`   | Approx: Trailing 12M USD converted to Local FX vs Statutory Threshold for 17 Jurisdictions                                              | Threshold Progress Bar & Level 0-4 Alert      |
| **#18**  | All Users Contribution by Country (%)                       | **DB3: Regional**   | Market Share         | `UserSession`, `User`            | $\frac{\text{Jurisdiction Total Users}}{\text{Global Total Users}} \times 100$ (17 Jurisdictions + "Other Countries")                   | Interactive Donut Chart                       |
| **#19**  | PRO Users Contribution by Country (%)                       | **DB3: Regional**   | Market Share (Paid)  | `UserSession`, `User`            | $\frac{\text{Jurisdiction PRO Users}}{\text{Global PRO Users}} \times 100$ (17 Jurisdictions + "Other Countries")                       | Interactive Donut Chart                       |
| **#20**  | Total Affiliates Count Comparison (MoM)                     | **DB4: Affiliates** | Partner Base         | `AffiliateProfile`, `User`       | $\text{COUNT}(id) \text{ (Affiliate+Free \& Affiliate+Pro) Current vs. Prior Month}$                                                    | Comparison KPI Card                           |
| **#21**  | Affiliate MoM Growth Rate (%)                               | **DB4: Affiliates** | Partner Growth       | `AffiliateProfile`               | $\frac{\text{Affiliates}_M - \text{Affiliates}_{M-1}}{\text{Affiliates}_{M-1}} \times 100$                                              | Trend Badge & Line Chart                      |
| **#22**  | Affiliate Country Contribution (%)                          | **DB4: Affiliates** | Partner Geography    | `AffiliateProfile`               | $\frac{\text{Affiliates per Jurisdiction}}{\text{Global Total Affiliates}} \times 100$ (17 Jurisdictions + "Other Countries")           | Donut Chart                                   |
| **#23**  | Affiliate Tier Ratio (Free vs PRO)                          | **DB4: Affiliates** | Partner Composition  | `AffiliateProfile`, `User`       | $\text{Affiliate+Free Count} : \text{Affiliate+Pro Count (Ratio \& Percentage)}$                                                        | Proportion Bar / Pie Chart                    |
| **#24**  | Average Monthly Commission per Affiliate                    | **DB4: Affiliates** | Partner Economics    | `Commission`, `AffiliateProfile` | $\frac{\text{Total Commission Paid in Month}}{\text{Active Earning Affiliates in Month}}$                                               | Metric Card & Trend Line                      |
| **#25**  | **Top 20 Affiliates Leaderboard (Privacy-Preserved)**       | **DB4: Affiliates** | Partner Leaderboard  | `Commission`, `AffiliateProfile` | $\sum(\text{commissionAmount}), \text{Codes Used, Net Sales by Masked Partner ID (No Names/Emails)}$                                    | Privacy-Compliant Leaderboard Table           |

---

## 4. Deep-Dive Specifications for the 5 Dashboards

### 4.1 Dashboard 1: Sales Growth Performance & Source of Sales Analysis

**Route:** `app/admin/dashboards/revenue/page.tsx`  
**API:** `GET /api/admin/analytics/revenue`  
**Metrics Covered:** Metric #8, Metric #9, Metric #10, Metric #11

#### Visual & Layout Architecture

- **Header Section:** Timeframe selector (Trailing 6M, Trailing 12M, YTD, All-Time) + CSV Export button.
- **Top KPI Cards (Row 1):**
  1. _Current Month Sales (USD)_ — Value ($48,920), Subtext (vs. Prev Month $42,150), Delta Badge (`+16.1% MoM`).
  2. _Monthly Sales YoY Growth_ — Value (`+43.5%`), Subtext (vs. Same Month Prior Year $34,090), Badge (Metric #10).
  3. _Current Quarter Sales (USD)_ — Value ($134,850), Subtext (vs. Prev Quarter $118,200), Delta Badge (`+14.1% QoQ`).
  4. _Quarterly Sales YoY Growth_ — Value (`+38.2%`), Subtext (vs. Same Quarter Prior Year $97,570), Badge (Metric #11).
- **Chart Section (Row 2):**
  - _Left (60% width):_ Multi-Bar & Area Chart comparing Monthly Trailing Revenue ($M_0, M_{-1}, M_{-2}, M_{-3}, M_{-4}, M_{-5}$) alongside Prior Year monthly benchmarks.
  - _Right (40% width):_ Quarterly Revenue Progression Bar Chart ($Q_0, Q_{-1}, Q_{-2}, Q_{-3}$) with YoY growth labels.
- **Data Tables (Row 3):**
  - Trailing 6-Month Detailed Breakdown Table (Month, Revenue USD, Prior Month, MoM $, MoM %, Prior Year $, YoY %).
  - Trailing 4-Quarter Detailed Breakdown Table (Quarter, Revenue USD, Prior Quarter, QoQ $, QoQ %, Prior Year $, YoY %).

#### SQL Aggregation Queries for DB1

```sql
-- Trailing 6 Months Monthly Sales & YoY Comparison (Metrics #8 & #10)
WITH monthly_sales AS (
  SELECT
    DATE_TRUNC('month', "paidAt") AS month_date,
    SUM("amountTotal") AS gross_sales,
    COUNT(id) AS transaction_count
  FROM "Invoice"
  WHERE "paidAt" >= DATE_TRUNC('month', NOW()) - INTERVAL '17 months'
  GROUP BY DATE_TRUNC('month', "paidAt")
)
SELECT
  curr.month_date,
  TO_CHAR(curr.month_date, 'Mon YYYY') AS month_label,
  curr.gross_sales AS current_revenue,
  prev_month.gross_sales AS prev_month_revenue,
  ROUND(((curr.gross_sales - prev_month.gross_sales) / NULLIF(prev_month.gross_sales, 0) * 100), 2) AS mom_growth_pct,
  prev_year.gross_sales AS prev_year_revenue,
  ROUND(((curr.gross_sales - prev_year.gross_sales) / NULLIF(prev_year.gross_sales, 0) * 100), 2) AS yoy_growth_pct
FROM monthly_sales curr
LEFT JOIN monthly_sales prev_month ON prev_month.month_date = curr.month_date - INTERVAL '1 month'
LEFT JOIN monthly_sales prev_year ON prev_year.month_date = curr.month_date - INTERVAL '12 months'
WHERE curr.month_date >= DATE_TRUNC('month', NOW()) - INTERVAL '5 months'
ORDER BY curr.month_date DESC;
```

---

### 4.2 Dashboard 2: Customer Base, Conversion Funnel & 6-Month Historical Trajectory

**Route:** `app/admin/dashboards/users/page.tsx`  
**API:** `GET /api/admin/analytics/users`  
**Metrics Covered:** Metric #1, Metric #2, Metric #3, Metric #4, Metric #5, Metric #6, Metric #7 (+ 6M History), Metric #12 (+ 6M History)

#### Visual & Layout Architecture

- **Top KPI Cards (Row 1):**
  1. _Total User Base_ — Value (14,820), Subtext (+1,240 vs. Prev Month 13,580), Badge (`+9.13% MoM`).
  2. _FREE Tier Users_ — Value (13,130), Subtext (+1,010 vs. Prev Month 12,120), Badge (`+8.33% MoM`).
  3. _PRO Tier Users_ — Value (1,690), Subtext (+230 vs. Prev Month 1,460), Badge (`+15.75% MoM`).
  4. _Conversion & True Churn_ — Value (`11.40% Conv`), Subtext (True Churn: `2.15%`), Badge (`+0.65% MoM`).
- **6-Month Historical Trajectory Visual Chart (Row 2):**
  - Dual-Axis Recharts Line & Area Chart displaying:
    - _Left Y-Axis (Green Area/Line):_ Overall Conversion Rate % ($8.64\% \to 9.15\% \to 9.69\% \to 10.23\% \to 10.75\% \to 11.40\%$).
    - _Right Y-Axis (Amber/Red Line):_ Monthly True Churn Rate % ($2.86\% \to 2.68\% \to 2.53\% \to 2.36\% \to 2.20\% \to 2.15\%$).
- **Tables Section (Row 3):**
  - _Table 1:_ Current Month User Tier Breakdown (Customer Tier, Aug 2026, Jul 2026, Net Change, Growth %, Share %).
  - _Table 2:_ **6-Month Historical Trajectory Table**:
    | Month | Total Users | FREE Users | PRO Users | Trial Starts | New Conversions | Conversion Rate % | PRO at Month Start | PRO Cancellations | True Churn Rate % |
    | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
    | **Aug 2026** | 14,820 | 13,130 | 1,690 | 530 | 262 | **11.40%** | 1,460 | 32 | **2.15%** |
    | **Jul 2026** | 13,580 | 12,120 | 1,460 | 480 | 218 | **10.75%** | 1,270 | 28 | **2.20%** |
    | **Jun 2026** | 12,420 | 11,150 | 1,270 | 440 | 192 | **10.23%** | 1,100 | 26 | **2.36%** |
    | **May 2026** | 11,350 | 10,250 | 1,100 | 410 | 175 | **9.69%** | 950 | 24 | **2.53%** |
    | **Apr 2026** | 10,380 | 9,430 | 950 | 370 | 154 | **9.15%** | 820 | 22 | **2.68%** |
    | **Mar 2026** | 9,490 | 8,670 | 820 | 340 | 138 | **8.64%** | 700 | 20 | **2.86%** |

#### True Churn & Conversion SQL Calculation

```sql
-- 6-Month Historical Trailing Conversion Rate & True Churn Rate Cohort
WITH monthly_series AS (
  SELECT generate_series(
    DATE_TRUNC('month', NOW()) - INTERVAL '5 months',
    DATE_TRUNC('month', NOW()),
    INTERVAL '1 month'
  ) AS month_start
)
SELECT
  ms.month_start,
  TO_CHAR(ms.month_start, 'Mon YYYY') AS month_label,
  -- 1. Total Registered Users at Month End
  (SELECT COUNT(u.id) FROM "User" u WHERE u."createdAt" < (ms.month_start + INTERVAL '1 month')) AS total_users_at_end,
  -- 2. Free Users at Month End
  (SELECT COUNT(u.id) FROM "User" u WHERE u."createdAt" < (ms.month_start + INTERVAL '1 month') AND u.tier = 'FREE') AS free_users,
  -- 3. Paid PRO Users at Month End
  (SELECT COUNT(u.id) FROM "User" u WHERE u."createdAt" < (ms.month_start + INTERVAL '1 month') AND u.tier = 'PRO') AS pro_users,
  -- 4. 7-Day Trial Conversions in Month
  (SELECT COUNT(u.id) FROM "User" u WHERE u."trialConvertedAt" >= ms.month_start AND u."trialConvertedAt" < (ms.month_start + INTERVAL '1 month')) AS new_conversions,
  -- 5. Conversion Rate (%)
  ROUND(
    ((SELECT COUNT(u.id)::DECIMAL FROM "User" u WHERE u."createdAt" < (ms.month_start + INTERVAL '1 month') AND u.tier = 'PRO') /
    NULLIF((SELECT COUNT(u.id)::DECIMAL FROM "User" u WHERE u."createdAt" < (ms.month_start + INTERVAL '1 month')), 0)) * 100, 2
  ) AS conversion_rate_pct,
  -- 6. Active Paying Subscribers at Start of Month
  (SELECT COUNT(s.id) FROM "Subscription" s WHERE s."createdAt" < ms.month_start AND (s."status" = 'ACTIVE' OR s."updatedAt" >= ms.month_start)) AS active_start_subs,
  -- 7. True Paid Cancellations in Month (Excluding expired un-converted trials)
  (SELECT COUNT(s.id) FROM "Subscription" s WHERE s."status" = 'CANCELED' AND s."updatedAt" >= ms.month_start AND s."updatedAt" < (ms.month_start + INTERVAL '1 month')) AS churned_subs,
  -- 8. True Churn Rate (%)
  ROUND(
    ((SELECT COUNT(s.id)::DECIMAL FROM "Subscription" s WHERE s."status" = 'CANCELED' AND s."updatedAt" >= ms.month_start AND s."updatedAt" < (ms.month_start + INTERVAL '1 month')) /
    NULLIF((SELECT COUNT(s.id)::DECIMAL FROM "Subscription" s WHERE s."createdAt" < ms.month_start AND (s."status" = 'ACTIVE' OR s."updatedAt" >= ms.month_start)), 0)) * 100, 2
  ) AS true_churn_rate_pct
FROM monthly_series ms
ORDER BY ms.month_start ASC;
```

---

### 4.3 Dashboard 3: Regional Markets & Multi-Jurisdiction Tax Surveillance

**Route:** `app/admin/dashboards/regional/page.tsx`  
**API:** `GET /api/admin/analytics/regional`  
**Metrics Covered:** Metric #13, Metric #14, Metric #15, Metric #16, Metric #17, Metric #18, Metric #19

#### Visual & Layout Architecture

- **Top KPI Cards (Row 1):**
  1. _Top Revenue Jurisdiction_ — Value (United Kingdom - GB), Subtext ($142,500 12M Sales / 29.1%), Badge (Rank 1).
  2. _Top User Base Market_ — Value (Thailand - TH), Subtext (3,480 Users / 23.5% Share), Badge (Rank 1).
  3. _Top Paid PRO Market_ — Value (United States - US), Subtext (460 PRO Users / 27.2% Share), Badge (Rank 1).
  4. _Active Tax Warning_ — Value (Level 1 Alert - UK), Subtext (UK Sales £54.2k reached 60.2% of £90k limit), Badge (`WARNING`).
- **Interactive Donut Charts (Row 2):**
  - _Left Donut Chart (Metric #18):_ All Users Geographic Distribution & Market Share (17 Primary Jurisdictions + "Other Countries").
  - _Right Donut Chart (Metric #19):_ PRO Paid Subscribers Geographic Distribution & Penetration.
- **Data Tables (Row 3 & 4):**
  - _Table 1:_ **Master Country Rankings Table** (17 Primary Jurisdictions + "Other Countries" consolidated):
    | Rank | Country / Territory | ISO | Total Users (#13) | All Users Share (#18) | FREE Users (#14) | PRO Users (#15) | PRO Users Share (#19) | Trailing 12M Sales USD (#16) | Sales Share (%) |
    | :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
    | **1** | United Kingdom | `GB` | 2,890 | 19.50% | 2,480 | 410 | 24.26% | $142,500 | 29.13% |
    | **2** | United States | `US` | 2,650 | 17.88% | 2,190 | 460 | 27.22% | $138,200 | 28.25% |
    | **3** | Thailand | `TH` | 3,480 | 23.48% | 3,190 | 290 | 17.16% | $68,400 | 13.98% |
    | **4** | European Union (27 Aggregated) | `EU` | 1,820 | 12.28% | 1,580 | 240 | 14.20% | $62,100 | 12.70% |
    | **5** | Singapore | `SG` | 980 | 6.61% | 840 | 140 | 8.28% | $38,500 | 7.87% |
    | **6** | Indonesia | `ID` | 1,120 | 7.56% | 1,050 | 70 | 4.14% | $16,800 | 3.43% |
    | **7** | Japan | `JP` | 460 | 3.10% | 420 | 40 | 2.37% | $10,500 | 2.15% |
    | **8** | India | `IN` | 780 | 5.26% | 750 | 30 | 1.78% | $7,200 | 1.47% |
    | **9** | United Arab Emirates | `AE` | 240 | 1.62% | 230 | 10 | 0.59% | $4,900 | 1.00% |
    | **...** | _(Remaining 17 Jurisdictions)_ | ... | ... | ... | ... | ... | ... | ... | ... |
    | **10** | **Other Countries (Consolidated)** | `OTHERS` | **400** | **2.70%** | **400** | **0** | **0.00%** | **$0** | **0.00%** |
  - _Table 2:_ **Metric #17 VAT & Sales Tax Threshold Surveillance & Warning Table**:
    | Jurisdiction | ISO | Trailing 12M Sales (USD) | Est. Local FX Rate | Approx. Local Sales | Statutory Threshold | Utilization (%) | Alert Severity Level | Recommended System & Legal Action |
    | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
    | **European Union** | `EU` | $62,100 | 0.92 EUR/USD | €57,132 | €0 (Zero Threshold) | **100.0%** | `ACTIVE / COLLECTING` | Stripe Tax & Non-Union OSS active from Day 1 |
    | **United Kingdom** | `GB` | $142,500 | 0.78 GBP/USD | £111,150* | £90,000 | **60.2%** | `LEVEL 1: WARNING` | *Domestic UK sales £54.2k; Dispatch email alert, prepare HMRC docs |
    | **Thailand** | `TH` | $68,400 | 36.50 THB/USD | THB 2,496,600 | THB 1,800,000 | **48.5%** | `LEVEL 0: SAFE` | Monitor trailing sales; alert at THB 1.08M (60%) |
    | **Singapore** | `SG` | $38,500 | 1.34 SGD/USD | SGD 51,590 | SGD 100,000 | **51.6%** | `LEVEL 0: SAFE` | Monitor global (>SGD 1M) and SG local sales (>SGD 100k) |
    | **United States** | `US` | $138,200 | 1.00 USD/USD | $138,200 (Multi-State) | $100k / State | **32.0%** | `LEVEL 0: SAFE` | Max state is CA ($32k / 48 txns); below $100k/200 limit |
    | **Indonesia** | `ID` | $16,800 | 15,800 IDR/USD | IDR 265,440,000 | IDR 600,000,000 | **44.2%** | `LEVEL 0: SAFE` | Below IDR 600M and 12k traffic; await DGT notice |

---

### 4.4 Dashboard 4: Affiliate Partner Network & Privacy-Preserving Leaderboard

**Route:** `app/admin/dashboards/affiliates/page.tsx`  
**API:** `GET /api/admin/analytics/affiliates`  
**Metrics Covered:** Metric #20, Metric #21, Metric #22, Metric #23, Metric #24, Metric #25

#### Visual & Layout Architecture

- **Top KPI Cards (Row 1):**
  1. _Total Active Affiliates_ — Value (485 Partners), Subtext (+48 vs. Prev Month 437), Badge (`+10.98% MoM`).
  2. _Partner Tier Ratio_ — Value (`3.1 : 1`), Subtext (367 Free : 118 PRO Partners), Badge (`75.7% Free : 24.3% PRO`).
  3. _Avg Monthly Commission_ — Value (`$184.50`), Subtext (per active earning affiliate), Badge (`+8.4% MoM`).
  4. _Top Affiliate Country_ — Value (Thailand - TH), Subtext (182 Affiliates / 37.5% Share), Badge (Donut Rank 1).
- **Charts & Composition (Row 2):**
  - _Left:_ Donut Chart representing Affiliate Partner Geographic Distribution (17 Primary Jurisdictions + "Other Countries").
  - _Right:_ Stacked Horizontal Proportion Bar displaying Affiliate+Free vs. Affiliate+PRO ratio (Metric #23).
- **Data Tables (Row 3 & 4):**
  - _Table 1:_ Affiliate Geographic & Tier Breakdown Table (Country, ISO, Total Affiliates #20, Share % #22, Affiliate+Free, Affiliate+PRO, Tier Ratio #23, Total Commission Paid USD).
  - _Table 2:_ **Metric #25: Privacy-Preserving Top 20 Affiliates Leaderboard Table (Names & Contact Info Redacted)**:
    | Rank | Masked Partner ID | Country | Country ISO | SaaS Tier | Active Code | Codes Used | Subscribers Referred | Gross Sales (USD) | Commission Earned (USD) | Status |
    | :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
    | **1** | `Partner #TH-8821` | Thailand | `TH` | `PRO` | `SOMCHAI30` | 68 | 64 | $5,240 | **$1,572.00** | `APPROVED` |
    | **2** | `Partner #GB-4019` | United Kingdom | `GB` | `PRO` | `ALEXFX20` | 54 | 51 | $4,180 | **$1,254.00** | `APPROVED` |
    | **3** | `Partner #US-7712` | United States | `US` | `PRO` | `DANVIP` | 48 | 45 | $3,690 | **$1,107.00** | `APPROVED` |
    | **4** | `Partner #TH-5290` | Thailand | `TH` | `PRO` | `NATTA30` | 42 | 39 | $3,190 | **$957.00** | `APPROVED` |
    | **5** | `Partner #US-3184` | United States | `US` | `PRO` | `MIKEFX` | 38 | 36 | $2,950 | **$885.00** | `PAID` |
    | **6** | `Partner #ID-9041` | Indonesia | `ID` | `FREE` | `BUDIFX` | 32 | 28 | $2,290 | **$687.00** | `APPROVED` |
    | **7** | `Partner #GB-6623` | United Kingdom | `GB` | `PRO` | `SARAHPRO` | 29 | 27 | $2,210 | **$663.00** | `APPROVED` |
    | **8** | `Partner #TH-1192` | Thailand | `TH` | `FREE` | `KRIT50` | 28 | 26 | $2,130 | **$639.00** | `APPROVED` |
    | **9** | `Partner #SG-8401` | Singapore | `SG` | `PRO` | `WEIMING` | 26 | 24 | $1,960 | **$588.00** | `PAID` |
    | **10** | `Partner #US-2294` | United States | `US` | `FREE` | `MILLER20` | 24 | 22 | $1,800 | **$540.00** | `APPROVED` |
    | **...** | _(Full Top 20 rendered with masked IDs and country flags)_ | | | | | | | | | |

---

### 4.5 Dashboard 5: Executive Business Command Center

**Route:** `app/admin/dashboards/executive/page.tsx` & Root `app/admin/page.tsx`  
**API:** `GET /api/admin/analytics/executive`  
**Core Role:** High-level unified executive glass pane synthesizing all 4 pillars on one screen.

#### Visual Layout & Executive KPIs

- **C-Suite Master Glass Pane KPI Cards (Row 1):**
  1. _1. Monthly Run-Rate Revenue_ — **$48,920** (`+16.1% MoM` | `+43.5% YoY` | ARR Run-Rate: $587k).
  2. _2. Total Active Customer Base_ — **14,820 Users** (`+9.1% MoM` | 1,690 PRO Paid / 13,130 Free | Conv: 11.40%).
  3. _3. Global Geographic Footprint_ — **10 Active Markets** (Top Rev: GB $142.5k | Top User: TH 3.48k | VAT Alert: UK 60%).
  4. _4. Partner Affiliate Network_ — **485 Partners** (`+11.0% MoM` | $19.1k Sales Influenced | Avg Payout: $184.50).
- **Cross-Functional Executive Performance Summary Table (Row 2):**
  - Displays Pillar, Primary KPI, Current Value, Prior Month, MoM Trend, YoY Benchmark, and RAG Status (🟢 Green / 🟡 Amber / 🔴 Red).

---

## 5. Complete Backend TypeScript API Schemas (Next.js 16.3.3)

### 5.1 `app/api/admin/analytics/revenue/route.ts`

```typescript
export interface RevenueAnalyticsResponse {
  summary: {
    currentMonthSales: number;
    prevMonthSales: number;
    momGrowthPct: number;
    monthlyYoYGrowthPct: number;
    currentQuarterSales: number;
    prevQuarterSales: number;
    qoqGrowthPct: number;
    quarterlyYoYGrowthPct: number;
    mrr: number;
    arr: number;
    arppu: number;
  };
  monthlyTrailing: Array<{
    month: string; // "2026-08"
    monthLabel: string; // "Aug 2026"
    revenueUsd: number;
    prevMonthUsd: number;
    momGrowthUsd: number;
    momGrowthPct: number;
    prevYearUsd: number;
    yoyGrowthPct: number;
    transactionCount: number;
  }>;
  quarterlyTrailing: Array<{
    quarter: string; // "2026-Q3"
    quarterLabel: string; // "Q3 2026"
    revenueUsd: number;
    prevQuarterUsd: number;
    qoqGrowthUsd: number;
    qoqGrowthPct: number;
    prevYearUsd: number;
    yoyGrowthPct: number;
  }>;
}
```

### 5.2 `app/api/admin/analytics/users/route.ts`

```typescript
export interface UsersAnalyticsResponse {
  summary: {
    totalUsers: number;
    freeUsers: number;
    proUsers: number;
    freePercentage: number;
    proPercentage: number;
    conversionRate: number; // e.g. 11.40
    trueChurnRate: number; // e.g. 2.15
    momGrowth: {
      totalUsersPct: number;
      freeUsersPct: number;
      proUsersPct: number;
    };
  };
  historicalTrajectory: Array<{
    month: string; // "2026-08"
    monthLabel: string; // "Aug 2026"
    totalUsersAtEnd: number;
    freeUsers: number;
    proUsers: number;
    trialStarts: number;
    newConversions: number;
    conversionRatePct: number; // Metric #7 History
    activeStartSubs: number;
    churnedSubs: number;
    trueChurnRatePct: number; // Metric #12 History
  }>;
  funnelCohorts: {
    registeredSignups: number;
    trialsActivated: number;
    paidConversions: number;
    retainedAfter60Days: number;
  };
}
```

### 5.3 `app/api/admin/analytics/regional/route.ts` (With "Other Countries" Grouping)

```typescript
export interface RegionalAnalyticsResponse {
  countryRankings: Array<{
    rank: number;
    countryName: string; // Specific Country or "Other Countries"
    isoCode: string; // Primary ISO (e.g. "GB", "TH") or "OTHERS"
    totalUsers: number;
    allUsersSharePct: number;
    freeUsers: number;
    proUsers: number;
    proUsersSharePct: number;
    trailing12mSalesUsd: number;
    salesSharePct: number;
  }>;
  taxSurveillance: Array<{
    countryName: string;
    isoCode: string;
    trailing12mSalesUsd: number;
    fxRate: number;
    approxLocalSales: string;
    statutoryThreshold: string;
    utilizationPct: number;
    alertLevel:
      | 'LEVEL_0_SAFE'
      | 'LEVEL_1_WARN'
      | 'LEVEL_2_ACTION'
      | 'LEVEL_3_CRITICAL'
      | 'ACTIVE_COLLECTING';
    recommendedAction: string;
  }>;
  donutMarketShare: {
    allUsers: Array<{
      country: string;
      iso: string;
      count: number;
      percentage: number;
    }>;
    proUsers: Array<{
      country: string;
      iso: string;
      count: number;
      percentage: number;
    }>;
  };
}
```

### 5.4 `app/api/admin/analytics/affiliates/route.ts` (Privacy-Preserved Schema)

```typescript
export interface AffiliatesAnalyticsResponse {
  summary: {
    totalAffiliates: number;
    prevMonthAffiliates: number;
    momGrowthPct: number;
    affiliateFreeCount: number;
    affiliateProCount: number;
    tierRatio: string; // "3.1 : 1"
    freePercentage: number;
    proPercentage: number;
    avgMonthlyCommission: number;
    totalCommissionsPaidUsd: number;
  };
  geographicDistribution: Array<{
    countryName: string; // 17 Primary Countries or "Other Countries"
    isoCode: string; // ISO or "OTHERS"
    totalAffiliates: number;
    sharePct: number;
    affiliateFree: number;
    affiliatePro: number;
    tierRatio: string;
    totalCommissionsUsd: number;
  }>;
  // Metric #25 Privacy-Preserving Leaderboard (Names & Contact Info Redacted)
  top20Leaderboard: Array<{
    rank: number;
    anonymizedPartnerId: string; // e.g. "Partner #TH-8821" (Generated from Country ISO + Deterministic Hash)
    country: string; // "Thailand"
    countryIso: string; // "TH"
    saasTier: 'FREE' | 'PRO';
    activeCode: string; // Referral Code identifier
    codesUsed: number;
    subscribersReferred: number;
    grossSalesUsd: number;
    commissionEarnedUsd: number;
    payoutStatus: 'APPROVED' | 'PAID' | 'PENDING';
  }>;
}
```

### 5.5 `app/api/admin/analytics/executive/route.ts`

```typescript
export interface ExecutiveAnalyticsResponse {
  revenuePillar: {
    mrr: number;
    arr: number;
    currentMonthSales: number;
    momGrowthPct: number;
    yoyGrowthPct: number;
  };
  customerPillar: {
    totalUsers: number;
    proUsers: number;
    conversionRate: number;
    trueChurnRate: number;
    momGrowthPct: number;
  };
  regionalPillar: {
    topRevenueCountry: string;
    topUserCountry: string;
    activeTaxAlertsCount: number;
    taxAlertSummary: string;
  };
  affiliatePillar: {
    totalAffiliates: number;
    salesInfluencedUsd: number;
    avgCommission: number;
    momGrowthPct: number;
  };
  healthStatusMatrix: Array<{
    pillar: string;
    keyMetric: string;
    currentValue: string;
    priorValue: string;
    momTrend: string;
    yoyBenchmark: string;
    ragStatus: 'GREEN' | 'AMBER' | 'RED';
    notes: string;
  }>;
}
```

---

## 6. Complete File Change Manifest

### Backend API Services

- **[NEW]** `app/api/admin/analytics/revenue/route.ts` — Implements Metrics #8, #9, #10, #11.
- **[NEW]** `app/api/admin/analytics/users/route.ts` — Implements Metrics #1, #2, #3, #4, #5, #6, #7 (+6M history), #12 (+6M history).
- **[NEW]** `app/api/admin/analytics/regional/route.ts` — Implements Metrics #13, #14, #15, #16, #17, #18, #19 with "Other Countries" grouping.
- **[NEW]** `app/api/admin/analytics/affiliates/route.ts` — Implements Metrics #20, #21, #22, #23, #24, #25 (with PII Redaction and "Other Countries" grouping).
- **[NEW]** `app/api/admin/analytics/executive/route.ts` — Implements Unified Master Command Center summary.

### Frontend UI Components (`components/admin/analytics/`)

- **[NEW]** `components/admin/analytics/kpi-summary-card.tsx` — Standard metric card with formatted values, comparison subtext, and color-coded delta badges.
- **[NEW]** `components/admin/analytics/historical-trend-chart.tsx` — Dual-axis Recharts component for 6-month trailing Conversion & Churn curves.
- **[NEW]** `components/admin/analytics/donut-market-share.tsx` — Interactive Recharts donut chart with central total label, hover tooltips, and ranked legends.
- **[NEW]** `components/admin/analytics/ranked-country-table.tsx` — Multi-column ranked data table with country flag icons, percentage bars, and sortable headers.
- **[NEW]** `components/admin/analytics/tax-threshold-gauge.tsx` — Visual progress bar with dynamic severity color transitions (Green $\to$ Yellow $\to$ Orange $\to$ Red).
- **[NEW]** `components/admin/analytics/top-affiliates-leaderboard.tsx` — Privacy-preserving leaderboard displaying masked partner IDs, country flags, codes used, referred sales, and payout badges (no names/contact info).
- **[NEW]** `components/admin/analytics/timeframe-filter.tsx` — Date range filter (Trailing 6M, 12M, MTD, QTD, YTD).

### Frontend Pages & App Routing (`app/admin/dashboards/`)

- **[NEW]** `app/admin/dashboards/layout.tsx` — Sub-navigation tab header linking all 5 dashboards seamlessly.
- **[NEW]** `app/admin/dashboards/page.tsx` — Route handler redirecting to `/admin/dashboards/executive`.
- **[NEW]** `app/admin/dashboards/revenue/page.tsx` — Dashboard 1: Sales Growth & Source Analysis.
- **[NEW]** `app/admin/dashboards/users/page.tsx` — Dashboard 2: Customer Base, Funnel & 6M Historical Trajectory.
- **[NEW]** `app/admin/dashboards/regional/page.tsx` — Dashboard 3: Regional Analysis & Multi-Jurisdiction Tax Surveillance.
- **[NEW]** `app/admin/dashboards/affiliates/page.tsx` — Dashboard 4: Affiliate Partner Network & Privacy-Preserving Leaderboard.
- **[NEW]** `app/admin/dashboards/executive/page.tsx` — Dashboard 5: Executive Business Command Center.
- **[MODIFY]** [`app/admin/layout.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/app/admin/layout.tsx) — Add direct navigation links to the 5 Business Intelligence Dashboards in the sidebar menu.

### Unit & Integration Test Suites (`__tests__/`)

- **[NEW]** `__tests__/api/admin-analytics-revenue.test.ts` — Tests monthly trailing revenue, quarterly aggregation, and YoY calculations.
- **[NEW]** `__tests__/api/admin-analytics-users.test.ts` — Tests 6-month historical conversion cohorts, true churn exclusions, and tier counts.
- **[NEW]** `__tests__/api/admin-analytics-regional.test.ts` — Tests country ranking, "Other Countries" grouping, donut market shares, and VAT threshold utilization.
- **[NEW]** `__tests__/api/admin-analytics-affiliates.test.ts` — Tests partner tier ratios, average commission calculations, and PII masking on Top 20 leaderboard.
- **[NEW]** `__tests__/api/admin-analytics-executive.test.ts` — Tests unified C-suite payload aggregation.

---

## 7. Claude Code Execution Plan & Step-by-Step Milestones

### Phase 1: Backend Aggregation Services & API Route Handlers

1. Create `app/api/admin/analytics/revenue/route.ts` with date boundary normalizers and monthly/quarterly YoY calculation engine.
2. Create `app/api/admin/analytics/users/route.ts` with 6-month historical cohort queries for Conversion Rate (Metric #7) and True Churn Rate (Metric #12).
3. Create `app/api/admin/analytics/regional/route.ts` leveraging `v_country_trailing_12m_sales`, `UserSession`, "Other Countries" normalization, and reference FX rates for VAT threshold warnings (Metric #17).
4. Create `app/api/admin/analytics/affiliates/route.ts` aggregating affiliate profiles, tier ratios, codes used, and the privacy-preserving Top 20 leaderboard (Metric #25, redacting PII).
5. Create `app/api/admin/analytics/executive/route.ts` assembling top-level summaries across all 4 pillars.
6. Write unit tests for all 5 route handlers in `__tests__/api/admin-analytics-*.test.ts`.

### Phase 2: Shared UI Component Library

1. Build `components/admin/analytics/kpi-summary-card.tsx` (Supports responsive cards, value formatting, and delta badge styling).
2. Build `components/admin/analytics/historical-trend-chart.tsx` (Dual-axis Recharts component for 6M historical conversion & churn curves).
3. Build `components/admin/analytics/donut-market-share.tsx` (Interactive donut charts with center labels and legend).
4. Build `components/admin/analytics/ranked-country-table.tsx` (Sortable table with country flags, "Other Countries" row, and percentage bars).
5. Build `components/admin/analytics/tax-threshold-gauge.tsx` (Multi-stage color progress bar).
6. Build `components/admin/analytics/top-affiliates-leaderboard.tsx` (Privacy-preserving leaderboard with masked partner IDs, country flags, and payout status badges).

### Phase 3: Dashboard Pages & App Router Navigation

1. Create `app/admin/dashboards/layout.tsx` featuring sub-navigation tabs for all 5 dashboards.
2. Implement Dashboard 1: Revenue (`app/admin/dashboards/revenue/page.tsx`).
3. Implement Dashboard 2: User Base & 6M Trajectory (`app/admin/dashboards/users/page.tsx`).
4. Implement Dashboard 3: Regional & Tax Intelligence (`app/admin/dashboards/regional/page.tsx`).
5. Implement Dashboard 4: Affiliate Network & Privacy-Preserving Leaderboard (`app/admin/dashboards/affiliates/page.tsx`).
6. Implement Dashboard 5: Executive Command Center (`app/admin/dashboards/executive/page.tsx`).
7. Update `app/admin/layout.tsx` to include the dashboard navigation links.

### Phase 4: Verification, Visual UI Parity & Automated Tests

1. Execute full Jest test suite: `npm test`
2. Validate strict TypeScript compilation under Next.js 16.3.3: `npx tsc --noEmit`
3. Cross-validate UI layouts, charts, and interactive tab behaviors against the interactive prototypes:
   - [`davintrade-dashboard-stack/davintrade-dashboards-interactive-preview.html`](file:///d:/SaaS%20Project/trading-alerts-saas-public/davintrade-dashboard-stack/davintrade-dashboards-interactive-preview.html)
   - [`davintrade-dashboard-stack/davintrade-dashboards-light-theme.html`](file:///d:/SaaS%20Project/trading-alerts-saas-public/davintrade-dashboard-stack/davintrade-dashboards-light-theme.html)
4. Cross-validate output numbers and tables against the master reference Excel workbook:
   - [`davintrade-dashboard-stack/countries-vat-and-business-dashboard.xlsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/davintrade-dashboard-stack/countries-vat-and-business-dashboard.xlsx)

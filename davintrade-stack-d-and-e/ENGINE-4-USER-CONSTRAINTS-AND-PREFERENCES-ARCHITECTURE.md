# Engine 4: User Constraints & Preferences Architecture Design

**Document Version:** 1.8.0  
**Target Module:** Stack D (Conversational AI Analyst) — Engine 4 Subsystem  
**Scope:** Trader Persona Profiling, Trading Behavior, Risk Preferences, Interactive Confirmation Gate, Information Balloons (Tooltips `[ℹ️]`), Maximum Leverage Ceiling (1:5.0x), Single-Order Scope Demarcation (No Portfolio Aggregation), Strict Asset/Timeframe Scope Guardrail (XAUUSD M5/M15 Only), Entry Price Plausibility Gate (±5.0%), Fixed 54-Bar Lookback Standard, Multi-Jurisdiction Regulatory Compliance, and Immutable Audit Trail  
**Execution Target:** Claude Code (Phase 12 / Session 12-0 → 12-3 Implementation)

---

## 📌 1. Executive Summary & Purpose

The primary objective of **Engine 4** is to enable the AI Co-Pilot to **deeply understand the user's trading identity, behavior, risk capacity, and time horizon**. By capturing, confirming, and auditing these constraints before and during any analysis, the system ensures that every subsequent AI recommendation aligns seamlessly with the trader's persona while strictly complying with regulatory requirements across the EU, US, UK, and Japan.

### 1.1 The Core Problem: Context & Time Horizon Mismatch

1. **Time Horizon Mismatch:** If a Scalper queries the AI on an M5 chart, but the LLM bases its analysis on the M15 macro trend, it may suggest holding positions for multiple hours with wide stop-loss bounds that violate the Scalper's time limits. Conversely, if a Day Trader receives a micro-scalp setup, the holding period is too brief.
2. **Strategy Bias Mismatch:** When market conditions change, the AI must evaluate technical setups through the lens of the user's declared strategy preference (e.g., Trend Following vs. Trend Countering) rather than assuming a generic approach.

### 1.2 Explicit Trader Type Definitions & Platform Scope:

- **Scalper:** A trader who expects to **close their trade within 2 hours** of opening.
- **Day Trader:** A trader who expects to **close their trade within 12 hours** of opening.
- ⚠️ **Platform Scope Guidance for Unsupported Assets & Timeframes:**
  > [!IMPORTANT]
  > **DavinTrade App is currently engineered and optimized strictly and exclusively for `XAUUSD (Gold)` on `M5` and `M15` timeframes.**
  >
  > 1. **Asset Boundary:** Analysis on other financial assets (Forex pairs, Crypto, Stocks, Indices) is out-of-scope in this version. Inquiries regarding other symbols are politely intercepted and redirected to XAUUSD.
  > 2. **Timeframe Boundary:** If a user operates as a **Swing Trader** or **Position Holder** requiring trade durations exceeding 12 hours on higher timeframes (H1, H4, Daily), DavinTrade App is **not suitable for their trading style at this stage**. The AI will explicitly inform users of this boundary and redirect them to M15/M5.

### 1.3 Multi-Timeframe Analytical Roles:

- **Day Trader ($< 12$ hours):** Primary Macro Structure = **M15**; Entry Confirmation Trigger = **M5**.
- **Scalper ($< 2$ hours):** Primary Structure & Entry Confirmation = **M5**; Tightly bounded target levels.

### 1.4 Single-Order / Standalone Setup Scope Demarcation:

> [!WARNING]
> **CRITICAL LEGAL & RISK DEMARCATION (SINGLE-ORDER SCOPE):**  
> All 8 constraints, risk models, lot sizes, and leverage calculations defined in Engine 4 apply **strictly and exclusively to the single specific trade setup currently being analyzed (Single-Order / Standalone Basis)**.
>
> - **No Portfolio-Level Risk Aggregation:** DavinTrade App **does NOT track, aggregate, manage, or calculate cumulative portfolio risk, total multi-position margin utilization, hedging offsets, cross-asset correlation, or net portfolio drawdown** across multiple open trades or other active market symbols (whether Long or Short on XAUUSD or other instruments).
> - **User Portfolio Responsibility:** If the user has other open positions on XAUUSD or other symbols on their broker account, the cumulative risk and total margin exposure are **completely independent** of DavinTrade's calculations. The user maintains sole fiduciary responsibility for managing overall account margin on their broker terminal.

---

## ⚙️ 2. The 8 Core User Constraints & Preferences Metrics

Engine 4 formalizes user profiling into **8 discrete metrics**, structured into **Multiple-Choice Controls (Items 1–5)** with pre-highlighted defaults and **Numeric Inputs (Items 6–8)**:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               USER CONSTRAINTS & PREFERENCES METRICS MATRIX                            │
├────┬──────────────────────────────┬───────────────────────────────┬─────────────────┬─────────────────┤
│ #  │ Metric Name                  │ Input Type / Options Matrix   │ Default Value   │ Role in Profile │
├────┼──────────────────────────────┼───────────────────────────────┼─────────────────┼─────────────────┤
│ 1  │ **Type of Trader**           │ • Scalper (< 2 hours)         │ **Day Trader**  │ Defines base    │
│    │                              │ • Day Trader (< 12 hours)     │ *(Highlighted)* │ timeframe roles │
├────┼──────────────────────────────┼───────────────────────────────┼─────────────────┼─────────────────┤
│ 2  │ **Trading Style**            │ • Trend Following             │ **Trend Follow**│ Defines setup   │
│    │                              │ • Trend Countering            │ *(Highlighted)* │ bias preference │
│    │                              │ • Both Following & Countering │                 │                 │
├────┼──────────────────────────────┼───────────────────────────────┼─────────────────┼─────────────────┤
│ 3  │ **Max Risk per Trade (RP)**  │ 0.5% | 0.75% | 1.0% | 1.25%   │ **1.50%**       │ Max capital loss│
│    │ *(Commission Included)*      │ 1.5% | 1.75% | 2.0%           │ *(Highlighted)* │ boundary / trade│
├────┼──────────────────────────────┼───────────────────────────────┼─────────────────┼─────────────────┤
│ 4  │ **Maximum Leverage**         │ • 1:1.0x | 1:1.5x | 1:2.0x    │ **1:1.50x**     │ Consistent safe │
│    │ *(Ceiling: 1:5.0x max)*      │   1:2.5x | 1:3.0x             │ *(Highlighted)* │ compounding rule│
│    │                              │ • Other [ ______ ]            │                 │                 │
│    │                              │   *(Must not exceed 5.0x)*    │                 │                 │
├────┼──────────────────────────────┼───────────────────────────────┼─────────────────┼─────────────────┤
│ 5  │ **Target RRR**               │ 1.50x | 1.75x | 2.00x | 2.25x │ **1.75x**       │ Target reward to│
│    │ *(Commission Included)*      │ 2.50x | 2.75x | 3.00x | 3.25x │ *(Highlighted)* │ risk threshold  │
│    │                              │ 3.50x                         │                 │                 │
├────┼──────────────────────────────┼───────────────────────────────┼─────────────────┼─────────────────┤
│ 6  │ **Current Equity Balance**   │ Numeric Input (`$ USD`)       │ `[$5,000.00]`   │ User simulation │
│    │ *(Calculation Input)*        │                               │                 │ capital base    │
├────┼──────────────────────────────┼───────────────────────────────┼─────────────────┼─────────────────┤
│ 7  │ **Min Stop Loss Distance**   │ Numeric Input (`$ USD` price) │ `[$13.00]`      │ Volatility SL   │
│    │ *(SLD - Commission Incl.)*   │                               │                 │ floor buffer    │
├────┼──────────────────────────────┼───────────────────────────────┼─────────────────┼─────────────────┤
│ 8  │ **Round-Trip Commission**    │ Numeric Input (`$ USD / lot`) │ `[$4.00]`       │ Transaction fee │
│    │                              │                               │                 │ baseline        │
└────┴──────────────────────────────┴───────────────────────────────┴─────────────────┴─────────────────┘
```

### 2.1 Special Conditional Constraints & System Standards:

#### A. Conditional Constraint on Metric #5 (Target RRR):

- **Rule:** If the user selects **`Trend Countering`** or **`Both Trend Following and Countering`** in Metric #2, the **Target RRR (Metric #5) is strictly capped at a maximum of `2.50x`**.
- **UI Behavior:** The higher RRR options (`2.75x`, `3.00x`, `3.25x`, `3.50x`) are automatically **disabled and grayed out** to enforce safe risk boundaries for counter-trend trading.

#### B. Strict Leverage Ceiling & Capital Preservation Policy on Metric #4 (Maximum Leverage):

- **Rule:** While statutory laws in the EU, US, UK, and Japan permit retail commodity/gold leverage up to `1:20 (20.0x)`, **DavinTrade strictly enforces an institutional risk ceiling of `1:5.0x (5.0x)`**.
- **UI Guardrail:** If the user inputs a custom leverage value exceeding `5.0x` (e.g. `6.0x`, `10.0x`, `20.0x`), the modal blocks the input and presents the mandatory capital preservation notice:
  > 🛡️ **DavinTrade Risk Policy & Capital Preservation Notice:**  
  > _"DavinTrade strictly prioritizes capital preservation and institutional risk management. To protect traders from catastrophic drawdown and discourage reckless gambling or all-in behavior, DavinTrade enforces a maximum leverage ceiling of 1:5.0x, even though global regulatory frameworks (EU/US/UK/JP) permit up to 1:20x."_

#### C. Standardized Fixed Lookback Window (Fixed 54-Bar Standard):

- **Institutional Standard:** The historical lookback window for quantitative MCD frequency aggregation (`FREQ54_MCDxx`), storyline narrative generation (`JSONB54`), and weighted confluence scoring (`WACS54`) is **permanently fixed at 54 bars** across the platform.
- **Mathematical Rationale:**
  - **On M5:** $54 \text{ bars} \times 5 \text{ min} = 270 \text{ min}$ (**4.5 hours**), capturing the exact duration of an active intraday London/NY trading session for Scalpers.
  - **On M15:** $54 \text{ bars} \times 15 \text{ min} = 810 \text{ min}$ (**13.5 hours**), covering the complete active 24-hour trading cycle across London and New York overlaps for Day Traders.
- **Architecture Benefit:** Hardcoding the 54-bar lookback removes user confusion, simplifies database queries/indexing, and guarantees consistent mathematical feature vectors for the LLM. It is no longer an adjustable parameter in Engine 4.

---

### 2.2 Interactive Information Balloon (Tooltip `[ℹ️]`) Specifications for Profile Metrics:

To prevent user confusion, avoid misleading beginners, and eliminate legal ambiguity under **EU AI Act Art 50, UK FCA Consumer Duty, US CFTC 4.41, and Japan JFSA regulations**, every single metric in the interactive modal features a hoverable/clickable **Information Balloon `[ℹ️]`** with clear, plain-language statutory definitions:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                           INFORMATION BALLOON TOOLTIP SPECIFICATIONS (ENGINE 4 MODAL)                          │
├────┬──────────────────────────────┬────────────────────────────────────────────────────────────────────────────┤
│ #  │ Field Name on UI             │ Information Balloon Tooltip Content [ℹ️] (Plain-Language & Legal Notice)   │
├────┼──────────────────────────────┼────────────────────────────────────────────────────────────────────────────┤
│ 1  │ **Type of Trader [ℹ️]**       │ "Defines your intended holding time horizon. Scalpers target trades under  │
│    │                              │  2 hours using M5 charts; Day Traders target trades under 12 hours using   │
│    │                              │  M15 macro structure with M5 entry confirmation."                          │
├────┼──────────────────────────────┼────────────────────────────────────────────────────────────────────────────┤
│ 2  │ **Trading Style [ℹ️]**        │ "Your strategy bias. 'Trend Following' seeks trades in the direction of    │
│    │                              │  the dominant trend; 'Trend Countering' looks for mean-reversion pullbacks │
│    │                              │  from extreme channel boundaries; 'Both' evaluates all valid setups."      │
├────┼──────────────────────────────┼────────────────────────────────────────────────────────────────────────────┤
│ 3  │ **Max Risk per Trade (RP%)** │ "🛡️ YOUR UPPER RISK CEILING: The maximum percentage of your equity you are│
│    │ **[ℹ️]**                      │  willing to lose on any single trade. When creating specific trade setups, │
│    │                              │  your chosen Desired RPT% can never exceed this ceiling."                  │
├────┼──────────────────────────────┼────────────────────────────────────────────────────────────────────────────┤
│ 4  │ **Maximum Leverage [ℹ️]**     │ "The maximum total trade value relative to your equity (preset 1:1.0x to   │
│    │                              │  1:3.0x, or custom up to 1:5.0x max). DavinTrade enforces a 1:5.0x ceiling  │
│    │                              │  to prevent over-leveraging and ensure safe capital compounding."          │
├────┼──────────────────────────────┼────────────────────────────────────────────────────────────────────────────┤
│ 5  │ **Target RRR [ℹ️]**           │ "Your baseline Target Reward-to-Risk Ratio (e.g. 1.75x means targeting $1.75│
│    │                              │  profit for every $1.00 risked). Counter-trend styles cap this at 2.50x to  │
│    │                              │  safeguard against over-extending against the trend."                      │
├────┼──────────────────────────────┼────────────────────────────────────────────────────────────────────────────┤
│ 6  │ **Current Equity Balance**   │ "The reference account balance in USD used for mathematical simulation     │
│    │ **[ℹ️]**                      │  and calculating maximum lot size ceilings in your profile."               │
├────┼──────────────────────────────┼────────────────────────────────────────────────────────────────────────────┤
│ 7  │ **Min Stop Loss Distance**   │ "🛡️ YOUR MINIMUM SL BUFFER FLOOR: The minimum price distance (in $ USD)  │
│    │ **(Min SLD$) [ℹ️]**           │  allowed for Stop Loss to prevent stops from being set too tightly inside  │
│    │                              │  normal market noise and spread fluctuations."                             │
├────┼──────────────────────────────┼────────────────────────────────────────────────────────────────────────────┤
│ 8  │ **Round-Trip Commission**    │ "The total transaction fee in USD charged by your broker per 1 Standard Lot│
│    │ **[ℹ️]**                      │  (both opening and closing). Included in all net profit calculations."     │
└────┴──────────────────────────────┴────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 3. Pre-Chat Interactive Confirmation Loop & Mid-Session Re-configuration

Engine 4 executes an interactive confirmation workflow at session start and supports dynamic mid-session updates at any time:

```
[ User Opens /terminal Chat Panel / Starts New Session ]
                          │
                          ▼
┌───────────────────────────────────────────────────────────────────┐
│              STEP 1: RENDER PROFILE SUMMARY CARD                  │
│  🤖 DavinTrade AI Optimization Tool (Algorithmic / Automated)     │
│  Display how the AI currently understands the user for this       │
│  session across the 8 Core Metrics & Fixed Standards:             │
│  • Trader: Day Trader (<12h)  • Style: Trend Following            │
│  • Max Risk: 1.50%            • Max Leverage: 1:1.50x             │
│  • Target RRR: 1.75x          • Equity Balance: $5,000 USD        │
│  • Min SL Distance: $13.00    • Round-Trip Comm: $4.00/lot        │
│  • Lookback Window: Fixed 54-Bar Standard (Automated)             │
│                                                                   │
│  ⚖️ Disclaimer: Parameters are user-specified calculation inputs  │
│     for mathematical simulation. Not personalized financial advice.│
│                                                                   │
│  "Do you confirm these 8 constraints & preferences for this       │
│   session, or do you wish to make any modifications?"             │
│                                                                   │
│             [ ✓ Confirm ]        [ ⚙ Modify / Edit ]              │
└─────────────────────┬───────────────────────┬─────────────────────┘
                      │                       │
     User clicks      │                       │ User clicks
     [ ✓ Confirm ]    │                       │ [ ⚙ Modify / Edit ]
                      │                       ▼
                      │       ┌──────────────────────────────────────────────┐
                      │       │     STEP 2: DISPLAY INTERACTIVE MODAL        │
                      │       │  Render the 8 editable fields:               │
                      │       │  • Metrics 1–5: Multiple Choice Badges       │
                      │       │    (with conditional RRR capping)            │
                      │       │  • Metrics 6–8: Numeric Input Fields         │
                      │       │  • Lookback: Fixed 54 Bars (System Locked)   │
                      │       │                                              │
                      │       │        [ Submit & Save Preferences ]         │
                      │       └──────────────────────┬───────────────────────┘
                      │                              │
                      │                              │ User clicks [ Submit & Save ]
                      │                              ▼
                      │       ┌──────────────────────────────────────────────┐
                      │       │     STEP 3: RE-RENDER UPDATED SUMMARY CARD   │
                      │       │  Display refreshed metrics and ask again:    │
                      │       │  "Do you confirm this updated profile or     │
                      │       │   wish to modify further?"                   │
                      │       │                                              │
                      │       │       [ ✓ Confirm ]    [ ⚙ Modify / Edit ]  │
                      │       └──────────────────────┬───────────────────────┘
                      │                              │
                      │   (Loops until User clicks   │
                      │         [ Confirm ])         │
                      └──────────────────────────────┘
                                     │
                                     ▼
┌───────────────────────────────────────────────────────────────────┐
│ 🔒 PROFILE LOCKED FOR ACTIVE INQUIRIES                            │
│ • Save to PostgreSQL `user_trade_preferences`                     │
│ • Append snapshot to `user_trade_preferences_history` (Audit Log) │
│ • Update Redis Fast-Cache (< 2ms)                                 │
│ • System begins accepting technical analysis inquiries from User  │
└────────────────────────────────────┬──────────────────────────────┘
                                     │
                                     ▼
┌───────────────────────────────────────────────────────────────────┐
│ 💬 DURING THE ACTIVE CHAT SESSION (MID-SESSION MODIFICATION)      │
│  User can request changes anytime via:                            │
│  • Natural language command (e.g. "Please change preferences",    │
│    "Update my risk to 1%", "Change style to Trend Countering")    │
│  • Or clicking the [ ⚙ Preferences ] button in the chat header    │
│                                                                   │
│  ➔ Re-opens STEP 2: DISPLAY INTERACTIVE MODAL and repeats loop!   │
└───────────────────────────────────────────────────────────────────┘
```

### 3.1 Confirmation Loop Invariants:

1. **Mandatory First Interaction:** At the start of every chat session (regardless of whether preferences were previously saved), the Summary Card is presented first.
2. **Infinite Refinement Loop:** If the user edits their profile, the updated Summary Card is rendered again until the user explicitly clicks `[ ✓ Confirm ]`.
3. **Inquiry Unlocking:** The AI will not accept or process chart analysis prompts until the profile confirmation step is completed.

### 3.2 Mid-Session Dynamic Re-configuration:

- Even after a chat conversation has started, the user can dynamically update their constraints and preferences at any moment.
- **Trigger Methods:**
  1. **Natural Language Intent:** The user types commands like _"Change my constraints and preferences"_, _"Update my risk settings"_, or _"Switch to Scalper mode"_.
  2. **UI Action Button:** Clicking the inline gear icon `[ ⚙ Edit Preferences ]` on the chat banner.
- **Execution:** Re-triggers **Step 2 (Interactive Modal)**, saves the new preferences, logs a new immutable historical snapshot with timestamp, and re-confirms with the user.

---

## 🏛️ 4. Multi-Jurisdiction Regulatory Compliance Layer

To guarantee that Engine 4 operates lawfully across all 4 target legal jurisdictions (EU, US, UK, Japan), the subsystem implements the following non-negotiable compliance invariants:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        ENGINE 4 GLOBAL REGULATORY COMPLIANCE MATRIX                    │
├────────────────────┬────────────────────────────────────┬──────────────────────────────┤
│ Jurisdiction / Law │ Mandatory Statutory Requirement    │ Engine 4 Implementation      │
├────────────────────┼────────────────────────────────────┼──────────────────────────────┤
│ 🇪🇺 **EU AI Act**   │ Article 50(1) Direct Disclosure &  │ Permanent AI Badge on Card   │
│ (Reg 2024/1689)    │ Article 50(2) Machine-Readable Tag │ Embeds metadata provenance   │
├────────────────────┼────────────────────────────────────┼──────────────────────────────┤
│ 🇺🇸 **US CFTC / SEC**│ CEA 4o Publisher's Exemption &     │ 9 Metrics framed as user-led │
│ (Rule 4.41)        │ Rule 4.41 Simulated Performance    │ scenario simulation inputs   │
├────────────────────┼────────────────────────────────────┼──────────────────────────────┤
│ 🇬🇧 **UK FCA**      │ PERG 8.29 Execution-Only Tool &    │ Zero discretionary advice;   │
│ (PS19/18)          │ PS19/18 CFD Margin Risk Warning    │ Mandatory leveraged warning  │
├────────────────────┼────────────────────────────────────┼──────────────────────────────┤
│ 🇯🇵 **Japan JFSA**  │ FIEA Article 29 Software Exemption │ Deterministic math tool;     │
│ (FIEA Art 37)      │ Article 37 Risk of Principal Loss  │ Japanese statutory disclaimer│
└────────────────────┴────────────────────────────────────┴──────────────────────────────┘
```

### 4.1 Closing Legal Gap 1: Mathematical Calculation Tool vs. Suitability Assessment

- **Regulatory Demarcation:** Under US CEA Section 4o (_Lowe v. SEC_), UK FCA PERG 8.29, and Japan JFSA Article 29, collecting personal wealth data to evaluate suitability constitutes _regulated investment advisory_.
- **Compliance Invariant:** Engine 4 **NEVER** conducts a suitability assessment. The 9 metrics are strictly treated as **"User-Specified Mathematical Simulation Inputs"** for quantitative scenario calculations. The system acts as a deterministic risk calculator.

### 4.2 Closing Legal Gap 2: EU AI Act Transparency & Machine-Readable Metadata

- **Transparency Badge:** Summary Card and Modal persistently display the indicator: `🤖 DavinTrade AI Optimization Tool (Algorithmic / Automated)`.
- **Machine-Readable Provenance:** All JSON payloads and SSE streaming events derived from Engine 4 embed:
  ```json
  {
    "provenance": {
      "is_ai_assisted": true,
      "user_governed": true,
      "user_id_hash": "e89a7fbc2...",
      "timestamp_utc": "2026-08-27T13:27:00Z"
    }
  }
  ```

### 4.3 Closing Legal Gap 3: Statutory Hypothetical Performance & Single-Order Scope Disclaimers

- Every Summary Card, Preferences Modal, and calculation output embeds the mandatory statutory micro-disclaimer:
  > _"Hypothetical Simulation & Single-Order Scope Notice: Selected Target RRR and risk parameters represent user-defined mathematical models for standalone single-order scenario simulation. DavinTrade App does NOT provide portfolio-level risk aggregation across multiple positions or symbols. Simulated models do not guarantee actual trading performance or protection against capital loss (CFTC Rule 4.41 / FCA PS19/18 / JFSA Article 37)."_

### 4.4 Closing Legal Gap 4: GDPR / CCPA / APPI Right to Erasure & Legal Defense Retention

- **GDPR Article 17(3)(e) Alignment:** The Right to Erasure does not apply to data retained strictly for the establishment, exercise, or defence of legal claims.
- **Cryptographic Anonymization Workflow:** When an account is deleted (Flag F21 Account Deletion Worker):
  1. Direct PII (Name, Email, Billing) is hard-deleted from `users` and `profiles`.
  2. In `user_trade_preferences_history`, the `user_id` is cryptographically hashed:
     $$\text{Anonymized Audit ID} = \text{HMAC-SHA256}(\text{user\_id}, \text{SERVER\_LEGAL\_PEPPER})$$
  3. The user receives a **Deletion Receipt ID** (e.g., `DEL-2026-X89F2A`).
  4. The immutable audit record remains accessible to DavinTrade Compliance Admins for 5–7 years to defend against future regulatory claims.

### 4.5 Closing Legal Gap 5: Standalone Single-Trade Scope Demarcation (Anti-Misleading / No Portfolio Management Mandate)

- **The Regulatory Risk:** Under EU MiFID II, US CFTC/SEC, UK FCA PRIN 2A, and Japan JFSA Article 29, a user might claim they assumed the software was monitoring their entire trading account's aggregate margin, hedging, or total risk across multiple simultaneous trades (e.g., holding other XAUUSD positions or FX pairs).
- **Strict Legal Safeguard:**
  1. **Explicit Architecture Demarcation:** All mathematical models in DavinTrade App are strictly **Single-Trade Standalone Calculations**.
  2. **No Fiduciary Portfolio Oversight:** The app explicitly informs the user that it does NOT monitor or calculate cumulative account margin, cross-instrument correlation, or net portfolio drawdown.
  3. **User Broker Independence:** The user is formally reminded that managing overall account margin and cumulative risk across multiple broker tickets remains their sole personal responsibility.

---

## 🗄️ 5. Database Schema & Fast-Cache Strategy

Engine 4 utilizes a two-table relational structure in PostgreSQL for live active preferences and immutable audit tracking:

```sql
-- 1. Live Active Preferences Table (1 Row Per User)
CREATE TABLE IF NOT EXISTS user_trade_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  trader_type VARCHAR(20) DEFAULT 'DAY_TRADER' NOT NULL, -- 'SCALPER' | 'DAY_TRADER'
  trading_style VARCHAR(35) DEFAULT 'TREND_FOLLOWING' NOT NULL, -- 'TREND_FOLLOWING' | 'TREND_COUNTERING' | 'BOTH'
  risk_per_trade_pct NUMERIC(4,2) DEFAULT 1.50 NOT NULL,
  max_leverage VARCHAR(10) DEFAULT '1:1.5' NOT NULL, -- Presets ('1:1.0'..'1:3.0') or Custom (<= '1:5.0')
  target_rrr NUMERIC(4,2) DEFAULT 1.75 NOT NULL,
  custom_equity_balance NUMERIC(12,2) DEFAULT 5000.00 NOT NULL,
  min_stop_loss_distance NUMERIC(8,2) DEFAULT 13.00 NOT NULL,
  round_trip_commission NUMERIC(6,2) DEFAULT 4.00 NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_user_trade_prefs_user_id ON user_trade_preferences(user_id);

-- 2. Immutable Historical Audit Trail Table (Append-Only)
CREATE TABLE IF NOT EXISTS user_trade_preferences_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  user_id_hash VARCHAR(64), -- Populated with HMAC-SHA256 upon account deletion
  session_id VARCHAR(64),
  trader_type VARCHAR(20) NOT NULL,
  trading_style VARCHAR(35) NOT NULL,
  risk_per_trade_pct NUMERIC(4,2) NOT NULL,
  max_leverage VARCHAR(10) NOT NULL,
  target_rrr NUMERIC(4,2) NOT NULL,
  custom_equity_balance NUMERIC(12,2) NOT NULL,
  min_stop_loss_distance NUMERIC(8,2) NOT NULL,
  round_trip_commission NUMERIC(6,2) NOT NULL,
  change_source VARCHAR(40) DEFAULT 'INITIAL_SESSION_GATE' NOT NULL, -- 'INITIAL_SESSION_GATE' | 'MID_SESSION_UPDATE' | 'MANUAL_SETTINGS'
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_user_prefs_hist_user_id ON user_trade_preferences_history(user_id, recorded_at DESC);
CREATE INDEX idx_user_prefs_hist_hash ON user_trade_preferences_history(user_id_hash, recorded_at DESC);
```

### 5.1 Redis Caching Strategy:

- **Key:** `davintrade:user:preferences:{userId}`
- **TTL:** 24 Hours (invalidated immediately upon saving preferences)
- **Performance:** $< 2\text{ms}$ retrieval when loading the 7-Pillar Retrieval context.

---

## 🔗 6. Integration with the 7-Pillar Retrieval Pipeline

Engine 4 acts as the **Contextual Governance Layer** across the entire 7-Pillar Retrieval Engine (working in tandem with the platform-wide Fixed 54-Bar Standard):

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                           ENGINE 4 GOVERNANCE OVER PIPELINE                            │
├──────────────────────────┬─────────────────────────────────────────────────────────────┤
│ Target Engine            │ Context Provided by Engine 4 / Fixed Standard               │
├──────────────────────────┼─────────────────────────────────────────────────────────────┤
│ **Engine 1 (VANNA)**     │ Standardized 54-bar historical slice into SQL query limit   │
│ **Engine 1.5A (MCD Count)**│ Aggregates MCD occurrence counts (FREQ54_MCDxx) over 54 bars│
│ **Engine 1.5B (Storyline)**│ Slices timeline narrative (JSONB54) strictly to 54 bars     │
│ **Engine 1.5C (WACS)**   │ Computes decay weighting (WACS54) across fixed 54-bar window│
│ **Engine 2 (Rules)**     │ Injects user's Trader Type and Trading Style constraints    │
│ **Engine 3 (Vision)**    │ Highlights M5 (Scalper) or M15 (Day Trader) chart panel     │
└──────────────────────────┴─────────────────────────────────────────────────────────────┘
```

---

## 📋 7. Implementation Checklist for Claude Code

When implementing Engine 4 in Phase 12 (Sessions 12-0 → 12-3):

- [ ] **DB Schema Migration:** Create `user_trade_preferences` and `user_trade_preferences_history` tables in PostgreSQL/Prisma.
- [ ] **API Endpoints:**
  - `GET /api/user/trade-preferences` (Fetch active preferences)
  - `PUT /api/user/trade-preferences` (Save preferences & append history snapshot)
  - `GET /api/user/trade-preferences/history` (Fetch immutable audit trail log)
- [ ] **UI Interactive Modal:** Build `components/chat/preferences-modal.tsx` with 5 Multiple-Choice Badges, 3 numeric fields, conditional RRR capping ($\le 2.50\text{x}$ for counter-trend), and statutory micro-disclaimers.
- [ ] **UI Session Summary Card:** Build `components/chat/preferences-summary-card.tsx` with permanent AI status indicator, statutory disclaimers, and `[ Confirm ]` / `[ Modify / Edit ]` action buttons.
- [ ] **UI History Audit Drawer/Modal:** Build `components/chat/preferences-history-modal.tsx` to view historical snapshots.
- [ ] **Mid-Session Intent Detection:** Add natural language intent parsing in the chat orchestrator to trigger the preferences modal mid-conversation.
- [ ] **Confirmation Loop Hook:** Implement `useUserTradePreferences()` hook managing the confirmation loop, history logging, and Redis cache sync.
- [ ] **Compliance Anonymization Worker:** Connect account deletion events to HMAC hash `user_trade_preferences_history` while preserving audit records.
- [ ] **Unit & Integration Tests:** Verify audit logging on mutation, leverage ceiling (1:5.0x), and mid-session re-configuration state transitions.

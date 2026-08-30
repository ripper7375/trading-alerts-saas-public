# XAUUSD (Gold) Trading Calculations: The Plain-English Guide

> **Purpose:** This guide explains all mathematical calculations used in **Stack-D** for **XAUUSD (Gold vs. US Dollar)** in simple, plain English without academic jargon or confusing mathematical symbols.

---

## 🌟 The Core Basics: 3 Golden Rules of XAUUSD

Before doing any math, remember these 3 fundamental facts about trading Gold on MetaTrader / CFD brokers:

1. **1 Standard Lot = 100 Troy Ounces of Gold**
   - When you trade `1.00 Lot`, you are buying or selling **100 ounces** of physical gold.
   - When you trade `0.10 Lot` (Mini Lot), you are controlling **10 ounces**.
   - When you trade `0.01 Lot` (Micro Lot), you are controlling **1 ounce**.

2. **Every $1.00 price move on 1.00 Lot = $100.00 Profit or Loss**
   - Because 1 lot is 100 ounces, if the price of gold goes up by $1.00 per ounce, you make `100 ounces × $1.00 = $100.00`.
   - If gold moves by **1 cent ($0.01 / 1 point)**, 1 lot makes or loses **$1.00**.
   - If gold moves by **10 cents ($0.10 / 1 pip)**, 1 lot makes or loses **$10.00**.

3. **Point Value NEVER Changes**
   - Whether gold is priced at $1,800, $2,500, or $3,000, **a 1-cent move on 1 lot is ALWAYS worth exactly $1.00 USD**.

---

## 📋 Quick Reference Cheatsheet

| What do you want to calculate?    | Plain-English Formula                                  | Example Scenario                                               |
| :-------------------------------- | :----------------------------------------------------- | :------------------------------------------------------------- |
| **1. Lot Size (Position Sizing)** | `Risk Amount ($) ÷ (Stop Loss Distance in $ × 100 oz)` | Risk $100 with a $10 Stop Loss → **0.10 Lots**                 |
| **2. Total Value (Exposure)**     | `Lot Size × 100 oz × Current Gold Price`               | 0.10 Lots at $2,500 Gold → **$25,000 USD**                     |
| **3. Account Leverage**           | `Total Value of Gold Controlled ÷ Account Equity`      | $25,000 Position on $10,000 Equity balance → **2.5x Leverage** |
| **4. P&L on Price Move**          | `Lot Size × 100 oz × Price Move in $`                  | 0.10 Lots × 100 oz × $5 Move → **$50 USD Profit**              |

---

## 1. Lot Size Calculation (How Big Should My Trade Be?)

### 🎯 The Goal

To calculate the exact lot size so that **if price hits your Stop Loss, you lose only the dollar amount you planned to risk** (e.g., exactly $100 or 1% of your account).

---

### 🧮 The Plain-English Formula

```text
                               Total Dollars You Are Willing to Risk
Lot Size = -------------------------------------------------------------------------------------------------------
           (Distance between Entry and Stop Loss in Dollars × 100 oz) + Round-Turn Broker Commission per 1 lot
```

_(If your broker charges no separate commission, just ignore the commission part.)_

---

### 🪜 Step-by-Step Example

Let's say you have a **$10,000 account (Equity Balance)** and you want to buy Gold.

- **Step 1: Decide your risk budget in dollars**
  - You decide to risk **1%** of your $10,000 equity balance.
  - `Risk Budget = $10,000 × 1% = $100.00`

- **Step 2: Find the distance to your Stop Loss in dollars**
  - **Entry Price:** $2,500.00
  - **Stop Loss Price:** $2,490.00
  - `Stop Loss Distance = $2,500.00 - $2,490.00 = $10.00 per ounce`

- **Step 3: Calculate how much 1 full Standard Lot (100 oz) would lose**
  - `Loss for 1.00 Lot = $10.00 per oz × 100 oz = $1,000.00`

- **Step 4: Divide your risk budget by the 1-lot loss**
  - `Lot Size = $100.00 ÷ $1,000.00 = 0.10 Lots (10 ounces)`

- **Step 5: Check Broker Rules (Rounding & Limits)**
  - Most brokers allow steps of **0.01 lots** (e.g., 0.08, 0.09, 0.10).
  - Check broker boundaries: Minimum lot is usually `0.01` and Maximum lot is usually `100.00`.
  - Your calculated `0.10 Lots` is valid and ready to place!
  - If your calculated `0.0321 Lots` --> this is not valid --> need to ROUND DOWN to the nearest valid lot size convention (here in this case is 0.03 lots).

---

## 2. Notional USD Exposure (How Much Gold Value Do I Control?)

### 🎯 The Goal

To know the **total cash market value** of all the physical gold your trades currently control in the real market.

---

### 🧮 The Plain-English Formulas

#### Single Trade Value

```text
Notional USD Exposure = Total Position Value ($) = Lot Size × 100 ounces × Current Gold Price
```

- **Example:** If you buy **0.10 Lots** when Gold is at **$2,500.00**:
  - `Notional USD Exposure = Total Position Value = 0.10 × 100 × $2,500 = $25,000 USD`
  - Even though you only risked $100, you are controlling **$25,000 worth of gold**.

---

## 3. Effective Leverage (How Much Am I Borrowing?)

### 🎯 The Goal

To measure **how many times larger your trading positions are compared to your actual equity balance**.

---

### 🧮 The Plain-English Formula

```text
                               Notional USD Exposure
Effective Leverage = ----------------------------------------
                               Equity Balance in USD
```

---

### 🪜 Examples

Suppose you have **$10,000** in your trading equity balance account and Gold is at **$2,500**:

- **1-Trade Position (0.10 Lots)**
  - Total Position Value = `0.10 × 100 × $2,500 = $25,000 USD`
  - `Leverage = $25,000 ÷ $10,000 = 2.5x`
  - _You are using 2.5 times your equity balance size._

---

## 4. Point Value & Profit/Loss Sensitivity

### 🎯 The Goal

To answer: _"If Gold moves by a certain number of cents, how much actual cash do I make or lose?"_

---

### 🧮 The Plain-English Formula

```text
Profit or Loss ($) = Lot Size × 100 ounces × Price Change in cents
```

---

### 📈 Gold Sensitivity Lookup Table

Here is a ready-to-use table showing exact dollar profits/losses for common lot sizes and price moves:

| Lot Size                | Ounces of Gold | $0.01 Move (1 Cent / 1 Point) | $0.10 Move (10 Cents / 1 Pip) | $1.00 Move (1 Dollar) | $5.00 Move (5 Dollars) | $10.00 Move (10 Dollars) | $20.00 Move (20 Dollars) |
| :---------------------- | :------------- | :---------------------------- | :---------------------------- | :-------------------- | :--------------------- | :----------------------- | :----------------------- |
| **1.00 Lot (Standard)** | 100 oz         | **$1.00**                     | **$10.00**                    | **$100.00**           | **$500.00**            | **$1,000.00**            | **$2,000.00**            |
| **0.50 Lot**            | 50 oz          | **$0.50**                     | **$5.00**                     | **$50.00**            | **$250.00**            | **$500.00**              | **$1,000.00**            |
| **0.10 Lot (Mini)**     | 10 oz          | **$0.10**                     | **$1.00**                     | **$10.00**            | **$50.00**             | **$100.00**              | **$200.00**              |
| **0.05 Lot**            | 5 oz           | **$0.05**                     | **$0.50**                     | **$5.00**             | **$25.00**             | **$50.00**               | **$100.00**              |
| **0.01 Lot (Micro)**    | 1 oz           | **$0.01**                     | **$0.10**                     | **$1.00**             | **$5.00**              | **$10.00**               | **$20.00**               |

---

## 5. Complete Master Walkthrough (Putting It All Together)

Let's walk through an entire trade from start to finish to see how all the formulas connect.

### 👤 Trader Profile & Setup

- **Equity Balance:** $10,000 USD
- **Risk Tolerance:** 1% of equity balance ($100 USD)
- **Gold Current Price:** $2,500.00
- **Trade Signal:** BUY at $2,500.00
- **Stop Loss (SL):** $2,490.00 ($10 risk per ounce)
- **Take Profit (TP):** $2,520.00 ($20 gain per ounce — a 1:2 Risk/Reward ratio)

---

### 🔢 Step-by-Step Execution

1. **Calculate Lot Size:**
   - Risk budget = $100
   - Loss per 1 lot = `($2,500 - $2,490) × 100 oz = $1,000`
   - `Lot Size = $100 ÷ $1,000 = 0.10 Lots`

2. **Calculate Exposure & Leverage:**
   - `Total Value Controlled = 0.10 × 100 oz × $2,500 = $25,000 USD`
   - `Effective Leverage = $25,000 ÷ $10,000 = 2.5x`

3. **Outcome A — Trade Hits Stop Loss ($2,490.00):**
   - Price drops by $10.00 per ounce.
   - `Loss = 0.10 Lots × 100 oz × (-$10.00) = -$100.00 USD`
   - _Result: Your account is protected and you lose exactly the $100 you planned._

4. **Outcome B — Trade Hits Take Profit ($2,520.00):**
   - Price rises by $20.00 per ounce.
   - `Profit = 0.10 Lots × 100 oz × (+$20.00) = +$200.00 USD`
   - _Result: You made $200 profit (2x your risked amount)._

---

## 📌 Summary of Terms

- **Troy Ounce (oz):** The standard unit of weight for precious metals. 1 standard lot = 100 troy ounces.
- **Standard Lot (1.00):** 100 ounces of gold.
- **Mini Lot (0.10):** 10 ounces of gold.
- **Micro Lot (0.01):** 1 ounce of gold.
- **Point (0.01):** 1 cent move in gold price ($0.01). Worth $1.00 per 1.00 standard lot.
- **Pip (0.10):** 10 cents move in gold price ($0.10). Worth $10.00 per 1.00 standard lot.
- **Notional Exposure:** The total dollar value of physical gold your trades control.
- **Effective Leverage:** How many times your exposure is compared to your equity balance.

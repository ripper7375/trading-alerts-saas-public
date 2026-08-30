# US Regulatory & CFTC / FTC Compliance Architectural Specification

**Document Version:** 1.0.0  
**Status:** Authoritative US Regulatory & Compliance Specification for AI Agents (Antigravity, Claude Code, Claude Cowork)  
**Target Scope:** DavinTrade SaaS Platform (Next.js Monolith/Frontend, `operation-service`, `money-service`, `railway-gateway`, Contabo VPS, and Mobile App)  
**Date:** 2026-08-26

---

## 1. Regulatory Context & US Legal Landscape

This specification defines the architectural invariants, legal boundaries, and implementation rules required for DavinTrade to operate lawfully when serving users located in the United States.

### 1.1 Key US Regulatory Bodies & Statutes

1. **Commodity Futures Trading Commission (CFTC) & National Futures Association (NFA)**:
   - **Statute:** Commodity Exchange Act (CEA), 7 U.S.C. § 1 et seq.
   - **Jurisdiction:** Retail Off-Exchange Foreign Exchange (Forex) and Leveraged Spot Commodities (specifically Spot Gold / `XAUUSD`).
   - **Commodity Trading Advisor (CTA) Demarcation:** Registration is required under CEA Section 4o unless protected by the constitutional **Publisher's Exemption** (_Lowe v. SEC_, 472 U.S. 181 (1985); CFTC Rule 4.14(a)(9)).
   - **CFTC Rule 4.41:** Strict, non-negotiable statutory disclaimer required word-for-word for hypothetical performance, backtested quantitative models, and simulated trading signals.
2. **Federal Trade Commission (FTC)**:
   - **Statute:** FTC Act Section 5 (15 U.S.C. § 45) prohibiting unfair or deceptive commercial practices.
   - **AI Claims Guidance:** Strict prohibition of unsubstantiated AI performance, accuracy, or profitability claims ("AI Hype").
   - **FTC "Click-to-Cancel" Rule & ROSCA (Restore Online Shoppers' Confidence Act)**: Mandates frictionless, self-service subscription cancellation.
3. **Securities and Exchange Commission (SEC)**:
   - **Statute:** Investment Advisers Act of 1940 (15 U.S.C. § 80b-1 et seq.).
   - Governs multi-asset expansion into US Equities, ETFs, or tokenized securities.
4. **State-Level Privacy Laws (CCPA / CPRA — California, TDPSA — Texas, VCDPA — Virginia)**:
   - Consumer opt-out rights ("Do Not Sell or Share My Personal Information") and disclosures regarding personal data utilized for AI model fine-tuning.
5. **Office of Foreign Assets Control (OFAC — US Department of the Treasury)**:
   - Strict sanctions enforcement prohibiting services to sanctioned nations (Cuba, Iran, North Korea, Syria, Crimea/Donetsk/Luhansk regions).

---

## 2. Core Compliance Invariants for AI Coding Agents (US Jurisdiction)

Every AI Agent executing tasks in this codebase **MUST** enforce the following 5 non-negotiable US compliance invariants:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          DAVINTRADE US COMPLIANCE FRAMEWORK                            │
├────────────────────────────┬─────────────────────────────┬─────────────────────────────┤
│ 1. CFTC RULE 4.41          │ 2. PUBLISHER'S EXEMPTION    │ 3. FTC AI & CANCELLATION    │
│ • Mandatory Word-for-Word  │ • Impersonal Analysis only  │ • Truth-in-Advertising      │
│   Simulated Disclaimer     │ • Non-Custodial architecture│ • 1-Click Self-Service      │
│ • Display on /disclaimer   │ • Non-Discretionary execution Cancellation (/billing)     │
└────────────────────────────┴─────────────────────────────┴─────────────────────────────┘
```

---

### Invariant 1: CFTC Rule 4.41 Mandatory Performance Disclaimer

Whenever hypothetical, simulated, or backtested trading performance, win rates, historical chart setups, or algorithmic models are presented (such as on `app/(marketing)/disclaimer`, `/pricing`, `/landing-content.tsx`, or inside `TradeSetupCard.tsx`), the **exact, unmodified text of CFTC Rule 4.41 MUST be included**:

> **"CFTC RULE 4.41 – HYPOTHETICAL OR SIMULATED PERFORMANCE RESULTS HAVE CERTAIN LIMITATIONS. UNLIKE AN ACTUAL PERFORMANCE RECORD, SIMULATED RESULTS DO NOT REPRESENT ACTUAL TRADING. ALSO, SINCE THE TRADES HAVE NOT BEEN EXECUTED, THE RESULTS MAY HAVE UNDER-OR-OVER COMPENSATED FOR THE IMPACT, IF ANY, OF CERTAIN MARKET FACTORS, SUCH AS LACK OF LIQUIDITY. SIMULATED TRADING PROGRAMS IN GENERAL ARE ALSO SUBJECT TO THE FACT THAT THEY ARE DESIGNED WITH THE BENEFIT OF HINDSIGHT. NO REPRESENTATION IS BEING MADE THAT ANY ACCOUNT WILL OR IS LIKELY TO ACHIEVE PROFIT OR LOSSES SIMILAR TO THOSE SHOWN."**

---

### Invariant 2: Maintaining Publisher's Exemption (No CTA Registration)

To maintain exemption from registration as a Commodity Trading Advisor (CTA), DavinTrade must operate strictly as an **impersonal software publisher**:

1. **Impersonal Analysis:** The system must never provide personalized trade advice tailored to an individual user's account balance, risk tolerance, or net worth.
2. **Non-Custodial Architecture:** The platform must never hold, transfer, custody, or manage user funds. All financial settlement occurs through third-party processors (Stripe/dLocal).
3. **Non-Discretionary Execution:** The software must NOT automatically place live market orders into third-party broker accounts without manual, human-initiated execution by the user.

---

### Invariant 3: FTC Truth-in-Advertising & AI Accuracy Substantiation

1. **No Deceptive AI Claims:** Marketing copy, landing pages, and UI prompts must never claim guaranteed profits, risk-free trading, or unsubstantiated accuracy statistics (e.g. _"95% Win Rate AI"_).
2. **Testimonial Disclosures:** Any displayed user reviews or trading PnL screenshots must carry the prominent disclosure:
   > _"Testimonials appearing on this site may not be representative of other clients or customers and is no guarantee of future performance or success. Trading involves substantial risk of loss."_
3. **Click-to-Cancel Compliance:** The billing page (`app/(dashboard)/settings/billing/page.tsx`) must preserve the existing self-service cancellation flow. Cancellation must never require phone calls, chat support approvals, or artificial UI roadblocks.

---

### Invariant 4: CCPA / CPRA Consumer Privacy & AI Opt-Out

1. **Notice at Collection:** `privacy/page.tsx` must disclose the categories of personal data collected and whether data is shared with analytics vendors.
2. **AI Model Training Opt-Out:** Users residing in California and other regulated US states must be provided with an explicit toggle in `/settings/privacy` to exclude their chat logs and prompt interactions from AI model improvement.

---

### Invariant 5: OFAC Sanctions Compliance

1. **Zero Bypass:** Cloudflare Geo-blocking and Stripe Radar / Sanction Screening must remain fully enabled.
2. **Blocked Jurisdictions:** The system must refuse registration and payments originating from comprehensively sanctioned territories: Cuba, Iran, North Korea, Syria, and the Ukrainian occupied regions (Crimea, Donetsk, Luhansk).

---

## 3. Post-8B Action Plan (Phase 16: Global & US Compliance Polish)

All US compliance tasks are scheduled for implementation during **Phase 16 (Global Legal & Compliance Polish)** after the core Master Roadmap (Phases 7 → 15 → 8B) completes:

| Task ID   | Target Component / Surface                  | Required Implementation                                                    |
| :-------- | :------------------------------------------ | :------------------------------------------------------------------------- |
| **US-01** | `app/(marketing)/disclaimer/page.tsx`       | Embed full CFTC Rule 4.41 mandatory text in prominent callout box.         |
| **US-02** | `app/(marketing)/terms/page.tsx`            | Reinforce Publisher's Exemption (Impersonal Quantitative Software terms).  |
| **US-03** | `app/(marketing)/pricing/page.tsx`          | Add CFTC Simulated Results & Risk Disclaimer above checkout tier selector. |
| **US-04** | `app/(marketing)/landing-content.tsx`       | Audit all marketing copy to remove any unsubstantiated AI accuracy claims. |
| **US-05** | `app/(dashboard)/settings/privacy/page.tsx` | Add CCPA "Do Not Sell/Share" and AI Training Opt-Out switches.             |

---

## 4. Agent Audit & Verification Checklist

When executing Phase 16, AI Agents must verify:

- [ ] **CFTC Rule 4.41:** Is the exact statutory disclaimer text present on `/disclaimer` and `/pricing`?
- [ ] **Publisher's Scope:** Do terms explicitly state that DavinTrade is an execution-only analytical tool?
- [ ] **FTC Compliance:** Are all marketing claims free from guaranteed profit or exaggerated AI accuracy statements?
- [ ] **Self-Service Cancellation:** Is the 1-click subscription cancellation button functional on `/settings/billing`?
- [ ] **CCPA AI Opt-Out:** Is there a mechanism for users to opt-out of AI training data collection?

---

_Authored for DavinTrade Engineering & Compliance Architecture — All rights reserved._

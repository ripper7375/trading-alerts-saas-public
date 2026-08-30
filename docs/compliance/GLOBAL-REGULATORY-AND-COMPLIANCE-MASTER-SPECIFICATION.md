# Global Regulatory & Compliance Master Architectural Specification (EU, US, UK & Japan)

**Document Version:** 1.0.0 (Master Global Edition)  
**Status:** Authoritative Global Regulatory & Compliance Master Specification for AI Agents (Antigravity, Claude Code, Claude Cowork)  
**Target Scope:** DavinTrade SaaS Platform (Next.js Monolith/Frontend, `operation-service`, `money-service`, `railway-gateway`, Contabo VPS, and Mobile App)  
**Jurisdictions in Scope:** European Union (EU/EEA), United States (US), United Kingdom (UK), and Japan (JP)  
**Date:** 2026-08-26

---

## 1. Executive Summary & Unified Global Compliance Framework

This master specification consolidates all statutory, regulatory, and architectural compliance requirements across the 4 primary global markets served by DavinTrade. It serves as the single source of truth for AI Coding Agents and Engineering Leads during project implementation and audits.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               DAVINTRADE GLOBAL COMPLIANCE ARCHITECTURE                                │
├──────────────────────────┬──────────────────────────┬──────────────────────────┬───────────────────────┤
│ 🇪🇺 EUROPEAN UNION        │ 🇺🇸 UNITED STATES         │ 🇬🇧 UNITED KINGDOM        │ 🇯🇵 JAPAN              │
│ • EU AI Act (Art. 50)    │ • CFTC Rule 4.41 (Exact) │ • FCA FSMA Sec 21 & PS19 │ • JFSA FIEA Exemption │
│ • GDPR Art 17 (Flag F21) │ • Publisher's Exemption  │ • DMCC Act 2024 (1-Click)│ • /tokushoho Notation │
│ • 14-Day Waiver Checkbox │ • FTC Anti-Deception AI  │ • Pre-Renewal Mail Cron  │ • Japanese Risk Copy  │
│ • EU VAT OSS (Stripe)    │ • CCPA/CPRA AI Opt-Out   │ • HMRC 20% UK VAT        │ • JCT 10% (Stripe Tax)│
└──────────────────────────┴──────────────────────────┴──────────────────────────┴───────────────────────┘
```

---

## 2. Universal Compliance Invariants (Cross-Border Core Rules)

Every AI Agent executing tasks in this codebase **MUST** enforce the following 5 universal invariants across all surfaces and microservices:

### 1. Invariant: Execution-Only Software Demarcation

Across all 4 jurisdictions (EU MiFID II, US CEA/SEC, UK FSMA, Japan FIEA), DavinTrade is legally protected only as an **impersonal mathematical analysis tool**.

- **Zero Personalized Advice:** The system must never tailor buy/sell setups to an individual's private portfolio or risk profile.
- **Non-Custodial & Non-Discretionary:** The system must never hold user funds or execute automated trades into broker accounts without manual user interaction.

### 2. Invariant: AI Transparency & Honest Marketing

- **Persistent AI Identification:** All generative and conversational panels (`AIAnalystPanel.tsx`, Contabo Web Chat) must display a persistent visual AI badge.
- **Machine-Readable Metadata:** SSE streams and API endpoints must emit structured metadata (`is_ai_generated: true`, `model_id`, `timestamp_utc`).
- **Truth in Advertising:** Never claim guaranteed returns, risk-free trading, or unverified AI accuracy percentages.

### 3. Invariant: Data Privacy & Right to Erasure (Closing Flag F21)

- Implementing the scheduled background account deletion worker in `operation-service` simultaneously satisfies **GDPR Article 17 (EU)**, **UK GDPR (UK)**, **CCPA/CPRA (California)**, and **APPI (Japan)**.

### 4. Invariant: Frictionless Subscription Cancellation (Click-to-Cancel)

- In compliance with **FTC Click-to-Cancel**, **UK DMCC Act 2024**, and **Japan Tokushoho**, the billing portal (`app/(dashboard)/settings/billing/page.tsx`) must maintain an unhindered self-service cancellation flow.

### 5. Invariant: Multi-Jurisdiction Tax & Payment Security

- Configure **Stripe Tax** to assess jurisdiction-specific tax rates based on customer billing country:
  - **EU Members:** Dynamic EU VAT OSS rates.
  - **United Kingdom (GB):** 20% UK VAT.
  - **Japan (JP):** 10% Japanese Consumption Tax (JCT).
  - **Strong Customer Authentication:** 3DS2 enabled for all EEA/UK cards.

---

## 3. Jurisdiction-Specific Statutory Requirements

### 3.1 🇪🇺 European Union (EU)

1. **EU AI Act (Art. 50):** Persistent badge on `AIAnalystPanel`, machine-readable metadata in `/api/ai/chat/stream`, and micro-disclaimer on `TradeSetupCard.tsx`.
2. **GDPR Consent:** 3-tier Cookie Consent Banner on `app/layout.tsx` (Strictly Necessary, Functional, Analytics).
3. **Consumer Rights:** Mandatory 14-day statutory right of withdrawal waiver checkbox on `/checkout`.

### 3.2 🇺🇸 United States (US)

1. **CFTC Rule 4.41 (Mandatory Statutory Text):** Must embed the exact word-for-word disclaimer on `/disclaimer` and `/pricing`:
   > _"CFTC RULE 4.41 – HYPOTHETICAL OR SIMULATED PERFORMANCE RESULTS HAVE CERTAIN LIMITATIONS. UNLIKE AN ACTUAL PERFORMANCE RECORD, SIMULATED RESULTS DO NOT REPRESENT ACTUAL TRADING. ALSO, SINCE THE TRADES HAVE NOT BEEN EXECUTED, THE RESULTS MAY HAVE UNDER-OR-OVER COMPENSATED FOR THE IMPACT, IF ANY, OF CERTAIN MARKET FACTORS, SUCH AS LACK OF LIQUIDITY. SIMULATED TRADING PROGRAMS IN GENERAL ARE ALSO SUBJECT TO THE FACT THAT THEY ARE DESIGNED WITH THE BENEFIT OF HINDSIGHT. NO REPRESENTATION IS BEING MADE THAT ANY ACCOUNT WILL OR IS LIKELY TO ACHIEVE PROFIT OR LOSSES SIMILAR TO THOSE SHOWN."_
2. **FTC Testimonial Disclosures:** Typical results disclosures on marketing copy.
3. **CCPA/CPRA:** "Do Not Sell/Share" and AI Training Opt-Out toggle in `/settings/privacy`.

### 3.3 🇬🇧 United Kingdom (UK)

1. **FCA Policy Statement PS19/18:** Mandatory CFD & Leveraged Derivative Risk Warning on `/disclaimer` and `/pricing`.
2. **DMCC Act 2024 Pre-Renewal Notifications:** Automated email dispatched at least 14 days before recurring annual subscription billing.
3. **HMRC UK VAT:** Assessment of 20% VAT separated from EU VAT schedules.

### 3.4 🇯🇵 Japan (JP)

1. **Tokushoho Statutory Notation (`/tokushoho`):** Dedicated page displaying company details, contact info, pricing, payment methods, delivery timing, and cancellation policy.
2. **JFSA FIEA Article 37 Risk Warning:** Standardized Japanese risk disclosure copy on `/disclaimer`.
3. **National Tax Agency JCT:** Assessment of 10% Japanese Consumption Tax via Stripe.

---

## 4. Phase 16 Master Implementation Plan (Post-8B Execution)

Following the completion of Master Roadmap Session 8B, all global compliance deliverables are executed as **Phase 16 (Global Legal & Compliance Polish)**:

| Category                        | Target Files & Components                                                                                                                                     | Concrete Deliverables                                                                                                                                                                                     |
| :------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Legal Copy & Disclaimers** | • `app/(marketing)/disclaimer/page.tsx`<br>• `app/(marketing)/terms/page.tsx`<br>• `app/(marketing)/tokushoho/page.tsx`                                       | • Embed CFTC 4.41, FCA PS19/18, and JFSA risk copy.<br>• Declare Execution-Only software scope across terms.<br>• Build statutory Japanese Tokushoho page.                                                |
| **2. UI UX & Checkout**         | • `app/layout.tsx`<br>• `app/checkout/page.tsx`<br>• `components/layout/footer.tsx`                                                                           | • Deploy 3-tier Cookie Consent Banner.<br>• Add EU 14-Day Waiver Checkbox at checkout.<br>• Add Tokushoho link in footer navigation.                                                                      |
| **3. AI & Data Pipeline**       | • `components/terminal/AIAnalystPanel.tsx`<br>• `app/api/ai/chat/stream/route.ts`<br>• `components/cards/TradeSetupCard.tsx`<br>• `operation-service/src/ai/` | • Add `🤖 DavinTrade AI` persistent badge.<br>• Embed `is_ai_generated: true` in SSE payload.<br>• Add non-advisory disclaimer on TradeSetupCard.<br>• Install Pre-LLM PII Sanitizer in context assembly. |
| **4. Backend Workers & Tax**    | • `operation-service/src/account/`<br>• `money-service/src/crons/`<br>• `money-service/src/stripe/`                                                           | • Implement 24h Account Deletion Worker (**Flag F21**).<br>• Create DMCC annual renewal email reminder cron.<br>• Configure Stripe Tax for EU VAT, UK VAT (20%), and JCT (10%).                           |

---

## 5. Master Verification Checklist for AI Agents

Before marking Phase 16 complete, the Agent must verify:

- [ ] **Universal Non-Advisory Status:** Are terms across all locales clearly scoped to execution-only software?
- [ ] **EU AI Act Transparency:** Do all AI surfaces and streaming routes output machine-readable metadata and visual badges?
- [ ] **CFTC Rule 4.41:** Is the unmodified CFTC disclaimer present on `/disclaimer` and `/pricing`?
- [ ] **FCA Derivative Warning:** Is the UK PS19/18 risk disclosure displayed?
- [ ] **Tokushoho Page:** Does `/tokushoho` render valid statutory merchant information?
- [ ] **GDPR / F21 Worker:** Does the backend deletion job actually purge/anonymize user data upon grace period expiry?
- [ ] **Stripe Tax:** Are country-specific tax rules (EU VAT, UK VAT 20%, JCT 10%) active in checkout flows?

---

_Authored for the DavinTrade Engineering & Global Architecture Team — All rights reserved._

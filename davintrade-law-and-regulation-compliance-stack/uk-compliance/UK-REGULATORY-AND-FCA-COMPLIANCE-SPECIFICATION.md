# UK Regulatory & FCA / UK-GDPR Compliance Architectural Specification

**Document Version:** 1.0.0  
**Status:** Authoritative UK Regulatory & Compliance Specification for AI Agents (Antigravity, Claude Code, Claude Cowork)  
**Target Scope:** DavinTrade SaaS Platform (Next.js Monolith/Frontend, `operation-service`, `money-service`, `railway-gateway`, Contabo VPS, and Mobile App)  
**Date:** 2026-08-26

---

## 1. Post-Brexit UK Regulatory Landscape

This specification defines the architectural invariants, regulatory constraints, and implementation guidelines for DavinTrade when serving users residing in the United Kingdom.

### 1.1 Key UK Regulatory Authorities & Statutes

1. **Financial Conduct Authority (FCA)**:
   - **Statute:** Financial Services and Markets Act 2000 (FSMA) & Financial Services and Markets Act 2023.
   - **Financial Promotions Regime (FSMA Section 21):** Prohibits communicating an invitation or inducement to engage in investment activity (such as trading alerts, CFD commentary, or financial software subscriptions) to UK consumers unless authorized or exempt.
   - **Regulated Activities Order (RAO Article 53 — Advising on Investments):** Differentiates between personalized financial advice and **execution-only / educational quantitative tools** (FCA Perimeter Guidance Manual PERG 8.29 / 8.30).
   - **Policy Statement PS19/18 (CFD / Margin Risk Disclosures):** Prescribes mandatory leverage limits and risk warnings for retail clients.
2. **Information Commissioner's Office (ICO)**:
   - **Statute:** UK GDPR & Data Protection Act 2018.
   - International Data Transfer Agreement (IDTA) / UK Addendum to EU Standard Contractual Clauses.
   - Cookie consent requirements under Privacy and Electronic Communications Regulations (PECR).
3. **Competition and Markets Authority (CMA) & DMCC Act 2024**:
   - **Digital Markets, Competition and Consumers Act 2024 (DMCC Act):** Enforces strict rules against "Subscription Traps", requiring transparent pre-contract disclosures, cooling-off reminders for annual renewals, and frictionless 1-click exit mechanics.
4. **His Majesty's Revenue and Customs (HMRC)**:
   - UK VAT on B2C Digital Services (standard rate: 20%). Note that UK digital sales are outside the EU VAT OSS regime.

---

## 2. Core Compliance Invariants for AI Coding Agents (UK Jurisdiction)

Every AI Agent executing tasks in this codebase **MUST** enforce the following 4 non-negotiable UK compliance invariants:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          DAVINTRADE UK COMPLIANCE FRAMEWORK                            │
├────────────────────────────┬─────────────────────────────┬─────────────────────────────┤
│ 1. FCA RISK DISCLOSURE     │ 2. PERG 8.29 EXECUTION-ONLY │ 3. DMCC SUBSCRIPTION RULES  │
│ • PS19/18 CFD Margin Warning│ • No personalized advice   │ • 1-Click Cancellation      │
│ • Display on /disclaimer   │ • Impersonal math models only│ • Pre-renewal notices (Mail)│
└────────────────────────────┴─────────────────────────────┴─────────────────────────────┘
```

---

### Invariant 1: FCA Standard CFD & Leveraged Derivative Warning

Under FCA Policy Statement PS19/18, all pages presenting trading setups, pricing, or subscription tiers (`/disclaimer`, `/pricing`, `/checkout`) must prominently display the mandatory leveraged product risk warning:

> **"CFDs and margin instruments are complex products and come with a high risk of losing money rapidly due to leverage. A large majority of retail investor accounts lose money when trading CFDs. You should consider whether you understand how leveraged products work and whether you can afford to take the high risk of losing your money. DavinTrade is an analytical software platform and is not authorized or regulated by the Financial Conduct Authority (FCA)."**

---

### Invariant 2: Perimeter Guidance Demarcation (PERG 8.29 & 8.30 — Execution-Only Software)

To avoid unauthorized financial promotion and advising under FSMA Section 21 and RAO Article 53:

1. **Impersonal Analytics:** All algorithmic outputs (`TradeSetupCard.tsx`, Stack E comments, and Stack D chat co-pilot responses) must remain general mathematical calculations. They must never query, store, or evaluate a user's personal financial position or risk appetite to formulate individualized recommendations.
2. **Clear Software Labeling:** Terms of Service (`app/(marketing)/terms/page.tsx`) must state explicitly:
   > _"DavinTrade provides automated technical analysis and mathematical market visualization tools on an execution-only basis. It does not provide regulated investment advisory services or trade execution facilities."_

---

### Invariant 3: DMCC Act 2024 Subscription & Renewal Management

1. **1-Click Self-Service Cancellation:** Ensure the self-service cancellation button on `app/(dashboard)/settings/billing/page.tsx` operates with zero friction.
2. **Pre-Renewal Email Notifications:** The background cron scheduler (`money-service/src/crons/` / `operation-service/src/mail/`) must dispatch an email reminder at least 14 days prior to charging recurring annual subscription renewals.

---

### Invariant 4: UK VAT Compliance (HMRC 20%)

- **Tax Engine Configuration:** Ensure Stripe Tax or billing calculators apply the standard UK 20% VAT rate for transactions where the customer's billing address or IP is within the United Kingdom (GB), separated from the EU VAT OSS schedule.

---

## 3. Post-8B Action Plan (Phase 16: Global & UK Compliance Polish)

All UK-specific tasks are executed during **Phase 16 (Global Legal & Compliance Polish)** after Master Roadmap Session 8B:

| Task ID   | Target Surface / Component            | Required UK Compliance Implementation                                         |
| :-------- | :------------------------------------ | :---------------------------------------------------------------------------- |
| **UK-01** | `app/(marketing)/disclaimer/page.tsx` | Embed FCA PS19/18 standard CFD & Margin Risk Warning.                         |
| **UK-02** | `app/(marketing)/terms/page.tsx`      | Include PERG 8.29 execution-only analytical tool declaration.                 |
| **UK-03** | `money-service/src/crons/`            | Verify pre-renewal notification cron for annual PRO subscriptions (DMCC Act). |
| **UK-04** | `money-service/src/stripe/`           | Configure UK 20% VAT tax code mapping in Stripe Tax.                          |

---

## 4. Agent Audit & Verification Checklist

When executing Phase 16, AI Agents must verify:

- [ ] **FCA Warning:** Is the FCA-compliant derivative risk warning visible on `/disclaimer` and `/pricing`?
- [ ] **Execution-Only Terms:** Do the terms of service clearly disclaim FCA-regulated advisory activity?
- [ ] **Annual Renewal Reminder:** Is an automated email triggered prior to recurring annual billing?
- [ ] **UK VAT:** Does Stripe calculate 20% VAT for UK consumer billing addresses?

---

_Authored for DavinTrade Engineering & Compliance Architecture — All rights reserved._

# EU AI Act & Regulatory Compliance Architectural Specification

**Document Version:** 1.0.0  
**Status:** Authoritative Regulatory & Compliance Specification for AI Agents (Antigravity, Claude Code, Claude Cowork)  
**Target Scope:** DavinTrade SaaS Platform (Next.js Monolith/Frontend, `operation-service`, `money-service`, `railway-gateway`, Contabo VPS, and Mobile App)  
**Date:** 2026-08-26

---

## 1. Regulatory Context & Legal Grounding

This specification provides the non-negotiable architectural invariants and implementation guidelines required for DavinTrade to operate lawfully and provide services to users residing in the European Union (EU / EEA).

### 1.1 Legislative Basis

1. **EU AI Act (Regulation (EU) 2024/1689)** as amended by the **Digital Omnibus on AI (Regulation (EU) 2026/1744)**:
   - Entered into force on **27 July 2026**.
   - **High-Risk AI Systems** (Annex I / Annex III) deadlines are postponed to **2 December 2027** and **2 August 2028**.
   - **Article 50 Transparency Obligations <u>WERE NOT POSTPONED</u> and have been fully enforceable since 2 August 2026.**
   - **Article 50(2) Grace Period:** Systems placed on the market before 2 August 2026 have until **2 December 2026** to achieve full compliance with machine-readable content marking.
2. **General Data Protection Regulation (GDPR - Regulation (EU) 2016/679)**:
   - Data minimization, Right to Erasure (Article 17), Consent Management (ePrivacy Directive), and Third-Country Data Transfers.
3. **EU Financial & Consumer Protection Regulations (MiFID II, ESMA, Consumer Rights Directive)**:
   - Execution-Only Software demarcation, High-Risk Margin Trading / CFD Risk Disclosures, 14-Day Statutory Right of Withdrawal Waiver, and PSD2 Strong Customer Authentication (3DS2).

### 1.2 Extraterritorial Applicability & Penalties

- **Territorial Scope:** The EU AI Act and GDPR apply to software providers and deployers located **outside the EU** whenever the system's output, web app, API, trading alerts, or AI co-pilot reaches natural persons residing in the EU.
- **Penalties for Non-Compliance with Article 50:** Fines up to **€15,000,000 or 3% of global annual turnover**, whichever is higher (for SMEs and startups, the lower amount applies).

### 1.3 Classification of DavinTrade under EU AI Act

- **Risk Tier:** **Limited Risk AI System** (Interactive AI, Conversational Copilots, and Algorithmic Content Generators). It does NOT fall under Annex III High-Risk (which covers credit scoring, biometrics, critical infrastructure, employment, etc.).
- **Entity Roles:**
  - **Provider:** DavinTrade acts as the provider for the proprietary algorithmic analysis engine, prompt assembly architecture, and dynamic UI card generators.
  - **Deployer:** DavinTrade acts as the deployer when utilizing foundation LLM APIs (Google Gemini 3.6, Anthropic Claude 3.5 Sonnet) and NLLB translation engines to generate market analysis and customer support responses.

---

## 2. Core Compliance Invariants for AI Coding Agents

Every AI Agent (Antigravity, Claude Code, Claude Cowork) executing tasks or refactoring code within this repository **MUST** adhere to the following 4 core compliance invariants.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        DAVINTRADE EU COMPLIANCE ARCHITECTURE                           │
├────────────────────────────┬─────────────────────────────┬─────────────────────────────┤
│ 1. AI ACT ARTICLE 50       │ 2. GDPR DATA PRIVACY        │ 3. FINANCIAL & CONSUMER LAW │
│ • Persistent AI Badge      │ • Resolve Flag F21 Worker   │ • Execution-Only Disclaimer │
│ • Machine-Readable Meta    │ • Cookie Consent (Opt-in)   │ • ESMA CFD Risk Warning     │
│ • Algorithmic Card Labels  │ • Pre-LLM PII Sanitizer     │ • 14-Day Withdrawal Waiver  │
└────────────────────────────┴─────────────────────────────┴─────────────────────────────┘
```

---

### Invariant 1: EU AI Act — Article 50 Transparency Obligations

#### 1.1 Direct Interaction Disclosure (Article 50(1))

- **Stack D (Conversational AI Analyst — Phase 12):**
  - The UI panel (`AIAnalystPanel.tsx`) must display a permanent, non-obscured indicator: `🤖 DavinTrade AI Analyst`.
  - The initial conversation prompt / greeting must clearly state that the user is interacting with an AI assistant.
  - The system prompt must forbid the AI from impersonating human staff, certified financial advisors, or broker representatives.
- **Phase 14 (Web Chat / Support Bot on Contabo):**
  - Customer support chatbots must declare their AI status in the first message.
  - Must provide a deterministic fallback or escalation button: `Transfer to Human Support`.

#### 1.2 Machine-Readable AI Output Marking (Article 50(2))

_(Enforceable immediately for new features; legacy grace period ends 2 December 2026)_

- **SSE Stream & REST API Responses:**
  - All streaming chunks and JSON responses from `/api/ai/chat/stream` and `/api/ai/chat` must embed machine-readable metadata headers or structured payload fields:
  ```json
  {
    "event": "message_chunk",
    "data": {
      "text": "XAUUSD M5 SSA line indicates bullish continuation...",
      "meta": {
        "is_ai_generated": true,
        "generator": "DavinTrade-Multimodal-Router",
        "model_id": "gemini-3.6-flash",
        "timestamp_utc": "2026-08-26T07:30:00Z"
      }
    }
  }
  ```
- **Part 24 Chart PNG Render Artifacts (`mtf_render_xauusd.png`):**
  - Matplotlib `renderer.py` must write standard Exif / XMP metadata tags indicating programmatic generation.
  - Vercel Blob and CDN pipelines must preserve image metadata without stripping headers during compression.

#### 1.3 Algorithmic Narrative & Trade Signal Labeling (Article 50(4) & 50(5))

- **Stack E (Market Comments Feed — Phase 13):**
  - All JSONB narrative comments generated via PostgreSQL triggers must render with an `⚡ Algorithmic Comment` icon/badge.
- **Dynamic Action Cards (`TradeSetupCard.tsx` — Phase 12-5):**
  - Whenever rendering quantitative Entry, Target (TP), Stop Loss (SL), or Risk/Reward ratios, the card **MUST** include the mandatory micro-disclaimer:
    > _"Automated Quantitative Setup — Generated algorithmically based on centroid regression & SSA models. Not financial advice."_

---

### Invariant 2: GDPR & Personal Data Protection

#### 2.1 Right to Erasure / 24h Account Deletion Worker (Resolving Flag F21)

- **Status in `DECISION-LOG.md`:** Flag **F21** (`24h Account-Deletion GDPR gap`) is currently **OPEN**.
- **Required Implementation:**
  - Complete `app/api/user/account/deletion-request` and `deletion-confirm` by implementing the scheduled backend background job in `operation-service`.
  - Upon expiry of the 24-hour grace period, the worker must:
    1. **Hard-Delete:** `Session`, `UserLoginHistory`, `Drawing`, `DrawingAlert`, and `NotificationPreference` records.
    2. **Anonymize:** `User` references in billing/tax-audited records (`Payment`, `Invoice`, `DisbursementTransaction`) by replacing PII with an anonymized cryptographic hash.

#### 2.2 Cookie Consent Management (ePrivacy Directive)

- Add a 3-tier **Cookie Consent Banner** in `app/layout.tsx` for EU users:
  1. _Strictly Necessary_ (Session, CSRF, Theme — Always Active).
  2. _Functional / Preferences_ (Chart drawings, active symbols).
  3. _Analytics & Telemetry_ (WebSocket telemetry, error logs — Default: OFF until explicit opt-in).

#### 2.3 Pre-LLM Prompt Sanitization & Training Opt-Out (GDPR Art. 13/14)

- **Privacy Policy (`privacy/page.tsx`):** Add explicit user toggle in `/settings/privacy` to Opt-out of conversational data utilization for model fine-tuning.
- **Context Assembly Layer (Phase 12-3):** Install a deterministic **PII Sanitizer** to scrub emails, names, IP addresses, and financial account numbers before dispatching queries to external LLM endpoints (Google Gemini / Anthropic).

---

### Invariant 3: Financial Regulations (MiFID II / ESMA) & Consumer Rights

#### 3.1 Demarcation of "Execution-Only Software" vs "Investment Advice"

- DavinTrade is **NOT** a regulated investment firm, broker-dealer, or financial advisor.
- **UI Copy & Disclaimers:** All marketing, pricing, and onboarding pages must prominently state:
  > _"DavinTrade is an algorithmic analytics software tool provided on an execution-only basis. It does not provide personalized investment advice or portfolio management services."_
- **ESMA Standard Derivative Warning:** Display standard CFD/margin warning on `/pricing` and `/checkout`:
  > _"CFDs and margin instruments are complex products carrying a high risk of rapid monetary loss due to leverage. Ensure you understand how these instruments operate before trading."_

#### 3.2 14-Day Statutory Right of Withdrawal Waiver (EU Consumer Rights)

- Digital content supplied immediately upon payment requires explicit waiver of the statutory 14-day cancellation window.
- **Checkout Page (`/checkout` — Phase 9-6):** Mandatory checkbox for EU billing addresses:
  ```html
  <Checkbox id="eu-withdrawal-waiver" required>
    I expressly request immediate access to DavinTrade services and acknowledge
    that I thereby lose my 14-day statutory right of withdrawal under EU
    consumer law.
  </Checkbox>
  ```

#### 3.3 Strong Customer Authentication (PSD2 / 3DS2) & EU VAT OSS

- **Payment Gateways (Sessions 4A-13, 4A-16):** Ensure Stripe & dLocal webhooks enforce 3D Secure 2 (3DS2) authentication for all cards issued by EU financial institutions.
- **Tax Calculation:** Ensure invoices calculate Country-Specific EU VAT rates based on the customer's billing country (or apply B2B Reverse Charge upon valid EU VAT number verification).

---

## 3. Master Roadmap Phase Integration Matrix

AI Agents implementing the Master Roadmap (Phases 7–15) must incorporate these compliance deliverables directly into their respective migration sessions:

| Roadmap Session         | Target Surface / Area | Required EU Compliance Implementation                                                                                                               |
| :---------------------- | :-------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Session 9-0 / 9-2**   | Public & Legal Pages  | Update `/disclaimer`, `/terms`, `/privacy` with EU AI Act & ESMA notices. Add Cookie Consent Banner in `app/layout.tsx`.                            |
| **Session 9-5**         | Settings Surface      | Add AI Training Opt-Out toggle in `/settings/privacy`. Wire `/settings/account` deletion UI.                                                        |
| **Session 9-6**         | Payments Flow         | Add 14-Day Right of Withdrawal Waiver checkbox on `/checkout`. Enable EU VAT & 3DS2 in Stripe/dLocal.                                               |
| **Session 11-2**        | Gateway & Forwarding  | Update `forwardedRequestContext()` to preserve GeoIP `cf-ipcountry` / `x-geo-country` headers to microservices.                                     |
| **Session 12-0 / 12-3** | Stack D: AI Context   | Implement Pre-LLM PII Sanitizer filter in `ContextAssemblyService`.                                                                                 |
| **Session 12-4 / 12-5** | Stack D: UI & SSE     | Add permanent `🤖 DavinTrade AI` badge on `AIAnalystPanel`. Embed `is_ai_generated` in SSE stream. Add non-advisory disclaimer on `TradeSetupCard`. |
| **Session 13-0 / 13-3** | Stack E: Comments     | Add `⚡ Algorithmic Comment` badge to `MarketCommentsFeed`.                                                                                         |
| **Session 14-0 / 14-2** | Phase 14: Web Chat    | Add AI disclosure greeting and `Transfer to Human Agent` button in Contabo Web Chat widget.                                                         |
| **Session 8A / F21**    | Decommission & GDPR   | Implement scheduled Account Deletion & PII Anonymization Worker in `operation-service` to close **Flag F21**.                                       |

---

## 4. Agent Execution & Verification Checklist

Before marking any session or migration order complete, the Agent must verify:

- [ ] **AI Disclosure:** Is every AI interactive surface clearly marked with a persistent visual badge?
- [ ] **Machine-Readable Metadata:** Do SSE streams and API endpoints output `is_ai_generated: true` metadata?
- [ ] **Trade Card Disclaimer:** Does `TradeSetupCard.tsx` contain the mandatory non-advisory legal notice?
- [ ] **GDPR Deletion (F21):** Is account deletion backed by a real server-side purge worker (no mock `console.log`)?
- [ ] **Prompt Privacy:** Are user personal details (PII) stripped prior to invoking Gemini or Claude LLMs?
- [ ] **Consumer Rights:** Is the 14-day statutory right of withdrawal waiver present on `/checkout`?
- [ ] **Financial Disclaimer:** Is the execution-only software warning visible across marketing and pricing pages?

---

_Authored for the DavinTrade Engineering & Architecture Team — All rights reserved._

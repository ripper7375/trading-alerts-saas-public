# Japan Regulatory & JFSA / Tokushoho Compliance Architectural Specification

**Document Version:** 1.0.0  
**Status:** Authoritative Japan Regulatory & Compliance Specification for AI Agents (Antigravity, Claude Code, Claude Cowork)  
**Target Scope:** DavinTrade SaaS Platform (Next.js Monolith/Frontend, `operation-service`, `money-service`, `railway-gateway`, Contabo VPS, and Mobile App)  
**Date:** 2026-08-26

---

## 1. Regulatory Context & Japan Legal Landscape

This specification defines the architectural invariants, statutory boundaries, and implementation rules required for DavinTrade when providing analytical trading software and AI chart analysis to residents of Japan.

### 1.1 Key Japanese Regulatory Authorities & Statutes

1. **Japan Financial Services Agency (JFSA — 金融庁)**:
   - **Statute:** Financial Instruments and Exchange Act (FIEA — 金融商品取引法, Act No. 25 of 1948).
   - **Investment Advisory Business Demarcation (投資助言・代理業):** Registration under Article 29 is mandatory for entities providing individualized investment advice.
   - **JFSA Supervisory Guidelines on Software (金融庁事務ガイドライン):** Software tools providing chart analysis and automated mathematical calculations are **exempt from registration** provided they adhere strictly to objective algorithms, do not adapt outputs to individual user portfolios, and do not execute automated trades without user intervention.
2. **Act on Specified Commercial Transactions (ASCT / Tokushoho — 特定商取引法)**:
   - Enforced by the Consumer Affairs Agency (CAA — 消費者庁) and METI.
   - Mandates a statutory **Tokushoho Notation page (`/tokushoho`)** for all B2C digital subscription services targeting Japanese consumers.
3. **Act on the Protection of Personal Information (APPI — 個人情報保護法)**:
   - Enforced by the Personal Information Protection Commission (PPC — 個人情報保護委員会).
   - Regulates cross-border data transfers to foreign cloud infrastructure and individual deletion rights (Article 34).
4. **Japanese Ministry of Economy, Trade and Industry (METI) & MIC (総務省) AI Guidelines**:
   - **AI Operator Guidelines (AI事業者ガイドライン):** Soft-law framework emphasizing transparency, non-deception, and clear user disclosure for generative AI.
5. **National Tax Agency (NTA — 国税庁) JCT 10%**:
   - Japanese Consumption Tax (10%) applies to cross-border digital B2C services supplied to Japanese residents.

---

## 2. Core Compliance Invariants for AI Coding Agents (Japan Jurisdiction)

Every AI Agent executing tasks in this codebase **MUST** enforce the following 4 non-negotiable Japan compliance invariants:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        DAVINTRADE JAPAN COMPLIANCE FRAMEWORK                           │
├────────────────────────────┬─────────────────────────────┬─────────────────────────────┤
│ 1. JFSA NON-ADVISORY SCOPE │ 2. TOKUSHOHO NOTATION       │ 3. JAPANESE RISK WARNING    │
│ • Objective math algorithms│ • Statutory /tokushoho page │ • Margin & leverage risk    │
│ • No personalized advice   │ • Mandatory merchant disclosure disclosure (元本割れ)     │
│ • Execution-only software  │ • Cancellation & refund terms│ • Display on /disclaimer   │
└────────────────────────────┴─────────────────────────────┴─────────────────────────────┘
```

---

### Invariant 1: JFSA Registration Exemption (Analytical Software Demarcation)

To remain strictly within the software provider exemption and avoid unauthorized Investment Advisory activity (無登録投資助言業務):

1. **Mathematical Objectivity:** All trading setups (`TradeSetupCard.tsx`), SSA lines, EDT channels, and centroid regressions must operate exclusively on deterministic quantitative models without human discretionary intervention.
2. **Impersonal Scope:** The system must never solicit or adjust signals based on the user's specific financial situation, account equity, or risk tolerance.
3. **Execution-Only:** The platform must not execute orders directly into broker accounts without explicit, manual confirmation by the user.

---

### Invariant 2: Mandatory Tokushoho Notation Page (`/tokushoho`)

Under the Act on Specified Commercial Transactions, a dedicated route `app/(marketing)/tokushoho/page.tsx` must be maintained, displaying:

1. **Seller Name (販売事業者名):** DavinTrade legal entity or authorized operating representative.
2. **Operations Address & Contact (所在地・連絡先):** Registered operating address, support email, and operational support hours.
3. **Pricing & Additional Fees (販売価格・役務の対価):** All tier prices displayed including 10% JCT tax.
4. **Payment Method (支払方法):** Credit card / digital payments processed via Stripe or dLocal.
5. **Delivery Timing (役務の提供時期):** Immediate activation upon payment confirmation.
6. **Cancellation & Refunds (解約・返金について):** Clear statement that subscriptions may be cancelled anytime via `/settings/billing` with zero termination fees, effective at the end of the current billing cycle.

---

### Invariant 3: Statutory Japanese Risk Disclosure (FIEA Article 37 Compliance)

For Japanese locale views (`ja`), all disclaimer and pricing pages must display the standardized risk notice:

> **「当サービス（DavinTrade）は、客観的なアルゴリズムおよびテクニカル分析指標に基づく市場データの可視化・分析支援ソフトウェアであり、金融商品取引法に基づく投資助言・代理業務を行うものではありません。外国為替証拠金取引（FX）およびコモディティ（XAUUSD等）の証拠金取引は、高いレバレッジにより預託した証拠金を上回る大きな損失が生じるリスクがあります。過去のバックテスト結果やAIによる分析結果は、将来の利益を保証するものではありません。取引に関する最終決定はお客様ご自身の判断と責任において行ってください。」**

---

### Invariant 4: Japanese Consumption Tax (JCT 10%)

- **Stripe Tax Mapping:** Configure Stripe Tax to automatically assess 10% Japanese Consumption Tax (JCT) when the billing address country is `JP` (Japan).

---

## 3. Post-8B Action Plan (Phase 16: Global & Japan Compliance Polish)

All Japan-specific tasks are executed during **Phase 16 (Global Legal & Compliance Polish)** after Master Roadmap Session 8B:

| Task ID   | Target Surface / Component            | Required Japan Compliance Implementation                                    |
| :-------- | :------------------------------------ | :-------------------------------------------------------------------------- |
| **JP-01** | `app/(marketing)/tokushoho/page.tsx`  | Create official Tokushoho statutory notation page.                          |
| **JP-02** | `components/layout/footer.tsx`        | Add "特定商取引法に基づく表記" link in footer navigation.                   |
| **JP-03** | `app/(marketing)/disclaimer/page.tsx` | Embed JFSA-compliant Japanese risk disclosure and non-advisory declaration. |
| **JP-04** | `money-service/src/stripe/`           | Verify Stripe Tax assessment for JCT 10% on Japanese billing transactions.  |

---

## 4. Agent Audit & Verification Checklist

When executing Phase 16, AI Agents must verify:

- [ ] **Tokushoho Page:** Does `/tokushoho` render all required statutory merchant information?
- [ ] **JFSA Disclaimer:** Is the Japanese financial risk warning available in locale files and displayed on `/disclaimer`?
- [ ] **Execution-Only Verification:** Are all automated trading signals clearly labelled as algorithmic calculations?
- [ ] **JCT 10% Calculation:** Does Stripe checkout properly calculate 10% JCT for Japanese addresses?

---

_Authored for DavinTrade Engineering & Compliance Architecture — All rights reserved._

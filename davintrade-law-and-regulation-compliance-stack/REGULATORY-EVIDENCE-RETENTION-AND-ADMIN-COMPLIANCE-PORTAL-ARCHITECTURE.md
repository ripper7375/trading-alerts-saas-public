# Regulatory Evidence Retention & Admin Compliance Portal Architecture Design

**Document Version:** 1.1.0  
**Target Modules:** Global Compliance Infrastructure, Object Storage Retention Vault, and Admin Compliance Portal  
**Jurisdiction Coverage:** EU (EU AI Act / GDPR / MiFID II), US (CFTC / SEC / FTC), UK (FCA / DMCC), Japan (JFSA / FIEA / Tokushoho)  
**Execution Target:** Claude Code (Phase 16 Global Legal & Compliance Polish / Phase 12 Integration)

---

## 📌 1. Executive Summary & Legal Grounding

When operating a FinTech SaaS platform utilizing Generative AI and quantitative trading analytics, the platform will inevitably encounter user inquiries, chargeback disputes, legal claims, or regulatory audits from authorities such as the **US CFTC, UK FCA, Japan JFSA, or European Data Protection Authorities**.

To achieve **Bulletproof Legal Protection**, DavinTrade must maintain an **Immutable, Tamper-Evident Digital Evidence Vault** coupled with a dedicated **Admin Compliance Portal** that allows authorized compliance officers to produce a **Certified Legal Compliance Dossier (PDF & Cryptographic Ledger)** within minutes.

### 1.1 Statutory Legal Grounding for Record Retention:

1. **EU & UK GDPR (Article 17(3)(e)):** The statutory "Right to Erasure" explicitly exempts records necessary _"for the establishment, exercise or defence of legal claims."_
2. **US CFTC Rule 4.41 & CEA Section 4o:** Proof that the platform operates as an impersonal software publisher (Publisher's Exemption) and that all user risk parameters were user-directed simulations.
3. **UK FCA SYSC 9 (Senior Management Systems and Controls — General Rules on Recordkeeping):** Requires financial software entities to maintain orderly records of customer authorizations and terms acceptance for a minimum of **5 years**.
4. **Japan JFSA Supervisory Guidelines & FIEA Article 37:** Proof of statutory risk warnings and evidence that the platform never engaged in discretionary unauthorized investment advice.

---

## 🏛️ 2. The 4 Pillars of Digital Evidence Collection

The DavinTrade platform systematically captures and cryptographically signs digital evidence across **4 foundational pillars**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          4 PILLARS OF DIGITAL LEGAL EVIDENCE                           │
├────────────────────────────┬────────────────────────────┬──────────────────────────────┤
│ 1. STATUTORY CONSENT       │ 2. USER CONSTRAINTS (ENG 4)│ 3. AI PROVENANCE & CHAT LOGS │
│ • Terms of Service Version │ • 9 Metrics Snapshots      │ • Prompt Assembly Context    │
│ • CFD / Risk Warnings      │ • Confirmation Timestamps  │ • Model ID & Provenance Tags │
│ • AI Status Acknowledgment │ • Mid-Session Mutations    │ • Raw SSE Responses          │
├────────────────────────────┴────────────────────────────┴──────────────────────────────┤
│ 4. FINANCIAL & IDENTITY LEDGER                                                         │
│ • Stripe / dLocal Customer IDs • Billing Transaction Receipts • Deletion Receipt Tokens│
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔐 3. Cryptographic Anonymization & GDPR-Compliant Deletion Architecture

To reconcile **GDPR Article 17 (Right to Erasure)** with **Article 17(3)(e) (Legal Defense Retention)**, DavinTrade employs a **Two-Tier Cryptographic Pseudonymization Engine**:

```
[ User Submits Account Deletion Request (Flag F21 Worker) ]
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│               STEP 1: PURGE DIRECT IDENTIFIABLE PII                     │
│ • Hard-delete Name, Email, Phone, Password Hash, Billing Address from:  │
│   `users`, `profiles`, `accounts`, `sessions` tables                    │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│          STEP 2: CRYPTOGRAPHIC PSEUDONYMIZATION OF AUDIT LEDGER         │
│ • Compute Salted HMAC-SHA256 Hash of original User Identifier:          │
│   `user_id_hash` = HMAC-SHA256(Original_Email, SERVER_LEGAL_PEPPER)     │
│ • Replace plain `user_id` with `user_id_hash` in audit tables           │
│ • Generate a Unique Deletion Receipt Token: `DEL-2026-X89F2A`           │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│             STEP 3: SECURE IMMUTABLE RETENTION VAULT                    │
│ • Retain audit snapshots for statutory limitation period (5–7 Years)    │
│ • Inaccessible to general public or non-privileged users                │
│ • Searchable exclusively by Compliance Admins via HMAC Hash matching    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ 4. Database Schema for the Regulatory Retention Vault

The Regulatory Retention Vault consists of 3 immutable tables in PostgreSQL:

```sql
-- 1. Statutory Consent & Terms Acceptance Ledger
CREATE TABLE IF NOT EXISTS user_legal_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_id_hash VARCHAR(64), -- Populated on account deletion
  consent_type VARCHAR(50) NOT NULL, -- 'TERMS_OF_SERVICE' | 'CFD_RISK_WARNING' | 'EU_AI_ACT_DISCLOSURE' | 'EXECUTION_ONLY_DECLARATION'
  document_version VARCHAR(20) NOT NULL, -- e.g. 'v1.3.0'
  ip_address VARCHAR(45) NOT NULL,
  user_agent TEXT NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_legal_consents_user_id ON user_legal_consents(user_id);
CREATE INDEX idx_legal_consents_hash ON user_legal_consents(user_id_hash);

-- 2. Engine 4 User Constraints & Preferences History (From ENGINE-4 Spec)
CREATE TABLE IF NOT EXISTS user_trade_preferences_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_id_hash VARCHAR(64), -- Populated on account deletion
  session_id VARCHAR(64),
  trader_type VARCHAR(20) NOT NULL,
  trading_style VARCHAR(35) NOT NULL,
  risk_per_trade_pct NUMERIC(4,2) NOT NULL,
  max_leverage VARCHAR(10) NOT NULL,
  target_rrr NUMERIC(4,2) NOT NULL,
  custom_equity_balance NUMERIC(12,2) NOT NULL,
  min_stop_loss_distance NUMERIC(8,2) NOT NULL,
  round_trip_commission NUMERIC(6,2) NOT NULL,
  lookback_bars INT NOT NULL,
  change_source VARCHAR(40) DEFAULT 'INITIAL_SESSION_GATE' NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_user_prefs_hist_hash ON user_trade_preferences_history(user_id_hash, recorded_at DESC);

-- 3. Admin Compliance Access & Audit Log (Super Admin Oversight)
CREATE TABLE IF NOT EXISTS admin_compliance_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  admin_email VARCHAR(255) NOT NULL,
  target_identifier_searched VARCHAR(255) NOT NULL, -- Salted hash or token searched
  action_type VARCHAR(50) NOT NULL, -- 'LOOKUP_DOSSIER' | 'EXPORT_CERTIFIED_PDF'
  ip_address VARCHAR(45) NOT NULL,
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

---

## ☁️ 5. Object Storage Architecture & WORM Compliance Retention

While structured metadata is queried in PostgreSQL, raw evidentiary payloads (Generated Certified PDFs, daily JSON audit dumps, and session transcripts) require a **Dedicated Immutable Object Storage Architecture**.

### 5.1 Storage Technology Evaluation: AWS S3 vs. Cloudflare R2

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                        OBJECT STORAGE SELECTION MATRIX FOR COMPLIANCE VAULT                            │
├─────────────────────┬──────────────────────────────────────────┬───────────────────────────────────────┤
│ Dimension           │ **AWS S3 (+ S3 Object Lock & Glacier)**  │ **Cloudflare R2**                     │
├─────────────────────┼──────────────────────────────────────────┼───────────────────────────────────────┤
│ **WORM Compliance** │ ⭐⭐⭐⭐⭐ **The Gold Standard**           │ ⭐⭐⭐ Basic Object Retention          │
│ *(Legal Weight)*    │ Certified under **SEC 17a-4 / CFTC 1.31**│ General WORM support; lacks specialized│
│                     │ Irrefutable tamper-proof legal standing  │ financial court precedent certifications│
├─────────────────────┼──────────────────────────────────────────┼───────────────────────────────────────┤
│ **7-Year Cost**     │ ⭐⭐⭐⭐⭐ **Ultra-Low Cost Glacier**       │ ⭐⭐⭐ Standard Flat Pricing          │
│ *(Cold Archive)*    │ **$0.00099 / GB / month** (Deep Archive) │ **$0.015 / GB / month** (15x higher)  │
├─────────────────────┼──────────────────────────────────────────┼───────────────────────────────────────┤
│ **Egress Fees**     │ ⭐⭐⭐ Charged on download (~$0.09/GB)   │ ⭐⭐⭐⭐⭐ **Zero Egress Fees**         │
│                     │ *(Negligible for rare legal lookups)*    │ Ideal for active web assets           │
├─────────────────────┼──────────────────────────────────────────┼───────────────────────────────────────┤
│ **Key Management**  │ **AWS KMS Hardware Security Module (HSM)**│ Standard AES-256 Server Encryption   │
└─────────────────────┴──────────────────────────────────────────┴───────────────────────────────────────┘
```

> [!IMPORTANT]
> **Authoritative Decision:** DavinTrade selects **AWS S3 with S3 Object Lock (Compliance Mode)** as the primary Regulatory Evidence Vault because of its **SEC/CFTC WORM compliance certifications and sub-dollar long-term Glacier archival pricing**.

---

### 5.2 S3 Bucket Structure & Partition Hierarchy

```text
s3://davintrade-legal-compliance-vault/
├── consents/               # Statutory Consent Signatures & Metadata
│   └── YYYY/MM/
│       └── {user_id_hash}_{consent_id}.json
├── preferences_history/    # Engine 4 Constraints Snapshot Dumps
│   └── YYYY/MM/
│       └── {user_id_hash}_{session_id}_{timestamp}.json
├── chat_transcripts/       # Verified AI Chat Transcripts with Machine Provenance
│   └── YYYY/MM/
│       └── {session_id}.jsonl
├── certified_dossiers/     # Generated Certified Legal Compliance PDF Reports
│   └── YYYY/MM/
│       └── {dossier_id}_{user_id_hash}.pdf
└── deletion_certificates/  # Immutable Deletion Receipt Ledger
    └── YYYY/MM/
        └── {deletion_token}.json
```

---

### 5.3 S3 Object Lock & Lifecycle Transition Policy

```
[ Day 0: Artifact Uploaded to S3 ]
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│ S3 Object Lock: COMPLIANCE MODE (Strict WORM)          │
│ • Retention Period: 7 Years (2,555 Days)               │
│ • Deletion/Mutation Blocked for ALL users (inc. Root)  │
└────────────────┬───────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│ S3 Intelligent-Tiering / Standard (Days 1–90)          │
│ • Immediate sub-second retrieval for active inquiries  │
└────────────────┬───────────────────────────────────────┘
                 │ (After 90 Days)
                 ▼
┌────────────────────────────────────────────────────────┐
│ Transition to S3 Glacier Flexible / Deep Archive       │
│ • Cost drops to $0.00099/GB/month ($1/TB/month)        │
│ • Retained securely until statutory 7-year lock expires│
└────────────────────────────────────────────────────────┘
```

---

## 🖥️ 6. Admin Compliance & Legal Portal Specification

### 6.1 Portal Route & Security Guardrails

- **Route:** `app/(admin)/admin/compliance/page.tsx`
- **Access Level:** Strictly restricted to `SUPER_ADMIN` and `COMPLIANCE_OFFICER` roles.
- **Security Requirements:**
  1. Mandatory Multi-Factor Authentication (2FA) enforced on every login.
  2. Every single search, view, or export action generates an immutable row in `admin_compliance_audit_logs`.
  3. No bulk scraping: Search must be targeted by individual user identifier.

### 6.2 Interactive Search & Lookup Engine

The portal supports exact matching across 4 lookup keys:

1. **Original Registration Email:** Calculates `HMAC-SHA256(Email, Pepper)` and queries database.
2. **User UUID:** Internal database identifier.
3. **Deletion Receipt Token:** e.g., `DEL-2026-X89F2A`.
4. **Payment Gateway Identifier:** Stripe Customer ID (`cus_...`) or Transaction ID (`ch_...`).

---

### 6.3 Portal User Interface Architecture (4-Quadrant Dossier View)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                        DAVINTRADE ADMIN COMPLIANCE & LEGAL PORTAL                                      │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 🔍 Lookup Target: [ user@example.com / DEL-2026-X89F2A           ] [ 🔎 Search Legal Record ]          │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Status: ✅ MATCH FOUND  | Account State: DELETED (GDPR Anonymized) | Deletion Date: 2026-08-27 15:00 UTC│
├──────────────────────────────────────────────────────────────────┬─────────────────────────────────────┤
│ 📜 QUADRANT 1: STATUTORY CONSENT TIMELINE                        │ ⚙️ QUADRANT 2: ENGINE 4 CONSTRAINTS │
│ • Terms of Service v1.3.0  (Accepted: 2026-08-01 10:15 UTC)      │ Latest Confirmed Snapshot:          │
│ • CFD Risk Warning PS19/18 (Accepted: 2026-08-01 10:15 UTC)      │ • Trader: Day Trader (<12h)         │
│ • EU AI Act Art 50 Notice  (Accepted: 2026-08-01 10:15 UTC)      │ • Style: Trend Following            │
│ • Non-Advisory Declaration (Accepted: 2026-08-01 10:15 UTC)      │ • Max Risk: 1.50% | RRR: 1.75x      │
│   IP: 198.51.100.42 | Browser: Chrome 127 / macOS                │ • Leverage: 1:1.50x | Equity: $5,000│
├──────────────────────────────────────────────────────────────────┼─────────────────────────────────────┤
│ 💬 QUADRANT 3: AI INTERACTION & PROVENANCE TRANSCRIPTS           │ 💳 QUADRANT 4: FINANCIAL AUDIT TRAIL│
│ Session ID: `sess_89f2a_xauusd`                                  │ Stripe Customer: `cus_Q98FzX...`    │
│ • User Prompt: "Analyze XAUUSD M5 for Buy Setup"                 │ • Tier: PRO Monthly ($49.00/mo)     │
│ • AI Response: "Based on your 1.5% risk & 1.75 RRR bounds..."    │ • Charge ID: `ch_3Pv8...` (Paid)    │
│ • Model: Gemini 3.6 Flash | Provenance Tag: Verified             │ • Active Billing Period: Verified   │
├──────────────────────────────────────────────────────────────────┴─────────────────────────────────────┤
│ 📥 ACTION: [ 📄 Export Certified Compliance Dossier (Signed PDF) ]  [ 📦 Export Raw JSON Evidence Zip ] │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📄 7. Certified Legal Compliance Dossier (Export Output)

When an Admin clicks **`Export Certified Compliance Dossier`**, the backend generates a cryptographically signed PDF document stored in the S3 vault containing:

1. **Header & Watermark:** Official DavinTrade Legal Compliance Certificate with Timestamp and Verification Hash.
2. **Legal Demarcation Declaration:** Statutory statement certifying that DavinTrade operated strictly as an automated calculation tool under the user's explicit instructions.
3. **Chronological Evidence Table:** Complete timeline of Terms accepted, Engine 4 constraints locked, and AI recommendations delivered.
4. **Cryptographic SHA-256 Checksum:** Embedded digital fingerprint ensuring the PDF cannot be tampered with after generation.

---

## 📋 8. Implementation Checklist for Claude Code

When executing Phase 16 (Global Legal & Compliance Polish):

- [ ] **Database Migration:** Create `user_legal_consents` and `admin_compliance_audit_logs` tables in Prisma schema.
- [ ] **S3 Bucket Provisioning:** Provision `davintrade-legal-compliance-vault` with S3 Object Lock in Compliance Mode (7-year default retention) and KMS encryption.
- [ ] **S3 Lifecycle Rules:** Configure 90-day transition to S3 Glacier Flexible Retrieval.
- [ ] **Cryptographic Utility:** Implement `lib/compliance/crypto-vault.ts` for Salted HMAC-SHA256 hashing and Deletion Token generation.
- [ ] **Account Deletion Hook:** Wire Flag F21 Account Deletion Worker to pseudonymize `user_id` across audit tables and push deletion certificates to S3.
- [ ] **Admin API Routes:**
  - `POST /api/admin/compliance/search` (Search audit records by email/hash/token)
  - `POST /api/admin/compliance/export-dossier` (Generate Certified PDF Dossier and save to S3)
- [ ] **Admin UI Portal:** Build `app/(admin)/admin/compliance/page.tsx` with 4-Quadrant Dossier display and RBAC authorization guard.
- [ ] **PDF Generator Engine:** Implement server-side PDF generator (using `@react-pdf/renderer` or `pdfkit`) with cryptographic watermark and SHA-256 seal.
- [ ] **Audit Logging Guard:** Ensure all admin search queries are logged to `admin_compliance_audit_logs`.

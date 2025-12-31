# Security Baseline - Trading Alerts SaaS V7

**Version:** 1.0.0
**Last Updated:** 2025-12-31
**Status:** Pre-Launch Certified

---

## Overview

This document establishes the security baseline for Trading Alerts SaaS V7. It defines the security controls, configurations, and standards that must be maintained in production.

---

## 1. Authentication Security

### 1.1 Session Management

| Setting | Value | File |
|---------|-------|------|
| Session Strategy | JWT | `lib/auth/auth-options.ts` |
| Session Max Age | 30 days | `lib/auth/auth-options.ts` |
| Cookie httpOnly | true | `lib/auth/auth-options.ts` |
| Cookie secure | true (production) | `lib/auth/auth-options.ts` |
| Cookie sameSite | lax | `lib/auth/auth-options.ts` |

### 1.2 Cookie Prefixes (Production)

| Cookie | Prefix | Purpose |
|--------|--------|---------|
| Session Token | `__Secure-` | HTTPS-only session |
| Callback URL | `__Secure-` | HTTPS-only callback |
| CSRF Token | `__Host-` | Origin-bound CSRF protection |

### 1.3 Password Requirements

| Requirement | Minimum |
|-------------|---------|
| Length | 8 characters |
| Uppercase | 1 character |
| Lowercase | 1 character |
| Numbers | 1 digit |
| Special Characters | 1 character |
| Maximum Length | 128 characters |

### 1.4 Token Security

| Token Type | Generation Method | Storage |
|------------|-------------------|---------|
| Verification Tokens | `crypto.randomBytes(32)` | Hashed (SHA-256) |
| Password Reset Tokens | `crypto.randomBytes(32)` | Hashed (SHA-256) |
| Session Tokens | `crypto.randomBytes(64)` | JWT signed |
| API Keys | `crypto.randomBytes(24)` | Hashed |

---

## 2. HTTP Security Headers

### 2.1 Required Headers

| Header | Value | Purpose |
|--------|-------|---------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Force HTTPS |
| `X-Frame-Options` | `SAMEORIGIN` | Prevent clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS protection |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Control referrer info |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Disable unused features |

### 2.2 Content Security Policy

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://checkout.stripe.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://*.googleusercontent.com https://*.githubusercontent.com https://*.stripe.com;
font-src 'self' data:;
connect-src 'self' https://api.stripe.com https://checkout.stripe.com wss://*.pusher.com https://*.vercel-analytics.com;
frame-src 'self' https://js.stripe.com https://checkout.stripe.com;
frame-ancestors 'self';
form-action 'self';
base-uri 'self';
object-src 'none';
```

---

## 3. Payment Security

### 3.1 Stripe Integration

| Control | Implementation |
|---------|----------------|
| Webhook Signature Verification | `constructWebhookEvent()` with HMAC |
| Price Determination | Server-side from `STRIPE_PRO_PRICE_ID` |
| User Identification | From authenticated session, not client |
| Card Handling | Stripe handles all PCI data |

### 3.2 dLocal Integration

| Control | Implementation |
|---------|----------------|
| Webhook Signature Verification | `verifyWebhookSignature()` with HMAC |
| Raw Body Preservation | `request.text()` for signature |
| Error Handling | Returns 400 on invalid signature |

---

## 4. Database Security

### 4.1 Query Security

| Control | Implementation |
|---------|----------------|
| ORM | Prisma (parameterized queries) |
| Raw Queries | Only `SELECT 1` for health checks |
| User Data Access | Session/webhook verified user IDs |

### 4.2 Sensitive Data

| Data Type | Protection |
|-----------|------------|
| Passwords | bcrypt hashed |
| Tokens | SHA-256 hashed |
| API Keys | SHA-256 hashed |
| Session Data | JWT encrypted |

---

## 5. Input Validation

### 5.1 Validation Framework

- **Library:** Zod
- **Location:** `lib/validations/`
- **Coverage:** All API inputs

### 5.2 Validation Rules

| Input Type | Validations |
|------------|-------------|
| Email | trim, lowercase, format, length (5-254) |
| Password | complexity, length (8-128) |
| Symbols | enum validation, tier check |
| IDs | string, min length |

---

## 6. Environment Security

### 6.1 Required Environment Variables

**Critical (Must be set):**
- `NEXTAUTH_SECRET` - Session encryption
- `NEXTAUTH_URL` - Production URL
- `DATABASE_URL` - Database connection

**Authentication:**
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET`

**Payments:**
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

### 6.2 Secret Generation

```bash
# NextAuth Secret
openssl rand -base64 32

# API Keys
openssl rand -hex 32

# Database Password
openssl rand -base64 24
```

---

## 7. CI/CD Security

### 7.1 Automated Checks

| Check | Trigger | Tool |
|-------|---------|------|
| Dependency Audit | Push, PR | `pnpm audit` |
| Type Checking | Push, PR | TypeScript |
| Linting | Push, PR | ESLint |
| Tests | Push, PR | Jest |

### 7.2 Branch Protection

- Require PR reviews before merge
- Require status checks to pass
- No force push to main

---

## 8. Monitoring & Logging

### 8.1 Security Events to Log

- Authentication failures
- Webhook signature failures
- Payment failures
- Rate limit exceeded
- Unauthorized access attempts

### 8.2 Sensitive Data in Logs

**Never log:**
- Passwords
- API keys
- Full credit card numbers
- Session tokens

**Safe to log:**
- User IDs
- Email (masked: u***@example.com)
- Last 4 digits of card
- Request IDs

---

## 9. Compliance Checklist

### Pre-Launch

- [x] HTTPS enforced (HSTS)
- [x] Secure cookies configured
- [x] CSP implemented
- [x] Webhook signatures verified
- [x] Passwords properly hashed
- [x] Input validation on all endpoints
- [x] No secrets in source code
- [x] Dependency vulnerabilities fixed

### Ongoing

- [ ] Weekly dependency audits
- [ ] Monthly security review
- [ ] Quarterly penetration testing
- [ ] Annual security audit

---

## 10. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-31 | Initial security baseline |

---

## Contact

For security issues, contact: security@davintrade.com

For vulnerability reports, use responsible disclosure.

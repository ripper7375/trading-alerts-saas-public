Phase 6 Pre-Launch security testing and auditing :
├─ Test EXISTING code security
├─ Find vulnerabilities
├─ Fix critical issues
└─ Validate safe for MVP launch

---

## Why Pre-Launch Security Testing and Auditing?

### **What Security Scans Catch (That Other Tests Don't)**

Functional tests verify features work, but **don't catch:**

- ❌ Vulnerable npm packages (remote code execution)
- ❌ Hardcoded API keys in code
- ❌ SQL injection vulnerabilities
- ❌ XSS attack vectors
- ❌ Insecure authentication flows
- ❌ Missing HTTPS enforcement
- ❌ Weak password validation
- ❌ Exposed environment variables

**Security scans find these BEFORE attackers do.**

---

## Security Testing Strategy (2-3 Days)

### **Day 1: Automated Scanning (Critical)**

- ✅ npm audit (dependency vulnerabilities)
- ✅ Snyk comprehensive scan
- ✅ Semgrep (static code analysis)
- ✅ Fix CRITICAL and HIGH vulnerabilities

### **Day 2: Web Application Security**

- ✅ OWASP ZAP automated scan
- ✅ Manual authentication testing
- ✅ Payment flow security review
- ✅ Fix identified issues

### **Day 3: Hardening & Documentation**

- ✅ Environment variable audit
- ✅ Security checklist verification
- ✅ Document security baseline
- ✅ Create security runbook

---

## Tool Setup & Installation

### **Tool 1: npm audit (Built-in)**

**Already available** - no installation needed.

```bash
# Check for vulnerabilities
npm audit

# See detailed report
npm audit --json > audit-report.json

# Fix automatically (review first!)
npm audit fix

# Only fix production dependencies
npm audit fix --only=prod
```

---

### **Tool 2: Snyk (Comprehensive)**

**Install:**

```bash
npm install -g snyk

# Or use npx (no installation)
npx snyk
```

**Setup:**

```bash
# Authenticate (free tier: 500 tests/month)
snyk auth

# Test current project
snyk test

# Monitor for new vulnerabilities
snyk monitor
```

**Add to package.json:**

```json
{
  "scripts": {
    "security:scan": "snyk test",
    "security:monitor": "snyk monitor"
  }
}
```

---

### **Tool 3: OWASP ZAP**

**Install via Docker (easiest):**

```bash
docker pull owasp/zap2docker-stable

# Verify installation
docker run owasp/zap2docker-stable zap.sh -version
```

**Alternative (Desktop App):**

- Download from: https://www.zaproxy.org/download/
- Install ZAP desktop for manual testing

---

### **Tool 4: Semgrep**

**Install:**

```bash
# Via pip
pip3 install semgrep

# Or via Homebrew (macOS)
brew install semgrep

# Verify
semgrep --version
```

---

## Day 1: Automated Security Scanning

### **Task 1.1: npm audit (30 minutes)**

**Run comprehensive audit:**

```bash
# Full audit
npm audit

# Save report
npm audit --json > reports/npm-audit-$(date +%Y%m%d).json

# Check severity levels
npm audit --audit-level=high
```

**Interpret results:**

```
┌───────────────┬──────────────────────────────────────────┐
│ High          │ Prototype Pollution                      │
├───────────────┼──────────────────────────────────────────┤
│ Package       │ lodash                                   │
├───────────────┼──────────────────────────────────────────┤
│ Patched in    │ >=4.17.21                               │
├───────────────┼──────────────────────────────────────────┤
│ Dependency of │ some-package                            │
├───────────────┼──────────────────────────────────────────┤
│ Path          │ node_modules/lodash                     │
└───────────────┴──────────────────────────────────────────┘
```

**Action items:**

```bash
# Fix automatically (REVIEW FIRST!)
npm audit fix

# If can't auto-fix, update manually
npm update lodash

# Or find alternative package
```

**Document findings:**
Create `reports/npm-audit-report.md`:

```markdown
# npm Audit Report - 2025-12-15

## Critical Vulnerabilities

- None found ✅

## High Vulnerabilities

- lodash@4.17.15: Prototype Pollution
  - Fixed by: npm update lodash
  - New version: 4.17.21
  - Status: FIXED ✅

## Medium Vulnerabilities

- (List and status)

## Low Vulnerabilities

- (List and accepted risks)

## Actions Taken

1. Updated lodash to 4.17.21
2. Updated axios to latest
3. Removed unused dependencies

## Remaining Risks

- None critical
- 2 medium risks accepted (document why)
```

---

### **Task 1.2: Snyk Comprehensive Scan (45 minutes)**

**Run Snyk test:**

```bash
# Test all projects
snyk test --all-projects

# Test with specific severity
snyk test --severity-threshold=high

# Generate JSON report
snyk test --json > reports/snyk-report-$(date +%Y%m%d).json

# Generate HTML report
snyk test --json | snyk-to-html -o reports/snyk-report.html
```

**Monitor for ongoing vulnerabilities:**

```bash
# Set up monitoring (checks daily)
snyk monitor

# View results at: https://app.snyk.io
```

**Fix identified issues:**

```bash
# Snyk provides fix suggestions
snyk wizard

# Or fix manually
npm install package@version
```

**Critical checks:**

```bash
# Check for license issues
snyk test --show-licenses

# Check container (if using Docker)
docker build -t trading-alerts .
snyk container test trading-alerts
```

**Document in `reports/snyk-report.md`:**

```markdown
# Snyk Security Report

## Overview

- Date: 2025-12-15
- Vulnerabilities found: 12
- Critical: 0 ✅
- High: 2 ⚠️
- Medium: 5
- Low: 5

## High Severity Issues

### 1. SQL Injection in pg@8.7.1

**Package:** pg (PostgreSQL client)
**Severity:** High (7.5 CVSS)
**Introduced:** package.json
**Fixed in:** pg@8.11.0
**Action:** `npm install pg@8.11.0`
**Status:** FIXED ✅

### 2. ReDoS in validator@13.7.0

**Severity:** High (7.8 CVSS)
**Fixed in:** validator@13.11.0
**Action:** `npm install validator@13.11.0`
**Status:** FIXED ✅

## Accepted Risks

- (Document any vulnerabilities you accept and why)
```

---

### **Task 1.3: Semgrep Static Analysis (1 hour)**

**Run Semgrep with security rulesets:**

```bash
# Auto-detect project and run security rules
semgrep --config=auto .

# Specific security rulesets
semgrep --config=p/security-audit \
        --config=p/owasp-top-ten \
        --config=p/typescript \
        --json --output=reports/semgrep-$(date +%Y%m%d).json .

# Only show high/critical
semgrep --config=p/security-audit --severity ERROR --severity WARNING .
```

**Common issues Semgrep finds:**

**1. Hardcoded Secrets:**

```javascript
// ❌ CRITICAL: Hardcoded secret
const stripe = new Stripe('sk_live_ABC123XYZ');

// ✅ FIXED: Use environment variable
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
```

**2. SQL Injection:**

```javascript
// ❌ CRITICAL: SQL injection vulnerability
const query = `SELECT * FROM users WHERE email = '${email}'`;

// ✅ FIXED: Use parameterized query (Prisma does this)
const user = await prisma.user.findUnique({ where: { email } });
```

**3. Insecure Random:**

```javascript
// ❌ HIGH: Weak random for security tokens
const token = Math.random().toString(36);

// ✅ FIXED: Use crypto
const token = crypto.randomBytes(32).toString('hex');
```

**4. Command Injection:**

```javascript
// ❌ CRITICAL: Command injection
exec(`convert ${filename} output.png`);

// ✅ FIXED: Validate input
const safeName = path.basename(filename);
exec(`convert ${safeName} output.png`);
```

**Fix all CRITICAL and HIGH issues.**

**Document in `reports/semgrep-report.md`:**

```markdown
# Semgrep Static Analysis Report

## Critical Issues Found: 3

### 1. Hardcoded Stripe Secret Key

**File:** lib/stripe/client.ts:15
**Severity:** CRITICAL
**Issue:** Hardcoded API key in source code
**Fix:** Moved to environment variable
**Status:** FIXED ✅

### 2. SQL Injection Risk

**File:** app/api/search/route.ts:42
**Severity:** CRITICAL
**Issue:** String concatenation in SQL query
**Fix:** Switched to Prisma parameterized query
**Status:** FIXED ✅

### 3. Weak Random Token Generation

**File:** lib/utils/tokens.ts:8
**Severity:** HIGH
**Issue:** Math.random() used for security token
**Fix:** Changed to crypto.randomBytes()
**Status:** FIXED ✅

## Other Findings

- Medium: 8 issues (all fixed)
- Low: 12 issues (reviewed, 10 fixed, 2 accepted)
```

---

## Day 2: Web Application Security Testing

### **Task 2.1: OWASP ZAP Baseline Scan (1 hour)**

**Run automated baseline scan:**

```bash
# Baseline scan (passive only)
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://your-staging-url.com \
  -r reports/zap-baseline-$(date +%Y%m%d).html

# Generate JSON report
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://your-staging-url.com \
  -J reports/zap-baseline-$(date +%Y%m%d).json
```

**Common findings:**

**1. Missing Security Headers:**

```
⚠️ HIGH: X-Frame-Options header not set
Risk: Clickjacking attacks
Fix: Add in middleware or next.config.js
```

**2. Weak HTTPS Configuration:**

```
⚠️ MEDIUM: HTTP Strict Transport Security not enforced
Risk: Man-in-the-middle attacks
Fix: Add HSTS header (will be in Phase 2A)
```

**3. Cookies Not Secure:**

```
⚠️ HIGH: Session cookie missing Secure flag
Risk: Cookie theft over HTTP
Fix: Ensure all cookies have secure: true
```

**Fix critical findings:**

```typescript
// Fix: Secure session cookies
export const authOptions = {
  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production', // HTTPS only
      },
    },
  },
};
```

---

### **Task 2.2: Authenticated ZAP Scan (1.5 hours)**

**Set up authenticated scanning:**

Create `zap-auth.context`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <context>
        <name>Trading Alerts Auth</name>
        <authentication>
            <type>0</type>
            <strategy>FORM_BASED</strategy>
            <loginUrl>https://your-app.com/api/auth/signin</loginUrl>
            <loginBody>email={%username%}&amp;password={%password%}</loginBody>
        </authentication>
        <users>
            <user>
                <name>test-user</name>
                <credentials>
                    <username>security-test@example.com</username>
                    <password>SecureTestPass123!</password>
                </credentials>
            </user>
        </users>
    </context>
</configuration>
```

**Run authenticated scan:**

```bash
# Full scan with authentication
docker run -v $(pwd):/zap/wrk/:rw -t owasp/zap2docker-stable \
  zap-full-scan.py \
  -t https://your-app.com \
  -n /zap/wrk/zap-auth.context \
  -r /zap/wrk/reports/zap-full-scan.html
```

**Test critical endpoints:**

- [ ] Login/signup flows
- [ ] Password reset
- [ ] Checkout/payment
- [ ] Affiliate dashboard
- [ ] Admin panel
- [ ] API endpoints

---

### **Task 2.3: Manual Security Tests (1 hour)**

**Authentication Security:**

```bash
# Test 1: Password requirements
curl -X POST https://your-app.com/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"weak"}'

# Should reject: 400 Bad Request ✅

# Test 2: SQL injection in login
curl -X POST https://your-app.com/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"' OR '1'='1"}'

# Should reject: 401 Unauthorized ✅

# Test 3: Session fixation
# Login twice, verify different session tokens

# Test 4: Brute force protection
# Make 20 failed login attempts, verify lockout
```

**Payment Security:**

```bash
# Test 1: Webhook signature verification
curl -X POST https://your-app.com/api/webhooks/stripe \
  -H "stripe-signature: invalid" \
  -d '{"type":"test"}'

# Should reject: 400 Bad Request ✅

# Test 2: Amount manipulation
# Try changing checkout amount client-side
# Server should use server-side amount ✅
```

**Authorization Tests:**

```bash
# Test 1: FREE user accessing PRO endpoint
curl https://your-app.com/api/charts/EURUSD/H1 \
  -H "Authorization: Bearer {FREE_USER_TOKEN}"

# Should reject: 403 Forbidden ✅

# Test 2: Non-admin accessing admin endpoint
curl https://your-app.com/api/admin/users \
  -H "Authorization: Bearer {REGULAR_USER_TOKEN}"

# Should reject: 403 Forbidden ✅
```

**Document findings in `reports/manual-security-tests.md`**

---

### **Task 2.4: Security Headers Check (30 minutes)**

**Check current security headers:**

```bash
curl -I https://your-staging-url.com

# Expected (before Phase 2A):
HTTP/2 200
x-powered-by: Next.js          ⚠️ Should hide
strict-transport-security: ?    ❌ Missing (Phase 2A)
x-frame-options: ?             ❌ Missing (Phase 2A)
x-content-type-options: ?      ❌ Missing (Phase 2A)
content-security-policy: ?     ❌ Missing (Phase 2A)
```

**For MVP launch, ensure minimum security:**

```javascript
// next.config.js - Add basic headers
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
};
```

---

## Day 3: Hardening & Documentation

### **Task 3.1: Environment Variable Audit (45 minutes)**

**Check for security issues:**

```bash
# Find hardcoded secrets (should be ZERO)
grep -r "sk_live" --include="*.ts" --include="*.tsx" src/

# Find API keys in code
grep -r "API_KEY" --include="*.ts" --include="*.tsx" src/

# Check .env files are gitignored
cat .gitignore | grep .env
```

**Verify .env.local security:**

```bash
# .env.local should contain:
- Database passwords
- API keys (Stripe, dLocal)
- NextAuth secret
- Upstash tokens (if using)
- Sentry DSN

# .env.example should contain:
- Placeholder values only
- No real secrets
- Clear documentation
```

**Environment variable checklist:**

- [ ] No secrets in source code
- [ ] All .env files in .gitignore
- [ ] .env.example has placeholders only
- [ ] Production secrets different from staging
- [ ] Secrets rotated before launch
- [ ] Vercel environment variables configured
- [ ] NextAuth secret is cryptographically random

**Generate secure secrets:**

```bash
# Generate NextAuth secret
openssl rand -base64 32

# Generate database password
openssl rand -hex 32

# Generate webhook secret
openssl rand -hex 24
```

---

### **Task 3.2: Payment Security Review (1 hour)**

**Stripe integration checklist:**

```typescript
// ✅ 1. Webhook signature verification
const sig = request.headers['stripe-signature'];
const event = stripe.webhooks.constructEvent(
  request.body,
  sig,
  process.env.STRIPE_WEBHOOK_SECRET
);

// ✅ 2. Never expose secret key to client
// Check: Secret key ONLY in server-side code

// ✅ 3. Amount validation server-side
const session = await stripe.checkout.sessions.create({
  line_items: [
    {
      price_data: {
        currency: 'usd',
        product_data: { name: 'PRO Plan' },
        unit_amount: 2900, // Server-controlled, not from client
      },
      quantity: 1,
    },
  ],
});

// ✅ 4. User verification
const userId = session.user.id; // From server session, not client

// ✅ 5. Idempotency
const session = await stripe.checkout.sessions.create(
  {
    // ...
  },
  {
    idempotencyKey: `checkout_${userId}_${Date.now()}`,
  }
);
```

**dLocal integration checklist:**

```typescript
// ✅ 1. Signature verification
function verifyDLocalSignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac('sha256', process.env.DLOCAL_SECRET_KEY!)
    .update(body)
    .digest('hex');
  return hash === signature;
}

// ✅ 2. Server-side amount control
// ✅ 3. User verification
// ✅ 4. Error handling
```

---

### **Task 3.3: Database Security (45 minutes)**

**Prisma security checklist:**

```typescript
// ✅ 1. Use Prisma (prevents SQL injection)
// All queries use parameterized statements

// ✅ 2. Connection pooling configured
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // connection_limit = 10 // If needed
}

// ✅ 3. Sensitive data encrypted (if storing)
// Example: Credit card last 4 digits
async function encryptCardInfo(last4: string): Promise<string> {
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'),
    iv
  );
  // ... encryption logic
}

// ✅ 4. User data access control
// Users can only query their own data
const alerts = await prisma.alert.findMany({
  where: {
    userId: session.user.id // Always filter by authenticated user
  }
});
```

**Database credentials:**

- [ ] Password strength ≥ 20 characters
- [ ] User has minimum required permissions
- [ ] SSL/TLS enforced for connections
- [ ] IP whitelist configured (if possible)
- [ ] Regular backups configured

---

### **Task 3.4: Security Baseline Documentation (30 minutes)**

**Create `docs/SECURITY-BASELINE.md`:**

````markdown
# Security Baseline - MVP Launch

**Date:** 2025-12-15
**Version:** v7 MVP
**Status:** Pre-Launch Validation Complete

## Security Posture Summary

### Implemented (Phase 6)

- ✅ Dependency vulnerability scanning (npm audit, Snyk)
- ✅ Static code analysis (Semgrep)
- ✅ Web application security testing (OWASP ZAP)
- ✅ Authentication security (NextAuth.js)
- ✅ Payment security (Stripe/dLocal signatures)
- ✅ Input validation (Zod schemas)
- ✅ Environment variable protection
- ✅ Database security (Prisma parameterized queries)

### Not Yet Implemented (Phase 2A - Post-Launch)

- ⏸️ Security headers (CSP, HSTS, X-Frame-Options)
- ⏸️ CORS configuration
- ⏸️ Rate limiting (DDoS protection)
- ⏸️ Comprehensive error tracking (Sentry)

### Known Risks (Accepted for MVP)

1. **No rate limiting** (Phase 2A)
   - Impact: DDoS vulnerability
   - Mitigation: Vercel has built-in DDoS protection
   - Plan: Add rate limiting in Phase 2A

2. **Basic security headers** (Phase 2A)
   - Impact: Clickjacking possible
   - Mitigation: X-Frame-Options added temporarily
   - Plan: Comprehensive headers in Phase 2A

3. **Manual error monitoring** (Phase 2A)
   - Impact: Slower incident response
   - Mitigation: Vercel logs available
   - Plan: Sentry integration in Phase 2A

## Vulnerability Scan Results

### npm audit

- Critical: 0 ✅
- High: 0 ✅
- Medium: 2 (documented below)
- Low: 5 (accepted)

### Snyk

- Critical: 0 ✅
- High: 0 ✅
- Medium: 3 (fixed)
- Low: 8 (accepted)

### Semgrep

- Critical: 0 ✅
- High: 0 ✅
- Medium: 5 (fixed)
- Low: 12 (accepted)

### OWASP ZAP

- High: 2 (security headers - Phase 2A)
- Medium: 5 (documented)
- Low: 15 (accepted)

## Security Checklist (Pre-Launch)

### Authentication

- [x] Strong password requirements (8+ chars, mixed case, numbers)
- [x] Session tokens are httpOnly and secure
- [x] NextAuth secret is cryptographically random
- [x] Password reset flow secure
- [x] Session expiration configured

### Payment Processing

- [x] Stripe webhook signatures verified
- [x] dLocal webhook signatures verified
- [x] No card data stored
- [x] Amounts validated server-side
- [x] Idempotency keys used

### Data Protection

- [x] No secrets in source code
- [x] All .env files gitignored
- [x] Production secrets rotated
- [x] Database connections encrypted (SSL)
- [x] User data access controlled

### Infrastructure

- [x] HTTPS enforced on production
- [x] Vercel environment variables set
- [x] Database backups configured
- [x] Monitoring dashboards set up

## Phase 6 Deliverables Checklist

### **Reports (All in `/reports` directory)**

- [ ] `npm-audit-report.md` - Dependency vulnerabilities
- [ ] `snyk-report.md` - Comprehensive Snyk scan
- [ ] `semgrep-report.md` - Static analysis findings
- [ ] `zap-baseline-report.html` - OWASP ZAP baseline
- [ ] `zap-full-scan-report.html` - Authenticated ZAP scan
- [ ] `manual-security-tests.md` - Manual test results

### **Documentation**

- [ ] `docs/SECURITY-BASELINE.md` - Security posture
- [ ] `docs/SECURITY-RUNBOOK.md` - Incident response
- [ ] `docs/PHASE-6-FINDINGS.md` - All findings summary

### **Code Fixes**

- [ ] All CRITICAL vulnerabilities fixed
- [ ] All HIGH vulnerabilities fixed
- [ ] Medium vulnerabilities documented
- [ ] Basic security headers added to next.config.js
- [ ] Session cookies secured
- [ ] Environment variables audited

### **Configuration**

- [ ] `.gitignore` includes all `.env*` files
- [ ] `.env.example` has no real secrets
- [ ] Vercel environment variables configured
- [ ] Production secrets rotated

---

## CI/CD Integration (Basic)

Add security checks to GitHub Actions:

```yaml
# .github/workflows/security.yml
name: Security Checks

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 1' # Weekly on Monday

jobs:
  security-scan:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: npm audit
        run: npm audit --audit-level=high
        continue-on-error: true

      - name: Snyk test
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        continue-on-error: true

      - name: Semgrep scan
        uses: returntocorp/semgrep-action@v1
        with:
          config: >-
            p/security-audit
            p/owasp-top-ten

      - name: Upload reports
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: security-reports
          path: reports/
```
````

---

## Timeline: 2-3 Days

| Day       | Tasks                    | Hours     |
| --------- | ------------------------ | --------- |
| **Day 1** | npm audit, Snyk, Semgrep | 6-8 hours |
| **Day 2** | OWASP ZAP, manual tests  | 6-8 hours |
| **Day 3** | Hardening, documentation | 4-6 hours |

**Total: 16-22 hours** across 2-3 days

---

## Success Criteria

✅ **Phase 6 Complete When:**

- All CRITICAL vulnerabilities fixed
- All HIGH vulnerabilities fixed
- Medium vulnerabilities documented
- Security baseline documented
- Basic security headers added
- All tools integrated into CI/CD
- Incident response plan created
- Team trained on security procedures

**Critical Metrics:**

- ✅ 0 CRITICAL vulnerabilities
- ✅ 0 HIGH vulnerabilities
- ✅ Security score >B on securityheaders.com
- ✅ All payment flows secure
- ✅ All authentication flows secure

---

## Notes for Claude Code

- **Focus on existing code** - Don't build new features
- **Fix critical issues only** - Medium/Low can wait for security development in next stage
- **Document everything** - Create clear security baseline
- **Test thoroughly** - Ensure fixes don't break functionality

---

**Ready to begin? Start with Day 1: npm audit scan.**

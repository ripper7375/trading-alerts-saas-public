# Security Runbook - Trading Alerts SaaS V7

**Version:** 1.0.0
**Last Updated:** 2025-12-31

---

## Overview

This runbook provides procedures for handling security incidents, performing security maintenance, and responding to common security scenarios.

---

## Table of Contents

1. [Incident Response](#1-incident-response)
2. [Secret Rotation](#2-secret-rotation)
3. [Dependency Vulnerabilities](#3-dependency-vulnerabilities)
4. [Suspicious Activity](#4-suspicious-activity)
5. [Security Maintenance](#5-security-maintenance)

---

## 1. Incident Response

### 1.1 Incident Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| P1 - Critical | Active breach, data exposure | Immediate | Leaked secrets, SQL injection |
| P2 - High | Potential breach, vulnerability | < 4 hours | Failed auth attempts, webhook failures |
| P3 - Medium | Security degradation | < 24 hours | Dependency vulnerability |
| P4 - Low | Minor security issue | < 1 week | Deprecated package |

### 1.2 Incident Response Steps

#### Step 1: Contain

```bash
# If credentials leaked, immediately rotate:
# 1. Generate new secret
openssl rand -base64 32

# 2. Update in Vercel/Railway dashboard
# 3. Redeploy application
```

#### Step 2: Investigate

```bash
# Check application logs
vercel logs --follow

# Check for unauthorized access
# Review authentication logs for suspicious patterns
```

#### Step 3: Remediate

1. Fix the root cause
2. Deploy the fix
3. Verify the fix works

#### Step 4: Document

- Create incident report
- Update runbook if needed
- Schedule post-mortem

---

## 2. Secret Rotation

### 2.1 NextAuth Secret Rotation

**When:** If compromised or quarterly rotation

```bash
# 1. Generate new secret
openssl rand -base64 32

# 2. Update NEXTAUTH_SECRET in Vercel
#    Dashboard > Settings > Environment Variables

# 3. Redeploy
vercel --prod

# 4. Note: All existing sessions will be invalidated
```

### 2.2 Stripe Keys Rotation

**When:** If compromised

```bash
# 1. Go to Stripe Dashboard > API Keys
# 2. Roll the secret key
# 3. Update STRIPE_SECRET_KEY in Vercel
# 4. Update STRIPE_WEBHOOK_SECRET from webhook settings
# 5. Redeploy
```

### 2.3 Database Password Rotation

**When:** If compromised or annually

```bash
# 1. Generate new password
openssl rand -base64 24

# 2. Update in Railway dashboard
# 3. Update DATABASE_URL in Vercel
# 4. Redeploy
```

### 2.4 OAuth Credentials Rotation

**When:** If compromised

1. Go to respective provider's console:
   - Google: https://console.cloud.google.com/apis/credentials
   - Twitter: https://developer.twitter.com/en/portal/projects

2. Generate new client secret

3. Update in Vercel environment variables

4. Redeploy

---

## 3. Dependency Vulnerabilities

### 3.1 Check for Vulnerabilities

```bash
# Run security audit
pnpm audit

# Check production dependencies only
pnpm audit --prod

# Get JSON output for automation
pnpm audit --json > audit-report.json
```

### 3.2 Fix Vulnerabilities

#### Automatic Fix (Safe)

```bash
# Try automatic fix
pnpm audit --fix

# If that doesn't work, update packages
pnpm update
```

#### Manual Fix (When Auto-Fix Fails)

```bash
# 1. Check which package is vulnerable
pnpm audit

# 2. Add override in package.json
# In "pnpm" section:
"pnpm": {
  "overrides": {
    "vulnerable-package": "^fixed-version"
  }
}

# 3. Reinstall
rm -rf node_modules && pnpm install

# 4. Verify fix
pnpm audit
```

### 3.3 Weekly Audit Schedule

```bash
# Add to CI/CD or run manually every Monday
pnpm run security:check
```

---

## 4. Suspicious Activity

### 4.1 Signs of Suspicious Activity

- Multiple failed login attempts from same IP
- Unusual API call patterns
- Webhook signature failures
- Unexpected error spikes

### 4.2 Investigation Steps

#### Check Vercel Logs

```bash
# Real-time logs
vercel logs --follow

# Filter for errors
vercel logs | grep -i error

# Filter for auth issues
vercel logs | grep -i "auth\|login\|unauthorized"
```

#### Check Stripe Dashboard

1. Go to Stripe Dashboard > Developers > Logs
2. Look for failed webhook deliveries
3. Check for unusual payment patterns

#### Check Database

```sql
-- Recent failed logins (if tracking)
SELECT * FROM audit_logs
WHERE action = 'LOGIN_FAILED'
ORDER BY created_at DESC
LIMIT 100;

-- Recent password resets
SELECT * FROM verification_tokens
WHERE type = 'PASSWORD_RESET'
ORDER BY created_at DESC
LIMIT 50;
```

### 4.3 Response Actions

**For Brute Force Attempts:**
1. Consider implementing rate limiting (if not already)
2. Review IP blocking options
3. Enable additional logging

**For Webhook Failures:**
1. Verify webhook secrets match
2. Check for configuration changes
3. Review Stripe/dLocal dashboard

---

## 5. Security Maintenance

### 5.1 Weekly Tasks

| Task | Command/Action |
|------|----------------|
| Dependency audit | `pnpm audit` |
| Review error logs | Check Vercel dashboard |
| Check webhook status | Stripe/dLocal dashboard |

### 5.2 Monthly Tasks

| Task | Action |
|------|--------|
| Review access logs | Export and analyze |
| Check for new vulnerabilities | Run full security scan |
| Review user permissions | Admin dashboard |
| Update dependencies | `pnpm update` |

### 5.3 Quarterly Tasks

| Task | Action |
|------|--------|
| Rotate NextAuth secret | See section 2.1 |
| Review security baseline | Update as needed |
| Security training | Team refresher |

### 5.4 Annual Tasks

| Task | Action |
|------|--------|
| Full security audit | External or internal |
| Rotate all secrets | Complete rotation |
| Penetration testing | Engage security firm |
| Compliance review | GDPR, PCI-DSS |

---

## 6. Quick Reference

### Emergency Contacts

| Role | Contact |
|------|---------|
| Security Lead | security@davintrade.com |
| DevOps | devops@davintrade.com |
| Stripe Support | dashboard.stripe.com/support |

### Key URLs

| Service | URL |
|---------|-----|
| Vercel Dashboard | vercel.com/dashboard |
| Railway Dashboard | railway.app/dashboard |
| Stripe Dashboard | dashboard.stripe.com |
| GitHub Repository | github.com/ripper7375/trading-alerts-saas-public |

### Quick Commands

```bash
# Check security
pnpm run security:check

# Full audit
pnpm audit

# Generate new secret
openssl rand -base64 32

# Check production
vercel logs --follow
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-31 | Initial runbook |

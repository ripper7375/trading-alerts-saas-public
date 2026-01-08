# Infrastructure Costs

**Part 20 - MT5 to PostgreSQL Data Flow**
**Last Updated:** 2026-01-08

---

## Table of Contents

1. [Overview](#overview)
2. [Contabo VPS Costs](#contabo-vps-costs)
3. [Railway Costs](#railway-costs)
4. [Vercel Costs](#vercel-costs)
5. [Additional Services](#additional-services)
6. [Total Monthly Cost](#total-monthly-cost)
7. [Cost Optimization Tips](#cost-optimization-tips)
8. [Scaling Considerations](#scaling-considerations)

---

## Overview

This document provides a detailed breakdown of infrastructure costs for the Trading Alerts data pipeline.

**Infrastructure Components:**
```
┌────────────────────────────────────────────────────────────────┐
│ Component              │ Provider  │ Est. Monthly Cost        │
├────────────────────────────────────────────────────────────────┤
│ Windows VPS            │ Contabo   │ €17.99 - €24.99          │
│ PostgreSQL Database    │ Railway   │ $5 - $20                 │
│ Redis Cache            │ Railway   │ $5 - $10                 │
│ Frontend Hosting       │ Vercel    │ $0 - $20                 │
│ Domain & SSL           │ Various   │ ~$1 - $3                 │
├────────────────────────────────────────────────────────────────┤
│ TOTAL ESTIMATED        │           │ $30 - $80/month          │
└────────────────────────────────────────────────────────────────┘
```

---

## Contabo VPS Costs

### Recommended Plans

| Plan | vCPU | RAM | SSD | Base Price | Windows License | Total |
|------|------|-----|-----|------------|-----------------|-------|
| VPS S | 4 | 8 GB | 50 GB | €5.99/mo | €7.00/mo | **€12.99/mo** |
| **VPS M** | **6** | **16 GB** | **100 GB** | **€10.99/mo** | **€7.00/mo** | **€17.99/mo** |
| VPS L | 8 | 30 GB | 200 GB | €16.99/mo | €7.00/mo | **€23.99/mo** |
| VPS XL | 10 | 60 GB | 400 GB | €26.99/mo | €7.00/mo | **€33.99/mo** |

### Recommended: VPS M (€17.99/month)

**Why VPS M:**
- 16 GB RAM handles 15 MT5 instances comfortably
- 6 vCPU sufficient for indicator calculations
- 100 GB SSD ample for SQLite and MT5 data
- Good price/performance balance

### Additional Contabo Options

| Add-on | Cost | Recommended |
|--------|------|-------------|
| Additional Storage (200GB) | €2.50/mo | Optional |
| Backup Space (100GB) | €1.00/mo | Recommended |
| Additional IP | €3.00/mo | Not needed |
| DDoS Protection | Included | ✓ |

### Contabo Cost Calculation

```
VPS M Base:                €10.99
Windows Server License:    + €7.00
Backup Space (100GB):      + €1.00 (optional)
─────────────────────────────────────
Monthly Total:             €17.99 - €18.99

Annual (if paid yearly):   ~€200 (save ~15%)
```

---

## Railway Costs

Railway uses usage-based pricing with Pro plan starting at $5/month.

### PostgreSQL Costs

**Usage Factors:**
- Compute (vCPU time)
- Memory
- Storage
- Network egress

**Estimated Usage for Trading Alerts:**

| Metric | Estimated Value | Cost Impact |
|--------|----------------|-------------|
| Storage | 1-5 GB | Low |
| Compute | Light (queries only) | Low |
| Memory | 256MB - 1GB | Low |
| Egress | 10-50 GB/month | Medium |

**Estimated PostgreSQL Cost: $5 - $15/month**

### Redis Costs

**Usage Factors:**
- Memory usage
- Network egress

**Estimated Usage:**

| Metric | Estimated Value | Cost Impact |
|--------|----------------|-------------|
| Memory | 50-100 MB | Very Low |
| Egress | 5-20 GB/month | Low |

**Estimated Redis Cost: $5 - $8/month**

### Railway Pricing Tiers

| Tier | Base Cost | Included Credits | Best For |
|------|-----------|------------------|----------|
| Hobby | $5/mo | $5 usage | Development |
| **Pro** | **$20/mo** | **$20 usage** | **Production** |
| Team | $20/seat/mo | $20/seat usage | Teams |

**Note:** Pro tier recommended for production. $20 includes compute/storage credits.

### Railway Cost Calculation

```
Pro Plan Base:             $20.00
PostgreSQL Usage:          Included in credits
Redis Usage:               Included in credits
Additional Usage:          $0 - $10 (if exceed credits)
─────────────────────────────────────
Monthly Total:             $20 - $30
```

---

## Vercel Costs

### Vercel Pricing Tiers

| Tier | Cost | Bandwidth | Serverless | Best For |
|------|------|-----------|------------|----------|
| Hobby | Free | 100 GB | 100 GB-hrs | Personal |
| **Pro** | **$20/mo** | **1 TB** | **1000 GB-hrs** | **Production** |
| Enterprise | Custom | Custom | Custom | Large scale |

### Estimated Vercel Usage

| Metric | Hobby Limit | Expected Usage | Within Limit? |
|--------|-------------|----------------|---------------|
| Bandwidth | 100 GB | 10-50 GB | ✓ |
| Serverless | 100 GB-hrs | 10-50 GB-hrs | ✓ |
| Builds | 6000 mins | 100-500 mins | ✓ |
| Deployments | Unlimited | 10-50/mo | ✓ |

### Vercel Cost Calculation

**Option A: Hobby (Free)**
- Sufficient for low-moderate traffic
- Personal/non-commercial use only
- No team features

**Option B: Pro ($20/month)**
- Commercial use allowed
- Team collaboration
- Higher limits
- Priority support

```
Recommended for Production:
Pro Plan:                  $20.00
Additional Bandwidth:      $0 (usually within limit)
─────────────────────────────────────
Monthly Total:             $20
```

---

## Additional Services

### Domain & SSL

| Service | Provider | Cost |
|---------|----------|------|
| Domain (.com) | Namecheap/Cloudflare | ~$10-15/year |
| SSL Certificate | Let's Encrypt (via Vercel) | Free |
| DNS | Cloudflare | Free |

**Monthly Cost: ~$1/month** (domain amortized)

### Monitoring (Optional)

| Service | Free Tier | Paid Tier |
|---------|-----------|-----------|
| UptimeRobot | 50 monitors | $7/mo (unlimited) |
| Better Uptime | 10 monitors | $20/mo |
| Custom (self-hosted) | Free | Server cost |

**Recommendation:** Use free tier of UptimeRobot or custom scripts

### Backup Services (Optional)

| Service | Cost | Notes |
|---------|------|-------|
| Contabo Backup | €1/mo | 100GB included |
| Railway Backups | Included | Pro plan |
| Custom S3 | ~$1-3/mo | For offsite |

---

## Total Monthly Cost

### Minimum Viable Setup

```
MINIMUM VIABLE SETUP
═══════════════════════════════════════════

Contabo VPS S:             €12.99 (~$14)
Railway Hobby (both):       $10.00
Vercel Hobby:               $0.00
Domain (amortized):         $1.00
─────────────────────────────────────
TOTAL:                     ~$25/month
```

### Recommended Production Setup

```
RECOMMENDED PRODUCTION SETUP
═══════════════════════════════════════════

Contabo VPS M:             €17.99 (~$19)
  - 16GB RAM, 6 vCPU, 100GB SSD
  - Windows Server license included

Railway Pro:               $20.00
  - PostgreSQL + Redis
  - $20 usage credits included

Vercel Pro:                $20.00
  - Commercial license
  - Team features

Domain + Backup:           $2.00
  - Domain (amortized)
  - Contabo backup

Monitoring:                $0.00
  - UptimeRobot free tier
  - Custom scripts
─────────────────────────────────────
TOTAL:                     ~$61/month
```

### Comfortable Production Setup

```
COMFORTABLE PRODUCTION SETUP
═══════════════════════════════════════════

Contabo VPS L:             €23.99 (~$26)
  - 30GB RAM, 8 vCPU, 200GB SSD
  - Room to grow

Railway Pro + Usage:       $30.00
  - Extra headroom for usage spikes

Vercel Pro:                $20.00

Domain + SSL + Monitoring: $5.00
  - Paid monitoring
  - Better DNS
─────────────────────────────────────
TOTAL:                     ~$81/month
```

---

## Cost Optimization Tips

### 1. Start Small, Scale Up

```
Month 1-3: Minimum Setup (~$25/mo)
- Validate architecture works
- Monitor actual resource usage
- Identify bottlenecks

Month 4+: Scale as needed
- Upgrade VPS if CPU/RAM constrained
- Upgrade Railway if hitting limits
- Upgrade Vercel if traffic grows
```

### 2. Contabo Annual Billing

```
Monthly Billing:  €17.99 × 12 = €215.88/year
Annual Billing:   ~€180/year (save ~15%)

Recommendation: Start monthly, switch to annual after validation
```

### 3. Railway Usage Optimization

```
Optimize PostgreSQL:
- Add proper indexes
- Use connection pooling
- Limit unnecessary queries

Optimize Redis:
- Set appropriate TTLs
- Don't cache everything
- Monitor memory usage
```

### 4. Vercel Optimization

```
Reduce Bandwidth:
- Enable compression
- Optimize images
- Use CDN effectively

Reduce Serverless:
- Cache aggressively
- Optimize API routes
- Reduce cold starts
```

### 5. Monitor and Adjust

```powershell
# Monthly cost review checklist
[ ] Check Contabo resource usage (need upgrade?)
[ ] Review Railway usage dashboard
[ ] Check Vercel analytics
[ ] Identify unused services
[ ] Optimize high-cost areas
```

---

## Scaling Considerations

### When to Scale VPS

| Symptom | Current | Upgrade To |
|---------|---------|------------|
| CPU consistently >80% | VPS S/M | VPS M/L |
| Memory >90% | VPS M | VPS L |
| Disk >80% full | Any | Add storage |
| More symbols needed | VPS M | VPS L/XL |

### When to Scale Railway

| Symptom | Solution |
|---------|----------|
| Exceeding $20 credits | Budget more or optimize |
| Slow queries | Add indexes, optimize |
| Connection limits | Use pooling |
| Storage growing fast | Add data retention limits |

### When to Scale Vercel

| Symptom | Solution |
|---------|----------|
| Bandwidth overages | Upgrade or optimize |
| Function timeouts | Optimize or upgrade |
| Build time issues | Upgrade or optimize |

### Projected Scaling Costs

| Scale | Symbols | Users | Est. Monthly Cost |
|-------|---------|-------|-------------------|
| Current | 15 | 10-100 | $50-80 |
| Medium | 30 | 100-500 | $100-150 |
| Large | 50+ | 500-1000 | $200-300 |
| Enterprise | 100+ | 1000+ | Custom |

---

## Cost Comparison: Cloud vs VPS

### Option A: Full Cloud (AWS/GCP)

```
EC2 Instance (t3.large):   ~$60/mo
RDS PostgreSQL:            ~$30/mo
ElastiCache Redis:         ~$25/mo
+ Data transfer, etc.
─────────────────────────────────────
TOTAL:                     ~$120-150/mo
```

### Option B: Hybrid (Current Approach)

```
Contabo VPS:               ~$20/mo
Railway (managed DB):      ~$20/mo
Vercel (CDN + serverless): ~$20/mo
─────────────────────────────────────
TOTAL:                     ~$60/mo
```

**Savings: 50-60% vs full cloud**

### Why Hybrid Works

- VPS handles compute-heavy MT5 terminals
- Railway handles managed database concerns
- Vercel handles CDN and serverless efficiently
- Each provider optimized for its role

---

## Budget Template

```
MONTHLY INFRASTRUCTURE BUDGET
═══════════════════════════════════════════════════════════════

Category                 Budgeted    Actual    Variance
───────────────────────────────────────────────────────────────
Compute (VPS)            $20.00      $____     $____
Database                 $20.00      $____     $____
Cache                    $10.00      $____     $____
Frontend                 $20.00      $____     $____
Domain/SSL               $2.00       $____     $____
Monitoring               $0.00       $____     $____
Buffer (10%)             $7.00       $____     $____
───────────────────────────────────────────────────────────────
TOTAL                    $79.00      $____     $____

Notes:
_______________________________________________________________
_______________________________________________________________
```

---

## Summary

| Setup Type | Monthly Cost | Annual Cost |
|------------|--------------|-------------|
| Minimum Viable | ~$25 | ~$300 |
| **Recommended Production** | **~$60** | **~$720** |
| Comfortable Production | ~$80 | ~$960 |
| Full Cloud Alternative | ~$150 | ~$1800 |

**Recommendation:** Start with the recommended production setup (~$60/month) and adjust based on actual usage after 2-3 months.

---

## Next Steps

After reviewing costs:

1. ➡️ **[Post-Testing Checklist](./12-post-testing-checklist.md)** - Final checklist

---

**Document Version:** 1.0.0
**Created:** 2026-01-08
**Author:** Claude Code (Trading Alerts SaaS Part 20)

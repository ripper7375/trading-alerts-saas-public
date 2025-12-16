# Affiliate Discount Code Business Logic Correction

**Date:** 2025-11-15
**Issue:** Critical business logic error in affiliate discount code implementation
**Status:** ✅ Completed

---

## 📋 Executive Summary

This document summarizes the comprehensive correction of the affiliate discount code business logic from an **incorrect permanent/lifetime discount model** to the **correct one-time monthly promo code model**.

### The Problem

The system documentation incorrectly described discount codes as providing:

- ❌ **Permanent/lifetime discounts** (once applied, discount lasts forever)
- ❌ Users pay $23.20/month indefinitely after using one code
- ❌ No need to re-enter codes on renewal

### The Solution

Corrected all documentation to reflect the proper business model:

- ✅ **One-time use, non-permanent monthly promo codes**
- ✅ Each code provides discount for ONE payment only
- ✅ At renewal, users pay full price ($29.00) unless they enter a NEW code
- ✅ Users must find fresh codes on social media monthly from affiliates

---

## 🎯 Business Rationale

The correct one-time monthly code model:

1. **Drives Affiliate Engagement:** Affiliates must continuously post codes on social media
2. **Encourages Social Media Activity:** Creates ongoing social media presence and engagement
3. **Creates Competition:** Affiliates compete to distribute codes, increasing reach
4. **Sustainable Economics:** Prevents indefinite 20% discounts from single code use
5. **User Engagement:** Encourages users to follow and engage with affiliates monthly

---

## 📝 Files Modified

### 1. UI Prompt Files (v0.dev UPDATED prompts)

All 5 UPDATED prompt files in `ui-frontend-user-journey/prompts-to-v0dev/` were corrected:

#### **prompt-1-next-js-marketing-homepage-UPDATED.md**

**Changes:**

- Helper text: ~~"Get 20% off PRO forever!"~~ → **"Get 20% off this month!"**
- Banner: ~~"20% off PRO forever!"~~ → **"20% off your first month!"**
- Badge: ~~"20% OFF WITH YOUR CODE"~~ → **"20% OFF FIRST MONTH"**

**Impact:** Homepage correctly sets user expectations from first visit.

---

#### **prompt-2-pricing-page-component-UPDATED.md**

**Changes:**

- Affiliate banner: Added **"New codes available monthly!"**
- FAQ answer completely rewritten to explain:
  - One-time discount per code
  - Need to find and apply new code at renewal
  - Affiliates post fresh codes on social media monthly

**Impact:** Pricing page clearly communicates the monthly code renewal process.

---

#### **prompt-3-registration-form-component-UPDATED.md**

**Changes:**

- Helper text: ~~"Get 20% off PRO forever!"~~ → **"Get 20% off this month!"**
- Code example updated to match new language

**Impact:** Registration form sets correct expectations during signup.

---

#### **prompt-8-billing-and-subscription-page-UPDATED.md**

**Changes:**

- Savings label: ~~"Lifetime 20% off"~~ → **"20% off this month"**
- Discount heading: ~~"Lifetime 20% Discount"~~ → **"20% Discount This Month"**
- Description: ~~"You're saving $5.80/month ($69.60/year)"~~ → **"You're saving $5.80 this month. Find new codes monthly to keep saving!"**
- Renewal text: ~~"Renews at $23.20"~~ → **"Renews at $29.00"**
- Sub-text: ~~"Your 20% affiliate discount is permanent"~~ → **"Use a new affiliate code at renewal to get 20% off again!"**
- Notice: ~~"Your discount is permanent and will continue as long as you maintain your subscription"~~ → **"Your discount code is valid for one payment only. At renewal, enter a new code to get 20% off again. Affiliates post fresh codes on social media monthly!"**
- Downgrade warning: ~~"You'll LOSE your 20% affiliate discount permanently (cannot be re-applied)"~~ → **"FREE tier is not eligible for affiliate discount codes"**

**Impact:** Billing page clearly shows renewal pricing and explains monthly code process.

---

#### **prompt-11-settings-page-with-tabs-UPDATED.md**

**Changes:**

- Discount heading: ~~"Lifetime Affiliate Discount"~~ → **"Discount Applied This Month"**
- Notice: ~~"Your discount is permanent as long as you maintain your subscription"~~ → **"Your code gave you 20% off this payment. Find new codes on social media monthly to keep saving!"**
- Code label: ~~"Your Referral Code"~~ → **"Code Used This Month"**
- Subtext: ~~"This code gave you the discount"~~ → **"Find new codes on social media for next month's discount"**
- Next billing: ~~"January 15, 2025 (you'll be charged $23.20)"~~ → **"January 15, 2025 ($29.00 without new code, or $23.20 if you apply a new code at renewal)"**
- All corresponding TypeScript code examples updated

**Impact:** Settings page provides clarity on discount status and renewal process.

---

## ✅ Files Verified (No Changes Needed)

### 1. **ARCHITECTURE.md**

- ✅ No mentions of permanent/lifetime discounts
- ✅ Database schema is already correct

### 2. **docs/AFFILIATE-MARKETING-DESIGN.md**

- ✅ Database schema correctly implements one-time use:

  ```prisma
  model AffiliateCode {
    usedBy    String?   // User ID who redeemed (ONE TIME)
    usedAt    DateTime? // When redeemed
    status    CodeStatus @default(ACTIVE)
  }

  enum CodeStatus {
    ACTIVE   // Available for use
    USED     // Redeemed by user (ONE TIME)
    EXPIRED  // Passed expiry date
    CANCELLED
  }
  ```

- ✅ Business logic correctly specified

### 3. **docs/policies/** files

- ✅ 04-escalation-triggers.md contains "permanent" only in generic architectural decision context
- ✅ No affiliate discount-related policy violations found

### 4. **ui-frontend-user-journey/saas-user-journey-updated.md**

- ✅ Already shows correct one-time discount code entry during checkout
- ✅ No permanent discount language found

---

## 🔑 Key Changes Summary

| Aspect                 | Before (Incorrect)                 | After (Correct)                           |
| ---------------------- | ---------------------------------- | ----------------------------------------- |
| **Discount Duration**  | Permanent/Lifetime                 | One-time per payment                      |
| **Renewal Price**      | $23.20 (discounted)                | $29.00 (full price)                       |
| **Code Reuse**         | One code forever                   | New code needed monthly                   |
| **User Messaging**     | "Forever", "Permanent", "Lifetime" | "This month", "One-time", "Monthly codes" |
| **Affiliate Strategy** | One-time code posting              | Continuous monthly engagement             |
| **Code Lifecycle**     | Irrelevant after first use         | Active → Used (monthly cycle)             |

---

## 📊 Impact Analysis

### Documentation Scope

- **Files Modified:** 5 v0.dev UPDATED prompt files
- **Total Edits:** 23 specific text/code changes
- **Lines Changed:** ~50 lines across all files

### Business Impact

- ✅ Prevents indefinite 20% discounts from single code
- ✅ Drives continuous affiliate social media engagement
- ✅ Creates sustainable affiliate marketing model
- ✅ Encourages user-affiliate relationship building
- ✅ Improves long-term revenue projections

### User Experience Impact

- ✅ Clear expectations set from homepage
- ✅ Transparent renewal pricing information
- ✅ Guidance on finding monthly codes
- ✅ No surprise charges at renewal

---

## 🔄 Next Steps

### This Conversation (Documentation) ✅

- ✅ All prompt files corrected
- ✅ All documentation verified
- ✅ Summary document created

### Next Conversation (Frontend Code)

The following frontend implementation files will need corresponding updates:

1. **seed-code/v0-components/** - All component implementations
2. **Any existing frontend code** - Update to match corrected prompts
3. **Backend API validation** - Ensure one-time code redemption logic
4. **Database migration scripts** - Verify schema matches design
5. **Test files** - Update test expectations

---

## 📌 Code Lifecycle Specification

For reference, the correct affiliate code lifecycle:

```
AFFILIATE REGISTRATION
    ↓
15 codes generated → ACTIVE status
    ↓
MONTHLY (automated)
    ↓
15 new codes generated → ACTIVE status
Previous month's codes → EXPIRED status
    ↓
USER REDEEMS CODE
    ↓
Code status: ACTIVE → USED
usedBy: [user_id]
usedAt: [timestamp]
    ↓
DISCOUNT APPLIED TO ONE PAYMENT
    ↓
NEXT RENEWAL
    ↓
Full price: $29.00 (no discount)
User must enter NEW code for discount
```

---

## 🎯 Commission Formula

Reminder of correct commission calculation:

```
Base Case (No Discount):
$29.00 × 20% = $5.80 commission to affiliate

With Discount (User uses affiliate code):
Step 1: Calculate discounted price
  $29.00 × (100% - 20%) = $29.00 × 0.80 = $23.20

Step 2: Calculate affiliate commission
  $23.20 × 20% = $4.64 commission to affiliate

Effect: Affiliate earns $4.64 per referred user per month (when code is used)
```

---

## ✅ Verification Checklist

- [x] All 5 v0.dev UPDATED prompt files corrected
- [x] All "permanent", "lifetime", "forever" language removed from discount context
- [x] ARCHITECTURE.md verified (no changes needed)
- [x] AFFILIATE-MARKETING-DESIGN.md verified (database schema correct)
- [x] Policy files verified (no discount-related violations)
- [x] User journey files verified (already correct)
- [x] Summary document created
- [x] Changes committed to git (pending)

---

## 📚 References

- **Issue Identified:** User feedback on incorrect permanent discount implementation
- **Design Document:** docs/AFFILIATE-MARKETING-DESIGN.md
- **Database Schema:** Prisma schema in AFFILIATE-MARKETING-DESIGN.md
- **Modified Files:** See "Files Modified" section above
- **Git Commit:** (Will be added after commit)

---

## 🔗 Related Documentation

- `docs/AFFILIATE-MARKETING-DESIGN.md` - Complete affiliate system design (database schema is correct)
- `ui-frontend-user-journey/saas-user-journey-updated.md` - User journey flow (already correct)
- `ui-frontend-user-journey/prompts-to-v0dev/prompt-*-UPDATED.md` - All corrected UI prompts

---

**Document Created:** 2025-11-15
**Created By:** Claude Code (Sonnet 4.5)
**Status:** Complete - Ready for frontend code updates in next conversation

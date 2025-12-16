# V5 Part M: Settings System - Implementation Guide

**For:** Trading Alerts SaaS V7
**Part:** 13 - Settings
**Total Files:** 17 files
**Complexity:** Low
**Last Updated:** 2025-11-21

---

## Overview

User settings system for managing profile, appearance, privacy, billing, and account preferences.

### Key Features

- Profile management (name, email, avatar)
- Appearance settings (theme: light/dark/system)
- Privacy settings (data export, account visibility)
- Billing settings (view subscription, manage payment)
- Account management (change password, delete account)
- Language preferences
- Help and support access

---

## Business Requirements

### 1. Profile Settings

**Editable Fields:**

- Name (required, 2-50 characters)
- Email (required, valid email format)
- Profile image (optional, upload or URL)

**Validation:**

- Email must be unique across all users
- If email changed, send verification email to new address
- Profile image max size: 5MB, formats: JPG, PNG, GIF

**API:** PATCH /api/user/profile

### 2. Appearance Settings

**Theme Options:**

- Light mode
- Dark mode
- System (follows OS preference)

**Storage:**

- Save preference in user preferences table
- Apply immediately without page reload

**API:** PUT /api/user/preferences

### 3. Account Settings

**Change Password:**

- Require current password
- New password min 8 characters, must include: uppercase, lowercase, number
- Send email notification after password change

**Delete Account:**

- Two-step confirmation process:
  1. Request deletion (send confirmation email with link)
  2. Confirm deletion via email link (account deleted within 24 hours)
- Grace period: 7 days to cancel deletion request
- Delete all user data (GDPR compliance)

**APIs:**

- POST /api/user/password
- POST /api/user/account/deletion-request
- POST /api/user/account/deletion-confirm
- POST /api/user/account/deletion-cancel

### 4. Privacy Settings

**Data Export:**

- User can request full data export (JSON format)
- Includes: profile, alerts, watchlists, subscription history
- Generated within 24 hours, download link sent via email
- Link expires in 7 days

**Account Visibility:**

- Public: Profile visible in leaderboards/social features (future)
- Private: Profile not visible to other users

**API:** POST /api/user/data-export

### 5. Billing Settings

**Display:**

- Current tier (FREE or PRO)
- If PRO: Next billing date, payment method (last 4 digits)
- Invoice history (last 12 months)
- Upgrade/cancel buttons

**Actions:**

- Upgrade to PRO → Redirect to checkout
- Cancel subscription → Immediate downgrade to FREE
- Update payment method → Open Stripe customer portal

**(See Part 12: E-commerce for detailed billing logic)**

### 6. Language Settings

**Supported Languages (V5):**

- English (default)
- Spanish (future)
- French (future)

**Implementation:**

- Use next-intl or similar i18n library
- Store language preference in user preferences
- Apply to UI, emails, notifications

**API:** PUT /api/user/preferences

### 7. Help Page

**Content:**

- Link to documentation
- Contact support form
- FAQ section
- Video tutorials (future)

**Support Form:**

- Name (pre-filled from profile)
- Email (pre-filled from profile)
- Subject (required)
- Message (required, max 1000 characters)
- Priority: Low/Medium/High
- Send to support email or ticketing system

---

## UI/UX Requirements

### Settings Layout

**Sidebar Navigation:**

- Profile
- Appearance
- Account
- Privacy
- Billing
- Language
- Help

**Active State:**

- Highlight current page
- Mobile: Collapsible sidebar

### Profile Page

**Form:**

- Avatar upload (drag-and-drop or click to browse)
- Name input
- Email input
- Save button (disabled if no changes)

**Validation:**

- Real-time validation on blur
- Show error messages below fields
- Disable save until valid

### Appearance Page

**Theme Selector:**

- Three radio buttons with icons
- Preview of theme
- Apply immediately on selection (no save button needed)

### Account Page

**Change Password Section:**

- Current password input (password field)
- New password input (password field)
- Confirm password input (password field)
- Password strength indicator
- Change Password button

**Delete Account Section:**

- Warning message: "This action cannot be undone"
- Request Deletion button (red, secondary)
- Confirmation modal before proceeding

### Privacy Page

**Data Export:**

- Description: "Download all your data"
- Request Export button
- Status: "No pending requests" or "Export in progress"

**Account Visibility:**

- Toggle switch: Public/Private
- Description of what visibility means

### Billing Page

**(See Part 12: E-commerce for detailed UI requirements)**

---

## Email Templates

### 1. Email Changed Verification

**Subject:** Verify your new email address

**Body:**

```
Hi {name},

You requested to change your email address to {newEmail}.

Click here to verify: {verificationLink}

If you didn't request this, please ignore this email.

Trading Alerts Team
```

### 2. Password Changed Notification

**Subject:** Your password was changed

**Body:**

```
Hi {name},

Your Trading Alerts password was successfully changed.

If you didn't make this change, please contact support immediately.

Trading Alerts Team
```

### 3. Account Deletion Request

**Subject:** Account deletion requested - Confirm to proceed

**Body:**

```
Hi {name},

You requested to delete your Trading Alerts account.

Click here to confirm deletion: {confirmationLink}

Your account will be permanently deleted within 24 hours after confirmation.

Changed your mind? You can cancel this request: {cancelLink}

Trading Alerts Team
```

### 4. Data Export Ready

**Subject:** Your data export is ready

**Body:**

```
Hi {name},

Your data export is ready for download.

Download here: {downloadLink}

This link expires in 7 days.

Trading Alerts Team
```

---

## API Endpoints

### PATCH /api/user/profile

- Update name, email, profile image
- Return updated user object

### PUT /api/user/preferences

- Update theme, language, privacy settings
- Return updated preferences

### POST /api/user/password

- Validate current password
- Update to new password
- Send notification email

### POST /api/user/account/deletion-request

- Create deletion request
- Send confirmation email
- Return request ID

### POST /api/user/account/deletion-confirm

- Verify token from email
- Schedule account deletion (24 hours)
- Return success

### POST /api/user/account/deletion-cancel

- Cancel pending deletion request
- Return success

### POST /api/user/data-export

- Create export job
- Generate JSON file (background job)
- Send email when ready

---

## Testing Requirements

**Manual Tests:**

- [ ] Update profile information saves correctly
- [ ] Email change sends verification email
- [ ] Password change works and sends notification
- [ ] Theme changes apply immediately
- [ ] Account deletion request sends confirmation email
- [ ] Data export generates and emails download link

---

## Summary

Settings system provides comprehensive user account management. Key features:

1. ✅ **Profile Management** - Name, email, avatar
2. ✅ **Theme Customization** - Light/dark/system
3. ✅ **Security** - Password change, account deletion
4. ✅ **Privacy Controls** - Data export, visibility
5. ✅ **Billing Access** - View/manage subscription

**Priority:** Medium - Important for user retention.

---

**Reference:** This guide works with `docs/build-orders/part-13-settings.md` for file-by-file build instructions.

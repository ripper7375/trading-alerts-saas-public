# Backend Files - Authentication Logic

## Trading Alerts SaaS V7

**Total Authentication Backend Files: 36 files**

---

## 1. AUTHENTICATION API ROUTES (7 files)

### Core Auth Endpoints

1. `app/api/auth/[...nextauth]/route.ts`
   - NextAuth.js main handler
   - Handles OAuth providers, credentials login, session management
   - JWT token generation and validation

2. `app/api/auth/register/route.ts`
   - User registration endpoint
   - Email uniqueness validation
   - Password hashing
   - Account creation

3. `app/api/auth/verify-email/route.ts`
   - Email verification endpoint
   - Token validation
   - Account activation

4. `app/api/auth/resend-verification/route.ts`
   - Resend verification email
   - Rate limiting for email sending
   - New token generation

5. `app/api/auth/forgot-password/route.ts`
   - Password reset request
   - Reset token generation
   - Security email sending

6. `app/api/auth/reset-password/route.ts`
   - Password reset confirmation
   - Token validation
   - New password setting

7. `app/api/auth/track-login/route.ts`
   - Login event tracking
   - Device fingerprinting
   - Login history recording

---

## 2. PASSWORD & SESSION MANAGEMENT API (3 files)

8. `app/api/user/password/route.ts`
   - Change password (authenticated users)
   - Current password verification
   - Password strength validation

9. `app/api/user/sessions/route.ts`
   - List all active sessions
   - Session metadata (device, location, last activity)

10. `app/api/user/sessions/[id]/route.ts`
    - Revoke specific session
    - Force logout from other devices

---

## 3. TWO-FACTOR AUTHENTICATION API (5 files)

11. `app/api/user/2fa/setup/route.ts`
    - Generate 2FA secret
    - QR code generation for authenticator apps
    - Backup codes generation

12. `app/api/user/2fa/verify-setup/route.ts`
    - Verify 2FA code during setup
    - Activate 2FA on account
    - Store encrypted secret

13. `app/api/user/2fa/verify/route.ts`
    - Verify 2FA code during login
    - Support for backup codes
    - Brute force protection

14. `app/api/user/2fa/disable/route.ts`
    - Disable 2FA
    - Password verification required
    - Invalidate backup codes

15. `app/api/user/2fa/backup-codes/route.ts`
    - Generate new backup codes
    - Invalidate old codes
    - Password verification required

---

## 4. AUTHENTICATION LIBRARY/UTILITIES (6 files)

### Core Auth Logic

16. `lib/auth/session.ts`
    - Session creation and validation
    - JWT token handling
    - Session storage (database/Redis)
    - Session expiration management

17. `lib/auth/password.ts`
    - Password hashing (bcrypt)
    - Password verification
    - Password strength validation
    - Hash comparison timing-safe functions

18. `lib/auth/email-verification.ts`
    - Verification token generation
    - Token expiration handling
    - Email sending integration
    - Token cleanup

19. `lib/auth/two-factor.ts`
    - TOTP generation and validation
    - Backup code management
    - QR code generation
    - Secret encryption/decryption

20. `lib/auth/permissions.ts`
    - Role-based access control (RBAC)
    - Permission checking
    - Admin/user role validation
    - Feature access control

21. `lib/auth/middleware.ts`
    - Authentication middleware functions
    - Protected route handlers
    - Session validation helpers
    - Unauthorized response handlers

---

## 5. SECURITY & FRAUD DETECTION (4 files)

22. `lib/security/device-detection.ts`
    - Device fingerprinting
    - Browser/OS detection
    - IP address tracking
    - User agent parsing

23. `lib/security/fraud-detection.ts`
    - Suspicious login detection
    - Multiple failed login attempts
    - Unusual location detection
    - Account takeover prevention

24. `lib/security/encryption.ts`
    - Data encryption utilities
    - AES encryption for sensitive data
    - Secret key management
    - Decryption functions

25. `lib/security/sanitization.ts`
    - Input sanitization
    - XSS prevention
    - SQL injection prevention
    - HTML escaping

---

## 6. EMAIL TEMPLATES (3 files)

26. `lib/email/templates/verification.tsx`
    - Email verification template
    - Verification link generation
    - Branded HTML email

27. `lib/email/templates/welcome.tsx`
    - Welcome email after registration
    - Getting started guide
    - Account setup tips

28. `lib/email/templates/password-reset.tsx`
    - Password reset email
    - Reset link with expiration
    - Security warning message

---

## 7. VALIDATION SCHEMAS (2 files)

29. `lib/validations/auth-schema.ts`
    - Login form validation
    - Registration validation rules
    - Password reset schemas
    - Email format validation
    - Password strength rules (Zod schemas)

30. `lib/validations/user-schema.ts`
    - User profile validation
    - Username validation
    - Email validation
    - Phone number validation

---

## 8. DATABASE OPERATIONS (2 files)

31. `lib/db/user.ts`
    - User CRUD operations
    - User lookup by email/username
    - User creation
    - User updates
    - Account deletion

32. `lib/db/session.ts`
    - Session CRUD operations
    - Session creation
    - Session retrieval
    - Session cleanup
    - Expired session deletion

---

## 9. TYPE DEFINITIONS (2 files)

33. `types/next-auth.d.ts`
    - NextAuth type extensions
    - Custom session type
    - Custom user type
    - JWT payload types

34. `types/user.ts`
    - User model types
    - User status enums
    - User role types
    - Authentication state types

---

## 10. MIDDLEWARE & INFRASTRUCTURE (2 files)

35. `middleware.ts`
    - Next.js middleware for route protection
    - Authentication checks
    - Role-based redirects
    - Session validation
    - Public/private route handling

36. `lib/csrf.ts`
    - CSRF token generation
    - CSRF validation
    - Double-submit cookie pattern
    - Token expiration

---

## AUTHENTICATION FLOW OVERVIEW

### Registration Flow

```
User → register/route.ts
     → auth-schema.ts (validation)
     → password.ts (hashing)
     → user.ts (create in DB)
     → email-verification.ts (generate token)
     → verification.tsx (send email)
```

### Login Flow

```
User → [...nextauth]/route.ts
     → password.ts (verify password)
     → fraud-detection.ts (check suspicious activity)
     → device-detection.ts (fingerprint device)
     → session.ts (create session)
     → track-login/route.ts (log event)
     → [if 2FA enabled] → verify/route.ts
```

### Password Reset Flow

```
User → forgot-password/route.ts
     → user.ts (lookup user)
     → email-verification.ts (generate reset token)
     → password-reset.tsx (send email)
     → reset-password/route.ts (validate token)
     → password.ts (hash new password)
     → user.ts (update password)
```

### 2FA Setup Flow

```
User → setup/route.ts (generate secret)
     → two-factor.ts (create QR code)
     → verify-setup/route.ts (validate code)
     → encryption.ts (encrypt secret)
     → user.ts (save 2FA settings)
```

---

## SECURITY FEATURES IMPLEMENTED

✅ **Password Security**

- Bcrypt hashing with salt rounds
- Password strength validation
- Timing-safe comparison
- No password storage in logs

✅ **Session Security**

- JWT tokens with expiration
- Session invalidation
- Multi-device session management
- Secure cookie flags (httpOnly, secure, sameSite)

✅ **Email Verification**

- Token-based verification
- Time-limited tokens
- Rate limiting on resend
- Cleanup of expired tokens

✅ **Two-Factor Authentication**

- TOTP-based (Google Authenticator compatible)
- Backup codes for recovery
- Encrypted secret storage
- Brute force protection

✅ **Fraud Prevention**

- Device fingerprinting
- Login attempt tracking
- IP address monitoring
- Unusual location detection
- Account lockout after failed attempts

✅ **Input Validation**

- Zod schema validation
- SQL injection prevention
- XSS prevention
- CSRF protection
- Input sanitization

✅ **Additional Security**

- Rate limiting on auth endpoints
- HTTPS enforcement
- Secure headers (CSP, HSTS, etc.)
- Session fixation prevention
- Privilege escalation protection

---

## DEPENDENCIES USED

**Authentication**

- `next-auth` 4.24.5 - Authentication framework
- `bcryptjs` - Password hashing
- `jsonwebtoken` - JWT token handling

**Security**

- `speakeasy` - 2FA TOTP generation
- `qrcode` - QR code generation for 2FA
- `crypto` (Node.js built-in) - Encryption utilities

**Validation**

- `zod` - Schema validation
- `validator` - String validation utilities

**Email**

- `resend` - Email sending service
- `react-email` - Email template rendering

**Database**

- `@prisma/client` - Database ORM
- `ioredis` - Redis for session storage

---

## RELATED CONFIGURATION

**Environment Variables Required**

```
NEXTAUTH_SECRET
NEXTAUTH_URL
DATABASE_URL
REDIS_URL
SMTP_HOST / RESEND_API_KEY
TWO_FACTOR_ENCRYPTION_KEY
CSRF_SECRET
```

**Database Tables Used**

- `User` - User accounts
- `Session` - Active sessions
- `VerificationToken` - Email verification & password reset
- `LoginHistory` - Login event tracking
- `FailedLoginAttempt` - Brute force detection

---

**Summary**: The authentication system is comprehensive with 36 backend files covering user registration, login, password management, 2FA, email verification, session management, fraud detection, and security measures.

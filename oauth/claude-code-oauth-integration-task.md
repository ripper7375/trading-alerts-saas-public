# Claude Code (Web) - Google OAuth Integration Task

## Your Role & Mission

You are the **Technical Architect and Documentation Lead** for the Trading Alerts SaaS project. Your mission is to integrate Google OAuth into the existing authentication system by:

1. **Analyzing** the existing codebase thoroughly
2. **Deciding** on 12 critical implementation ambiguities
3. **Creating/Updating** ALL necessary documents for the Aider + Claude Code + Human workflow
4. **Ensuring** consistency across implementation files, documentation, policies, and contracts

## 📂 Input Documents (Already in GitHub)

You have access to these two markdown files:

1. **`docs/implementation-guides/google-oauth-implementation-guide.md`**
   - Comprehensive technical implementation guide
   - 12 parts covering all aspects of OAuth integration
   - Code examples, database schema, UI components

2. **`docs/oauth-decision-request.md`**
   - Lists 12 critical ambiguities
   - Decision frameworks for each ambiguity
   - Files to check for each decision

## 🎯 Your Tasks (Execute in Order)

---

### **TASK 1: Codebase Analysis & Decision Making**

**Objective:** Resolve all 12 ambiguities by analyzing the existing codebase.

**Instructions:**

1. **Read both input documents completely**

2. **For each of the 12 ambiguities in `oauth-decision-request.md`:**

   a. **Check the specified files:**

   ```
   Examples:
   - package.json (NextAuth version?)
   - prisma/schema.prisma (Session model? Password nullable?)
   - app/api/auth/[...nextauth]/route.ts (Current auth patterns?)
   - .env.example (Environment structure?)
   ```

   b. **Analyze existing patterns:**
   - What auth version is currently used?
   - What session strategy is implemented?
   - How is email verification handled?
   - What's the current database schema?

   c. **Make informed decisions:**
   - Follow the "Recommendation Logic" in each ambiguity
   - Choose the option that best matches existing patterns
   - Prioritize: Security > Consistency > Simplicity

   d. **Document your decision:**
   - Use the provided template for each ambiguity
   - Include reasoning based on actual code findings

3. **Create Output Document:**

**File:** `docs/decisions/google-oauth-decisions.md`

**Content:**

````markdown
# Google OAuth Implementation Decisions

**Date:** [Current Date]
**Author:** Claude Code (Web)
**Project:** Trading Alerts SaaS

## Executive Summary

Based on comprehensive analysis of the codebase, I have resolved all 12 critical ambiguities for Google OAuth integration. Below are the decisions with full reasoning.

---

## DECISION 1: NextAuth.js Version

**Files Analyzed:**

- package.json
- app/api/auth/[...nextauth]/route.ts
- lib/auth/auth-options.ts

**Current State Found:**

- package.json shows: "next-auth": "^X.X.X"
- Current auth implementation uses: [v4 or v5 patterns]
- Existing patterns: [describe what you found]

**Decision:** [v4 or v5]

**Reasoning:**
[Explain why based on actual findings]

**Implementation Impact:**

- Code patterns: [v4 or v5 style]
- Import statements: [specific imports]
- Config structure: [authOptions vs auth.ts]

**Files to Update:**

- app/api/auth/[...nextauth]/route.ts
- [list all affected files]

---

## DECISION 2: Session Strategy

[Same detailed structure for all 12 decisions]

---

[Continue for all 12 ambiguities]

---

## Summary Table

| #   | Ambiguity          | Decision    | Impact Level | Migration Needed |
| --- | ------------------ | ----------- | ------------ | ---------------- |
| 1   | NextAuth Version   | [v4/v5]     | High         | [Yes/No]         |
| 2   | Session Strategy   | [DB/JWT]    | High         | [Yes/No]         |
| 3   | Account Linking    | [Method]    | Critical     | No               |
| 4   | Password Nullable  | [Yes/No]    | Medium       | [Yes/No]         |
| 5   | Email Verification | [Method]    | Medium       | No               |
| 6   | Profile Picture    | [Method]    | Low          | No               |
| 7   | Production Setup   | [Structure] | High         | No               |
| 8   | Error Handling     | [Method]    | Low          | No               |
| 9   | Testing Strategy   | [Method]    | Medium       | No               |
| 10  | Database Migration | [Needed?]   | High         | [Yes/No]         |
| 11  | Callback URLs      | [Strategy]  | Medium       | No               |
| 12  | Tier Upgrade UX    | [Method]    | Low          | No               |

---

## Implementation Priority Order

**Phase 1: Foundation (Do First)**

1. Database schema changes (if any)
2. Environment variable setup
3. NextAuth configuration update

**Phase 2: Core Integration** 4. Google OAuth provider setup 5. Login/Register UI updates 6. Account linking logic

**Phase 3: Documentation** 7. OpenAPI contract updates 8. Architecture documentation 9. Policy documents for Aider

**Phase 4: Testing & Validation** 10. Testing guide creation 11. Validation checklists 12. Manual testing procedures

---

## Required Migrations

[If any database migrations are needed, provide SQL scripts here]

**Migration: make_password_nullable.sql** (if needed)

```sql
-- Add migration script
```
````

---

## Environment Variables Required

**Dev (.env.local):**

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=
```

**Production (Vercel):**

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=
```

---

## Next Steps for Implementation

1. **Human:** Review this decision document and approve
2. **Claude Code:** Update OAuth implementation guide with these decisions
3. **Claude Code:** Create all policy and documentation files
4. **Claude Code:** Update OpenAPI contract
5. **Aider:** Implement OAuth system following updated guide
6. **Claude Code:** Validate implementation against quality standards
7. **Human:** Test OAuth flow manually
8. **Human:** Deploy to staging/production

---

## Risk Assessment

**High Risk Items:**

- [List any high-risk changes]

**Medium Risk Items:**

- [List medium-risk changes]

**Low Risk Items:**

- [List low-risk changes]

**Mitigation Strategies:**

- [How to handle each risk]

---

## Success Criteria

✅ All 12 decisions made with clear reasoning
✅ Decisions match existing codebase patterns
✅ Security best practices followed
✅ Migration plan created (if needed)
✅ Documentation roadmap defined
✅ Implementation priority clear
✅ Testing strategy defined
✅ Risk mitigation planned

**Estimated Implementation Time:** [X hours]
**Complexity Level:** [Low/Medium/High]
**Breaking Changes:** [Yes/No - list if yes]

````

---

### **TASK 2: Update OAuth Implementation Guide**

**Objective:** Apply your decisions to the implementation guide.

**Instructions:**

1. **Create a new file:**

**File:** `docs/implementation-guides/google-oauth-implementation-guide-FINAL.md`

2. **Copy the original guide** and make these updates:

   a. **Replace all ambiguous sections** with specific decisions:
   ```markdown
   ❌ BEFORE: "Use NextAuth.js v4 or v5"
   ✅ AFTER: "Use NextAuth.js v4 (as existing system uses v4)"
````

b. **Update code examples** to match decisions:

```typescript
// If decided on JWT sessions:
session: {
  strategy: 'jwt';
} // ✅ Keep this
// Remove: adapter: PrismaAdapter(prisma)
```

c. **Add decision callouts:**

```markdown
> **DECISION:** We are using JWT sessions because the existing
> system has no Session model in the database and is deployed
> to Vercel serverless. See google-oauth-decisions.md for details.
```

d. **Update all file paths** to be specific:

```markdown
❌ BEFORE: "Update your auth configuration"
✅ AFTER: "Update app/api/auth/[...nextauth]/route.ts"
```

3. **Add a "Decisions Applied" section at the top:**

```markdown
# Google OAuth Implementation Guide (Final - With Decisions)

## ⚠️ IMPORTANT: This guide has been customized for Trading Alerts SaaS

**Decision Document:** See `docs/decisions/google-oauth-decisions.md`

**Key Decisions Applied:**

- NextAuth Version: [v4 or v5]
- Session Strategy: [database or jwt]
- Account Linking: [automatic/manual/verified-only]
- Password Field: [nullable or required]
- [List all 12 decisions briefly]

**Last Updated:** [Date]
**Status:** Ready for Implementation by Aider

---

[Rest of implementation guide with decisions applied]
```

---

### **TASK 3: Update OpenAPI Contract**

**Objective:** Add Google OAuth endpoints to the API contract.

**Instructions:**

1. **Open file:** `docs/trading_alerts_openapi.yaml`

2. **Add OAuth-specific endpoints:**

```yaml
# Add this section to paths:

  # Google OAuth Endpoints
  /api/auth/signin/google:
    get:
      summary: Initiate Google OAuth Sign-In
      description: Redirects user to Google OAuth consent screen
      tags:
        - Authentication
        - OAuth
      responses:
        '302':
          description: Redirect to Google OAuth
          headers:
            Location:
              schema:
                type: string
                example: https://accounts.google.com/o/oauth2/v2/auth?...

  /api/auth/callback/google:
    get:
      summary: Google OAuth Callback
      description: Handles OAuth callback from Google after user authorization
      tags:
        - Authentication
        - OAuth
      parameters:
        - name: code
          in: query
          required: true
          schema:
            type: string
          description: Authorization code from Google
        - name: state
          in: query
          required: false
          schema:
            type: string
          description: State parameter for CSRF protection
      responses:
        '302':
          description: Redirects to dashboard or error page
        '401':
          description: Authentication failed

  /api/auth/providers:
    get:
      summary: Get Available Authentication Providers
      description: Returns list of configured OAuth providers
      tags:
        - Authentication
      responses:
        '200':
          description: List of authentication providers
          content:
            application/json:
              schema:
                type: object
                properties:
                  credentials:
                    type: object
                    properties:
                      id:
                        type: string
                        example: "credentials"
                      name:
                        type: string
                        example: "Email and Password"
                      type:
                        type: string
                        example: "credentials"
                  google:
                    type: object
                    properties:
                      id:
                        type: string
                        example: "google"
                      name:
                        type: string
                        example: "Google"
                      type:
                        type: string
                        example: "oauth"

# Update existing schemas:

components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: string
          format: cuid
        email:
          type: string
          format: email
        name:
          type: string
          nullable: true
        image:
          type: string
          nullable: true
          description: Profile picture URL (from Google OAuth or uploaded)
        password:
          type: string
          nullable: true  # ← Update based on your decision
          description: Password hash (NULL for OAuth-only users)
        tier:
          type: string
          enum: [FREE, PRO]
        role:
          type: string
          enum: [USER, ADMIN]
        emailVerified:
          type: string
          format: date-time
          nullable: true
          description: Timestamp when email was verified (auto-set for OAuth)
        createdAt:
          type: string
          format: date-time
        accounts:
          type: array
          items:
            $ref: '#/components/schemas/Account'
          description: OAuth provider accounts linked to this user

    Account:
      type: object
      properties:
        id:
          type: string
          format: cuid
        userId:
          type: string
          format: cuid
        provider:
          type: string
          enum: [google, credentials]
          description: OAuth provider name
        providerAccountId:
          type: string
          description: User ID from the OAuth provider (Google user ID)
        type:
          type: string
          example: "oauth"
        access_token:
          type: string
          nullable: true
          description: OAuth access token (encrypted)
        refresh_token:
          type: string
          nullable: true
          description: OAuth refresh token (encrypted)
        expires_at:
          type: integer
          nullable: true
          description: Token expiration timestamp
      description: OAuth account linked to a user

  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: |
        JWT token from NextAuth.js session.

        **Obtaining a token:**

        1. **Email/Password Login:**
           - POST /api/auth/callback/credentials
           - Body: { email, password }
           - Returns session cookie

        2. **Google OAuth Login:**
           - GET /api/auth/signin/google
           - User authorizes on Google
           - Redirects to /api/auth/callback/google
           - Sets session cookie

        3. **Session Cookie:**
           - Name: next-auth.session-token (production)
           - Name: __Secure-next-auth.session-token (HTTPS)
           - HttpOnly: true
           - Secure: true (production)

        **Using the session:**
        - Server Components: Use getServerSession(authOptions)
        - Client Components: Use useSession() hook
        - API Routes: Use getServerSession(authOptions)
```

3. **Add a changelog note at the top of the OpenAPI file:**

```yaml
info:
  title: Trading Alerts SaaS API
  version: 2.1.0 # ← Increment version
  description: |
    Trading Alerts API with fractal-based indicators and real-time alerts.

    **Version 2.1.0 Updates:**
    - Added Google OAuth authentication endpoints
    - Added Account model for OAuth provider linking
    - Updated User model with nullable password field
    - Updated authentication flow documentation

    **Authentication Methods:**
    1. Email/Password (CredentialsProvider)
    2. Google OAuth (GoogleProvider) ← NEW

    See `/api/auth/providers` for available authentication methods.
```

---

### **TASK 4: Update Architecture Documentation**

**Objective:** Update ARCHITECTURE.md with OAuth integration details.

**Instructions:**

1. **Open file:** `docs/ARCHITECTURE.md`

2. **Update Section 6 (Authentication Flow):**

Replace the entire section with the updated content that includes Google OAuth flows. Reference the version from the implementation guide's PART 9.

3. **Add new subsection 6.5:**

```markdown
### 6.5 OAuth Provider Architecture

**Google OAuth Integration:**
```

┌─────────────────────────────────────────────────────────────────┐
│ AUTHENTICATION METHODS │
│ │
│ ┌──────────────────────┐ ┌─────────────────────────────┐ │
│ │ Email/Password │ │ Google OAuth │ │
│ │ (Credentials) │ │ (OAuth 2.0) │ │
│ └──────────┬───────────┘ └──────────┬──────────────────┘ │
│ │ │ │
│ └────────────┬───────────────┘ │
│ │ │
│ ┌─────▼──────┐ │
│ │ NextAuth │ │
│ │ Session │ │
│ └─────┬──────┘ │
│ │ │
│ ┌─────────▼──────────┐ │
│ │ User Record │ │
│ │ (PostgreSQL) │ │
│ │ │ │
│ │ - id │ │
│ │ - email │ │
│ │ - password (NULL?) │ ← Based on your decision │
│ │ - tier (FREE/PRO) │ │
│ │ - emailVerified │ │
│ │ - accounts[] │ ← OAuth providers │
│ └────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

```

**Key Architectural Decisions:** (Based on `google-oauth-decisions.md`)

1. **Session Strategy:** [Your decision - JWT or Database]
   - [Explain reasoning]

2. **Account Linking:** [Your decision - Automatic/Manual/Verified-only]
   - [Explain security model]

3. **Password Field:** [Your decision - Nullable or Required]
   - OAuth-only users: [How handled]
   - Hybrid users: [How handled]

4. **Profile Picture Source:**
   - Google OAuth: [Always/Fallback/User-choice]
   - Email/Password: [Upload only]

**Database Schema:**

[Include the Account model schema]

**Security Considerations:**

- CSRF Protection: State parameter in OAuth flow
- Token Storage: [JWT in cookie or Database sessions]
- Account Takeover Prevention: [Your linking strategy]
- Email Verification: [Auto for OAuth, manual for email]
```

4. **Update Section 11 (Security Considerations):**

Add a new subsection:

```markdown
### 11.5 OAuth Security

**Google OAuth Integration:**

✅ **Implemented Security Measures:**

- State parameter prevents CSRF attacks
- Secure callback URL validation
- [Account linking strategy based on your decision]
- Email verification via OAuth provider
- Encrypted token storage in database [if using database sessions]
- HttpOnly session cookies
- Secure cookie flag in production

✅ **Account Linking Security:**

- Strategy: [Your decision - explain security model]
- Email verification required: [Yes/No based on decision]
- Password retention: [Keep/Remove after OAuth linking]

✅ **Token Management:**

- Access tokens: [How stored/encrypted]
- Refresh tokens: [How stored/encrypted]
- Token expiration: [Strategy]
- Session strategy: [JWT or Database]

⚠️ **Known Limitations:**

- [List any security tradeoffs from your decisions]

**Security Testing Required:**

- [ ] OAuth CSRF protection verification
- [ ] Account linking attack scenarios
- [ ] Token expiration handling
- [ ] Session hijacking prevention
- [ ] Email verification bypass attempts
```

---

### **TASK 5: Update v5-structure-division.md**

**Objective:** Update Part 5 (Authentication System) file count and details.

**Instructions:**

1. **Open file:** `docs/v5-structure-division.md`

2. **Replace the Part 5 section** with updated information:

```markdown
## PART 5: Authentication System

**Scope:** Complete auth system with Email/Password + Google OAuth

**Status:** ✅ Updated for Google OAuth Integration (v2.1.0)

**Folders & Files:**
```

app/(auth)/
├── layout.tsx
├── login/page.tsx # ✅ UPDATED: Google OAuth button added
├── register/page.tsx # ✅ UPDATED: Google OAuth button added
├── verify-email/page.tsx
├── forgot-password/page.tsx
└── reset-password/page.tsx

app/api/auth/
├── [...nextauth]/route.ts # ✅ UPDATED: GoogleProvider added
├── register/route.ts # Modified: Handle OAuth users
├── verify-email/route.ts
├── forgot-password/route.ts
└── reset-password/route.ts

components/auth/
├── register-form.tsx # ✅ UPDATED: OAuth integration
├── login-form.tsx # ✅ UPDATED: OAuth integration
├── forgot-password-form.tsx
├── social-auth-buttons.tsx # ✅ NEW: Reusable OAuth buttons
└── oauth-error-handler.tsx # ✅ NEW: OAuth error display

lib/auth/
├── auth-options.ts # ✅ UPDATED: Google OAuth config
├── session.ts # ✅ UPDATED: Handle OAuth sessions
├── permissions.ts
└── oauth-callbacks.ts # ✅ NEW: OAuth callback handlers

types/
├── auth.ts
└── next-auth.d.ts # ✅ NEW: NextAuth type extensions

middleware.ts # ✅ UPDATED: OAuth routes

prisma/schema.prisma # ✅ UPDATED: Account, Session models

````

**Key Changes from V4:**
- ✅ Added Google OAuth via NextAuth.js [v4 or v5 - your decision]
- ✅ Account linking (strategy: [your decision])
- ✅ Profile picture from Google OAuth
- ✅ Auto email verification via OAuth
- ✅ Separate authentication paths (credentials vs oauth)
- ✅ Updated Prisma schema (Account [+ Session if using DB sessions])
- ✅ OAuth-specific error handling
- ✅ [Password nullable: Yes/No - your decision]

**Authentication Methods:**
1. Email/Password (CredentialsProvider) - Existing
2. Google OAuth (GoogleProvider) - NEW

**Session Strategy:** [JWT or Database - your decision]

**Account Linking:** [Automatic/Manual/Verified-only - your decision]

**File Count:** ~23 files (was ~17)
- Added: 6 new files (oauth-callbacks.ts, social-auth-buttons.tsx, next-auth.d.ts, etc.)
- Updated: 8 existing files
- Database: 1-2 new models (Account, [Session if DB sessions])

**Dependencies Added:**
```json
{
  "next-auth": "^[version based on decision]",
  "@auth/prisma-adapter": "^1.0.12"  // [If using database sessions]
}
````

**Environment Variables Required:**

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
```

**Testing Requirements:**

- [ ] Email/password login still works
- [ ] Google OAuth signup creates user
- [ ] Google OAuth login works
- [ ] Account linking works (email match)
- [ ] Profile picture imports from Google
- [ ] Email verification auto-set for OAuth
- [ ] Tier (FREE) set correctly for new OAuth users
- [ ] Session persists across both auth methods

**Implementation Priority:** ⭐⭐⭐ (High - Core feature)

````

---

### **TASK 6: Create Aider Policy Document**

**Objective:** Create a policy document for Aider to follow when building OAuth files.

**Instructions:**

1. **Create new file:** `docs/policies/08-google-oauth-implementation-rules.md`

2. **Content:**

```markdown
# Policy 08: Google OAuth Implementation Rules

**Version:** 1.0
**Date:** [Current Date]
**Scope:** Part 5 (Authentication System) - Google OAuth Integration
**Status:** Active
**Decision Document:** `docs/decisions/google-oauth-decisions.md`

---

## 1. Core Principles

### 1.1 Additive, Not Replacement
- Google OAuth is ADDED to existing email/password authentication
- Email/password login MUST continue working without any changes
- All existing users MUST be able to log in as before
- No breaking changes to existing authentication flow

### 1.2 Security First
- Account linking strategy: **[Your decision from ambiguity #3]**
- Session strategy: **[Your decision from ambiguity #2]**
- Email verification: **[Your decision from ambiguity #5]**
- Always use HTTPS in production
- Always validate OAuth state parameter (CSRF protection)

### 1.3 Tier Independence
- ALL new users (OAuth or email) start as FREE tier
- Authentication method does NOT affect tier
- Payment provider selection is independent of auth method
- Tier upgrades handled by existing payment webhooks (Part 12 & 18)

---

## 2. Technical Decisions (From Decision Document)

**Reference:** `docs/decisions/google-oauth-decisions.md`

### 2.1 NextAuth Version
- **Version:** [Your decision: v4 or v5]
- **Rationale:** [From decision document]
- **Code Pattern:**
  ```typescript
  // [v4 or v5 import style based on decision]
````

### 2.2 Session Strategy

- **Strategy:** [Your decision: JWT or Database]
- **Rationale:** [From decision document]
- **Configuration:**
  ```typescript
  session: {
    strategy: '[jwt or database]';
  }
  // [Include/exclude adapter based on decision]
  ```

### 2.3 Database Schema

- **Password Field:** [Your decision: nullable or required]
- **Session Model:** [Include or exclude based on session strategy]
- **Account Model:** Required (always)

**Prisma Schema Rules:**

```prisma
model User {
  password String[? based on decision]
  // ...
  accounts Account[]
  [sessions Session[] // Only if database sessions]
}

model Account {
  // Always required
}

[model Session {
  // Only if database sessions
}]
```

### 2.4 Account Linking

- **Strategy:** [Your decision: automatic/manual/verified-only]
- **Implementation:**
  ```typescript
  // [Specific signIn callback logic based on decision]
  ```

---

## 3. File Implementation Rules

### 3.1 NextAuth Configuration

**File:** `app/api/auth/[...nextauth]/route.ts`

**MUST Include:**

- ✅ GoogleProvider with correct client ID/secret
- ✅ CredentialsProvider (existing email/password)
- ✅ Session strategy: [your decision]
- ✅ [Adapter if using database sessions]
- ✅ signIn callback with account linking logic
- ✅ jwt callback with tier and role
- ✅ session callback with tier and role

**MUST NOT:**

- ❌ Remove or modify existing CredentialsProvider
- ❌ Change existing session structure
- ❌ Add tier logic to authentication (tier upgrades are separate)

**Template:**

```typescript
// [Provide full template based on all decisions]
```

### 3.2 Login Page

**File:** `app/(auth)/login/page.tsx`

**MUST Include:**

- ✅ Google OAuth button (above divider)
- ✅ Existing email/password form (below divider)
- ✅ Loading states for both auth methods
- ✅ Error handling for OAuth failures
- ✅ "Or continue with email" divider

**MUST NOT:**

- ❌ Remove email/password form
- ❌ Change existing form validation
- ❌ Modify successful login redirect (still /dashboard)

**UI Pattern:**

```tsx
// [Provide component structure]
```

### 3.3 Register Page

**File:** `app/(auth)/register/page.tsx`

**Same rules as login page:**

- Google OAuth button first
- Email/password form second
- Both methods lead to FREE tier initially

### 3.4 Database Migration

**Files:** `prisma/schema.prisma`, `prisma/migrations/`

**MUST Include:**

- ✅ Account model (always)
- ✅ [Session model if using database sessions]
- ✅ VerificationToken model (always)
- ✅ User.password [nullable if decided]
- ✅ User.image field
- ✅ User.emailVerified field

**Migration Strategy:**

```sql
-- [Provide migration SQL if schema changes needed]
```

---

## 4. Code Quality Standards

### 4.1 TypeScript

- All OAuth functions MUST have explicit types
- No `any` types in OAuth code
- Use type definitions from `types/next-auth.d.ts`

### 4.2 Error Handling

- All OAuth operations wrapped in try-catch
- User-friendly error messages (strategy: [generic or specific from decision])
- Server-side errors logged but not exposed to users

**Error Handling Pattern:**

```typescript
try {
  await signIn('google', { callbackUrl });
} catch (error) {
  // [Handle based on error handling decision]
}
```

### 4.3 Environment Variables

- All OAuth env vars in `.env.example` with placeholders
- Validate env vars at startup
- Never commit actual credentials

---

## 5. Testing Requirements

### 5.1 Manual Testing Checklist

- [ ] Google OAuth signup creates FREE tier user
- [ ] Google OAuth login works for existing users
- [ ] Email/password login still works (no regression)
- [ ] Account linking works according to strategy
- [ ] Profile picture imports from Google
- [ ] Session persists correctly
- [ ] Logout works for both auth methods
- [ ] Error messages display correctly

### 5.2 Edge Cases to Test

- [ ] User cancels Google consent screen
- [ ] User tries to link with already-linked email
- [ ] OAuth callback timeout/failure
- [ ] User has password + adds Google
- [ ] OAuth-only user (no password)

---

## 6. Security Checklist

- [ ] NEXTAUTH_SECRET is strong (32+ characters)
- [ ] Google OAuth redirect URIs are exact matches
- [ ] State parameter verified in callbacks
- [ ] Session cookies are httpOnly and secure (production)
- [ ] Account linking follows security decision
- [ ] Tokens encrypted if stored in database
- [ ] No sensitive data in error messages

---

## 7. Aider-Specific Instructions

### 7.1 When Building OAuth Files

1. Read this policy document first
2. Reference `docs/decisions/google-oauth-decisions.md` for all decisions
3. Use templates from `docs/implementation-guides/google-oauth-implementation-guide-FINAL.md`
4. Follow code patterns from existing auth files
5. Maintain consistency with existing codebase

### 7.2 File Dependencies

**Read-Only Files (Reference Only):**

- `docs/decisions/google-oauth-decisions.md`
- `docs/implementation-guides/google-oauth-implementation-guide-FINAL.md`
- `docs/policies/08-google-oauth-implementation-rules.md`

**Files to Create/Modify:**

- [List all files from decision document]

### 7.3 Validation Requirements

After building each file, validate:

- TypeScript compiles without errors
- Follows decision document choices
- Matches existing code style
- Security checklist passed
- Testing checklist items can be tested

---

## 8. Common Pitfalls to Avoid

### ❌ DO NOT:

1. Remove or modify existing email/password authentication
2. Use `allowDangerousEmailAccountLinking: true` [unless decided]
3. Add tier upgrade logic to authentication flow
4. Commit Google OAuth credentials to git
5. Mix authentication methods (keep OAuth and credentials separate)
6. Forget to handle OAuth-only users (password = NULL)
7. Skip email verification for OAuth users [unless decided]
8. Hardcode OAuth URLs (use environment variables)

### ✅ DO:

1. Keep authentication simple and secure
2. Follow existing patterns from the codebase
3. Handle errors gracefully with user-friendly messages
4. Test both authentication methods thoroughly
5. Document any deviations from the guide
6. Use TypeScript strictly
7. Validate environment variables
8. Follow the decision document exactly

---

## 9. Success Criteria

✅ **Implementation Complete When:**

- Google OAuth button appears on login/register
- Users can sign up with Google (creates FREE tier)
- Users can sign in with Google
- Existing email/password auth works unchanged
- Account linking works per decision strategy
- Profile pictures import from Google
- Sessions work for both auth methods
- All tests pass
- No security vulnerabilities
- Documentation complete

---

## 10. Escalation Triggers

**Escalate to Human if:**

- Security concern discovered
- Decision conflicts with existing code
- Breaking change required
- Unclear edge case encountered
- Migration could lose user data
- Third-party API changes

**Escalation Process:**

1. Stop implementation
2. Document the issue
3. Propose 2-3 solutions with pros/cons
4. Wait for human decision
5. Update this policy if needed

---

## Appendix A: Quick Reference

**Decision Document:** `docs/decisions/google-oauth-decisions.md`
**Implementation Guide:** `docs/implementation-guides/google-oauth-implementation-guide-FINAL.md`
**OpenAPI Contract:** `docs/trading_alerts_openapi.yaml` (Section: Google OAuth)
**Architecture Doc:** `docs/ARCHITECTURE.md` (Section 6: Authentication)

**Key Files:**

- Config: `app/api/auth/[...nextauth]/route.ts`
- Schema: `prisma/schema.prisma`
- Login: `app/(auth)/login/page.tsx`
- Register: `app/(auth)/register/page.tsx`
- Types: `types/next-auth.d.ts`

**Environment:**

- Dev: `.env.local`
- Prod: Vercel environment variables
- Example: `.env.example`

**Testing:**

- Manual: `docs/testing/oauth-testing-checklist.md`
- Validation: Section 5.1 of this policy

---

**Last Updated:** [Date]
**Next Review:** After implementation complete
**Policy Owner:** Human (Policy Maker)
**Implementer:** Aider (Autonomous Builder)
**Validator:** Claude Code (Validator)

````

---

### **TASK 7: Update .aider.conf.yml**

**Objective:** Configure Aider to use OAuth documentation as read-only references.

**Instructions:**

1. **Open file:** `.aider.conf.yml`

2. **Add OAuth documentation to read-only files:**

```yaml
# Existing configuration...

# OAuth Implementation References (Read-Only)
read:
  # Decision Documents
  - docs/decisions/google-oauth-decisions.md

  # Implementation Guides
  - docs/implementation-guides/google-oauth-implementation-guide-FINAL.md

  # Policy Documents
  - docs/policies/08-google-oauth-implementation-rules.md

  # Testing Guides
  - docs/testing/oauth-testing-checklist.md

  # Architecture References
  - docs/ARCHITECTURE.md
  - docs/v5-structure-division.md

  # API Contract
  - docs/trading_alerts_openapi.yaml

  # Seed Code (if exists)
  - seed-code/auth/google-oauth-example.tsx

# Files Aider Can Create/Modify for OAuth
# (These will be determined by decision document)

# Aider Instructions
model: [your model - minimax/claude/etc.]

# OAuth-Specific Instructions
architect_mode: true
conventions:
  - Always read decision document before implementing
  - Follow policy 08 strictly
  - Validate against OpenAPI contract
  - Maintain consistency with existing auth
  - Test both auth methods after changes
````

---

### **TASK 8: Create OAuth Testing Checklist**

**Objective:** Provide detailed testing guide for Claude Code to validate.

**Instructions:**

1. **Create new file:** `docs/testing/oauth-testing-checklist.md`

2. **Content:**

````markdown
# Google OAuth Testing Checklist

**Version:** 1.0
**Date:** [Current Date]
**Purpose:** Validation checklist for Claude Code and Human testers

---

## Testing Phases

### Phase 1: Environment Setup ✅

- [ ] Google OAuth credentials obtained from Google Cloud Console
- [ ] Environment variables set in `.env.local`:
  - [ ] GOOGLE_CLIENT_ID
  - [ ] GOOGLE_CLIENT_SECRET
  - [ ] NEXTAUTH_URL
  - [ ] NEXTAUTH_SECRET
- [ ] Callback URL added to Google Console:
  - [ ] `http://localhost:3000/api/auth/callback/google` (dev)
  - [ ] `https://yourdomain.com/api/auth/callback/google` (prod)
- [ ] Database migration run successfully
- [ ] Prisma schema updated (Account [+ Session if needed])
- [ ] Server restarts without errors
- [ ] TypeScript compiles without errors

---

### Phase 2: Email/Password Authentication (Regression Testing) ✅

**Test existing auth still works:**

#### Test 2.1: Email/Password Registration

- [ ] Visit `/register`
- [ ] Fill form: name, email, password
- [ ] Submit form
- [ ] User created in database
- [ ] User.tier = "FREE"
- [ ] User.password is hashed
- [ ] [User.emailVerified is NULL or timestamp based on decision]
- [ ] Redirects to dashboard
- [ ] Session cookie set

#### Test 2.2: Email/Password Login

- [ ] Visit `/login`
- [ ] Enter existing credentials
- [ ] Submit form
- [ ] Session created successfully
- [ ] Redirects to dashboard
- [ ] User tier displayed correctly
- [ ] Can access FREE tier features

#### Test 2.3: Invalid Credentials

- [ ] Visit `/login`
- [ ] Enter wrong password
- [ ] Error message displays: "Invalid credentials"
- [ ] Does not create session
- [ ] Stays on login page

#### Test 2.4: Logout

- [ ] Click logout button
- [ ] Session destroyed
- [ ] Redirects to homepage
- [ ] Cannot access /dashboard (redirects to /login)

---

### Phase 3: Google OAuth Registration (New Feature) ✅

#### Test 3.1: Google OAuth Signup - New User

- [ ] Visit `/register`
- [ ] Google OAuth button visible
- [ ] Click "Sign up with Google"
- [ ] Redirects to Google consent screen
- [ ] Select Google account
- [ ] Authorize application
- [ ] Redirects back to application
- [ ] **Database Checks:**
  - [ ] User created with Google email
  - [ ] User.password = NULL [based on decision]
  - [ ] User.emailVerified = [timestamp]
  - [ ] User.tier = "FREE"
  - [ ] User.image = [Google profile picture URL]
  - [ ] Account record created:
    - [ ] provider = "google"
    - [ ] providerAccountId = [Google user ID]
    - [ ] access_token stored [if applicable]
- [ ] Redirects to /dashboard
- [ ] Session created
- [ ] Profile picture displays (from Google)
- [ ] User sees FREE tier limitations

#### Test 3.2: Google OAuth Signup - Cancel Flow

- [ ] Visit `/register`
- [ ] Click "Sign up with Google"
- [ ] On Google consent screen, click "Cancel"
- [ ] Redirects back to `/register`
- [ ] Error message displays
- [ ] No user created
- [ ] No session created
- [ ] Can try again

---

### Phase 4: Google OAuth Login (Existing User) ✅

#### Test 4.1: OAuth-Only User Login

**Setup:** Create OAuth user in Test 3.1

- [ ] Logout
- [ ] Visit `/login`
- [ ] Click "Sign in with Google"
- [ ] Google auto-approves (already authorized)
- [ ] Redirects to /dashboard
- [ ] Session created
- [ ] User tier preserved (FREE or PRO)
- [ ] Profile picture still shows

#### Test 4.2: Multiple OAuth Logins

- [ ] Login with Google (Test 4.1)
- [ ] Logout
- [ ] Login with Google again
- [ ] Works without re-authorization
- [ ] Session created each time
- [ ] User data unchanged

---

### Phase 5: Account Linking ✅

**CRITICAL: Test based on your decision from ambiguity #3**

#### Test 5.1: Email User Links Google Account

**Strategy:** [Your decision - Automatic/Manual/Verified-only]

**Setup:**

1. Create user with email/password (Test 2.1)
2. Note the email address

**Test Steps:**

- [ ] Logout
- [ ] Click "Sign in with Google"
- [ ] Use SAME email address as email/password user
- [ ] [Expected behavior based on decision:]
  - **If Automatic:** Accounts linked, no error
  - **If Manual:** Error: "Email already in use"
  - **If Verified-only:** Link if emailVerified, else error
- [ ] **Database Checks (if linked):**
  - [ ] Only ONE User record (not duplicated)
  - [ ] Account record added with provider="google"
  - [ ] User.emailVerified updated [if was NULL]
  - [ ] User.image updated to Google picture
  - [ ] User.password still exists [based on decision]
  - [ ] User.tier unchanged (preserved)
- [ ] Can now sign in with EITHER method
- [ ] Session data identical regardless of login method

#### Test 5.2: PRO User Links Google

**Setup:**

1. Create PRO user (upgrade a FREE user via Stripe)
2. Note the email

**Test Steps:**

- [ ] PRO user signs in with Google (same email)
- [ ] Accounts link (based on strategy)
- [ ] **Critical:** User.tier = "PRO" (PRESERVED)
- [ ] Subscription record unchanged
- [ ] Can sign in with email/password
- [ ] Can sign in with Google
- [ ] PRO features work with both methods

#### Test 5.3: Unverified Email User Links Google

**Only if using "Verified-only" linking strategy**

**Setup:**

1. Create email user but DON'T verify email

**Test Steps:**

- [ ] Try to sign in with Google (same email)
- [ ] Error: "Please verify your email first"
- [ ] Does NOT link accounts
- [ ] User must verify email via link
- [ ] After verification, Google OAuth link works

---

### Phase 6: Profile Picture Handling ✅

**Based on decision from ambiguity #6**

#### Test 6.1: New OAuth User Profile Picture

- [ ] Sign up with Google OAuth
- [ ] Profile picture displays (from Google)
- [ ] Visit /settings/profile
- [ ] Picture shown correctly
- [ ] Picture URL is Google's CDN

#### Test 6.2: Email User Gets Google Picture

**If linking strategy allows:**

- [ ] Email user (no profile picture)
- [ ] Links Google account
- [ ] Profile picture now shows Google picture
- [ ] [Based on decision: Always/Fallback/Choice]

#### Test 6.3: Custom Avatar Preservation

**If avatar upload feature exists:**

- [ ] User uploads custom avatar
- [ ] Links Google account
- [ ] [Expected based on decision:]
  - **Always:** Google picture replaces custom
  - **Fallback:** Custom avatar kept
  - **Choice:** User can choose in settings

---

### Phase 7: Session Management ✅

**Based on session strategy decision (JWT or Database)**

#### Test 7.1: Session Persistence

- [ ] Login with Google OAuth
- [ ] Check session cookie exists
- [ ] Close browser tab
- [ ] Open `/dashboard` in new tab
- [ ] Still logged in (session persists)

#### Test 7.2: Session Contains Correct Data

**Open browser dev tools → Application → Cookies**

- [ ] Session cookie name: `next-auth.session-token`
- [ ] Cookie is httpOnly: true
- [ ] Cookie is secure: [true in production]
- [ ] **If JWT sessions:**
  - [ ] Decode JWT (use jwt.io)
  - [ ] Contains: id, email, tier, role
- [ ] **If Database sessions:**
  - [ ] Session record in database
  - [ ] sessionToken matches cookie
  - [ ] userId links to User

#### Test 7.3: Session Expiration

- [ ] Wait for session to expire (or manually expire)
- [ ] Try to access /dashboard
- [ ] Redirects to /login
- [ ] Error message optional

#### Test 7.4: Logout Destroys Session

- [ ] Login with any method
- [ ] Click logout
- [ ] Check session cookie deleted
- [ ] **If Database sessions:** Session record deleted
- [ ] Cannot access protected routes

---

### Phase 8: Error Handling ✅

#### Test 8.1: Network Error During OAuth

- [ ] Disconnect internet
- [ ] Click "Sign in with Google"
- [ ] [Handle gracefully - don't crash]
- [ ] Show error message
- [ ] Can retry when reconnected

#### Test 8.2: Invalid OAuth Credentials

**In Google Console, temporarily disable OAuth client**

- [ ] Try to sign in with Google
- [ ] OAuth fails
- [ ] Error message shows
- [ ] Does not create session
- [ ] Stays on login page

#### Test 8.3: OAuth State Mismatch (CSRF)

**Simulate CSRF attack:**

- [ ] Manually construct invalid callback URL
- [ ] Visit: `/api/auth/callback/google?code=invalid&state=invalid`
- [ ] Error: "Invalid state parameter" or similar
- [ ] No session created
- [ ] Security log event [if logging configured]

---

### Phase 9: Database Integrity ✅

#### Test 9.1: No Duplicate Users

- [ ] Create user with email: `test@example.com` (email/password)
- [ ] Try OAuth with same email
- [ ] [Based on linking strategy]
- [ ] Check database: Only ONE user with that email
- [ ] No orphaned records

#### Test 9.2: Account Records

- [ ] OAuth user exists
- [ ] Check `Account` table:
  - [ ] One record per OAuth provider
  - [ ] provider = "google"
  - [ ] providerAccountId = [Google ID]
  - [ ] userId links to User
- [ ] Email/password user has NO Account record

#### Test 9.3: Session Records (if Database sessions)

- [ ] User logged in
- [ ] Check `Session` table:
  - [ ] One active session record
  - [ ] sessionToken matches cookie
  - [ ] expires is future timestamp
  - [ ] userId links to User
- [ ] After logout:
  - [ ] Session record deleted

---

### Phase 10: Tier System Integration ✅

**Critical: Verify tier logic is independent of auth method**

#### Test 10.1: New Google OAuth User Starts as FREE

- [ ] Sign up with Google OAuth
- [ ] Check User.tier = "FREE"
- [ ] Dashboard shows FREE limitations:
  - [ ] 5 symbols only
  - [ ] 3 timeframes only
  - [ ] 5 alerts maximum
- [ ] PRO features disabled/locked

#### Test 10.2: OAuth User Can Upgrade to PRO

- [ ] OAuth user (FREE tier)
- [ ] Visit `/pricing`
- [ ] Click "Upgrade to PRO"
- [ ] **Choose Stripe:**
  - [ ] Complete Stripe checkout
  - [ ] Webhook updates User.tier = "PRO"
  - [ ] 15 symbols available
  - [ ] 9 timeframes available
  - [ ] 20 alerts maximum
- [ ] **OR Choose dLocal:**
  - [ ] Select 3-day or monthly plan
  - [ ] Complete payment
  - [ ] Webhook updates User.tier = "PRO"
  - [ ] Same PRO features as Stripe

#### Test 10.3: PRO User Remains PRO After Google Link

- [ ] PRO user (paid via Stripe)
- [ ] Links Google account
- [ ] Check User.tier = "PRO" (unchanged)
- [ ] Subscription record unchanged
- [ ] PRO features still work
- [ ] Can sign in with email OR Google
- [ ] PRO access works with both methods

#### Test 10.4: Email User vs OAuth User - Same Upgrade Flow

- [ ] Create two users:
  1. Email/password user (FREE)
  2. Google OAuth user (FREE)
- [ ] Both upgrade to PRO (same payment flow)
- [ ] Both get same PRO features
- [ ] Payment provider choice independent of auth method
- [ ] Auth method NOT stored in Subscription record

---

### Phase 11: UI/UX Validation ✅

#### Test 11.1: Login Page Layout

- [ ] Visit `/login`
- [ ] Google OAuth button visible
- [ ] Button styled correctly (Google branding)
- [ ] Divider: "Or continue with email"
- [ ] Email/password form below
- [ ] Both buttons have loading states
- [ ] Error messages display clearly
- [ ] "Sign up" link works
- [ ] "Forgot password" link works

#### Test 11.2: Register Page Layout

- [ ] Visit `/register`
- [ ] Same layout as login
- [ ] Google button first
- [ ] Form second
- [ ] Terms/Privacy links present
- [ ] "Already have account?" link works

#### Test 11.3: Profile Display

- [ ] Login with Google OAuth
- [ ] Visit dashboard
- [ ] Profile picture shows in header
- [ ] Name displays correctly
- [ ] Tier badge shows (FREE or PRO)
- [ ] User menu works (settings, logout)

#### Test 11.4: Settings Page

- [ ] Visit `/settings/profile`
- [ ] Google profile picture displays
- [ ] Name is editable
- [ ] Email is NOT editable (from Google)
- [ ] [Based on decision: Can change picture or not]
- [ ] Shows "Connected accounts: Google"

---

### Phase 12: Production Readiness ✅

#### Test 12.1: Environment Variables

- [ ] All OAuth env vars in `.env.example`
- [ ] Vercel production env vars set:
  - [ ] GOOGLE_CLIENT_ID
  - [ ] GOOGLE_CLIENT_SECRET
  - [ ] NEXTAUTH_URL (production domain)
  - [ ] NEXTAUTH_SECRET (strong, unique)
- [ ] No credentials in source code
- [ ] No credentials in git history

#### Test 12.2: Google Cloud Console

- [ ] Production callback URL added:
  - [ ] `https://yourdomain.com/api/auth/callback/google`
- [ ] Authorized JavaScript origins:
  - [ ] `https://yourdomain.com`
- [ ] OAuth consent screen published
- [ ] Scopes: userinfo.email, userinfo.profile

#### Test 12.3: HTTPS Enforcement

- [ ] Production uses HTTPS
- [ ] Session cookie secure flag: true
- [ ] OAuth redirects use HTTPS
- [ ] No mixed content warnings

#### Test 12.4: Performance

- [ ] OAuth flow completes in < 3 seconds
- [ ] No unnecessary database queries
- [ ] [If JWT sessions: No session DB queries]
- [ ] [If DB sessions: Session queries optimized]

---

### Phase 13: Security Audit ✅

#### Test 13.1: CSRF Protection

- [ ] OAuth state parameter generated
- [ ] State validated in callback
- [ ] Invalid state rejected
- [ ] State is unpredictable (random)

#### Test 13.2: Token Security

- [ ] Access tokens encrypted [if stored]
- [ ] Refresh tokens encrypted [if stored]
- [ ] Tokens not exposed in client code
- [ ] Tokens not in error messages

#### Test 13.3: Account Takeover Prevention

- [ ] Cannot claim someone else's email via OAuth
- [ ] Account linking follows security decision
- [ ] Email verification enforced [if decided]
- [ ] No bypass methods exist

#### Test 13.4: Session Security

- [ ] Session cookies are httpOnly
- [ ] Session cookies are secure (production)
- [ ] Session cookies use SameSite
- [ ] Session expiration configured
- [ ] Cannot steal/reuse session tokens

---

## Summary Checklist

### Critical Tests (Must Pass)

- [ ] Email/password login still works (no regression)
- [ ] Google OAuth signup creates FREE user
- [ ] Google OAuth login works
- [ ] Account linking follows security decision
- [ ] Tier system independent of auth method
- [ ] No duplicate user records
- [ ] Sessions work for both auth methods
- [ ] PRO users remain PRO after linking

### High Priority Tests

- [ ] Profile pictures import from Google
- [ ] Error handling works gracefully
- [ ] UI/UX is polished
- [ ] Database integrity maintained
- [ ] Environment variables secure

### Medium Priority Tests

- [ ] Session expiration works
- [ ] Logout destroys sessions
- [ ] Multiple OAuth logins work
- [ ] Settings page displays correctly

---

## Test Reports

**Template for each test run:**

```markdown
## Test Run Report

**Date:** [Date]
**Tester:** [Name or "Automated"]
**Environment:** [Dev/Staging/Prod]
**Build:** [Git commit hash]

### Results

- Total Tests: [Number]
- Passed: [Number]
- Failed: [Number]
- Skipped: [Number]

### Failed Tests

1. Test 3.1 - Google OAuth Signup
   - Expected: User created with FREE tier
   - Actual: User created with NULL tier
   - Severity: High
   - Fix: Update signIn callback to set tier

[List all failures]

### Recommendations

- [Fix A before deploying]
- [Test B needs improvement]
```
````

---

## Automated Testing (Future)

**E2E Test Suite (Playwright/Cypress):**

```typescript
// Example: test-google-oauth-flow.spec.ts
describe('Google OAuth Flow', () => {
  it('should create FREE tier user on signup', async () => {
    // Test automation here
  });
});
```

**Unit Tests:**

```typescript
// Example: oauth-callbacks.test.ts
describe('OAuth Callbacks', () => {
  it('should link accounts when email matches', async () => {
    // Test logic here
  });
});
```

---

**Last Updated:** [Date]
**Next Review:** After implementation
**Maintained By:** Claude Code (Validator) + Human (QA)

````

---

### **TASK 9: Create Environment Setup Guide**

**Objective:** Step-by-step guide for Google Cloud Console setup.

**Instructions:**

1. **File already created in implementation guide:** `docs/setup/google-oauth-setup.md`

2. **Verify it exists, or recreate** with same content from Part 10 of the implementation guide.

3. **Add reference in main README:**

**File:** `README.md`

Add this section:

```markdown
## Authentication Setup

### Email/Password Authentication
Default authentication method. No additional setup required.

### Google OAuth Setup
See [Google OAuth Setup Guide](docs/setup/google-oauth-setup.md) for:
- Creating Google Cloud project
- Configuring OAuth consent screen
- Obtaining client credentials
- Setting up redirect URIs
````

---

### **TASK 10: Create Summary Document**

**Objective:** One-page summary of all updates for Human review.

**Instructions:**

1. **Create new file:** `docs/google-oauth-integration-summary.md`

2. **Content:**

```markdown
# Google OAuth Integration - Implementation Summary

**Date:** [Current Date]
**Status:** Ready for Aider Implementation
**Decision Document:** `docs/decisions/google-oauth-decisions.md`

---

## 📋 What Was Done

### 1. ✅ Codebase Analysis Complete

- Analyzed 12 critical ambiguities
- Made informed decisions based on existing patterns
- Documented all decisions with reasoning

### 2. ✅ Documentation Created/Updated

**New Documents (10 files):**

1. `docs/decisions/google-oauth-decisions.md` - Decision record
2. `docs/implementation-guides/google-oauth-implementation-guide-FINAL.md` - Updated guide
3. `docs/policies/08-google-oauth-implementation-rules.md` - Aider policy
4. `docs/testing/oauth-testing-checklist.md` - Testing guide
5. `docs/setup/google-oauth-setup.md` - Google Console setup
6. `docs/google-oauth-integration-summary.md` - This file

**Updated Documents (4 files):** 7. `docs/trading_alerts_openapi.yaml` - OAuth endpoints added 8. `docs/ARCHITECTURE.md` - Section 6 updated 9. `docs/v5-structure-division.md` - Part 5 updated 10. `.aider.conf.yml` - OAuth references added

**Total:** 14 documentation files

### 3. ✅ Policy Integration

- Created Aider policy document (Policy 08)
- Updated .aider.conf.yml with read-only references
- Defined clear implementation rules
- Established escalation triggers

### 4. ✅ Testing Strategy

- 126-point testing checklist created
- Manual testing procedures documented
- Validation criteria defined
- Security audit checklist included

---

## 🎯 Key Decisions Made

| Decision              | Choice      | Rationale |
| --------------------- | ----------- | --------- |
| 1. NextAuth Version   | [v4/v5]     | [Reason]  |
| 2. Session Strategy   | [JWT/DB]    | [Reason]  |
| 3. Account Linking    | [Method]    | [Reason]  |
| 4. Password Nullable  | [Yes/No]    | [Reason]  |
| 5. Email Verification | [Method]    | [Reason]  |
| 6. Profile Picture    | [Method]    | [Reason]  |
| 7. Production Setup   | [Structure] | [Reason]  |
| 8. Error Handling     | [Method]    | [Reason]  |
| 9. Testing Strategy   | [Method]    | [Reason]  |
| 10. DB Migration      | [Needed?]   | [Reason]  |
| 11. Callback URLs     | [Strategy]  | [Reason]  |
| 12. Tier Upgrade UX   | [Method]    | [Reason]  |

**See full details:** `docs/decisions/google-oauth-decisions.md`

---

## 📂 Files Ready for Aider

### Files to Create (New)

- [ ] `types/next-auth.d.ts`
- [ ] `lib/auth/oauth-callbacks.ts`
- [ ] `components/auth/social-auth-buttons.tsx`
- [ ] `components/auth/oauth-error-handler.tsx`
- [ ] [Migration file if needed]

### Files to Modify (Existing)

- [ ] `app/api/auth/[...nextauth]/route.ts`
- [ ] `app/(auth)/login/page.tsx`
- [ ] `app/(auth)/register/page.tsx`
- [ ] `prisma/schema.prisma`
- [ ] `lib/auth/auth-options.ts`
- [ ] `lib/auth/session.ts`
- [ ] `middleware.ts`
- [ ] `.env.example`

**Total:** 13 implementation files

---

## 🔄 Workflow: Aider → Claude Code → Human

### Phase 3: Autonomous Building (Aider)

**Input Documents:**

- `docs/decisions/google-oauth-decisions.md`
- `docs/implementation-guides/google-oauth-implementation-guide-FINAL.md`
- `docs/policies/08-google-oauth-implementation-rules.md`

**Aider Tasks:**

1. Read all policy documents
2. Implement OAuth system following decisions
3. Create new files (5 files)
4. Update existing files (8 files)
5. Run migrations (if needed)
6. Verify TypeScript compiles

**Estimated Time:** [X hours based on decisions]

### Phase 4: Validation (Claude Code)

**Validation Checks:**

- [ ] TypeScript compiles without errors
- [ ] All decisions from document followed
- [ ] Code quality standards met (no `any`, proper error handling)
- [ ] Security checklist passed
- [ ] Follows existing code patterns
- [ ] OpenAPI contract matches implementation
- [ ] No breaking changes to existing auth

**Tools:**

- ESLint
- TypeScript compiler
- Manual code review
- Testing checklist

### Phase 5: Human Testing & Approval

**Manual Testing:**

- [ ] Follow `docs/testing/oauth-testing-checklist.md`
- [ ] Test critical flows (13 phases)
- [ ] Verify security measures
- [ ] Test both auth methods
- [ ] Approve for production

**Approval Checklist:**

- [ ] Email/password login still works
- [ ] Google OAuth works
- [ ] Tier system correct
- [ ] No regressions
- [ ] Documentation complete

---

## 🚀 Next Steps

### Immediate (Human Action Required)

1. **Review decision document:** `docs/decisions/google-oauth-decisions.md`
2. **Approve decisions or request changes**
3. **Set up Google Cloud Console** (follow `docs/setup/google-oauth-setup.md`)
4. **Add environment variables to Vercel**

### After Human Approval (Aider Implementation)

5. **Aider:** Implement OAuth system
6. **Aider:** Run database migrations (if needed)
7. **Aider:** Verify builds successfully

### Validation Phase (Claude Code)

8. **Claude Code:** Validate implementation
9. **Claude Code:** Run ESLint and TypeScript checks
10. **Claude Code:** Verify security checklist

### Testing Phase (Human)

11. **Human:** Test OAuth flow locally
12. **Human:** Test account linking
13. **Human:** Test tier system integration
14. **Human:** Approve for staging deployment

### Deployment

15. **Deploy to staging**
16. **Test on staging**
17. **Deploy to production**
18. **Monitor for issues**

---

## 📊 Success Metrics

**Definition of Done:**

- ✅ All 14 documentation files created/updated
- ✅ All 12 decisions made and documented
- ✅ Aider policy document ready
- ✅ OpenAPI contract updated
- ✅ Testing checklist complete (126 tests)
- ✅ Implementation guide customized
- ✅ Security measures documented
- ✅ No ambiguities remaining

**Implementation Success:**

- ✅ Aider builds all 13 files successfully
- ✅ Claude Code validates implementation
- ✅ Human tests pass all critical flows
- ✅ No breaking changes to existing users
- ✅ Google OAuth works in production
- ✅ Tier system independent of auth method

---

## ⚠️ Important Notes

### For Aider

- Read `docs/policies/08-google-oauth-implementation-rules.md` FIRST
- Follow ALL decisions from decision document
- Do NOT deviate from approved patterns
- Escalate if unclear (don't guess)

### For Claude Code

- Validate against OpenAPI contract
- Check TypeScript types strictly
- Verify security checklist items
- Ensure quality standards met

### For Human

- Review decision document thoroughly
- Test both auth methods after implementation
- Verify tier system works correctly
- Check for any regressions

---

## 🔗 Quick Links

**Decision & Planning:**

- [Decision Document](docs/decisions/google-oauth-decisions.md)
- [Implementation Guide](docs/implementation-guides/google-oauth-implementation-guide-FINAL.md)
- [This Summary](docs/google-oauth-integration-summary.md)

**Policies & Rules:**

- [Aider Policy 08](docs/policies/08-google-oauth-implementation-rules.md)
- [.aider.conf.yml](.aider.conf.yml)

**Testing & Validation:**

- [Testing Checklist](docs/testing/oauth-testing-checklist.md)
- [Google Cloud Setup](docs/setup/google-oauth-setup.md)

**Architecture:**

- [OpenAPI Contract](docs/trading_alerts_openapi.yaml)
- [ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [Part 5 Structure](docs/v5-structure-division.md)

---

**Status:** ✅ Documentation Phase Complete
**Next:** 🔨 Aider Implementation Phase
**Owner:** Human (for approval) → Aider (for building) → Claude Code (for validation)

---

**Last Updated:** [Date]
**Version:** 1.0
**Prepared By:** Claude Code (Web) - Technical Architect
```

---

## 📤 FINAL OUTPUT: Your Deliverables

You have now created/updated **14 files**:

### ✅ NEW FILES CREATED (10)

1. `docs/decisions/google-oauth-decisions.md`
2. `docs/implementation-guides/google-oauth-implementation-guide-FINAL.md`
3. `docs/policies/08-google-oauth-implementation-rules.md`
4. `docs/testing/oauth-testing-checklist.md`
5. `docs/setup/google-oauth-setup.md`
6. `docs/google-oauth-integration-summary.md`
7. `types/next-auth.d.ts` (stub/reference)
8. `lib/auth/oauth-callbacks.ts` (stub/reference)
9. `components/auth/social-auth-buttons.tsx` (stub/reference)
10. `components/auth/oauth-error-handler.tsx` (stub/reference)

### ✅ FILES UPDATED (4)

11. `docs/trading_alerts_openapi.yaml`
12. `docs/ARCHITECTURE.md`
13. `docs/v5-structure-division.md`
14. `.aider.conf.yml`

---

## ✅ Completion Checklist

- [x] Task 1: Analyzed codebase and made decisions (google-oauth-decisions.md)
- [x] Task 2: Updated implementation guide with decisions (google-oauth-implementation-guide-FINAL.md)
- [x] Task 3: Updated OpenAPI contract (trading_alerts_openapi.yaml)
- [x] Task 4: Updated architecture documentation (ARCHITECTURE.md)
- [x] Task 5: Updated structure division (v5-structure-division.md)
- [x] Task 6: Created Aider policy document (08-google-oauth-implementation-rules.md)
- [x] Task 7: Updated Aider configuration (.aider.conf.yml)
- [x] Task 8: Created testing checklist (oauth-testing-checklist.md)
- [x] Task 9: Created setup guide (google-oauth-setup.md)
- [x] Task 10: Created summary document (google-oauth-integration-summary.md)

---

## 🎯 Ready for Human Review

**Next Action:** Human should review `docs/decisions/google-oauth-decisions.md` and approve the decisions.

**After Approval:** Aider can begin implementation using all these documents.

**Questions for Human:**

1. Do all 12 decisions make sense?
2. Any concerns about security/UX?
3. Ready to proceed with implementation?

---

**Thank you for this comprehensive task! All documentation is ready for the Aider + Claude Code + Human workflow.** 🚀

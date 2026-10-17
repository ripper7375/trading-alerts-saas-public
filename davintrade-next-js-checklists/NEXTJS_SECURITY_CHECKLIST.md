# Next.js App Router Security Checklist & Audit Guide

This checklist provides a production-grade security verification standard for Next.js applications (App Router, Next.js 14, 15, and 16). It synthesizes security architectural models and controls from:

1. **Vercel Core Engineering:** _"How to Think About Security in Next.js Server Components and Server Actions"_ (Sebastian Markbåge)
2. **Next.js Official Documentation:** _"Data Security in Next.js App Router"_
3. **Arcjet Security Engineering:** _"Next.js Security Checklist for App Router"_

---

## 1. Data Handling Architecture & Data Access Layer (DAL)

The App Router blurs the boundary between client and server. Architectural discipline is the primary defense against unintended data exposure.

| ID         | Control Item                                           |  Risk Level  | Status | Details & Remediation                                                                                                                                                                                                                                         |
| :--------- | :----------------------------------------------------- | :----------: | :----: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **DAL-01** | **Adopt a Unified Data Fetching Pattern**              |   **High**   |  [ ]   | Stick to one model across the codebase: **HTTP APIs (Zero Trust)** for microservices/polyglot orgs, or an internal **Data Access Layer (DAL)** for integrated monoliths. Avoid chaotic mixing of patterns.                                                    |
| **DAL-02** | **Enforce Data Access Layer (DAL) Isolation**          | **Critical** |  [ ]   | Centralize all database queries, ORM calls, and third-party API keys within dedicated server-only modules (e.g., `src/data/*` or `lib/dal/*`). Components must not make raw ad-hoc database queries.                                                          |
| **DAL-03** | **Enforce Data Transfer Objects (DTO) Minimization**   | **Critical** |  [ ]   | Always return minimal, sanitized Data Transfer Objects (DTOs) from DAL functions and Server Components. Never pass raw database rows (`SELECT *`), whole ORM entities, or broad `User` records down to Client Components.                                     |
| **DAL-04** | **Use Class Instances for Sensitive Internal Records** |  **Medium**  |  [ ]   | React Server Components serialize data passed to Client Components via a JSON superset protocol. Custom JavaScript class instances cannot be serialized and will throw an error at runtime, acting as a structural barrier against accidental client leakage. |
| **DAL-05** | **Restrict Prototype/Component-Level Queries**         |   **High**   |  [ ]   | If direct database calls inside Server Components are used for prototyping, strictly audit every `"use client"` component boundary to ensure props do not receive sensitive fields (e.g., `passwordHash`, `stripeCustomerId`, `ssn`, `phoneNumber`).          |

```typescript
// ❌ BAD: Leaking entire database record to Client Component
export async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await db.user.findUnique({ where: { id } }); // Contains passwordHash, salt, etc.
  return <ClientUserProfile user={user} />;
}

// ✅ GOOD: Data Access Layer returning a strictly filtered DTO
import 'server-only';
import { getCurrentUser } from '@/lib/auth';

export async function getUserProfileDTO(userId: string) {
  const viewer = await getCurrentUser();
  const rawUser = await db.user.findUnique({ where: { id: userId } });
  if (!rawUser) return null;

  return {
    id: rawUser.id,
    name: rawUser.name,
    avatarUrl: rawUser.avatarUrl,
    email: viewer.isAdmin || viewer.id === rawUser.id ? rawUser.email : null,
  };
}
```

---

## 2. Server Boundary Enforcement & Secret Isolation

Ensure server-only code and private environment variables can never leak into the browser JavaScript bundle.

| ID         | Control Item                                         |  Risk Level  | Status | Details & Remediation                                                                                                                                                                                                                      |
| :--------- | :--------------------------------------------------- | :----------: | :----: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **BND-01** | **Guard Modules with `server-only`**                 | **Critical** |  [ ]   | Add `import 'server-only';` at the top of every DAL file, database client configuration, encryption module, and authentication handler. This causes the build to fail immediately if a Client Component attempts to import it.             |
| **BND-02** | **Strict `NEXT_PUBLIC_` Environment Auditing**       | **Critical** |  [ ]   | Ensure **NO** database connection strings, private API secrets, encryption keys, or service tokens use the `NEXT_PUBLIC_` prefix. Only public CDN URLs, tracking IDs, or public client keys may carry this prefix.                         |
| **BND-03** | **Enforce Environment Access Boundary**              |   **High**   |  [ ]   | Restrict `process.env` access exclusively to the DAL or dedicated configuration modules. Client Components and generic UI utilities must never read raw process environments.                                                              |
| **BND-04** | **Enable React Taint Protection (Defense-in-Depth)** |  **Medium**  |  [ ]   | Enable `experimental.taint: true` in `next.config.js`. Use `experimental_taintObjectReference` on sensitive objects and `experimental_taintUniqueValue` on tokens/passwords to throw build/runtime errors if passed across the RSC bridge. |
| **BND-05** | **Sanitize Docker & Build Artifacts**                |   **High**   |  [ ]   | For containerized / standalone deployments (`output: 'standalone'`), verify that `.env`, `.env.local`, `.git`, or sensitive local configuration files are excluded via `.dockerignore` and not baked into production image layers.         |

```typescript
// next.config.ts
const nextConfig = {
  experimental: {
    taint: true, // Enables React Taint APIs
  },
};
export default nextConfig;

// lib/data/account.ts
import 'server-only';
import {
  experimental_taintObjectReference,
  experimental_taintUniqueValue,
} from 'react';

export async function getAccountSecurityData(accountId: string) {
  const account = await db.account.findUnique({ where: { id: accountId } });

  // Prevent entire object or specific tokens from ever being sent to a Client Component
  experimental_taintObjectReference(
    'Do not pass raw account object to the client',
    account
  );
  if (account?.apiSecret) {
    experimental_taintUniqueValue(
      'Do not leak API secret token',
      account,
      account.apiSecret
    );
  }
  return account;
}
```

---

## 3. Authentication & Authorization (Defense-in-Depth)

Never treat client-side navigation, URL params, or Middleware as the sole access control barrier.

| ID         | Control Item                                           |  Risk Level  | Status | Details & Remediation                                                                                                                                                                                                                                  |
| :--------- | :----------------------------------------------------- | :----------: | :----: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AUT-01** | **Never Rely on Middleware as Sole Security Boundary** | **Critical** |  [ ]   | Middleware can be bypassed by misconfigured matchers, edge routing quirks, internal rewrites, or historical vulnerabilities (e.g., CVE-2025-29927). Always re-verify session and roles inside each Server Component, Route Handler, and Server Action. |
| **AUT-02** | **Re-authorize Inside Every Server Action & Route**    | **Critical** |  [ ]   | Server Actions and Route Handlers are independently reachable HTTP endpoints. Page-level redirects do **NOT** protect actions invoked on that page. Authenticate the caller at the start of every action.                                              |
| **AUT-03** | **Enforce Resource Ownership Checks (Prevent IDOR)**   | **Critical** |  [ ]   | Prevent Insecure Direct Object References. Verifying that a user is authenticated (`session != null`) is insufficient; you must verify that the user owns or is explicitly authorized to mutate the specific resource ID.                              |
| **AUT-04** | **Treat Route Params & SearchParams as Hostile Input** | **Critical** |  [ ]   | Never trust `searchParams` (e.g., `?isAdmin=true`) or dynamic route segments (`/[teamId]/`) for authorization decisions. Always read access credentials from verified session cookies or tokens.                                                       |
| **AUT-05** | **Cache User Session Queries via `React.cache`**       |  **Medium**  |  [ ]   | Wrap session fetching functions in `React.cache()` so that multiple components or DAL checks within a single request share the decrypted session without duplicate database roundtrips or prop drilling.                                               |

```typescript
// ❌ BAD: Trusting page-level redirect or omitting resource ownership check
// app/actions.ts
'use server';

export async function deleteDocument(docId: string) {
  // Missing auth check: Anyone who discovers this action ID can delete any document!
  await db.document.delete({ where: { id: docId } });
}

// ✅ GOOD: Defense-in-depth with authentication and IDOR ownership check
('use server');

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function deleteDocumentSafe(docId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const document = await db.document.findUnique({
    where: { id: docId },
    select: { authorId: true },
  });

  if (!document) {
    throw new Error('Not found');
  }

  // Authorization / IDOR Protection
  if (document.authorId !== session.user.id && !session.user.isAdmin) {
    throw new Error('Forbidden');
  }

  await db.document.delete({ where: { id: docId } });
  return { success: true };
}
```

---

## 4. Server Actions (`"use server"`) Hardening

Every exported function in a `"use server"` file or closure is an exposed public POST endpoint.

| ID         | Control Item                                                               |  Risk Level  | Status | Details & Remediation                                                                                                                                                                                                                                                                    |
| :--------- | :------------------------------------------------------------------------- | :----------: | :----: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ACT-01** | **Validate All Input Arguments with Schemas**                              | **Critical** |  [ ]   | TypeScript types are erased at runtime and offer zero protection against forged requests. Parse and validate every argument and `FormData` field using Zod, Valibot, or ArkType.                                                                                                         |
| **ACT-02** | **Filter Server Action Return Values**                                     |   **High**   |  [ ]   | Server Action return values are serialized and returned in the HTTP response. Never return raw database records containing internal audit timestamps, foreign keys, or private fields. Return `{ success: true }` or a clean DTO.                                                        |
| **ACT-03** | **Pin Multi-Server Encryption Key (`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`)** |   **High**   |  [ ]   | Closed-over variables in inline Server Actions are encrypted with a private key generated at build time. When self-hosting horizontally scaled instances, configure a persistent 32-byte base64 key in `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` to avoid decryption errors across instances. |
| **ACT-04** | **Audit `.bind()` Arguments (Unencrypted Data)**                           |   **High**   |  [ ]   | Unlike inline closures which are encrypted by Next.js, arguments passed using `.bind()` to Server Actions are sent to the client as **plain unencrypted JSON**. Never `.bind()` sensitive tokens, hashes, or internal IDs.                                                               |
| **ACT-05** | **Configure Allowed Origins for Reverse Proxies**                          |   **High**   |  [ ]   | Next.js protects Server Actions from CSRF by matching the `Origin` header against `Host` / `X-Forwarded-Host`. If using reverse proxies, API gateways, or alternate domains, configure `serverActions.allowedOrigins` in `next.config.js`.                                               |
| **ACT-06** | **Zero Side-Effects in Server Component Rendering**                        | **Critical** |  [ ]   | Never perform mutations (deletions, updates, cookie setting, logouts) during component rendering or via `GET` requests. Keep renders idempotent and use Server Actions (POST) for all state mutations.                                                                                   |
| **ACT-07** | **Implement Action Rate Limiting & Abuse Protection**                      |   **High**   |  [ ]   | Protect sensitive actions (e.g., password reset, credit purchases, AI generation, comments) with rate limiting (Upstash Redis, Arcjet, or database tokens) to prevent brute-force and resource exhaustion.                                                                               |

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Whitelist origins allowed to invoke Server Actions through proxies
      allowedOrigins: ['app.example.com', 'api.example.com'],
    },
  },
};
export default nextConfig;
```

```typescript
// app/actions/update-email.ts
'use server';

import { z } from 'zod';
import { auth } from '@/lib/auth';
import { updateEmailDAL } from '@/lib/dal/user';

const UpdateEmailSchema = z.object({
  newEmail: z.string().email().trim().toLowerCase().max(255),
});

export async function updateEmailAction(rawInput: unknown) {
  // 1. Runtime schema validation
  const result = UpdateEmailSchema.safeParse(rawInput);
  if (!result.success) {
    return { success: false, error: 'Invalid input' };
  }

  // 2. Authentication & Authorization in DAL
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  // 3. Delegate to DAL & return sanitized result
  await updateEmailDAL(session.user.id, result.data.newEmail);
  return { success: true };
}
```

---

## 5. Route Handlers (`route.ts`) & Middleware Security

Route Handlers operate outside the automatic CSRF and method constraints of Server Actions.

| ID         | Control Item                                              | Risk Level | Status | Details & Remediation                                                                                                                                                                                                |
| :--------- | :-------------------------------------------------------- | :--------: | :----: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RTE-01** | **Explicit Method Handlers Only**                         |  **High**  |  [ ]   | Only export supported HTTP methods (`export async function POST`, `GET`, etc.). Never write generic catch-all dispatchers that might process state-changing requests over `GET`.                                     |
| **RTE-02** | **Manual CSRF & Origin Verification on Custom Endpoints** |  **High**  |  [ ]   | Unlike Server Actions, custom `route.ts` handlers do **not** automatically verify `Origin` vs `Host`. For state-changing operations relying on session cookies, verify the `Origin` header or implement CSRF tokens. |
| **RTE-03** | **Use Matcher Allowlists in Middleware / Proxy**          |  **High**  |  [ ]   | Write route matchers using strict allowlists (e.g., protect everything under `/dashboard/*` by default) rather than denylists. Denylists frequently leak new routes or RSC client navigation requests (`?_rsc=...`). |
| **RTE-04** | **In-App Request Screening (Bot & WAF Protection)**       | **Medium** |  [ ]   | Integrate request screening (e.g., `@arcjet/next`, Cloudflare WAF, or custom IP rate limiters) at route handler entry points before triggering expensive database queries or third-party AI APIs.                    |

---

## 6. Input Validation, Injection & XSS Sanitization

React escapes JSX string children automatically, but modern applications face risks beyond standard reflected XSS.

| ID         | Control Item                                      |  Risk Level  | Status | Details & Remediation                                                                                                                                                                                                                   |
| :--------- | :------------------------------------------------ | :----------: | :----: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **INP-01** | **Parameterize All SQL / NoSQL Queries**          | **Critical** |  [ ]   | Never concatenate user input into SQL queries. Always use tagged template literals (e.g., `sql`...\`\`), Prisma/Drizzle parameterized builders, or ORM binding.                                                                         |
| **INP-02** | **Restrict & Sanitize `dangerouslySetInnerHTML`** | **Critical** |  [ ]   | Avoid `dangerouslySetInnerHTML`. If rendering user-submitted markdown or HTML is required, sanitize it through an audited HTML sanitizer (such as `DOMPurify` with `jsdom` or `sanitize-html`) with a strict tag/attribute whitelist.   |
| **INP-03** | **Validate URL Redirect Targets (Open Redirect)** |   **High**   |  [ ]   | When using `redirect(url)` based on query parameters (e.g., `?returnTo=/dashboard`), validate that the target begins with a relative `/` and does not start with `//` or an untrusted external protocol.                                |
| **INP-04** | **Sanitize Dynamic SVG & File Uploads**           |   **High**   |  [ ]   | User-uploaded SVGs can contain embedded JavaScript `<script>` tags. Validate MIME types, store uploads in private S3/R2 buckets, and serve them with `Content-Disposition: attachment` or strict `Content-Type: image/png` conversions. |

---

## 7. Security Headers & Content Security Policy (CSP)

Set standard defense-in-depth HTTP response headers across all page and data responses.

| ID         | Control Item                         |  Risk Level  | Status | Recommended Standard Value                                                                                                              |
| :--------- | :----------------------------------- | :----------: | :----: | :-------------------------------------------------------------------------------------------------------------------------------------- |
| **HDR-01** | **Content-Security-Policy (CSP)**    | **Critical** |  [ ]   | Enforce strict CSP with nonces for scripts. Start with `default-src 'self'`. Avoid `'unsafe-eval'` or `'unsafe-inline'` where possible. |
| **HDR-02** | **Strict-Transport-Security (HSTS)** |   **High**   |  [ ]   | `max-age=63072000; includeSubDomains; preload` (ensures browser enforces HTTPS).                                                        |
| **HDR-03** | **X-Content-Type-Options**           |  **Medium**  |  [ ]   | `nosniff` (prevents MIME sniffing attacks).                                                                                             |
| **HDR-04** | **Referrer-Policy**                  |  **Medium**  |  [ ]   | `strict-origin-when-cross-origin` (prevents leaking sensitive path information across origins).                                         |
| **HDR-05** | **Permissions-Policy**               |  **Medium**  |  [ ]   | `camera=(), microphone=(), geolocation=()` (disables unused device capabilities).                                                       |
| **HDR-06** | **Clickjacking Mitigation**          |   **High**   |  [ ]   | Set `frame-ancestors 'none'` (or `'self'`) in CSP; fallback `X-Frame-Options: DENY` for legacy browsers.                                |
| **HDR-07** | **Omit Deprecated Headers**          |   **Low**    |  [ ]   | **Do NOT** set `X-XSS-Protection: 1; mode=block`. It is deprecated, non-standard, and can introduce vulnerabilities in modern browsers. |

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const securityHeaders = [
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value:
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; object-src 'none'; frame-ancestors 'none';",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
```

---

## 8. Error Handling & Information Disclosure

Prevent internal error traces, stack traces, and database internals from leaking to attackers.

| ID         | Control Item                                    |  Risk Level  | Status | Details & Remediation                                                                                                                                                                                                                                       |
| :--------- | :---------------------------------------------- | :----------: | :----: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ERR-01** | **Strict `NODE_ENV=production` in Deployments** | **Critical** |  [ ]   | Ensure all staging, preview, and production environments execute with `NODE_ENV=production`. In development mode, Next.js sends plain-text server errors and stack traces to the client, whereas production mode masks them with an obfuscated hash digest. |
| **ERR-02** | **Sanitize Thrown Error Messages**              |   **High**   |  [ ]   | Never throw raw database or validation errors containing sensitive payload values (e.g., `"Error: user with phone +66... already exists"`). Log the full error to server telemetry (Sentry, Datadog) and rethrow a generic user-friendly message.           |
| **ERR-03** | **Correlate Client Digest with Server Logs**    |  **Medium**  |  [ ]   | When Next.js masks a server error in production, it generates a hash digest. Capture this digest in your centralized logging system to allow security and engineering teams to trace client-reported issues back to the underlying server exception.        |

---

## 9. Dependency Hygiene & CI/CD Security Pipeline

Automate static analysis, secret scanning, and dependency management in CI before shipping to production.

| ID         | Control Item                            |  Risk Level  | Status | Recommended Tools & Commands                                                                                                                                                                             |
| :--------- | :-------------------------------------- | :----------: | :----: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **OPS-01** | **Lockfile Integrity & Audit Gate**     | **Critical** |  [ ]   | Always commit the package manager lockfile (`pnpm-lock.yaml`, `package-lock.json`). Add `pnpm audit --prod` or `npm audit --audit-level=high` to the CI pipeline to break builds on known critical CVEs. |
| **OPS-02** | **Automated Dependency Updates**        |   **High**   |  [ ]   | Enable Renovate or Dependabot with weekly vulnerability alerts. Keep Next.js and React updated to receive core security patches promptly.                                                                |
| **OPS-03** | **Automated Secret Scanning**           | **Critical** |  [ ]   | Run **TruffleHog** or **Gitleaks** on pull requests and pre-commit hooks to detect committed private keys, JWT secrets, database connection strings, or cloud tokens.                                    |
| **OPS-04** | **Enforce Strict Static Analysis**      |   **High**   |  [ ]   | Configure TypeScript with `"strict": true` in `tsconfig.json`. Add ESLint security plugins (`eslint-plugin-security`) and Semgrep rulesets to catch unsafe code patterns before peer review.             |
| **OPS-05** | **Periodic Penetration Testing & DAST** |  **Medium**  |  [ ]   | Perform recurring penetration testing or dynamic vulnerability scans (DAST) on Route Handlers, authentication flows, and Server Actions.                                                                 |

---

## Quick Reference Audit Summary

```
                       ┌──────────────────────────────────────────────┐
                       │               UNTRUSTED CLIENT               │
                       └──────────────────────┬───────────────────────┘
                                              │
                      POST /_rsc / Route      ▼ (Origin, CSRF, Headers)
                       ┌──────────────────────────────────────────────┐
                       │          MIDDLEWARE / REVERSE PROXY          │
                       │   (Allowlist matching, Edge Security Headers) │
                       └──────────────────────┬───────────────────────┘
                                              │
                          Re-authenticate     ▼ Re-authorize
                       ┌──────────────────────────────────────────────┐
                       │     ROUTE HANDLERS & SERVER ACTIONS          │
                       │  - Zod Input Parsing                         │
                       │  - Resource Ownership Verification (No IDOR) │
                       │  - Returns clean DTO / { success: true }     │
                       └──────────────────────┬───────────────────────┘
                                              │
                         import 'server-only' ▼ Cached context
                       ┌──────────────────────────────────────────────┐
                       │           DATA ACCESS LAYER (DAL)            │
                       │  - Direct DB Access (Parameterized Queries)  │
                       │  - Reads process.env (Secrets)               │
                       │  - Enforces API Minimization / Taint Checks  │
                       └──────────────────────────────────────────────┘
```

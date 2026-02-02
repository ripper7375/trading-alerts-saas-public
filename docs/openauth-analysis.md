# OpenAuth Authentication Architecture Analysis

**Date:** 2026-02-02
**Repository:** seed-code/openauth
**Analysis Scope:** OAuth 2.0 authentication architecture and token management

---

## Executive Summary

**OpenAuth uses a HYBRID JWT-BASED authentication architecture:**

- **Primary Method:** JWT access tokens (stateless)
- **Secondary Method:** Server-stored refresh tokens (stateful)
- **Architecture Type:** OAuth 2.0 + OIDC compliant, hybrid stateless/stateful

---

## 1. Core Authentication Architecture

### JWT-Based Access Tokens (Primary)

OpenAuth is fundamentally a **JWT-based OAuth 2.0 authentication system** with stateless access tokens.

**Access Token Schema** (`packages/openauth/src/jwt.ts`):

```typescript
{
  mode: "access",           // Token type
  type: string,             // Subject type (e.g., "user")
  properties: object,       // User/subject data
  aud: string,              // Client ID
  iss: string,              // Issuer URL
  sub: string,              // Subject identifier
  exp: number,              // Expiration timestamp
}
```

**Key Characteristics:**
- Signed with **ES256** (ECDSA with SHA-256)
- **Stateless**: No database lookup needed for validation
- Default TTL: **30 days** (configurable)
- Contains full user data in payload
- Self-contained authorization information

---

## 2. Token Management System

### Dual Token Strategy

**1. Access Tokens (JWT)**
- **Purpose:** API authentication
- **Storage:** Client-side (cookies, localStorage, or memory)
- **Validation:** Cryptographic signature verification
- **Lifetime:** Short to medium (30 days default)
- **Format:** Standard JWT (header.payload.signature)

**2. Refresh Tokens (Opaque)**
- **Purpose:** Obtain new access tokens
- **Storage:** Server-side backend storage
- **Validation:** Database lookup
- **Lifetime:** Long (1 year default)
- **Format:** `subject:uuid` pair

**From `issuer.ts` lines 649-711:**
```typescript
// Generate refresh token
const refresh = uuid();

// Store refresh token with next token reserved (for reuse detection)
await storage.set(`oauth:refresh:${subject}:${refresh}`, {
  expires: refreshTTL,
  next: uuid(), // Reserved for next refresh
});

// Create access JWT
const accessToken = await jwt.create({
  mode: "access",
  type: subject.type,
  properties: subject.properties,
  aud: client.id,
  iss: issuer,
  sub: subjectID,
}, accessTTL);

return { access_token: accessToken, refresh_token: refresh };
```

---

## 3. Cookie Management System

### HTTP-Only Encrypted Cookies

**From `issuer.ts` lines 591-609:**

```typescript
async set(ctx, key, maxAge, value) {
  setCookie(ctx, key, await encrypt(value), {
    maxAge,
    httpOnly: true,           // XSS protection
    ...(ctx.req.url.startsWith("https://")
      ? { secure: true, sameSite: "None" }
      : {}),
  })
}
```

**Cookie Security Features:**
- ✅ **HttpOnly**: Prevents XSS attacks
- ✅ **Secure**: HTTPS-only in production
- ✅ **SameSite**: CSRF protection (None for cross-domain)
- ✅ **Encrypted**: RSA-OAEP-512 encryption for sensitive data

**Cookie Types:**
1. Authorization state cookies (OAuth flow)
2. Access token cookies (SSR apps)
3. Refresh token cookies (optional, for SSR)

---

## 4. Storage Architecture

### Pluggable Storage Adapters

OpenAuth supports multiple storage backends for refresh tokens and authorization codes:

**Available Adapters:**

1. **MemoryStorage** (`storage/memory.ts`)
   - In-memory key-value store
   - Optional file persistence
   - Best for: Development, testing

2. **DynamoStorage** (`storage/dynamo.ts`)
   - AWS DynamoDB backend
   - Production-grade
   - Best for: AWS deployments

3. **CloudflareStorage** (`storage/cloudflare.ts`)
   - Cloudflare KV store
   - Edge-optimized
   - Best for: Cloudflare Workers

**Storage Operations:**
```typescript
interface Storage {
  get(key: string): Promise<any | undefined>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  remove(key: string): Promise<void>;
  scan(prefix: string): AsyncIterableIterator<[string, any]>;
}
```

**Stored Data Types:**
```
oauth:code:[code]                - Authorization codes (60s TTL)
oauth:refresh:[subject]:[token]  - Refresh token data (1y TTL)
signing:key:[id]                 - JWT signing keys
encryption:key:[id]              - Cookie encryption keys
```

---

## 5. Cryptographic Key Management

### Multi-Key System

**From `keys.ts` and `issuer.ts`:**

**1. Signing Keys (JWT):**
- Algorithm: **ES256** (ECDSA with P-256 curve)
- Purpose: Sign access tokens
- Rotation: Automatic with timestamp tracking
- Legacy support: RS512 (RSA with SHA-512)

**2. Encryption Keys (Cookies):**
- Algorithm: **RSA-OAEP-512**
- Purpose: Encrypt cookie values
- Key size: 4096-bit RSA
- Rotation: Supported with key versioning

**JWKS Endpoint:**
```
GET /.well-known/jwks.json
```
Returns public keys for JWT verification:
```json
{
  "keys": [
    {
      "kty": "EC",
      "crv": "P-256",
      "x": "...",
      "y": "...",
      "kid": "key-id",
      "use": "sig",
      "alg": "ES256"
    }
  ]
}
```

---

## 6. OAuth 2.0 Flows Supported

### Authorization Flows

**1. Authorization Code Flow** (SSR Apps)
```
GET  /authorize?client_id=...&redirect_uri=...&scope=...
  → User authenticates via provider
GET  /callback?code=...&state=...
  → Exchange code for tokens
POST /token
  → Returns access_token + refresh_token
```

**2. Authorization Code + PKCE** (SPAs, Mobile)
```
code_challenge = base64url(sha256(code_verifier))
GET  /authorize?...&code_challenge=...&code_challenge_method=S256
  → User authenticates
POST /token
  Body: code=...&code_verifier=...
  → Validates PKCE, returns tokens
```

**3. Client Credentials Flow** (Service-to-Service)
```
POST /token
  Body: grant_type=client_credentials&client_id=...&client_secret=...
  → Returns access_token
```

**4. Refresh Token Flow**
```
POST /token
  Body: grant_type=refresh_token&refresh_token=...
  → Returns new access_token + refresh_token
```

---

## 7. Token Refresh & Rotation

### Automatic Token Refresh

**Client-Side Auto-Refresh** (`client.ts` lines 697-746):

```typescript
async function verified(token: string, refresh?: string) {
  try {
    // Verify JWT signature
    const result = await verify(token);
    return result;
  } catch {
    // Token expired, auto-refresh if refresh token available
    if (refresh) {
      const newTokens = await exchangeRefresh(refresh);
      return verified(newTokens.access, newTokens.refresh);
    }
    throw new Error("Token expired");
  }
}
```

### Token Reuse Detection

**Security Feature** (from `issuer.ts`):

1. Each refresh token stores a "next" token UUID
2. On refresh, generates new refresh token with new "next"
3. If old refresh token used again within window → **Invalidate all tokens**
4. Reuse window: **60 seconds** (configurable)

**Protects against:**
- Token theft and replay attacks
- Concurrent refresh token usage
- Stolen refresh token exploitation

---

## 8. Provider Integrations

### 20+ Pre-Built OAuth Providers

**Social Providers:**
- Google, GitHub, Discord, Facebook
- Apple, Microsoft, Twitter/X, LinkedIn
- Slack, Spotify, Twitch, Reddit

**Enterprise Providers:**
- Okta, Auth0, Azure AD
- Generic OAuth2/OIDC support

**Built-In Providers:**
- Password (with UI)
- Email/Code (passwordless)

**Provider Implementation** (`provider/` directory):
```typescript
interface Provider {
  type: string;
  authorize(config): AuthorizeRequest;
  token(config, code): TokenResponse;
  userinfo?(token): UserInfo;
}
```

---

## 9. API Endpoints

### Core OAuth Endpoints

**From `issuer.ts`:**

```
POST  /token
  - Token exchange (code → tokens)
  - Refresh token exchange
  - Client credentials grant

GET   /authorize
  - Start authorization flow
  - Returns authorization code

POST  /{provider}/authorize
  - Provider-specific authorization

POST  /{provider}/callback
  - OAuth callback handler

GET   /userinfo
  - Get authenticated user info
  - Requires Bearer token

GET   /.well-known/jwks.json
  - JSON Web Key Set (public keys)

GET   /.well-known/oauth-authorization-server
  - OAuth 2.0 server metadata
```

---

## 10. Security Features

### Multi-Layer Security

**1. PKCE (Proof Key for Code Exchange)**
- Required for SPAs and native apps
- Prevents authorization code interception
- SHA-256 code challenge/verifier

**2. State Parameter**
- CSRF protection for OAuth flows
- Cryptographically random
- Validated on callback

**3. Token Reuse Detection**
- Tracks refresh token usage
- Invalidates on suspicious reuse
- 60-second reuse window

**4. Key Rotation**
- Automatic signing key rotation
- Multiple active keys supported
- Backward compatibility during rotation

**5. Schema Validation**
- Subject payload validation (Valibot)
- Type-safe user properties
- Prevents malformed data

**6. HTTP-Only Cookies**
- XSS protection
- Encrypted values
- Secure flag in production

---

## 11. Client Integration

### Server-Side Rendering (SSR)

**From `client.ts`:**

```typescript
import { createClient } from "openauth/client";

const client = createClient({
  issuer: "https://auth.example.com",
  clientID: "my-app",
  clientSecret: "secret",
});

// In Next.js API route
export async function GET(req: Request) {
  const token = req.headers.get("authorization")?.split(" ")[1];

  // Verify and auto-refresh
  const subject = await client.verify(token, req.cookies.get("refresh"));

  return Response.json({ user: subject.properties });
}
```

### Single Page Applications (SPA)

```typescript
// PKCE flow for SPAs
const { url, verifier } = await client.authorize({
  provider: "google",
  pkce: true,
  redirectURI: "https://app.example.com/callback",
});

// Store PKCE verifier temporarily and redirect user
sessionStorage.setItem("pkce_verifier", verifier);
window.location.href = url;

// After callback
const tokens = await client.exchange({
  code: urlParams.get("code"),
  verifier: sessionStorage.getItem("pkce_verifier"),
});

// Store access token in memory; refresh token is managed via httpOnly cookies/server-side state
let accessToken = tokens.access;
```

---

## 12. Comparison: OpenAuth vs Traditional Sessions

### What OpenAuth IS

✅ **JWT-Based OAuth 2.0 System with:**
- Stateless JWT access tokens (self-contained)
- Stateful refresh tokens (server-stored)
- Multi-provider OAuth/OIDC support
- Standard-compliant OAuth 2.0 flows
- Cryptographic token validation
- Automatic token refresh

### What OpenAuth IS NOT

❌ **Traditional Session-Based Auth:**
- No session IDs in cookies
- No server-side session lookup for every request
- Not database-dependent for access token validation
- Not tied to a single authentication method

---

## 13. Architecture Decision Rationale

### Why JWT-Based?

**Advantages:**
1. **Stateless Authentication:** No database lookup for every API request
2. **Scalability:** Horizontal scaling without session store
3. **Multi-Service:** Share authentication across microservices
4. **Standards Compliance:** OAuth 2.0 / OIDC compatible
5. **Flexibility:** Works with SSR, SPA, mobile, and APIs
6. **Performance:** Fast signature verification vs database queries

**Refresh Token Addition:**
1. **Revocation Control:** Can invalidate user sessions
2. **Security:** Shorter access token lifetime reduces risk
3. **Reuse Detection:** Protects against token theft
4. **Rotation:** Fresh credentials on every refresh

---

## 14. Key Files Reference

### Core Authentication
- `packages/openauth/src/issuer.ts` (1,156 lines) - Auth server
- `packages/openauth/src/client.ts` (750 lines) - Client SDK
- `packages/openauth/src/jwt.ts` - JWT operations
- `packages/openauth/src/keys.ts` - Key management

### Storage
- `packages/openauth/src/storage/storage.ts` - Interface
- `packages/openauth/src/storage/memory.ts` - Memory adapter
- `packages/openauth/src/storage/dynamo.ts` - DynamoDB adapter
- `packages/openauth/src/storage/cloudflare.ts` - Cloudflare KV adapter

### Providers
- `packages/openauth/src/provider/` - 30+ provider implementations
- Each provider has: authorize(), token(), userinfo() methods

### Framework
- Built on **Hono** (v4.6.9) - Fast web framework
- Uses **jose** (v5.9.6) - JWT/JWE/JWK operations

---

## 15. Dependencies

**Core:**
- `jose` (5.9.6) - JWT operations
- `hono` (4.6.9) - Web framework
- `@standard-schema/spec` - Schema validation
- `arctic` (2.2.2) - OAuth provider helpers

**Optional:**
- `valibot` - Runtime schema validation
- `aws-sdk` - DynamoDB integration
- `@cloudflare/workers-types` - Cloudflare Workers types

---

## 16. Conclusion

**OpenAuth Authentication Type: JWT-BASED (Hybrid)**

**Summary:**
- Primary authentication method is **JWT access tokens** (stateless)
- Refresh tokens stored server-side for revocation control (stateful)
- Full OAuth 2.0 + OIDC compliance with 20+ providers
- Cryptographic security with ES256 signing and RSA encryption
- Pluggable storage adapters (Memory, DynamoDB, Cloudflare KV)
- PKCE support for SPAs and mobile apps
- Token reuse detection and automatic rotation

**Best Suited For:**
1. **Multi-tenant SaaS applications** - OAuth 2.0 provider for customers
2. **Microservices architectures** - Stateless JWTs for service-to-service
3. **SSR + SPA hybrid apps** - Cookie and Bearer token support
4. **Multi-provider authentication** - 20+ social/enterprise providers
5. **API-first applications** - Standards-compliant OAuth 2.0 APIs

**Comparison to Better Auth:**
- **Better Auth:** Session-based with optional JWT caching (stateful primary)
- **OpenAuth:** JWT-based with refresh token storage (stateless primary)
- **Better Auth:** Single application focus, simpler setup
- **OpenAuth:** OAuth 2.0 provider, multi-client, more complex

---

**Analysis Completed:** 2026-02-02
**Confidence Level:** High (based on source code review)
**Architecture Type:** **JWT-Based OAuth 2.0 with Stateful Refresh Tokens**

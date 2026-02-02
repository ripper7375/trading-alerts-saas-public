# JWT Authentication Strategy for Microservices
## PUBLIC vs INTERNAL Endpoint Authentication

**Date:** 2026-02-02
**Scope:** System-wide authentication strategy (Stacks A, B, C, D, E)
**Decision:** JWT authenticates PUBLIC endpoints only (not internal logic)

---

## 📋 Executive Summary

**Recommended Strategy:** ✅ **JWT for PUBLIC endpoints only**

**Rationale:**
- JWT validates at service boundaries (entry points)
- Internal logic operates in trusted context
- Performance optimized (verify once, not repeatedly)
- Service autonomy preserved

---

## 🎯 Authentication Scope Definition

### **PUBLIC Endpoints** (JWT Required)

**Definition:** Endpoints exposed to OTHER services or clients

**Examples:**
```
✅ Frontend A → Backend A: /api/auth/login        (PUBLIC)
✅ Frontend A → Backend A: /api/alerts            (PUBLIC)
✅ Backend A → Backend B: /api/market-data/ohlcv  (PUBLIC)
✅ Backend A → Backend D: /api/rag/query          (PUBLIC)
✅ External API → Backend A: /api/webhooks/stripe (PUBLIC)
```

**Characteristics:**
- Exposed via API Gateway or direct HTTP
- Cross-service communication
- Untrusted entry points
- **MUST validate JWT**

---

### **INTERNAL Endpoints** (NO JWT Required)

**Definition:** Functions/methods used only WITHIN the service

**Examples:**
```
❌ Backend A internal: alertService.create()       (INTERNAL)
❌ Backend A internal: userService.findById()      (INTERNAL)
❌ Backend A internal: validateTierAccess()        (INTERNAL)
❌ Backend A → Database: prisma.alert.findMany()   (INTERNAL)
❌ Backend A → Redis: redis.get('key')             (INTERNAL)
```

**Characteristics:**
- Not exposed externally
- Same process/service calls
- Trusted environment
- **Uses typed user context (not JWT)**

---

## 🏗️ Architecture Patterns

### **Pattern 1: Frontend → Backend (PUBLIC)**

```typescript
// Frontend A makes API call
const response = await fetch('/api/alerts', {
  method: 'GET',
  credentials: 'include', // Sends JWT cookie
});
```

```typescript
// Backend A - API Controller (PUBLIC endpoint)
@Controller('alerts')
export class AlertsController {

  @Get()
  @UseGuards(JwtAuthGuard) // ← JWT VERIFIED HERE (at boundary)
  async getAlerts(@CurrentUser() user: User) {
    // JWT already verified by guard
    // user object is typed and trusted

    // Internal service calls (NO JWT)
    return this.alertsService.findByUser(user.id);
  }
}
```

```typescript
// Backend A - Service Layer (INTERNAL)
@Injectable()
export class AlertsService {

  // NO JWT verification here - receives typed user context
  async findByUser(userId: string): Promise<Alert[]> {
    // Internal database call (NO JWT)
    return this.prisma.alert.findMany({
      where: { userId },
    });
  }
}
```

**Key Points:**
- ✅ JWT verified ONCE at controller (PUBLIC entry point)
- ✅ Service layer receives typed `userId` (not JWT)
- ✅ Database calls use typed parameters (not JWT)

---

### **Pattern 2: Backend → Backend (PUBLIC)**

```typescript
// Backend A calls Backend B (PUBLIC endpoint)
@Injectable()
export class MarketDataService {

  async getOHLCV(userId: string, symbol: string) {
    // Make HTTP request to Backend B with JWT
    const response = await fetch('http://backend-b:3002/api/market-data/ohlcv', {
      headers: {
        'Authorization': `Bearer ${await this.getServiceJWT(userId)}`,
      },
    });

    return response.json();
  }

  private async getServiceJWT(userId: string): Promise<string> {
    // Generate service-to-service JWT
    return this.jwtService.sign({
      sub: userId,
      service: 'backend-a',
      scope: 'market-data:read',
    });
  }
}
```

```typescript
// Backend B - API Controller (PUBLIC endpoint)
@Controller('market-data')
export class MarketDataController {

  @Get('ohlcv')
  @UseGuards(JwtAuthGuard) // ← JWT VERIFIED HERE (at boundary)
  async getOHLCV(@CurrentUser() user: User, @Query('symbol') symbol: string) {
    // JWT verified, now use internal service
    return this.marketDataService.getOHLCV(user.id, symbol);
  }
}
```

```typescript
// Backend B - Service Layer (INTERNAL)
@Injectable()
export class MarketDataService {

  // NO JWT here - receives typed parameters
  async getOHLCV(userId: string, symbol: string): Promise<OHLCV[]> {
    // Check user tier (INTERNAL authorization)
    await this.validateTierAccess(userId, symbol);

    // Fetch from database (INTERNAL)
    return this.prisma.ohlcv.findMany({
      where: { symbol },
    });
  }

  private async validateTierAccess(userId: string, symbol: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (user.tier === 'FREE' && !ALLOWED_SYMBOLS_FREE.includes(symbol)) {
      throw new ForbiddenException('Symbol not allowed for FREE tier');
    }
  }
}
```

**Key Points:**
- ✅ Backend A generates service-to-service JWT
- ✅ Backend B verifies JWT at entry point
- ✅ Backend B internal logic uses typed context
- ✅ Authorization logic (tier validation) is INTERNAL

---

### **Pattern 3: Internal Service Calls (NO JWT)**

```typescript
// Backend A - Alerts Controller
@Controller('alerts')
export class AlertsController {

  @Post()
  @UseGuards(JwtAuthGuard) // ← JWT verified here
  async createAlert(
    @CurrentUser() user: User,
    @Body() createAlertDto: CreateAlertDto,
  ) {
    // JWT verified, now call internal services with typed context

    // 1. Validate tier access (INTERNAL)
    await this.tierService.validateAccess(user.id, createAlertDto.symbol);

    // 2. Create alert (INTERNAL)
    const alert = await this.alertsService.create(user.id, createAlertDto);

    // 3. Send notification (INTERNAL)
    await this.notificationService.sendAlertCreated(user.id, alert.id);

    return alert;
  }
}
```

```typescript
// All internal services receive typed parameters (NO JWT)

@Injectable()
export class TierService {
  async validateAccess(userId: string, symbol: string): Promise<void> {
    // No JWT - receives typed parameters
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    // ... validation logic
  }
}

@Injectable()
export class AlertsService {
  async create(userId: string, dto: CreateAlertDto): Promise<Alert> {
    // No JWT - receives typed parameters
    return this.prisma.alert.create({
      data: { userId, ...dto },
    });
  }
}

@Injectable()
export class NotificationService {
  async sendAlertCreated(userId: string, alertId: string): Promise<void> {
    // No JWT - receives typed parameters
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    // ... send notification
  }
}
```

**Key Points:**
- ✅ JWT verified ONCE at controller
- ✅ All internal services receive typed parameters
- ✅ No JWT passed around internally
- ✅ Cleaner, more maintainable code

---

## 🔐 Security Boundaries

### **Where JWT is Verified:**

```
┌─────────────────────────────────────────────────────────┐
│                     API GATEWAY                         │
│              (Optional: Verify JWT here)                │
└─────────────────────────────────────────────────────────┘
                        ↓ (JWT in header)
        ┌───────────────┴───────────────┐
        ↓                               ↓
┌─────────────────┐           ┌─────────────────┐
│   STACK A       │           │   STACK B       │
├─────────────────┤           ├─────────────────┤
│                 │           │                 │
│ ┌─────────────┐ │           │ ┌─────────────┐ │
│ │  Controller │ │           │ │  Controller │ │
│ │  (PUBLIC)   │ │ JWT       │ │  (PUBLIC)   │ │
│ │  ✓ JWT      │─┼──────────→│ │  ✓ JWT      │ │
│ └─────────────┘ │ verified  │ └─────────────┘ │
│        ↓        │           │        ↓        │
│ ┌─────────────┐ │           │ ┌─────────────┐ │
│ │   Service   │ │           │ │   Service   │ │
│ │  (INTERNAL) │ │           │ │  (INTERNAL) │ │
│ │  No JWT     │ │           │ │  No JWT     │ │
│ └─────────────┘ │           │ └─────────────┘ │
│        ↓        │           │        ↓        │
│ ┌─────────────┐ │           │ ┌─────────────┐ │
│ │  Database   │ │           │ │  Database   │ │
│ │  (INTERNAL) │ │           │ │  (INTERNAL) │ │
│ │  No JWT     │ │           │ │  No JWT     │ │
│ └─────────────┘ │           │ └─────────────┘ │
└─────────────────┘           └─────────────────┘
```

**Security Layers:**
1. **API Gateway** (optional): Verify JWT, rate limiting
2. **Controller/Entry Point** (required): Verify JWT, extract user
3. **Service Layer** (internal): Typed user context, no JWT
4. **Database** (internal): Typed parameters, no JWT

---

## 🚀 Implementation Guidelines

### **1. Controller Layer (PUBLIC Endpoints)**

**Always verify JWT at controller:**

```typescript
@Controller('alerts')
export class AlertsController {
  constructor(
    private readonly alertsService: AlertsService,
    private readonly tierService: TierService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard) // ← ALWAYS use JWT guard
  async getAlerts(@CurrentUser() user: User) {
    // user is typed and verified
    return this.alertsService.findByUser(user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard) // ← ALWAYS use JWT guard
  @UseGuards(TierGuard) // Optional: additional authorization
  async createAlert(
    @CurrentUser() user: User,
    @Body() dto: CreateAlertDto,
  ) {
    return this.alertsService.create(user.id, dto);
  }
}
```

---

### **2. Service Layer (INTERNAL Logic)**

**Never verify JWT in services:**

```typescript
@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  // ✅ GOOD: Receives typed userId
  async findByUser(userId: string): Promise<Alert[]> {
    return this.prisma.alert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ✅ GOOD: Receives typed parameters
  async create(userId: string, dto: CreateAlertDto): Promise<Alert> {
    const alert = await this.prisma.alert.create({
      data: {
        userId,
        symbol: dto.symbol,
        timeframe: dto.timeframe,
        condition: dto.condition,
      },
    });

    // Call other internal services (no JWT)
    await this.notificationService.sendAlertCreated(userId, alert.id);

    return alert;
  }

  // ❌ BAD: Don't do this
  async createWithJWT(jwt: string, dto: CreateAlertDto): Promise<Alert> {
    // Don't verify JWT in service layer!
    const user = await this.jwtService.verify(jwt); // ❌ Wrong!
    // ...
  }
}
```

---

### **3. Authorization Logic (INTERNAL)**

**Authorization can be internal (not JWT-based):**

```typescript
// Option A: Guard at controller level (preferred)
@Controller('alerts')
export class AlertsController {

  @Post()
  @UseGuards(JwtAuthGuard) // Authentication
  @UseGuards(TierGuard) // Authorization (checks user.tier)
  async createAlert(@CurrentUser() user: User, @Body() dto: CreateAlertDto) {
    return this.alertsService.create(user.id, dto);
  }
}

@Injectable()
export class TierGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // Already authenticated
    const dto = request.body;

    // Authorization logic (internal)
    return this.validateTierAccess(user.tier, dto.symbol);
  }

  private validateTierAccess(tier: string, symbol: string): boolean {
    if (tier === 'FREE' && !ALLOWED_SYMBOLS_FREE.includes(symbol)) {
      throw new ForbiddenException('Symbol not allowed for FREE tier');
    }
    return true;
  }
}
```

```typescript
// Option B: Service-level authorization (also valid)
@Injectable()
export class AlertsService {

  async create(userId: string, dto: CreateAlertDto): Promise<Alert> {
    // Fetch user (internal database call)
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    // Authorization check (internal logic)
    if (user.tier === 'FREE' && !ALLOWED_SYMBOLS_FREE.includes(dto.symbol)) {
      throw new ForbiddenException('Symbol not allowed for FREE tier');
    }

    // Create alert
    return this.prisma.alert.create({ data: { userId, ...dto } });
  }
}
```

**Key Point:** Authorization logic doesn't need JWT - it uses the already-authenticated user context.

---

## 📊 Comparison Table

| Aspect | JWT for ALL Endpoints | JWT for PUBLIC Only (Recommended) |
|--------|----------------------|----------------------------------|
| **Performance** | ❌ Slow (verify JWT repeatedly) | ✅ Fast (verify once) |
| **Code Complexity** | ❌ High (JWT everywhere) | ✅ Low (typed context internally) |
| **Service Autonomy** | ❌ Low (tied to JWT format) | ✅ High (internal flexibility) |
| **Security** | ✅ Verified everywhere | ✅ Verified at boundaries |
| **Testability** | ❌ Hard (need JWT mocks everywhere) | ✅ Easy (typed parameters) |
| **Refactoring** | ❌ Hard (JWT coupling) | ✅ Easy (internal changes) |
| **Debugging** | ❌ Complex (JWT errors everywhere) | ✅ Simple (clear boundaries) |

---

## 🔑 Service-to-Service JWT

**Special case:** When Backend A calls Backend B, it DOES use JWT (PUBLIC endpoint).

### **Implementation:**

```typescript
// Backend A - Generate service-to-service JWT
@Injectable()
export class MarketDataClient {
  constructor(private readonly jwtService: JwtService) {}

  async getOHLCV(userId: string, symbol: string): Promise<OHLCV[]> {
    // Generate JWT for this specific call
    const jwt = this.jwtService.sign(
      {
        sub: userId,
        service: 'backend-a', // Source service
        scope: 'market-data:read', // Permission scope
      },
      {
        expiresIn: '1m', // Short-lived for service calls
        secret: process.env.SERVICE_JWT_SECRET, // Different secret!
      }
    );

    // Make HTTP request with JWT
    const response = await fetch('http://backend-b:3002/api/market-data/ohlcv', {
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'X-Service': 'backend-a', // Service identifier
      },
      params: { symbol },
    });

    return response.json();
  }
}
```

```typescript
// Backend B - Verify service-to-service JWT
@Injectable()
export class ServiceJwtStrategy extends PassportStrategy(Strategy, 'service-jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.SERVICE_JWT_SECRET, // Same secret
    });
  }

  async validate(payload: any) {
    // Validate service-to-service token
    if (payload.service !== 'backend-a') {
      throw new UnauthorizedException('Invalid service');
    }

    return {
      userId: payload.sub,
      service: payload.service,
      scope: payload.scope,
    };
  }
}

@Controller('market-data')
export class MarketDataController {

  @Get('ohlcv')
  @UseGuards(AuthGuard('service-jwt')) // ← Service JWT guard
  async getOHLCV(@CurrentUser() user: ServiceUser, @Query('symbol') symbol: string) {
    // Service JWT verified, now use internal service
    return this.marketDataService.getOHLCV(user.userId, symbol);
  }
}
```

**Key Points:**
- ✅ Service-to-service JWT is SHORT-LIVED (1 minute)
- ✅ Uses DIFFERENT secret (not user JWT secret)
- ✅ Includes service identifier and scope
- ✅ Verified at Backend B entry point
- ✅ Backend B internal logic still uses typed context

---

## 🛡️ Security Best Practices

### **1. Different JWT Secrets**

```typescript
// .env
JWT_SECRET=user-jwt-secret-min-32-chars           # For user JWTs
SERVICE_JWT_SECRET=service-jwt-secret-different   # For service-to-service
```

**Why:** Compromise of one secret doesn't affect the other.

---

### **2. Short-Lived Service JWTs**

```typescript
// User JWT: 7 days
const userJWT = this.jwtService.sign(payload, { expiresIn: '7d' });

// Service JWT: 1 minute
const serviceJWT = this.jwtService.sign(payload, { expiresIn: '1m' });
```

**Why:** Service-to-service calls should complete quickly. Short expiration reduces risk.

---

### **3. JWT Scopes for Services**

```typescript
// Service JWT includes scope
{
  sub: "user_123",
  service: "backend-a",
  scope: "market-data:read", // ← Permission scope
  exp: 1704672000
}

// Backend B validates scope
if (!user.scope.includes('market-data:read')) {
  throw new ForbiddenException('Insufficient scope');
}
```

**Why:** Principle of least privilege - services only access what they need.

---

### **4. Mutual TLS (mTLS) for High-Security**

**Optional:** For very sensitive service-to-service calls, use mTLS + JWT.

```typescript
// Backend A makes HTTPS request with client certificate
const response = await fetch('https://backend-b:3002/api/sensitive', {
  headers: {
    'Authorization': `Bearer ${jwt}`,
  },
  agent: new https.Agent({
    cert: fs.readFileSync('client-cert.pem'),
    key: fs.readFileSync('client-key.pem'),
    ca: fs.readFileSync('ca-cert.pem'),
  }),
});
```

**Why:** Two-factor authentication for services:
1. JWT (proves identity)
2. Client certificate (proves service authenticity)

---

## ✅ Recommended Implementation Strategy

### **Phase 1: User JWT (Frontend → Backend)**

```typescript
// Frontend sends JWT in cookie
fetch('/api/alerts', { credentials: 'include' });

// Backend verifies at controller
@UseGuards(JwtAuthGuard)
async getAlerts(@CurrentUser() user: User) { ... }

// Internal services use typed context
async findByUser(userId: string) { ... }
```

---

### **Phase 2: Service JWT (Backend → Backend)**

```typescript
// Backend A generates service JWT
const jwt = this.jwtService.sign({
  sub: userId,
  service: 'backend-a',
  scope: 'market-data:read',
}, { expiresIn: '1m' });

// Backend B verifies service JWT
@UseGuards(AuthGuard('service-jwt'))
async getOHLCV(@CurrentUser() user: ServiceUser) { ... }
```

---

### **Phase 3: API Gateway (Optional, Future)**

```typescript
// API Gateway verifies JWT once
// Adds X-User-Id header for downstream services

// Backend services trust X-User-Id header
const userId = request.headers['x-user-id']; // From API Gateway
```

---

## 📐 OpenAPI Documentation Scope

### **JWT Authentication Scope = OpenAPI Documentation Scope**

**The same PUBLIC/INTERNAL distinction applies to OpenAPI documentation:**

```
┌──────────────────────────────────────────────────────────┐
│  What goes in OpenAPI Document?                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ✅ INCLUDE: PUBLIC HTTP Endpoints (JWT authenticated)  │
│                                                          │
│     POST   /auth/login                                   │
│     POST   /auth/register                                │
│     POST   /auth/refresh                                 │
│     GET    /alerts                                       │
│     POST   /alerts                                       │
│     GET    /market-data/ohlcv                           │
│     POST   /rag/query                                    │
│                                                          │
│  ❌ EXCLUDE: Internal Implementation (No JWT)           │
│                                                          │
│     authService.generateTokens()                         │
│     authService.validateUser()                           │
│     alertsService.findByUser()                           │
│     prisma.user.findUnique()                            │
│     redis.get('key')                                     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### **Why This Matters:**

1. **Consistent Architecture**
   - JWT verifies at PUBLIC endpoints → Document PUBLIC endpoints in OpenAPI
   - No JWT internally → No internal methods in OpenAPI
   - One-to-one mapping between JWT scope and OpenAPI scope

2. **Accurate API Contract**
   - OpenAPI shows what's actually accessible via HTTP
   - Frontend/Backend know exactly what endpoints exist
   - No confusion between public APIs and internal implementation

3. **Type Generation Accuracy**
   - Generated types match actual HTTP API calls
   - No types generated for internal methods (as it should be)
   - Frontend gets exact types for what it can call

4. **Clear Boundaries**
   - OpenAPI = External interface (PUBLIC)
   - Internal code = Implementation details (INTERNAL)
   - Easy to understand service boundaries

### **Authentication Stack OpenAPI Example:**

```yaml
# openapi-system-wide.yaml

paths:
  # ✅ These are PUBLIC HTTP endpoints (in OpenAPI)
  /auth/login:
    post:
      summary: Login with email and password
      security: []  # Public endpoint (no JWT required)
      # ...

  /auth/register:
    post:
      summary: Register new user
      security: []  # Public endpoint
      # ...

  /auth/refresh:
    post:
      summary: Refresh access token
      security:
        - CookieAuth: []  # JWT required
      # ...

  /alerts:
    get:
      summary: List user alerts
      security:
        - BearerAuth: []  # JWT required
      # ...

# ❌ These are NOT in OpenAPI (internal implementation)
#
# - authService.generateTokens(user): Promise<Tokens>
# - authService.validateUser(userId): Promise<User>
# - authService.createRefreshToken(userId): Promise<string>
# - alertsService.findByUser(userId): Promise<Alert[]>
# - prisma.user.findUnique({ where: { id } })
# - redis.get('session:' + userId)
```

### **Key Principle:**

> **"If it's not callable via HTTP from outside the service, it's NOT in OpenAPI."**
>
> - PUBLIC HTTP endpoint → In OpenAPI → JWT authenticated
> - Internal method → NOT in OpenAPI → No JWT (typed context)

---

## 📝 Summary

### ✅ **Recommended Approach:**

**JWT authenticates PUBLIC endpoints only (not internal logic)**

**Why:**
1. ✅ **Performance:** Verify JWT once at boundary, not repeatedly
2. ✅ **Simplicity:** Internal services use typed parameters, not JWT
3. ✅ **Security:** Same security (verified at entry), less complexity
4. ✅ **Testability:** Easy to test internal services (no JWT mocks)
5. ✅ **Maintainability:** Clear separation (public vs internal)

**Where JWT is verified:**
- ✅ Frontend → Backend: Verify at controller (PUBLIC)
- ✅ Backend → Backend: Verify at controller (PUBLIC)
- ❌ Service → Service internal: No JWT (INTERNAL)
- ❌ Service → Database: No JWT (INTERNAL)

**Where JWT is NOT needed:**
- ❌ Internal service methods
- ❌ Database queries
- ❌ Redis cache operations
- ❌ Internal helper functions

---

**Document Version:** 1.0
**Last Updated:** 2026-02-02
**Status:** Recommended Strategy
**Next Steps:** Implement JWT guards at all PUBLIC endpoints (controllers)

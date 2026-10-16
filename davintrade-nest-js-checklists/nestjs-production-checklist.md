# NestJS Production Checklist: 17 Checks Before You Deploy

> **Author:** Kamil Myśliwiec (Creator of NestJS)  
> **Source Reference:** [DEV Community - NestJS Production Checklist](https://dev.to/nestjs/nestjs-production-checklist-17-checks-before-you-deploy-1d0j)  
> **Scope & Application:** Master Engineering Standard and Verification Guide for NestJS Services (`operation-service`, `money-service`, and future microservices).

---

## Executive Summary: The Distributed Production Mindset

Locally, a NestJS application runs as a single process, restarts when files change, connects directly to an unshared local database, and receives requests straight from your browser.

In production, the application operates in an entirely different reality:

- It runs as **multiple replicas** behind a load balancer / reverse proxy (e.g., Railway, Kubernetes, Cloudflare).
- It is continuously terminated and spawned during zero-downtime rolling deploys and scale-downs.
- It shares its database connection pool with multiple containers, migration runners, and worker processes.
- It relies on downstream third-party APIs and microservices that can lag, timeout, or fail completely.

Defaults that are convenient for local development are often hazardous in production. This document serves as the canonical 17-point production checklist and architectural reference for engineering teams verifying NestJS services prior to production release.

---

## 1. Startup and Deploys

### Check 1: Validate Config at Boot, and Keep Secrets Out of the Image

#### Principle & Rationale

A missing, misnamed, or malformed environment variable must stop the application process **before** it opens its HTTP port and accepts traffic. If validation is omitted or deferred, an application can pass basic health checks, receive user traffic, and crash catastrophically on the first request attempting to read that missing key.

Furthermore, rolling deployments depend on this failure mode: an invalid container fails at boot, never marks itself ready, and the orchestrator preserves the previous healthy release.

#### Anti-Patterns

- Calling `configService.get('SECRET')` without nullability checks or fallbacks at runtime.
- Hardcoding `.env` files inside Docker images or baking secrets into Docker `ARG` / `ENV` directives (where they remain readable via image layer history).
- Executing `console.log(config)` during startup for debugging, inadvertently streaming credentials and secrets to log pipelines.

#### Implementation Standard

Use `@nestjs/config` with strict schema validation using a Standard Schema (Zod, Valibot, or ArkType), and retrieve mandatory values with `getOrThrow()`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  STRIPE_SECRET_KEY: z.string().min(1),
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => envSchema.parse(config),
    }),
  ],
})
export class AppModule {}
```

#### Team Audit Checklist

- [ ] Is an environment validation schema (Zod/Joi) attached to `ConfigModule.forRoot()`?
- [ ] Are required credentials accessed via `configService.getOrThrow()` rather than `get()`?
- [ ] Are `.env*` files excluded via `.dockerignore` and `.gitignore`?
- [ ] Are secrets injected strictly at runtime via the platform secret store (Railway Secrets / AWS Secrets Manager / Vault)?
- [ ] Is `console.log(process.env)` or full config logging strictly prohibited?

---

### Check 2: Handle SIGTERM, and Get the Container Right

#### Principle & Rationale

Container orchestrators send a `SIGTERM` signal during deployments, scale-downs, and host maintenance. NestJS does **not** listen for process signals by default. Unless explicitly instructed, hooks such as `onModuleDestroy()`, `beforeApplicationShutdown()`, and `onApplicationShutdown()` never run. Consequently:

- Database connection pools terminate abruptly.
- Background queue workers (e.g., BullMQ) are killed mid-job, causing stalled locks.
- In-flight client HTTP requests are dropped without responses.

#### Signal Delivery Traps in Containers

1. **Intermediary Wrappers:** Running `CMD npm run start:prod` puts `npm` as PID 1. `npm` does not reliably forward OS signals to child Node processes.
2. **Node as PID 1:** The Linux kernel treats PID 1 specially and does not apply default signal dispositions. If Nest catches `SIGTERM` and re-emits it to exit, PID 1 ignores it unless an init system manages it.

#### Implementation Standard

1. **Enable Shutdown Hooks in `main.ts`:**

   ```typescript
   async function bootstrap() {
     const app = await NestFactory.create(AppModule);
     app.enableShutdownHooks();
     await app.listen(process.env.PORT ?? 3000);
   }
   bootstrap();
   ```

2. **Use Container Exec Form & Init System:**
   - Execute Node directly without `npm`: `CMD ["node", "dist/main.js"]`.
   - Run containers with an init process (`docker run --init` or `tini` as entrypoint), or configure Nest explicitly:
     ```typescript
     app.enableShutdownHooks(undefined, { useProcessExit: true });
     ```

3. **Multi-Stage Build & Memory Limit Budget:**
   Set V8 old space to ~75% of the container memory ceiling so that memory leaks trigger a clean JavaScript `heap out of memory` exception with an actionable stack trace, rather than an unlogged kernel OOM kill (`exit code 137`):

   ```dockerfile
   # Stage 1: Build
   FROM node:22-slim AS build
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci
   COPY . .
   RUN npm run build && npm prune --omit=dev

   # Stage 2: Runtime
   FROM node:22-slim
   ENV NODE_ENV=production
   WORKDIR /app
   COPY --from=build /app/package.json ./
   COPY --from=build /app/node_modules ./node_modules
   COPY --from=build /app/dist ./dist
   USER node
   ENV NODE_OPTIONS="--max-old-space-size=768 --enable-source-maps"
   CMD ["node", "dist/main.js"]
   ```

#### Team Audit Checklist

- [ ] Is `app.enableShutdownHooks()` explicitly called in `main.ts`?
- [ ] Does the deployment configuration (e.g., `railway.toml`, Dockerfile) launch Node directly (`node dist/main.js`) instead of through `npm run`?
- [ ] Is `--max-old-space-size` configured proportionally to the container memory ceiling?
- [ ] Does the container run under a non-root user (`USER node`)?

---

### Check 3: Drain Before You Close

#### Principle & Rationale

When an orchestrator terminates a replica, two asynchronous events occur concurrently:

1. The replica is deregistered from load balancer / proxy routing tables.
2. The replica receives `SIGTERM`.

Propagation of endpoint removal through load balancers and kube-proxy takes several seconds. If a Nest server stops accepting connections immediately upon receiving `SIGTERM`, clients routed during this convergence window receive `502 Bad Gateway` or `ECONNRESET`.

#### Implementation Standard

- **PreStop Hook / Termination Delay:** Add a delay before shutting down the HTTP listener (e.g., 5 seconds in container lifecycle):
  ```yaml
  lifecycle:
    preStop:
      exec:
        command: ['sleep', '5']
  ```
- **NestJS 12 `return503OnClosing`:** Use `return503OnClosing: true` in `NestFactory.create()` so incoming connections receive `503 Service Unavailable` with `Connection: close` while in-flight transactions finish draining.
- **Grace Period vs. Background Job Duration:** Ensure `terminationGracePeriodSeconds` exceeds the run duration of your longest background task, or ensure jobs are partitioned into small idempotent steps.

#### Team Audit Checklist

- [ ] Is there a drain delay configured before process termination in production orchestrators?
- [ ] Is the grace period sufficient for active database transactions and queue workers to drain cleanly?

---

### Check 4: Scheduled Jobs Run on Every Replica

#### Principle & Rationale

Decorators like `@Cron()`, `@Interval()`, and `@Timeout()` from `@nestjs/schedule` execute **in-process**. If an application scales to 3 replicas in production, every scheduled job executes 3 times simultaneously. This causes double-billing, duplicate notifications, race conditions, and database lock contention.

#### Anti-Patterns

- Relying on local boolean flags or in-memory variables to guard `@Cron()` execution across replicas.
- Assuming only one container triggers `@Cron()` without distributed locking.

#### Implementation Standard

Use `@nestjs/locks` (or a distributed Redis mutex) backed by a shared persistence store (Redis or Postgres):

```typescript
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OnOneInstance, WithoutOverlapping } from '@nestjs/locks';

@Injectable()
export class BillingCronService {
  @Cron('0 2 * * *')
  @OnOneInstance({ key: 'billing:daily-invoices' })
  async generateDailyInvoices() {
    // Guaranteed to run on exactly one instance; others skip the tick
  }

  @Cron('*/5 * * * *')
  @WithoutOverlapping()
  async reconcileAccounts() {
    // Skips if previous execution on this instance is still running
  }
}
```

_Note on Queues (BullMQ):_ Set `attempts`, `backoff`, and `removeOnComplete` / `removeOnFail` in `defaultJobOptions`. Every queue worker must be safe to execute multiple times (**idempotent**).

#### Team Audit Checklist

- [ ] Are `@Cron()` methods protected by distributed locks (e.g., Redis mutex / `@nestjs/locks`) or isolated to a dedicated single-replica worker?
- [ ] Are cron jobs designed to process pending state rather than assuming fixed temporal batches?
- [ ] Do queue jobs configure explicit retry limits, backoffs, and dead-letter cleanup?

---

## 2. The Edge and Security

### Check 5: Make Authentication Deny-by-Default

#### Principle & Rationale

Applying `@UseGuards(AuthGuard)` individually to each controller is a **fail-open** design: if an engineer creates a new controller or method and forgets the decorator, the endpoint remains exposed to the public internet without any error or warning.

Inverting this model to **deny-by-default** guarantees that every route requires authentication unless explicitly opted out with a `@Public()` decorator.

#### Implementation Standard

Register the authentication guard globally using `APP_GUARD`, and inspect metadata with `Reflector`:

```typescript
// public.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// jwt-auth.guard.ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class GlobalJwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }
}

// app.module.ts
providers: [
  {
    provide: APP_GUARD,
    useClass: GlobalJwtAuthGuard,
  },
],
```

#### Team Audit Checklist

- [ ] Is authentication registered globally via `APP_GUARD`?
- [ ] Are public endpoints explicitly marked with `@Public()`?
- [ ] During PR reviews, are security checks focused on reviewing new instances of `@Public()`?

---

### Check 6: Security Headers, CORS, Rate Limits, and the Proxy in Front

#### Principle & Rationale

Production web services face automated scanning, credential stuffing, and spoofing. Defaults must be hardened before public release:

- **Security Headers:** Protect against MIME-sniffing, clickjacking, and XSS.
- **CORS:** Restrict browser origins to legitimate frontends.
- **Rate Limiting:** Protect sensitive authentication and billing routes.
- **Trust Proxy:** Behind reverse proxies (Railway, Cloudflare, ALB), `req.ip` reflects the proxy IP unless configured. Rate limiters and audit logs will mistake all traffic as originating from one client.

#### Implementation Standard

```typescript
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 1. Trust proxy: specify exact hop count (1 for single reverse proxy)
  app.set('trust proxy', 1);

  // 2. Security headers (via Helmet or Nest built-in useSecurityHeaders())
  app.use(helmet());

  // 3. Strict CORS origin allowlist (avoid wildcard '*' when credentials are true)
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') ?? [];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
```

_Shared Rate Limiting:_ Configure `ThrottlerModule` with a Redis storage adapter (`@nest-lab/throttler-storage-redis`) so rate limits are tracked across all running replicas.

#### Team Audit Checklist

- [ ] Is `app.set('trust proxy', 1)` (or appropriate hop count) configured?
- [ ] Are security headers (Helmet / CSP / HSTS) applied globally?
- [ ] Is CORS configured with an explicit origin array instead of a permissive wildcard?
- [ ] Are brute-force targets (login, password reset, checkout) throttled with shared Redis storage?

---

## 3. Input and Output Handling

### Check 7: Validate Every Input and Bound List Endpoints

#### Principle & Rationale

Every payload entering the system must be strictly validated before touching application logic. Unstripped payload keys allow Mass Assignment vulnerabilities (e.g., injecting `role: "admin"` into a user update DTO).

Additionally, unpaginated listing endpoints are denial-of-service risks: a query without maximum limit constraints can load hundreds of thousands of database rows into Node memory, exhausting the heap.

#### Implementation Standard

1. **Global Validation Pipe:**

   ```typescript
   app.useGlobalPipes(
     new ValidationPipe({
       whitelist: true, // Strips undeclared properties
       forbidNonWhitelisted: true, // Rejects requests containing unknown fields
       transform: true, // Autotransforms primitive types
     })
   );
   ```

   _(Or `StandardSchemaValidationPipe` when using Zod / Valibot schemas)._

2. **Bound All List & Bulk Queries:**
   Enforce default and maximum pagination parameters in all query DTOs:

   ```typescript
   import { z } from 'zod';

   export const ListQuerySchema = z.object({
     limit: z.coerce.number().int().min(1).max(100).default(20),
     cursor: z.string().optional(),
   });
   ```

3. **Preserve Global Body Limits:**
   Keep the default 100 KB JSON body size limit. Never increase body parser limits globally for file upload endpoints; stream uploads or utilize direct pre-signed URLs to S3/R2 storage.

#### Team Audit Checklist

- [ ] Is a global `ValidationPipe` enabled with `whitelist: true` and `forbidNonWhitelisted: true`?
- [ ] Does every list endpoint define both a default limit and a hard upper cap (e.g., maximum 100 items)?
- [ ] Are bulk operations bounded to prevent payload-driven memory exhaustion?
- [ ] Are large file uploads handled via pre-signed storage URLs rather than through the NestJS process?

---

### Check 8: Control What Goes Out

#### Principle & Rationale

Returning ORM entity objects directly from controller handlers exposes sensitive fields (password hashes, internal status flags, tokens). Even if an entity appears harmless today, new columns added to the database table in future migrations are automatically serialized and leaked unless strict output mapping is enforced.

Furthermore, API documentation interfaces (Swagger UI) map out internal attack surfaces and must not be publicly discoverable in production without authentication.

#### Implementation Standard

- **Response DTOs & Serialization:** Map database results to explicit response DTOs or enforce `ClassSerializerInterceptor` with `@Exclude()` on entity models:
  ```typescript
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  ```
- **Conditionally Disable Swagger in Production:**
  ```typescript
  if (process.env.NODE_ENV !== 'production') {
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }
  ```

#### Team Audit Checklist

- [ ] Are controller endpoints mapped through explicit response DTOs or Prisma select blocks?
- [ ] Is Swagger documentation disabled or protected behind authentication in production environments?

---

### Check 9: Make Writes Safe to Repeat (Idempotency)

#### Principle & Rationale

Network blips, mobile retries, double-clicks, and webhook delivery policies cause identical HTTP `POST` requests to reach the server multiple times. Without idempotency, a customer is charged twice or duplicate records are created.

#### Implementation Standard

Implement an idempotency contract via an `Idempotency-Key` header stored in a shared persistence backend (Redis/Postgres):

- If a request arrives with an active key, return `409 Conflict` with `Retry-After`.
- If a completed response exists for the key, replay the cached response immediately (`Idempotent-Replayed: true`).
- If the request body differs for the same key, reject with `422 Unprocessable Entity`.
- For critical financial write operations, enforce `Idempotency-Key` as mandatory (`required: true`).

```typescript
@Post(':id/pay')
@UseInterceptors(IdempotencyInterceptor)
async executePayment(
  @Param('id') orderId: string,
  @Headers('idempotency-key') idempotencyKey: string,
) {
  return this.paymentService.processOrder(orderId);
}
```

#### Team Audit Checklist

- [ ] Are financial transactions, order creation, and payment operations guarded with idempotency keys?
- [ ] Is the idempotency cache stored in a shared Redis/Postgres instance rather than process memory?
- [ ] Do webhook handlers implement idempotent upserts based on external provider IDs?

---

## 4. Dependencies and Database

### Check 10: Run Current Supported Versions of Node, Nest, and Dependencies

#### Principle & Rationale

Operating outdated software introduces known CVE vulnerabilities, unpatched memory leaks, and dependency conflicts. Release lines past End-of-Life (EOL) receive zero security patches.

- **Node.js:** Run an active LTS release (e.g., Node 22 or Node 24).
- **NestJS:** Keep all `@nestjs/*` packages aligned on the exact same major version to prevent dependency injection and metadata reflection bugs.
- **Lockfile & Audit:** Commit `package-lock.json` or `pnpm-lock.yaml`, install via `npm ci`, and run `npm audit --omit=dev` in continuous integration pipelines.

#### Team Audit Checklist

- [ ] Is the Node runtime pinned to an active, supported LTS release in Dockerfiles and engines?
- [ ] Are all `@nestjs/*` package versions synchronized?
- [ ] Does CI enforce clean installs (`npm ci` / `pnpm install --frozen-lockfile`) and audit dependencies?

---

### Check 11: Time Out Every Outbound Call

#### Principle & Rationale

A downstream API that hangs without responding is far more dangerous than one that returns an immediate HTTP 500 error. Every hung outbound request holds an open TCP socket, memory, event loop resources, and frequently an open database transaction. Under moderate traffic, connection starvation cascades back and halts the entire service.

#### Default Timeout Pitfalls

- Standard Node `fetch()` has no default timeout (it waits up to 5 minutes for headers).
- Unbounded Prisma/Postgres queries can run indefinitely unless a statement timeout is specified.

#### Implementation Standard

1. **Pass `AbortSignal.timeout()` to every `fetch`:**

   ```typescript
   const response = await fetch(endpointUrl, {
     method: 'GET',
     signal: AbortSignal.timeout(5000), // Enforces hard 5s timeout
   });
   ```

2. **Configure Database Statement Timeout:**
   Set `statement_timeout` in PostgreSQL pool configuration to prevent slow queries from monopolizing connections:
   ```typescript
   new Pool({
     connectionString: process.env.DATABASE_URL,
     statement_timeout: 10000, // 10s maximum query runtime
   });
   ```

#### Team Audit Checklist

- [ ] Does every external HTTP request utilize an explicit timeout signal (`AbortSignal.timeout`)?
- [ ] Are statement timeouts configured on database connection pools?
- [ ] Are retry policies bounded so exponential backoff does not exceed the caller's total timeout budget?

---

### Check 12: Plan for Dependencies That Are Down (Resilience)

#### Principle & Rationale

When a third-party dependency experiences an extended outage, repeatedly hammering it with requests wastes resources and slows your application down. Systems must fail fast, isolate failures, and provide fallback options.

#### Implementation Patterns

- **Circuit Breaker:** Once downstream failure rates cross a threshold (e.g., 50% failures across 10 requests), open the circuit to immediately reject calls with `503 Service Unavailable` for a cooldown period (e.g., 30s) without waiting for timeouts.
- **Bulkhead:** Limit the maximum number of concurrent requests permitted to a specific dependency so it cannot consume all available Node event loop workers.
- **Fallback:** Return safe default data or cached responses when downstream calls fail.
- **Layered Retries:** Retries must only be managed by **one layer**. If an HTTP client retries 3 times and an outer resilience interceptor also retries 3 times, a single client request triggers 9 outbound requests ($3 \times 3$).

#### Team Audit Checklist

- [ ] Are volatile external dependencies protected by circuit breakers or backoff policies?
- [ ] Are retries restricted to idempotent methods and governed by a single layer?
- [ ] Are graceful degradation or fallback mechanisms defined for non-critical dependencies?

---

### Check 13: Run Migrations as a Deploy Step

#### Principle & Rationale

- Development features like TypeORM `synchronize: true` or Prisma `db push` calculate automatic diffs and are unsafe in production, as they can inadvertently drop tables or columns.
- Running migrations automatically on application startup (`migrationsRun: true`) causes **race conditions** when multiple container replicas launch simultaneously.
- **Backward Compatibility:** During rolling deployments, old and new application containers run concurrently against the same database schema. Any migration that drops or renames a column breaks active containers.

#### Implementation Standard

1. Run migrations as an isolated pre-deployment job (e.g., CI/CD release phase or Kubernetes Job):
   ```bash
   npx prisma migrate deploy
   ```
2. Follow the **Expand / Contract** pattern for breaking changes:
   - _Deploy 1 (Expand):_ Add the new nullable column; write to both old and new columns.
   - _Deploy 2:_ Backfill historical data.
   - _Deploy 3 (Contract):_ Switch reads to the new column; drop the old column.
3. Ensure every migration is backward-compatible so that deploying the previous application image is always possible without requiring risky down-migrations.

#### Team Audit Checklist

- [ ] Are schema sync tools (`synchronize`, `db push`) strictly disabled in production?
- [ ] Are migrations executed in an isolated deploy step prior to rolling container updates?
- [ ] Can the previous application image run safely against the migrated schema if a rollback is needed?

---

### Check 14: Check the Database Connection Pool Math

#### Principle & Rationale

Every application replica manages its own local connection pool. A pool size of 20 connections on 5 replicas consumes 100 connections. During rolling updates, when old and new pods overlap, this number can double to 200, exceeding database `max_connections` limits.

#### Calculation Formula

$$\text{Total Connections} = (\text{Max Active Replicas} + \text{Rolling Update Surges}) \times \text{Pool Size per Replica} + \text{Background Workers} + \text{Admin Tools}$$

#### Implementation Standard

- Explicitly configure pool sizing (`max` in pg/Prisma adapter) rather than relying on driver defaults.
- When total required connections approach database limits, deploy a connection pooler like **PgBouncer** (or Supabase/Railway connection pooling) using transaction-mode pooling instead of increasing PostgreSQL `max_connections`.

#### Team Audit Checklist

- [ ] Is connection pool size explicitly defined in database client configurations?
- [ ] Does total potential connection consumption fit safely within the database server limit during deployment surges?
- [ ] Is connection pooling (e.g., PgBouncer) implemented for microservice architectures?

---

### Check 15: Watch for Request-Scoped Chains

#### Principle & Rationale

In NestJS, dependency injection defaults to `Scope.DEFAULT` (Singletons). If a provider is marked with `Scope.REQUEST`, **every provider that injects it, up through the controller, becomes request-scoped**.

A request-scoped logger or utility at the bottom of your dependency graph causes dozens of class instances to be instantiated and garbage-collected on every single HTTP request. This introduces severe memory allocation overhead and degrades throughput.

#### Implementation Standard

- Keep controllers and services as singletons.
- If request-specific metadata (such as `correlationId`, `userId`, or transaction contexts) is needed deep in the call stack, use Node.js `AsyncLocalStorage` (e.g., via the `nestjs-cls` package) rather than request-scoped providers.

#### Team Audit Checklist

- [ ] Does the codebase avoid unnecessary `Scope.REQUEST` declarations?
- [ ] Is contextual data (correlation IDs, tenant context) propagated via `AsyncLocalStorage` instead of DI scope?

---

## 5. Errors and Observability

### Check 16: Errors: Statuses, Structured Logging, and Source Maps

#### Principle & Rationale

1. **Semantic HTTP Exceptions:** `HttpException` instances must emit precise status codes (400, 401, 403, 404). Uncaught system errors must emit opaque 500 responses to the client while logging complete diagnostic details internally.
2. **Filter Inheritance:** Custom global exception filters should extend `BaseExceptionFilter` so Nest's core error-handling logic and logger streams remain intact.
3. **TypeScript Source Maps:** When Node executes compiled JavaScript from `dist/`, runtime stack traces reference minified code unless source maps are explicitly enabled.

#### Implementation Standard

- **Enable Source Maps in Production:**
  Launch Node with `--enable-source-maps`:
  ```json
  "scripts": {
    "start:prod": "node --enable-source-maps dist/main.js"
  }
  ```
  _(Or configure `NODE_OPTIONS="--enable-source-maps"` in the container environment)._
- **Structured Exception Filter:**
  Ensure the global exception filter extracts request context (`correlationId`, route path, user ID) and records error stacks on 5xx failures.

#### Team Audit Checklist

- [ ] Is `--enable-source-maps` configured in production startup scripts?
- [ ] Does error handling sanitize internal stack traces from client responses while preserving them in logs?
- [ ] Are uncaught promise rejections logged with full stack traces prior to process exit?

---

### Check 17: Logs, Health Checks, and Telemetry

#### Principle & Rationale

- **Structured Logs:** Production logs must output machine-readable JSON containing timestamp, severity level, message, and a unique `correlationId` attached to each request.
- **Liveness vs. Readiness:**
  - **Liveness Probe:** Checks if the Node process is running and the event loop is responsive. It **must never check external dependencies** like the database. If your database experiences a brief hiccup and liveness checks fail, the orchestrator will restart every replica at once, worsening the outage with a reconnection storm.
  - **Readiness Probe:** Checks if the replica is ready to accept incoming user traffic (verifies database, Redis, and message broker connections via `@nestjs/terminus`).

#### Implementation Standard

```typescript
import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
} from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator
  ) {}

  // Liveness: Process health only (No external dependencies)
  @Get('live')
  checkLiveness() {
    return { status: 'ok', uptime: process.uptime() };
  }

  // Readiness: Checks downstream connectivity before routing traffic
  @Get('ready')
  @HealthCheck()
  checkReadiness() {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
    ]);
  }
}
```

#### Team Audit Checklist

- [ ] Are logs formatted in structured JSON with correlation IDs across all log entries?
- [ ] Are liveness and readiness health checks strictly separated?
- [ ] Does the liveness probe avoid querying external dependencies?
- [ ] Are APM metrics (p95 latency, error rates, database spans) monitored via OpenTelemetry or equivalent APM tooling?

---

## Production Verification Matrix

Use this quick-reference audit checklist during pull request reviews and pre-deployment gate evaluations:

|  Item  | Focus Area           | Key Verification Question                                                              | Checked |
| :----: | :------------------- | :------------------------------------------------------------------------------------- | :-----: |
| **01** | Config Validation    | Does missing env config crash the app at boot via Zod schema validation?               |   [ ]   |
| **02** | SIGTERM & PID        | Does Node receive signals directly (`CMD ["node", ...]`) with shutdown hooks enabled?  |   [ ]   |
| **03** | Traffic Drain        | Is there a preStop delay and adequate grace period to drain active connections?        |   [ ]   |
| **04** | Distributed Crons    | Are `@Cron()` methods protected by distributed locks against duplicate execution?      |   [ ]   |
| **05** | Deny-by-Default Auth | Is authentication enforced globally with explicit `@Public()` exceptions?              |   [ ]   |
| **06** | Edge Security        | Are `trust proxy`, Helmet, strict CORS origins, and Redis rate limiters active?        |   [ ]   |
| **07** | Input Validation     | Are validation pipes stripping unknown keys and bounding list pagination limits?       |   [ ]   |
| **08** | Output Control       | Are database entities masked with response DTOs, and is Swagger hidden in prod?        |   [ ]   |
| **09** | Idempotency          | Do critical payment and write endpoints deduplicate requests via idempotency keys?     |   [ ]   |
| **10** | Supported Versions   | Are Node LTS, Nest packages, and dependencies current, locked, and audited?            |   [ ]   |
| **11** | Outbound Timeouts    | Does every external `fetch` and database query have an explicit timeout?               |   [ ]   |
| **12** | Resilience           | Are external calls isolated with circuit breakers, bulkheads, or fallbacks?            |   [ ]   |
| **13** | Safe Migrations      | Are migrations run as a separate deploy phase with backward-compatible schema changes? |   [ ]   |
| **14** | DB Connection Math   | Does (replicas $\times$ pool size) fit safely inside database connection limits?       |   [ ]   |
| **15** | DI Scope             | Are providers singletons, avoiding accidental `Scope.REQUEST` performance leaks?       |   [ ]   |
| **16** | Error Handling       | Is `--enable-source-maps` active and are error stack traces logged cleanly?            |   [ ]   |
| **17** | Observability        | Are JSON logs traced with correlation IDs, and are liveness/readiness probes split?    |   [ ]   |

# Claude Code Prompt Template: Backend Stack B Builder

**Version:** 1.0.0
**Purpose:** Build complete Backend Stack B with production files and tests
**Target:** Claude Code (web)
**Stack:** Nest.js + PostgreSQL + Redis + TypeScript

---

## 📋 How to Use This Template

1. Replace all `{{PLACEHOLDERS}}` with actual values
2. Attach required documents to Claude Code conversation
3. Copy the filled template to Claude Code
4. Let Claude Code build the entire stack

---

## 🎯 PROMPT TEMPLATE

```markdown
# Build Backend Stack B - {{PART_NAME}} (Part {{PART_NUMBER}})

## 📚 Context

I need you to build **Backend Stack B** for a Trading Alerts SaaS application. This is part of a modular monolith architecture where:

- **Backend Stack A** (Railway Container A): Main CRUD operations, authentication, billing
- **Backend Stack B** (Railway Container B): Async workers, message queues, analytics
- **Backend Stack C** (Contabo VPS): Market data collection from MT5

You are building **Backend Stack B - {{PART_NAME}}** which handles {{PART_DESCRIPTION}}.

---

## 📎 Attached Documents

I'm providing these documents as context:

1. **OpenAPI Contract**: `{{OPENAPI_FILE_NAME}}.yaml`
   - Complete API specification
   - Request/response schemas
   - All endpoints defined

2. **Implementation Guide**: `IMPLEMENTATION-GUIDE.md`
   - TypeScript type generation
   - API client patterns
   - Environment setup

3. **Architecture Design**: `{{ARCHITECTURE_DOC_NAME}}.md`
   - System architecture
   - Database schemas
   - Service relationships

4. **Implementation Plan**: `{{IMPLEMENTATION_PLAN_NAME}}.md`
   - Build order
   - File structure
   - Dependencies

---

## 🎯 Your Task

Build a **production-ready Nest.js backend** following the OpenAPI contract with:

### Required Files:

#### 1️⃣ Core Service Files

- **Controllers** (`*.controller.ts`) - HTTP request handlers following OpenAPI paths
- **Services** (`*.service.ts`) - Business logic implementation
- **DTOs** (`dto/*.dto.ts`) - Data Transfer Objects matching OpenAPI schemas
- **Entities** (`entities/*.entity.ts`) - Prisma/TypeORM entities for Database B
- **Interfaces** (`interfaces/*.interface.ts`) - TypeScript interfaces

#### 2️⃣ Supporting Files

- **Guards** (`guards/*.guard.ts`) - Authentication & authorization
- **Interceptors** (`interceptors/*.interceptor.ts`) - Logging, transformation
- **Pipes** (`pipes/*.pipe.ts`) - Validation pipes
- **Filters** (`filters/*.filter.ts`) - Exception handling
- **Decorators** (`decorators/*.decorator.ts`) - Custom decorators

#### 3️⃣ Infrastructure Files

- **Module** (`{{MODULE_NAME}}.module.ts`) - Feature module definition
- **Database Migrations** (`prisma/migrations/*`) - Database schema
- **Message Queue** (`queue/*.processor.ts`) - Background job processors
- **Cache** (`cache/*.service.ts`) - Redis caching layer

#### 4️⃣ Test Files

- **Unit Tests** (`*.spec.ts`) - For services and utilities
- **Integration Tests** (`*.e2e-spec.ts`) - For controllers and API endpoints
- **Mock Data** (`__mocks__/*.mock.ts`) - Test fixtures

#### 5️⃣ Configuration Files

- **Environment Schema** (`.env.example`) - Required environment variables
- **Swagger Config** (`swagger.config.ts`) - API documentation
- **Module Config** (`config/*.config.ts`) - Feature-specific configuration

---

## 📐 Project Structure

Generate files in this structure:
```

backend-stack-b/
├── src/
│ ├── {{MODULE_NAME}}/
│ │ ├── controllers/
│ │ │ └── {{MODULE_NAME}}.controller.ts
│ │ ├── services/
│ │ │ └── {{MODULE_NAME}}.service.ts
│ │ ├── dto/
│ │ │ ├── create-{{ENTITY_NAME}}.dto.ts
│ │ │ ├── update-{{ENTITY_NAME}}.dto.ts
│ │ │ └── {{ENTITY_NAME}}-response.dto.ts
│ │ ├── entities/
│ │ │ └── {{ENTITY_NAME}}.entity.ts
│ │ ├── interfaces/
│ │ │ └── {{ENTITY_NAME}}.interface.ts
│ │ ├── guards/
│ │ │ └── {{GUARD_NAME}}.guard.ts
│ │ ├── pipes/
│ │ │ └── {{PIPE_NAME}}.pipe.ts
│ │ ├── decorators/
│ │ │ └── {{DECORATOR_NAME}}.decorator.ts
│ │ ├── queue/
│ │ │ └── {{JOB_NAME}}.processor.ts
│ │ ├── tests/
│ │ │ ├── {{MODULE_NAME}}.controller.spec.ts
│ │ │ ├── {{MODULE_NAME}}.service.spec.ts
│ │ │ └── {{MODULE_NAME}}.e2e-spec.ts
│ │ └── {{MODULE_NAME}}.module.ts
│ ├── common/
│ │ ├── filters/
│ │ │ └── http-exception.filter.ts
│ │ ├── interceptors/
│ │ │ └── logging.interceptor.ts
│ │ └── guards/
│ │ └── jwt-auth.guard.ts
│ ├── prisma/
│ │ ├── schema.prisma
│ │ └── migrations/
│ ├── config/
│ │ ├── database.config.ts
│ │ ├── redis.config.ts
│ │ └── queue.config.ts
│ └── main.ts
├── test/
│ └── {{MODULE_NAME}}.e2e-spec.ts
├── .env.example
├── nest-cli.json
├── package.json
├── tsconfig.json
└── README.md

````

---

## ✅ Implementation Requirements

### 1. **Follow OpenAPI Contract EXACTLY**
- ✅ All endpoints defined in `{{OPENAPI_FILE_NAME}}.yaml`
- ✅ Request/response schemas match OpenAPI definitions
- ✅ HTTP status codes match specifications
- ✅ Error responses follow OpenAPI error schemas

### 2. **Type Safety**
- ✅ Use TypeScript strict mode
- ✅ No `any` types (use proper interfaces/types)
- ✅ All DTOs have class-validator decorators
- ✅ Return types specified on all methods

### 3. **Authentication & Authorization**
- ✅ JWT authentication using guards
- ✅ Session validation from NextAuth
- ✅ User ID ownership checks
- ✅ Proper 401/403 responses

### 4. **Validation**
- ✅ Request body validation with class-validator
- ✅ Query parameter validation
- ✅ Path parameter validation
- ✅ Custom validation pipes where needed

### 5. **Error Handling**
- ✅ Try-catch blocks in all async methods
- ✅ Specific exception types (NotFoundException, BadRequestException, etc.)
- ✅ User-friendly error messages
- ✅ Error logging with context

### 6. **Database Operations**
- ✅ Use Prisma ORM for Database B
- ✅ Transaction support where needed
- ✅ Proper error handling for DB constraints
- ✅ Optimized queries (use select, include wisely)

### 7. **Caching**
- ✅ Redis caching for frequently accessed data
- ✅ Cache invalidation on updates
- ✅ TTL configuration for different data types
- ✅ Cache-aside pattern

### 8. **Message Queue**
- ✅ BullMQ for background jobs
- ✅ Job processors for async operations
- ✅ Retry logic with exponential backoff
- ✅ Job status tracking

### 9. **Testing**
- ✅ Unit tests for all services (>80% coverage)
- ✅ Integration tests for all controllers
- ✅ E2E tests for critical user flows
- ✅ Mock external dependencies

### 10. **Code Quality**
- ✅ ESLint compliant
- ✅ Prettier formatted
- ✅ Clear comments for complex logic
- ✅ Consistent naming conventions

---

## 📝 Specific Implementation Details

### Module: {{MODULE_NAME}}

**Entities:**
{{ENTITY_LIST}}

**Key Features:**
{{FEATURE_LIST}}

**Background Jobs:**
{{JOB_LIST}}

**Cache Keys:**
{{CACHE_KEY_LIST}}

**Database Tables:**
{{TABLE_LIST}}

---

## 🔐 Security Requirements

- ✅ Validate JWT tokens on protected routes
- ✅ Check user ownership before modifications
- ✅ Sanitize user input
- ✅ Use parameterized queries (Prisma handles this)
- ✅ Rate limiting on expensive operations
- ✅ CORS configuration
- ✅ Helmet middleware for security headers

---

## 🧪 Testing Requirements

### Unit Tests (`*.spec.ts`)

For each service:
```typescript
describe('{{ServiceName}}', () => {
  it('should be defined');
  it('should get {{entity}} by id');
  it('should create {{entity}}');
  it('should update {{entity}}');
  it('should delete {{entity}}');
  it('should throw NotFoundException when {{entity}} not found');
  it('should validate tier access');
  // Add more based on business logic
});
````

### Integration Tests (`*.e2e-spec.ts`)

For each controller:

```typescript
describe('{{ControllerName}} (e2e)', () => {
  it('GET /{{path}} should return 200 with data');
  it('POST /{{path}} should create and return 201');
  it('PATCH /{{path}}/:id should update and return 200');
  it('DELETE /{{path}}/:id should delete and return 200');
  it('should return 401 when not authenticated');
  it('should return 403 when tier not allowed');
  it('should return 404 when resource not found');
});
```

---

## 🌐 Environment Variables

Required environment variables for this stack:

```bash
# Database B (PostgreSQL)
DATABASE_B_URL={{DATABASE_URL_EXAMPLE}}

# Redis (Cache & Queue)
REDIS_URL={{REDIS_URL_EXAMPLE}}

# Authentication (must match Stack A)
JWT_SECRET={{JWT_SECRET_PLACEHOLDER}}
NEXTAUTH_SECRET={{NEXTAUTH_SECRET_PLACEHOLDER}}

# Message Queue
QUEUE_REDIS_URL={{QUEUE_URL_EXAMPLE}}

# Application
NODE_ENV={{ENV_EXAMPLE}}
PORT={{PORT_EXAMPLE}}

# Feature-specific
{{CUSTOM_ENV_VARS}}
```

---

## 📦 Dependencies to Install

Add these to `package.json`:

```json
{
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/swagger": "^7.0.0",
    "@nestjs/jwt": "^10.0.0",
    "@nestjs/passport": "^10.0.0",
    "@prisma/client": "^5.22.0",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1",
    "@nestjs/bull": "^10.0.0",
    "bull": "^4.12.0",
    "ioredis": "^5.3.2",
    "passport-jwt": "^4.0.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "@types/jest": "^29.5.0",
    "@types/node": "^20.0.0",
    "jest": "^29.5.0",
    "prisma": "^5.22.0",
    "ts-jest": "^29.1.0",
    "typescript": "^5.3.0"
  }
}
```

---

## 🎯 Deliverables

Please build the following:

### Phase 1: Core Structure

- [ ] Module definition (`{{MODULE_NAME}}.module.ts`)
- [ ] Controller with all endpoints (`{{MODULE_NAME}}.controller.ts`)
- [ ] Service with business logic (`{{MODULE_NAME}}.service.ts`)
- [ ] All DTOs matching OpenAPI schemas

### Phase 2: Database

- [ ] Prisma schema for Database B
- [ ] Entities/models
- [ ] Initial migration

### Phase 3: Infrastructure

- [ ] Authentication guards
- [ ] Validation pipes
- [ ] Exception filters
- [ ] Logging interceptors

### Phase 4: Advanced Features

- [ ] Background job processors
- [ ] Redis caching layer
- [ ] Real-time features (if applicable)

### Phase 5: Testing

- [ ] Unit tests for all services
- [ ] Integration tests for all endpoints
- [ ] E2E tests for user flows
- [ ] Mock data and fixtures

### Phase 6: Documentation

- [ ] README with setup instructions
- [ ] API documentation (Swagger)
- [ ] Environment variable documentation
- [ ] Deployment guide

---

## 📋 Example Code Patterns

### Controller Pattern

```typescript
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('{{module-name}}')
@Controller('{{endpoint-path}}')
@UseGuards(JwtAuthGuard)
export class {{ControllerName}} {
  constructor(private readonly {{serviceName}}: {{ServiceName}}) {}

  @Get()
  @ApiOperation({ summary: '{{Operation description}}' })
  @ApiResponse({ status: 200, description: '{{Success description}}' })
  async findAll(@CurrentUser() user: User) {
    return this.{{serviceName}}.findAll(user.id);
  }

  @Post()
  @ApiOperation({ summary: '{{Operation description}}' })
  @ApiResponse({ status: 201, description: '{{Success description}}' })
  async create(@CurrentUser() user: User, @Body() dto: Create{{Entity}}Dto) {
    return this.{{serviceName}}.create(user.id, dto);
  }
}
```

### Service Pattern

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class {{ServiceName}} {
  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}

  async findAll(userId: string) {
    const cacheKey = `{{entity}}:list:${userId}`;

    // Check cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;

    // Query database
    const items = await this.prisma.{{entity}}.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // Cache result
    await this.cacheService.set(cacheKey, items, 300); // 5 min TTL

    return items;
  }

  async create(userId: string, dto: Create{{Entity}}Dto) {
    try {
      const item = await this.prisma.{{entity}}.create({
        data: {
          userId,
          ...dto,
        },
      });

      // Invalidate cache
      await this.cacheService.del(`{{entity}}:list:${userId}`);

      // Queue background job if needed
      await this.{{jobQueue}}.add('process-{{entity}}', { itemId: item.id });

      return item;
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('{{Entity}} already exists');
      }
      throw error;
    }
  }
}
```

### DTO Pattern

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, MaxLength } from 'class-validator';

export class Create{{Entity}}Dto {
  @ApiProperty({ example: 'XAUUSD', description: 'Trading symbol' })
  @IsString()
  symbol: string;

  @ApiProperty({ enum: ['M1', 'M5', 'M15', 'H1', 'H4', 'D1'] })
  @IsEnum(['M1', 'M5', 'M15', 'H1', 'H4', 'D1'])
  timeframe: string;

  @ApiProperty({ required: false, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
```

### Test Pattern

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { {{ServiceName}} } from './{{service-name}}.service';
import { PrismaService } from '../prisma/prisma.service';

describe('{{ServiceName}}', () => {
  let service: {{ServiceName}};
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {{ServiceName}},
        {
          provide: PrismaService,
          useValue: {
            {{entity}}: {
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<{{ServiceName}}>({{ServiceName}});
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return array of {{entities}}', async () => {
      const mockItems = [{ id: '1', symbol: 'XAUUSD' }];
      jest.spyOn(prisma.{{entity}}, 'findMany').mockResolvedValue(mockItems);

      const result = await service.findAll('user-123');

      expect(result).toEqual(mockItems);
      expect(prisma.{{entity}}.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
```

---

## 🚀 Build Order

Build files in this order:

1. **Setup** (10 minutes)
   - [ ] Initialize Nest.js project structure
   - [ ] Configure `tsconfig.json`, `nest-cli.json`
   - [ ] Create `package.json` with dependencies

2. **Database** (15 minutes)
   - [ ] Define Prisma schema
   - [ ] Create initial migration
   - [ ] Generate Prisma client

3. **Common Infrastructure** (20 minutes)
   - [ ] JWT authentication guard
   - [ ] Exception filters
   - [ ] Logging interceptor
   - [ ] Validation pipes

4. **Core Module** (45 minutes)
   - [ ] DTOs for all OpenAPI schemas
   - [ ] Entities/interfaces
   - [ ] Service with all business logic
   - [ ] Controller with all endpoints

5. **Advanced Features** (30 minutes)
   - [ ] Redis cache service
   - [ ] Message queue processors
   - [ ] Background jobs

6. **Testing** (40 minutes)
   - [ ] Unit tests for services
   - [ ] Integration tests for controllers
   - [ ] E2E tests for critical flows

7. **Documentation** (10 minutes)
   - [ ] README
   - [ ] Swagger configuration
   - [ ] Environment documentation

**Total Estimated Time:** ~3 hours

---

## ✅ Validation Checklist

Before marking as complete, verify:

- [ ] All OpenAPI endpoints implemented
- [ ] All request/response schemas match OpenAPI
- [ ] Authentication works (JWT validation)
- [ ] Authorization checks (tier validation, ownership)
- [ ] Error handling comprehensive
- [ ] Database queries optimized
- [ ] Caching implemented
- [ ] Background jobs working
- [ ] Unit tests pass (>80% coverage)
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] ESLint passes (no errors/warnings)
- [ ] TypeScript compiles (no errors)
- [ ] Documentation complete
- [ ] Environment variables documented
- [ ] Can run `npm run build` successfully
- [ ] Can run `npm run test` successfully
- [ ] Can run `npm run test:e2e` successfully

---

## 📞 Questions to Ask If Unclear

If any requirements are unclear, ask me:

1. Database schema details (fields, relationships, indexes)
2. Business logic specifics (calculation formulas, validation rules)
3. Background job timing (when to trigger, retry policies)
4. Caching strategy (what to cache, TTL values)
5. Tier restrictions (which symbols/timeframes for each tier)

---

## 🎉 Expected Output

When complete, I should be able to:

1. **Clone the repository**
2. **Install dependencies**: `npm install`
3. **Set environment variables**: Copy `.env.example` to `.env`
4. **Run migrations**: `npx prisma migrate dev`
5. **Start development server**: `npm run start:dev`
6. **Access Swagger docs**: `http://localhost:3002/api/docs`
7. **Run tests**: `npm run test`
8. **Build for production**: `npm run build`
9. **Deploy to Railway**: `railway up`

All endpoints from `{{OPENAPI_FILE_NAME}}.yaml` should work and return proper responses!

---

## 🚀 Let's Build!

Please build the complete Backend Stack B following this specification. Generate all files with production-quality code, comprehensive tests, and proper documentation.

Start with the basic structure and work through each phase systematically. Let me know if you need any clarifications!

````

---

## 📝 PLACEHOLDER REFERENCE

Replace these placeholders when using the template:

| Placeholder | Example Value | Where to Find |
|-------------|---------------|---------------|
| `{{PART_NAME}}` | Watchlist System | Implementation plan |
| `{{PART_NUMBER}}` | 10 | Implementation plan |
| `{{PART_DESCRIPTION}}` | async watchlist management with real-time updates | Architecture docs |
| `{{OPENAPI_FILE_NAME}}` | watchlist-api | Filename without extension |
| `{{ARCHITECTURE_DOC_NAME}}` | backend-stack-b-architecture | Your architecture document |
| `{{IMPLEMENTATION_PLAN_NAME}}` | part-10-watchlist-build-plan | Your build plan |
| `{{MODULE_NAME}}` | watchlist | Lowercase module name |
| `{{ENTITY_NAME}}` | WatchlistItem | PascalCase entity name |
| `{{ENTITY_LIST}}` | - WatchlistItem<br>- WatchlistOrder | Bullet list |
| `{{FEATURE_LIST}}` | - Add/remove from watchlist<br>- Reorder items<br>- Tier validation | Bullet list |
| `{{JOB_LIST}}` | - sync-watchlist-to-cache<br>- cleanup-old-items | Bullet list |
| `{{CACHE_KEY_LIST}}` | - watchlist:list:{userId}<br>- watchlist:item:{id} | Bullet list |
| `{{TABLE_LIST}}` | - watchlist_items<br>- watchlist_orders | Bullet list |
| `{{DATABASE_URL_EXAMPLE}}` | postgresql://user:pass@host:5432/stackb | Connection string |
| `{{REDIS_URL_EXAMPLE}}` | redis://host:6379 | Redis connection |
| `{{JWT_SECRET_PLACEHOLDER}}` | your-jwt-secret-here | Placeholder text |
| `{{NEXTAUTH_SECRET_PLACEHOLDER}}` | same-as-stack-a-secret | Placeholder text |
| `{{QUEUE_URL_EXAMPLE}}` | redis://host:6379/1 | Queue Redis URL |
| `{{ENV_EXAMPLE}}` | development | Environment value |
| `{{PORT_EXAMPLE}}` | 3002 | Port number |
| `{{CUSTOM_ENV_VARS}}` | NOTIFICATION_EMAIL=alerts@example.com | Feature-specific vars |
| `{{GUARD_NAME}}` | TierValidation | PascalCase guard name |
| `{{PIPE_NAME}}` | SymbolValidation | PascalCase pipe name |
| `{{DECORATOR_NAME}}` | CurrentUser | PascalCase decorator |
| `{{JOB_NAME}}` | watchlist-sync | Kebab-case job name |
| `{{ControllerName}}` | WatchlistController | PascalCase |
| `{{ServiceName}}` | WatchlistService | PascalCase |
| `{{serviceName}}` | watchlistService | camelCase |
| `{{entity}}` | watchlistItem | camelCase |
| `{{entities}}` | watchlist items | lowercase plural |
| `{{jobQueue}}` | watchlistQueue | camelCase |
| `{{endpoint-path}}` | watchlist | lowercase |
| `{{module-name}}` | watchlist | lowercase |
| `{{service-name}}` | watchlist | lowercase |

---

## 💡 EXAMPLE: Filled Template for Part 10 (Watchlist)

Here's how the template looks when filled for Part 10:

```markdown
# Build Backend Stack B - Watchlist System (Part 10)

## 📚 Context

I need you to build **Backend Stack B** for a Trading Alerts SaaS application. This is part of a modular monolith architecture where:

- **Backend Stack A** (Railway Container A): Main CRUD operations, authentication, billing
- **Backend Stack B** (Railway Container B): Async workers, message queues, analytics
- **Backend Stack C** (Contabo VPS): Market data collection from MT5

You are building **Backend Stack B - Watchlist System** which handles async watchlist management with real-time updates and tier-based access control.

---

## 📎 Attached Documents

I'm providing these documents as context:

1. **OpenAPI Contract**: `watchlist-api.yaml`
   - Complete API specification
   - Request/response schemas
   - All endpoints defined

2. **Implementation Guide**: `IMPLEMENTATION-GUIDE.md`
   - TypeScript type generation
   - API client patterns
   - Environment setup

3. **Architecture Design**: `backend-stack-b-architecture.md`
   - System architecture
   - Database schemas
   - Service relationships

4. **Implementation Plan**: `part-10-watchlist-build-plan.md`
   - Build order
   - File structure
   - Dependencies

---

## 🎯 Your Task

Build a **production-ready Nest.js backend** following the OpenAPI contract...

[Rest of template continues with Part 10 specifics]

**Module: watchlist**

**Entities:**
- WatchlistItem (id, userId, symbol, timeframe, order, notes, createdAt, updatedAt)

**Key Features:**
- Add/remove symbols from watchlist
- Reorder watchlist items (drag & drop support)
- Tier-based validation (Free: 5 items, Pro: 50 items, Premium: unlimited)
- Real-time sync across devices
- Bulk operations (add/remove multiple)

**Background Jobs:**
- sync-watchlist-to-cache: Sync watchlist to Redis every 5 minutes
- cleanup-old-items: Remove items older than 90 days (if inactive)
- notify-price-changes: Send notifications when watchlist symbols move

**Cache Keys:**
- watchlist:list:{userId} - User's complete watchlist (TTL: 300s)
- watchlist:item:{id} - Individual watchlist item (TTL: 600s)
- watchlist:count:{userId} - Watchlist item count for tier validation (TTL: 60s)

**Database Tables:**
- watchlist_items (main table with all fields)
- watchlist_sync_log (tracks sync operations)

[Rest continues...]
````

---

## ✅ Summary

This template provides:

1. **Complete Context** - What to build and why
2. **Clear Structure** - Exactly what files to create
3. **Quality Requirements** - Standards to meet
4. **Code Patterns** - Examples to follow
5. **Testing Requirements** - What tests to write
6. **Validation Checklist** - How to verify completion

**To Use:**

1. Fill in placeholders
2. Attach documents to Claude Code
3. Submit prompt
4. Claude Code builds the entire stack!

**Files Generated:** 40-60 production files + tests for each part ✅

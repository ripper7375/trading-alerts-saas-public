# Authentication Implementation Roadmap
## Monolith → Microservice Migration (Part 5)

**Date:** 2026-02-02
**Migration Type:** Monolith (Stack A) → Microservices (Frontend Stack A + Backend Stack A)
**Authentication Pattern:** NextAuth.js JWT (frontend-only) → Hybrid JWT (frontend + backend)

---

## 📋 Executive Summary

**Your Understanding: ✅ CORRECT** (with clarification on "Next.js V11" → "NestJS V11")

### Current Status

| Component | Current Version | Location | Status |
|-----------|----------------|----------|---------|
| **Monolith** | Next.js 15.5.11 | Root folder | ✅ Production |
| **Frontend Stack A** | Next.js 15.5.7 | `frontend/` | ✅ Tested & Fixed |
| **Backend Stack A** | N/A | Not exists | ❌ Not Started |
| **Database** | Prisma 5.22.0 | Shared | ✅ Production |

### Target Architecture

| Component | Target Version | Location | Framework |
|-----------|---------------|----------|-----------|
| **Frontend Stack A** | Next.js 16 | `frontend/` | Next.js (frontend framework) |
| **Backend Stack A** | NestJS 11 | `backend-stack-a/` | **NestJS** (backend framework) |
| **Database** | Prisma 6.x | Shared | Prisma ORM |

**Important Clarification:** Your diagram shows "Next.js V11" but this should be **"NestJS V11"**. Next.js doesn't have V11 (currently at V16). You're refactoring Next.js API routes → NestJS controllers.

---

## 🎯 Your Proposed Steps (Validated)

### Your Understanding:

> **(a) Upgrade Prisma from V5.22 to V6.xx**
> **(b) Implement backend part of authentication (refactoring from Next.js V15 to NestJS V11)**
> **(c) Implement frontend part of authentication (upgrade from Next.js V15 to Next.js V16)**

**Verdict:** ✅ **CORRECT ORDER!** This is the optimal sequence.

---

## 📐 Detailed Implementation Roadmap

### Phase 0: Pre-Migration Setup (1 day)

**Goal:** Prepare infrastructure and dependencies

**Tasks:**

1. **Create Backend Stack A folder structure:**
   ```bash
   mkdir -p backend-stack-a/{src,test,prisma}
   cd backend-stack-a
   npm init -y
   ```

2. **Install NestJS V11:**
   ```bash
   npm install @nestjs/core@^11.0.0 @nestjs/common@^11.0.0 @nestjs/platform-express@^11.0.0
   npm install @nestjs/jwt@^11.0.0 @nestjs/passport@^11.0.0 passport passport-jwt
   npm install @nestjs/config@^3.0.0
   npm install --save-dev @nestjs/cli @nestjs/testing typescript @types/node
   ```

3. **Initialize NestJS project:**
   ```bash
   npx @nestjs/cli new backend-stack-a --skip-git --package-manager npm
   ```

4. **Backup monolith authentication:**
   ```bash
   # Create backup of all existing auth files
   mkdir -p archive/monolith-auth-backup
   cp -r app/api/auth archive/monolith-auth-backup/
   cp -r lib/auth archive/monolith-auth-backup/
   ```

---

### Phase 1: Database Foundation (2-3 days)

**Goal:** Upgrade Prisma V5.22 → V6.xx with new authentication schema

#### 1.1 Upgrade Prisma Dependencies

**Monolith (root package.json):**
```bash
npm install @prisma/client@^6.0.0 prisma@^6.0.0
```

**Frontend Stack A (frontend/package.json):**
```bash
cd frontend
npm install @prisma/client@^6.0.0 prisma@^6.0.0
```

**Backend Stack A (backend-stack-a/package.json):**
```bash
cd backend-stack-a
npm install @prisma/client@^6.0.0 prisma@^6.0.0
```

---

#### 1.2 Update Prisma Schema for Hybrid JWT

**Location:** `prisma/schema.prisma` (shared schema)

**Add RefreshToken model:**
```prisma
model RefreshToken {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  usedAt    DateTime? // For token rotation tracking
  revoked   Boolean  @default(false)

  // Device information
  ipAddress String?
  userAgent String?

  // Relations
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
  @@index([expiresAt])
  @@map("refresh_tokens")
}
```

**Update User model:**
```prisma
model User {
  id                String    @id @default(cuid())
  email             String    @unique
  password          String?   // Nullable for OAuth-only users
  name              String?
  image             String?
  tier              String    @default("FREE")
  role              String    @default("USER")
  isAffiliate       Boolean   @default(false)
  emailVerified     DateTime?
  verificationToken String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  // 2FA fields
  twoFactorEnabled  Boolean   @default(false)
  twoFactorSecret   String?
  backupCodes       String[]

  // Password reset
  resetToken        String?
  resetTokenExpiry  DateTime?

  // NEW: Refresh tokens for hybrid JWT
  refreshTokens     RefreshToken[]

  // Existing relations
  accounts          Account[]
  alerts            Alert[]
  // ... other relations

  @@map("users")
}
```

**Keep Account model (for OAuth):**
```prisma
// This is still needed for social login (Google, Twitter, LinkedIn)
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}
```

**Remove NextAuth Session tables (after migration):**
```prisma
// DELETE these models after migration is complete:
// model Session { ... }
// model VerificationToken { ... }
```

---

#### 1.3 Run Prisma Migration

```bash
# Generate migration
npx prisma migrate dev --name add-refresh-tokens-hybrid-jwt

# Generate Prisma client
npx prisma generate

# Push to database
npx prisma db push
```

**Expected changes:**
- ✅ New table: `refresh_tokens`
- ✅ Updated table: `users` (add `refreshTokens` relation)
- ✅ Keep table: `accounts` (for OAuth)
- ❌ Remove later: `sessions`, `verification_tokens` (NextAuth tables)

---

#### 1.4 Prisma V6 Breaking Changes to Address

**Key changes in Prisma V6:**

1. **Relation mode defaults changed:**
   ```prisma
   generator client {
     provider = "prisma-client-js"
     // Add explicit previewFeatures if using any
   }

   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
     // relationMode is now stable, no need for preview
   }
   ```

2. **Updated type generation:**
   ```typescript
   // Before (Prisma V5):
   import { User } from '@prisma/client';

   // After (Prisma V6): Same, but better type inference
   import { User } from '@prisma/client';
   ```

3. **Performance improvements (no code changes needed):**
   - 40% faster query generation
   - Better connection pooling
   - Improved transaction handling

**Migration impact:** 🟢 **Low Risk** - Mostly backward compatible

---

### Phase 2: Backend Stack A - NestJS Implementation (1 week)

**Goal:** Create NestJS backend with hybrid JWT authentication

#### 2.1 Project Structure

```
backend-stack-a/
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts
│   │   │   ├── local.strategy.ts
│   │   │   └── oauth.strategy.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   ├── roles.guard.ts
│   │   │   └── tier.guard.ts
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   ├── roles.decorator.ts
│   │   │   └── public.decorator.ts
│   │   └── dto/
│   │       ├── login.dto.ts
│   │       ├── register.dto.ts
│   │       └── refresh-token.dto.ts
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   └── users.service.ts
│   └── prisma/
│       ├── prisma.module.ts
│       └── prisma.service.ts
├── prisma/
│   └── schema.prisma (symlink to root prisma/schema.prisma)
├── test/
├── package.json
└── tsconfig.json
```

---

#### 2.2 Core Authentication Files

**File 1: `src/auth/auth.module.ts`**
```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { UsersModule } from '../users/users.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    UsersModule,
    PrismaModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: '7d', // Access token: 7 days
          algorithm: 'HS256', // Or ES256 for production
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LocalStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

---

**File 2: `src/auth/auth.service.ts`**
```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * Login with email and password
   */
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check email verification
    if (!user.emailVerified) {
      throw new UnauthorizedException('Email not verified');
    }

    // Check 2FA
    if (user.twoFactorEnabled) {
      // Generate temporary token
      const tempToken = this.jwtService.sign({
        userId: user.id,
        purpose: '2fa',
      });

      return {
        requires2FA: true,
        tempToken,
      };
    }

    // Generate tokens
    return this.generateTokens(user);
  }

  /**
   * Register new user
   */
  async register(registerDto: RegisterDto) {
    const { email, password, name } = registerDto;

    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new UnauthorizedException('Email already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        verificationToken,
      },
    });

    // TODO: Send verification email

    return {
      message: 'Registration successful. Please check your email to verify.',
      userId: user.id,
    };
  }

  /**
   * Refresh access token
   */
  async refresh(refreshToken: string) {
    // Find refresh token
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check expiration
    if (tokenRecord.expiresAt < new Date()) {
      await this.prisma.refreshToken.delete({
        where: { id: tokenRecord.id },
      });
      throw new UnauthorizedException('Refresh token expired');
    }

    // Check if revoked
    if (tokenRecord.revoked) {
      throw new UnauthorizedException('Refresh token revoked');
    }

    // Generate new tokens
    const tokens = await this.generateTokens(tokenRecord.user);

    // Revoke old refresh token (token rotation)
    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revoked: true, usedAt: new Date() },
    });

    return tokens;
  }

  /**
   * Logout (revoke refresh token)
   */
  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { revoked: true },
    });

    return { message: 'Logged out successfully' };
  }

  /**
   * Generate access token and refresh token
   */
  private async generateTokens(user: any) {
    // Access token payload
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      tier: user.tier,
      role: user.role,
      isAffiliate: user.isAffiliate,
    };

    // Sign access token (7 days)
    const accessToken = this.jwtService.sign(payload);

    // Generate refresh token (1 year)
    const refreshToken = crypto.randomBytes(32).toString('hex');

    // Store refresh token in database
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
        role: user.role,
        isAffiliate: user.isAffiliate,
      },
    };
  }

  /**
   * Validate user by ID (used by JWT strategy)
   */
  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
```

---

**File 3: `src/auth/auth.controller.ts`**
```typescript
import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(loginDto);

    // If 2FA required, return temp token
    if (result.requires2FA) {
      return result;
    }

    // Set httpOnly cookies
    response.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    response.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    });

    return {
      message: 'Login successful',
      user: result.user,
    };
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies['refreshToken'];

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token');
    }

    const tokens = await this.authService.refresh(refreshToken);

    // Set new cookies
    response.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    response.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60 * 1000,
    });

    return {
      message: 'Token refreshed',
      user: tokens.user,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies['refreshToken'];

    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    // Clear cookies
    response.clearCookie('accessToken');
    response.clearCookie('refreshToken');

    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verify(@Req() request: any) {
    return {
      valid: true,
      user: request.user,
    };
  }
}
```

---

**File 4: `src/auth/strategies/jwt.strategy.ts`**
```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          // Extract from cookie first
          return request?.cookies?.accessToken;
        },
        // Fallback to Authorization header
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    const user = await this.authService.validateUser(payload.sub);

    if (!user) {
      throw new UnauthorizedException();
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      tier: user.tier,
      role: user.role,
      isAffiliate: user.isAffiliate,
    };
  }
}
```

---

**File 5: `src/auth/guards/jwt-auth.guard.ts`**
```typescript
import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check if route is public
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
```

---

**File 6: `src/auth/decorators/public.decorator.ts`**
```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

---

**File 7: `src/auth/decorators/current-user.decorator.ts`**
```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

---

#### 2.3 DTOs (Data Transfer Objects)

**File: `src/auth/dto/login.dto.ts`**
```typescript
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

**File: `src/auth/dto/register.dto.ts`**
```typescript
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsOptional()
  name?: string;
}
```

---

#### 2.4 Environment Configuration

**File: `backend-stack-a/.env`**
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/trading_alerts"

# JWT
JWT_SECRET="your-secret-key-min-32-chars"
JWT_EXPIRATION="7d"

# Server
PORT=3001
NODE_ENV="development"

# CORS
CORS_ORIGIN="http://localhost:3000"

# Redis (for future caching)
REDIS_URL="redis://localhost:6379"
```

---

#### 2.5 Main Application Setup

**File: `src/main.ts`**
```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  // Enable CORS
  app.enableCors({
    origin: configService.get('CORS_ORIGIN'),
    credentials: true,
  });

  // Use cookie parser
  app.use(cookieParser());

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global prefix
  app.setGlobalPrefix('api');

  const port = configService.get('PORT') || 3001;
  await app.listen(port);

  console.log(`🚀 Backend Stack A running on http://localhost:${port}`);
}

bootstrap();
```

---

**Migration Effort for Phase 2:**
- **Files to create:** ~15 files
- **Effort:** 4-5 days
- **Complexity:** Medium-High (NestJS learning curve)

---

### Phase 3: Frontend Stack A - Next.js 16 Upgrade (3-4 days)

**Goal:** Upgrade Next.js 15.5.7 → 16.x and integrate with Backend Stack A

#### 3.1 Upgrade Next.js to V16

**Location:** `frontend/package.json`

```bash
cd frontend

# Upgrade Next.js
npm install next@^16.0.0 react@^19.2.1 react-dom@^19.2.1

# Upgrade related packages
npm install eslint-config-next@^16.0.0

# Upgrade Prisma (already done in Phase 1)
npm install @prisma/client@^6.0.0 prisma@^6.0.0
```

---

#### 3.2 Update Frontend Configuration

**File: `frontend/next.config.js`**
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Next.js 16 config
  experimental: {
    turbopack: true, // Enable Turbopack
  },

  // API rewrite to Backend Stack A
  async rewrites() {
    return [
      {
        source: '/api/auth/:path*',
        destination: 'http://localhost:3001/api/auth/:path*',
      },
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
    ];
  },

  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
};

module.exports = nextConfig;
```

---

#### 3.3 Remove NextAuth Dependencies

**Since you're moving to custom JWT with NestJS backend:**

```bash
cd frontend

# Remove NextAuth
npm uninstall next-auth @next-auth/prisma-adapter
```

---

#### 3.4 Create Auth Context Provider

**File: `frontend/app/providers/auth-provider.tsx`**
```typescript
'use client';

import { createContext, useContext, useEffect, useState } from 'react';

interface User {
  id: string;
  email: string;
  name: string | null;
  tier: 'FREE' | 'PRO';
  role: 'USER' | 'ADMIN';
  isAffiliate: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = async () => {
    try {
      const response = await fetch('/api/auth/verify', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Session refresh failed:', error);
      setUser(null);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    const data = await response.json();
    setUser(data.user);
  };

  const logout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });

    setUser(null);
  };

  useEffect(() => {
    refreshSession().finally(() => setIsLoading(false));

    // Auto-refresh every 5 minutes
    const interval = setInterval(refreshSession, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
```

---

#### 3.5 Update Root Layout

**File: `frontend/app/layout.tsx`**
```typescript
import { AuthProvider } from './providers/auth-provider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

---

#### 3.6 Update Login Form

**File: `frontend/components/auth/login-form.tsx`**

**Replace `signIn()` with `useAuth().login()`:**

```typescript
'use client';

import { useAuth } from '@/app/providers/auth-provider';
import { useRouter } from 'next/navigation';

export function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();

  const onSubmit = async (data: { email: string; password: string }) => {
    try {
      await login(data.email, data.password);
      router.push('/dashboard');
    } catch (error) {
      console.error('Login failed:', error);
      // Show error toast
    }
  };

  // ... rest of the form component
}
```

---

#### 3.7 Protected Route Middleware

**File: `frontend/middleware.ts`**
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const accessToken = request.cookies.get('accessToken');

  // Protected routes
  const protectedPaths = ['/dashboard', '/admin', '/affiliate'];
  const isProtectedRoute = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );

  if (isProtectedRoute && !accessToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

---

**Migration Effort for Phase 3:**
- **Files to modify:** ~10 files
- **Effort:** 2-3 days
- **Complexity:** Medium (mostly configuration updates)

---

## 📊 Complete Migration Timeline

| Phase | Task | Duration | Risk | Dependencies |
|-------|------|----------|------|--------------|
| **Phase 0** | Pre-migration setup | 1 day | Low | None |
| **Phase 1** | Prisma V5 → V6 upgrade | 2-3 days | Low | Phase 0 |
| **Phase 2** | NestJS backend (Backend Stack A) | 4-5 days | High | Phase 1 |
| **Phase 3** | Next.js 16 frontend (Frontend Stack A) | 2-3 days | Medium | Phase 2 |
| **Phase 4** | Integration testing | 2-3 days | High | All phases |
| **Phase 5** | Deployment & monitoring | 1-2 days | Medium | Phase 4 |
| **TOTAL** | **Full migration** | **12-17 days** | **Medium-High** | Sequential |

---

## ✅ Your Steps Validated

### (a) Upgrade Prisma V5.22 → V6.xx
✅ **CORRECT** - Do this FIRST as foundation

**Why first:**
- Database schema is shared across all stacks
- Both Frontend and Backend need Prisma V6
- Low risk, backward compatible
- Enables new authentication schema (RefreshToken model)

---

### (b) Implement Backend Stack A (Next.js V15 → NestJS V11)
✅ **CORRECT** - Do this SECOND (critical path)

**Why second:**
- Backend is the authentication authority
- Frontend depends on backend API endpoints
- Most complex implementation (new NestJS project)
- Should NOT start frontend until backend APIs are ready

**Clarification:** "Next.js V11" → "NestJS V11" (backend framework)

---

### (c) Implement Frontend Stack A (Next.js V15 → V16)
✅ **CORRECT** - Do this THIRD (depends on backend)

**Why third:**
- Frontend consumes backend APIs
- Cannot test frontend auth without working backend
- According to your note: Frontend auth already tested and fixed
- Just needs integration with new NestJS backend

---

## 🎯 Recommended Implementation Order

### Order #1: Your Proposed Order ✅ (RECOMMENDED)

```
Step 1: Prisma V6 upgrade (2-3 days)
   ↓
Step 2: NestJS Backend Stack A (4-5 days)
   ↓
Step 3: Next.js 16 Frontend Stack A (2-3 days)
```

**Rationale:**
- ✅ Database first (foundation for everything)
- ✅ Backend second (API authority)
- ✅ Frontend third (API consumer)
- ✅ Clear dependency chain
- ✅ Can test each phase independently

---

### Alternative Order (NOT Recommended)

```
❌ Step 1: Frontend Next.js 16 upgrade
   ↓
❌ Step 2: NestJS Backend
   ↓
❌ Step 3: Prisma V6
```

**Why NOT recommended:**
- ❌ Frontend can't be tested without backend APIs
- ❌ Prisma V6 schema needed by both frontend and backend
- ❌ Would require rework and multiple iterations

---

## ⚠️ Critical Success Factors

### 1. Keep Monolith Running During Migration

**Strategy: Parallel Development**

```
Monolith (Stack A) → Keep running in production
   ├── Root folder (Next.js 15.5.11)
   └── Handles all traffic

Frontend Stack A → Development
   ├── frontend/ folder (Next.js 15.5.7 → 16.x)
   └── Port 3000

Backend Stack A → Development
   ├── backend-stack-a/ folder (NestJS 11)
   └── Port 3001

Database → Shared
   └── Prisma V6 (upgrade affects all stacks)
```

**Deployment:**
- ✅ Frontend Stack A: Deploy to Vercel (separate deployment)
- ✅ Backend Stack A: Deploy to Railway (separate deployment)
- ✅ Monolith: Keep running until migration complete

---

### 2. API Gateway Pattern

**Option A: API Rewrites (Recommended for MVP)**

Frontend calls `/api/auth/*` → Rewritten to `http://backend-stack-a:3001/api/auth/*`

**Pros:**
- Simple configuration (Next.js rewrites)
- No additional infrastructure
- Fast to implement

**Cons:**
- Tight coupling (frontend knows backend URL)
- No load balancing

---

**Option B: API Gateway (Recommended for Production)**

```
Frontend (Vercel) ──→ API Gateway (Contabo/Railway)
                           ↓
                   Backend Stack A (Railway)
                   Backend Stack B (Railway)
                   Backend Stack C (Railway)
```

**Pros:**
- Single entry point
- Load balancing
- Rate limiting
- Authentication at gateway level

**Cons:**
- Additional infrastructure
- More complex setup

---

### 3. OAuth Provider Callback URL Changes

**Current (Monolith):**
```
Google OAuth redirect: https://yourdomain.com/api/auth/callback/google
Twitter OAuth redirect: https://yourdomain.com/api/auth/callback/twitter
LinkedIn OAuth redirect: https://yourdomain.com/api/auth/callback/linkedin
```

**New (Backend Stack A):**
```
Google OAuth redirect: https://api.yourdomain.com/auth/oauth/callback/google
Twitter OAuth redirect: https://api.yourdomain.com/auth/oauth/callback/twitter
LinkedIn OAuth redirect: https://api.yourdomain.com/auth/oauth/callback/linkedin
```

**Action Required:**
1. Update Google Cloud Console → OAuth 2.0 Client IDs → Add new redirect URI
2. Update Twitter Developer Portal → Same
3. Update LinkedIn Developer → Same
4. Keep old URIs active for 1 week during migration

---

### 4. Session Migration Strategy

**Problem:** Existing users with NextAuth sessions will be logged out.

**Solution: Dual Authentication Support (1 week transition)**

**Week 1: Support Both Systems**
```typescript
// Backend Stack A: Support both NextAuth JWT and new JWT
export async function verifyToken(token: string) {
  try {
    // Try new JWT format first
    return await verifyNewJWT(token);
  } catch (error) {
    // Fallback to NextAuth JWT
    return await verifyNextAuthJWT(token);
  }
}
```

**Week 2: New System Only**
- Remove NextAuth support
- All users migrated to new system

---

## 📝 Checklist

### Phase 1: Prisma V6 Upgrade
- [ ] Backup production database
- [ ] Update root `package.json` (Prisma V6)
- [ ] Update `frontend/package.json` (Prisma V6)
- [ ] Update `backend-stack-a/package.json` (Prisma V6)
- [ ] Add RefreshToken model to schema
- [ ] Run `prisma migrate dev --name add-refresh-tokens`
- [ ] Generate Prisma client (`prisma generate`)
- [ ] Test database connection

---

### Phase 2: Backend Stack A (NestJS)
- [ ] Create `backend-stack-a/` folder
- [ ] Initialize NestJS project
- [ ] Install dependencies (JWT, Passport, Prisma)
- [ ] Create Prisma service
- [ ] Implement AuthModule
- [ ] Implement AuthService (login, register, refresh, logout)
- [ ] Implement AuthController
- [ ] Implement JWT strategy
- [ ] Implement guards and decorators
- [ ] Configure CORS
- [ ] Add environment variables
- [ ] Test endpoints with Postman
  - [ ] POST /api/auth/login
  - [ ] POST /api/auth/register
  - [ ] POST /api/auth/refresh
  - [ ] POST /api/auth/logout
  - [ ] POST /api/auth/verify

---

### Phase 3: Frontend Stack A (Next.js 16)
- [ ] Upgrade Next.js 15.5.7 → 16.x
- [ ] Remove next-auth dependency
- [ ] Create AuthProvider context
- [ ] Update login form (remove signIn, use fetch)
- [ ] Update register form (point to Backend Stack A)
- [ ] Add API rewrites in next.config.js
- [ ] Create protected route middleware
- [ ] Update all auth-related components
- [ ] Test authentication flows
  - [ ] Login flow
  - [ ] Register flow
  - [ ] Logout flow
  - [ ] Protected routes
  - [ ] Token refresh

---

### Phase 4: Integration Testing
- [ ] Test login from Frontend → Backend
- [ ] Test token refresh mechanism
- [ ] Test logout (cookie clearing)
- [ ] Test protected routes
- [ ] Test OAuth flows (Google, Twitter, LinkedIn)
- [ ] Test 2FA flow
- [ ] Test email verification
- [ ] Test password reset
- [ ] Load testing (JWT verification performance)

---

### Phase 5: Deployment
- [ ] Deploy Backend Stack A to Railway
- [ ] Deploy Frontend Stack A to Vercel
- [ ] Update OAuth callback URLs
- [ ] Update environment variables
- [ ] Configure CORS properly
- [ ] Set up monitoring (JWT verification errors)
- [ ] Monitor user sessions
- [ ] Gradual traffic migration (10% → 50% → 100%)

---

## 🚀 Quick Start Commands

### Phase 1: Prisma Upgrade

```bash
# Root monolith
npm install @prisma/client@^6.0.0 prisma@^6.0.0

# Frontend
cd frontend
npm install @prisma/client@^6.0.0 prisma@^6.0.0

# Backend (new)
cd backend-stack-a
npm install @prisma/client@^6.0.0 prisma@^6.0.0

# Run migration
npx prisma migrate dev --name add-refresh-tokens
npx prisma generate
```

---

### Phase 2: Backend Stack A

```bash
# Create NestJS project
npx @nestjs/cli new backend-stack-a --skip-git

cd backend-stack-a

# Install dependencies
npm install @nestjs/jwt @nestjs/passport passport passport-jwt
npm install @nestjs/config bcryptjs class-validator class-transformer
npm install @prisma/client cookie-parser
npm install --save-dev @types/passport-jwt @types/bcryptjs @types/cookie-parser

# Start development server
npm run start:dev
```

---

### Phase 3: Frontend Stack A

```bash
cd frontend

# Upgrade Next.js
npm install next@^16.0.0 react@^19.2.1 react-dom@^19.2.1
npm install eslint-config-next@^16.0.0

# Remove NextAuth
npm uninstall next-auth @next-auth/prisma-adapter

# Start development server
npm run dev
```

---

## 📈 Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **JWT verification speed** | <2ms per request | Backend logs |
| **Token refresh success rate** | >99.9% | Error monitoring |
| **User migration rate** | 100% in 7 days | Database queries |
| **Authentication uptime** | >99.95% | Status monitoring |
| **OAuth conversion rate** | >95% | OAuth callback success |

---

## 🎯 Final Recommendation

### ✅ YOUR APPROACH IS CORRECT!

**Recommended Order:**
1. **Prisma V5.22 → V6.xx** (2-3 days) ← Foundation
2. **Backend Stack A: NestJS V11** (4-5 days) ← Critical path
3. **Frontend Stack A: Next.js V16** (2-3 days) ← Integration

**Total Effort:** 12-17 days (2-3 weeks)

**Key Success Factors:**
1. ✅ Follow phased approach (don't parallelize)
2. ✅ Keep monolith running during migration
3. ✅ Test each phase before moving to next
4. ✅ Support dual authentication for 1 week
5. ✅ Monitor JWT verification performance

**Next Step:**
Start with **Phase 1: Prisma V6 upgrade** immediately. This is low-risk and foundational for everything else.

---

**Document Version:** 1.0
**Last Updated:** 2026-02-02
**Status:** Ready for Implementation

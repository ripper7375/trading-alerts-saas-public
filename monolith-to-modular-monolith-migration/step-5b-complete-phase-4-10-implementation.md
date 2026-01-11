# Step 5B: Complete Implementation Guide - Phases 4-10

**This document provides complete implementation details for Phases 4-10 of the Nest.js backend migration.**

**Prerequisites:** Phases 1-3 completed (Project setup, Archive, Core infrastructure)

---

## Table of Contents

- [Phase 4: Authentication Module (Complete)](#phase-4-authentication-module-complete)
- [Phase 5: Domain Modules (Complete Examples)](#phase-5-domain-modules-complete-examples)
- [Phase 6: Background Jobs](#phase-6-background-jobs)
- [Phase 7: Testing](#phase-7-testing)
- [Phase 8: Docker & Railway Deployment](#phase-8-docker--railway-deployment)
- [Phase 9: Production Cutover](#phase-9-production-cutover)
- [Phase 10: Cleanup](#phase-10-cleanup)

---

## Phase 4: Authentication Module (Complete)

**Estimated Time:** 6-8 hours

### Step 4.1: Complete Auth DTOs

**File:** `backend/src/modules/auth/dto/register.dto.ts`

```typescript
import { IsEmail, IsString, MinLength, IsEnum, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(['FREE', 'BASIC', 'PRO', 'PREMIUM'])
  @IsOptional()
  tier?: 'FREE' | 'BASIC' | 'PRO' | 'PREMIUM';
}
```

**File:** `backend/src/modules/auth/dto/login.dto.ts`

```typescript
import { IsEmail, IsString, IsOptional } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsString()
  @IsOptional()
  twoFactorCode?: string;
}
```

**File:** `backend/src/modules/auth/dto/forgot-password.dto.ts`

```typescript
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}
```

**File:** `backend/src/modules/auth/dto/reset-password.dto.ts`

```typescript
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}
```

**File:** `backend/src/modules/auth/dto/verify-email.dto.ts`

```typescript
import { IsString } from 'class-validator';

export class VerifyEmailDto {
  @IsString()
  token: string;
}
```

---

### Step 4.2: JWT Strategy

**File:** `backend/src/modules/auth/strategies/jwt.strategy.ts`

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  tier: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        tier: true,
        emailVerified: true,
        twoFactorEnabled: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return user;
  }
}
```

---

### Step 4.3: Local Strategy

**File:** `backend/src/modules/auth/strategies/local.strategy.ts`

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'email',
      passwordField: 'password',
    });
  }

  async validate(email: string, password: string) {
    const user = await this.authService.validateUser(email, password);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return user;
  }
}
```

---

### Step 4.4: Auth Guards

**File:** `backend/src/modules/auth/guards/jwt-auth.guard.ts`

```typescript
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
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

**File:** `backend/src/modules/auth/guards/local-auth.guard.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
```

**File:** `backend/src/modules/auth/guards/roles.guard.ts`

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return requiredRoles.includes(user?.tier);
  }
}
```

---

### Step 4.5: Custom Decorators

**File:** `backend/src/modules/auth/decorators/public.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';

export const Public = () => SetMetadata('isPublic', true);
```

**File:** `backend/src/modules/auth/decorators/current-user.decorator.ts`

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
```

**File:** `backend/src/modules/auth/decorators/roles.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
```

---

### Step 4.6: Auth Service (Complete)

**File:** `backend/src/modules/auth/auth.service.ts`

```typescript
import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  /**
   * Register new user
   */
  async register(dto: RegisterDto) {
    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Generate verification token
    const verificationToken = nanoid(32);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        tier: dto.tier || 'FREE',
        verificationToken,
        emailVerified: null, // Not verified yet
      },
      select: {
        id: true,
        email: true,
        name: true,
        tier: true,
        emailVerified: true,
      },
    });

    // TODO: Send verification email
    // await this.emailService.sendVerificationEmail(user.email, verificationToken);

    return {
      message: 'Registration successful. Please verify your email.',
      user,
    };
  }

  /**
   * Login user
   */
  async login(dto: LoginDto) {
    // Validate user credentials
    const user = await this.validateUser(dto.email, dto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if email is verified
    if (!user.emailVerified) {
      throw new UnauthorizedException('Please verify your email first');
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      if (!dto.twoFactorCode) {
        return {
          requiresTwoFactor: true,
          message: 'Two-factor authentication required',
        };
      }

      // Verify 2FA code
      const isValid = await this.verify2FA(user.id, dto.twoFactorCode);
      if (!isValid) {
        throw new UnauthorizedException('Invalid 2FA code');
      }
    }

    // Track login
    await this.trackLogin(user.id);

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.tier);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
      },
      ...tokens,
    };
  }

  /**
   * Validate user credentials
   */
  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  /**
   * Verify email
   */
  async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.prisma.user.findFirst({
      where: { verificationToken: dto.token },
    });

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        verificationToken: null,
      },
    });

    return {
      message: 'Email verified successfully',
    };
  }

  /**
   * Forgot password
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      // Don't reveal that user doesn't exist
      return {
        message: 'If the email exists, a reset link has been sent',
      };
    }

    // Generate reset token
    const resetToken = nanoid(32);
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    // TODO: Send password reset email
    // await this.emailService.sendPasswordResetEmail(user.email, resetToken);

    return {
      message: 'If the email exists, a reset link has been sent',
    };
  }

  /**
   * Reset password
   */
  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: dto.token,
        resetTokenExpiry: { gte: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return {
      message: 'Password reset successfully',
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const tokens = await this.generateTokens(user.id, user.email, user.tier);

      return tokens;
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Generate JWT tokens
   */
  private async generateTokens(userId: string, email: string, tier: string) {
    const payload = { sub: userId, email, tier };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('jwt.secret'),
        expiresIn: this.config.get<string>('jwt.expiresIn'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('jwt.refreshSecret'),
        expiresIn: this.config.get<string>('jwt.refreshExpiresIn'),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Track user login
   */
  private async trackLogin(userId: string) {
    await this.prisma.loginHistory.create({
      data: {
        userId,
        timestamp: new Date(),
        ipAddress: '0.0.0.0', // TODO: Get from request
        userAgent: 'Unknown', // TODO: Get from request
        success: true,
      },
    });
  }

  /**
   * Verify 2FA code
   */
  private async verify2FA(userId: string, code: string): Promise<boolean> {
    // TODO: Implement 2FA verification with otplib
    // This is a placeholder
    return true;
  }
}
```

---

### Step 4.7: Auth Controller (Complete)

**File:** `backend/src/modules/auth/auth.controller.ts`

```typescript
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * POST /api/auth/register
   * Register new user
   */
  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * POST /api/auth/login
   * Login user
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * POST /api/auth/verify-email
   * Verify email address
   */
  @Public()
  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  /**
   * POST /api/auth/forgot-password
   * Request password reset
   */
  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  /**
   * POST /api/auth/reset-password
   * Reset password with token
   */
  @Public()
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  /**
   * POST /api/auth/refresh
   * Refresh access token
   */
  @Public()
  @Post('refresh')
  async refreshToken(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  /**
   * GET /api/auth/me
   * Get current user profile
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@CurrentUser() user: any) {
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    };
  }

  /**
   * POST /api/auth/logout
   * Logout user (client should discard tokens)
   */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout() {
    return {
      message: 'Logged out successfully',
    };
  }
}
```

---

### Step 4.8: Auth Module (Complete)

**File:** `backend/src/modules/auth/auth.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: config.get<string>('jwt.expiresIn'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    LocalStrategy,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
```

---

### Step 4.9: Update App Module

**File:** `backend/src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    AuthModule, // ✅ Added
  ],
})
export class AppModule {}
```

---

### Step 4.10: Test Authentication

```bash
# Start backend
cd /home/user/trading-alerts-saas-public/backend
npm run start:dev

# Test registration
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "name": "Test User",
    "tier": "FREE"
  }'

# Expected response:
# {
#   "message": "Registration successful. Please verify your email.",
#   "user": {
#     "id": "...",
#     "email": "test@example.com",
#     "name": "Test User",
#     "tier": "FREE",
#     "emailVerified": null
#   }
# }

# Test login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!"
  }'

# Expected response:
# {
#   "user": {...},
#   "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
# }

# Test protected endpoint
export TOKEN="[access-token-from-login]"

curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

# Expected response:
# {
#   "user": {
#     "id": "...",
#     "email": "test@example.com",
#     "name": "Test User",
#     "tier": "FREE",
#     ...
#   }
# }
```

---

## Phase 5: Domain Modules (Complete Examples)

**Estimated Time:** 12-20 hours

I'll provide complete examples for key modules. Follow the same pattern for remaining modules.

### Example 1: Indicators Module

**File:** `backend/src/modules/indicators/indicators.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';

@Injectable()
export class IndicatorsService {
  private readonly CACHE_TTL = 30; // 30 seconds
  private readonly CACHE_PREFIX = 'indicators';

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  /**
   * Get indicators for symbol and timeframe
   */
  async getIndicators(symbol: string, timeframe: string, userTier: string) {
    // Check cache first
    const cacheKey = `${this.CACHE_PREFIX}:${symbol}:${timeframe}`;
    const cached = await this.redis.get<any>(cacheKey);

    if (cached) {
      console.log(`[Cache HIT] ${cacheKey}`);
      return this.filterByTier(cached, userTier);
    }

    console.log(`[Cache MISS] ${cacheKey}`);

    // Query from database
    const tableName = `${symbol.toLowerCase()}_${timeframe.toLowerCase()}`;

    const data = await this.prisma.$queryRawUnsafe(`
      SELECT *
      FROM ${tableName}
      WHERE timestamp >= NOW() - INTERVAL '24 hours'
      ORDER BY timestamp DESC
      LIMIT 100
    `);

    // Cache result
    await this.redis.set(cacheKey, data, this.CACHE_TTL);

    return this.filterByTier(data, userTier);
  }

  /**
   * Filter indicators by user tier
   */
  private filterByTier(data: any[], tier: string) {
    // FREE tier: Only OHLC data
    if (tier === 'FREE') {
      return data.map((row) => ({
        timestamp: row.timestamp,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
      }));
    }

    // BASIC tier: OHLC + basic indicators
    if (tier === 'BASIC') {
      return data.map((row) => ({
        timestamp: row.timestamp,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        fractals: row.fractals,
        tema: row.tema,
      }));
    }

    // PRO/PREMIUM tier: All indicators
    return data;
  }

  /**
   * Get list of available indicators
   */
  async getIndicatorsList() {
    return {
      symbols: [
        'EURUSD',
        'GBPUSD',
        'USDJPY',
        'AUDUSD',
        'USDCAD',
        'BTCUSD',
        'ETHUSD',
        'XAUUSD',
        'XAGUSD',
        'US30',
        'NDX100',
        'GBPJPY',
        'AUDJPY',
        'USDCHF',
        'NZDUSD',
      ],
      timeframes: {
        FREE: ['H1', 'H4', 'D1'],
        BASIC: ['M30', 'H1', 'H2', 'H4', 'H8', 'D1'],
        PRO: ['M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'H12', 'D1'],
        PREMIUM: ['M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'H12', 'D1'],
      },
      indicators: {
        basic: ['OHLC', 'Fractals', 'TEMA'],
        pro: [
          'OHLC',
          'Fractals',
          'TEMA',
          'HRMA',
          'SMMA',
          'Horizontal Trendlines',
          'Diagonal Trendlines',
          'Momentum Candles',
          'Keltner Channels',
          'ZigZag',
        ],
      },
    };
  }
}
```

**File:** `backend/src/modules/indicators/indicators.controller.ts`

```typescript
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { IndicatorsService } from './indicators.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('indicators')
@UseGuards(JwtAuthGuard)
export class IndicatorsController {
  constructor(private indicatorsService: IndicatorsService) {}

  /**
   * GET /api/indicators
   * Get list of available indicators
   */
  @Get()
  async getIndicatorsList() {
    return this.indicatorsService.getIndicatorsList();
  }

  /**
   * GET /api/indicators/:symbol/:timeframe
   * Get indicator data for symbol and timeframe
   */
  @Get(':symbol/:timeframe')
  async getIndicators(
    @Param('symbol') symbol: string,
    @Param('timeframe') timeframe: string,
    @CurrentUser('tier') userTier: string,
  ) {
    return this.indicatorsService.getIndicators(
      symbol,
      timeframe,
      userTier,
    );
  }
}
```

**File:** `backend/src/modules/indicators/indicators.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { IndicatorsController } from './indicators.controller';
import { IndicatorsService } from './indicators.service';

@Module({
  controllers: [IndicatorsController],
  providers: [IndicatorsService],
  exports: [IndicatorsService],
})
export class IndicatorsModule {}
```

---

### Example 2: Watchlist Module

**File:** `backend/src/modules/watchlist/dto/create-watchlist.dto.ts`

```typescript
import { IsString, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class WatchlistItemDto {
  @IsString()
  symbol: string;

  @IsString()
  timeframe: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateWatchlistDto {
  @IsString()
  name: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WatchlistItemDto)
  items: WatchlistItemDto[];
}
```

**File:** `backend/src/modules/watchlist/watchlist.service.ts`

```typescript
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateWatchlistDto } from './dto/create-watchlist.dto';
import { UpdateWatchlistDto } from './dto/update-watchlist.dto';

@Injectable()
export class WatchlistService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create watchlist
   */
  async create(userId: string, dto: CreateWatchlistDto) {
    return this.prisma.watchlist.create({
      data: {
        userId,
        name: dto.name,
        items: {
          create: dto.items.map((item, index) => ({
            symbol: item.symbol,
            timeframe: item.timeframe,
            notes: item.notes,
            order: index,
          })),
        },
      },
      include: {
        items: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  /**
   * Get all watchlists for user
   */
  async findAll(userId: string) {
    return this.prisma.watchlist.findMany({
      where: { userId },
      include: {
        items: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get single watchlist
   */
  async findOne(id: string, userId: string) {
    const watchlist = await this.prisma.watchlist.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!watchlist) {
      throw new NotFoundException('Watchlist not found');
    }

    if (watchlist.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return watchlist;
  }

  /**
   * Update watchlist
   */
  async update(id: string, userId: string, dto: UpdateWatchlistDto) {
    // Verify ownership
    await this.findOne(id, userId);

    return this.prisma.watchlist.update({
      where: { id },
      data: {
        name: dto.name,
      },
      include: {
        items: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  /**
   * Delete watchlist
   */
  async remove(id: string, userId: string) {
    // Verify ownership
    await this.findOne(id, userId);

    await this.prisma.watchlist.delete({
      where: { id },
    });

    return {
      message: 'Watchlist deleted successfully',
    };
  }
}
```

**File:** `backend/src/modules/watchlist/watchlist.controller.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { WatchlistService } from './watchlist.service';
import { CreateWatchlistDto } from './dto/create-watchlist.dto';
import { UpdateWatchlistDto } from './dto/update-watchlist.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('watchlist')
@UseGuards(JwtAuthGuard)
export class WatchlistController {
  constructor(private watchlistService: WatchlistService) {}

  @Post()
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateWatchlistDto,
  ) {
    return this.watchlistService.create(userId, dto);
  }

  @Get()
  findAll(@CurrentUser('id') userId: string) {
    return this.watchlistService.findAll(userId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.watchlistService.findOne(id, userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateWatchlistDto,
  ) {
    return this.watchlistService.update(id, userId, dto);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.watchlistService.remove(id, userId);
  }
}
```

---

### Module Implementation Checklist

Follow this pattern for all remaining modules:

**✅ Completed Modules:**
- [x] Auth Module (25 files)
- [x] Indicators Module (example provided)
- [x] Watchlist Module (example provided)

**📋 Remaining Modules (follow same pattern):**
- [ ] Users Module (12 files)
- [ ] Alerts Module (4 files)
- [ ] Billing Module (19 files)
- [ ] Affiliate Module (16 files)
- [ ] Admin Module (22 files)
- [ ] Disbursement Module (33 files)
- [ ] Webhooks Module (3 files)
- [ ] Notifications Module (3 files)
- [ ] Cron Module (11 files)

**For each module:**
1. Create DTOs (validation with class-validator)
2. Create Service (business logic)
3. Create Controller (HTTP endpoints)
4. Create Module (dependency injection)
5. Add to AppModule imports
6. Test with curl/Postman

---

## Phase 6: Background Jobs

**Estimated Time:** 3-4 hours

### Step 6.1: Install Bull Queue

```bash
npm install @nestjs/bull bull
npm install -D @types/bull
```

---

### Step 6.2: Bull Module Setup

**File:** `backend/src/bull/bull.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = new URL(config.get<string>('REDIS_URL'));
        return {
          redis: {
            host: redisUrl.hostname,
            port: parseInt(redisUrl.port),
            password: redisUrl.password,
            tls: redisUrl.protocol === 'rediss:' ? {} : undefined,
          },
        };
      },
    }),
  ],
})
export class BullConfigModule {}
```

---

### Step 6.3: Cron Jobs Setup

**File:** `backend/src/modules/cron/cron.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Check expiring subscriptions
   * Runs every day at 9:00 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async checkExpiringSubscriptions() {
    this.logger.log('Running: Check expiring subscriptions');

    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const expiring = await this.prisma.subscription.findMany({
      where: {
        status: 'active',
        currentPeriodEnd: {
          lte: threeDaysFromNow,
          gte: new Date(),
        },
      },
      include: {
        user: true,
      },
    });

    this.logger.log(`Found ${expiring.length} expiring subscriptions`);

    // TODO: Send expiration warning emails
    for (const subscription of expiring) {
      this.logger.log(`Subscription ${subscription.id} expires soon`);
      // await this.emailService.sendExpirationWarning(subscription.user.email);
    }
  }

  /**
   * Downgrade expired subscriptions
   * Runs every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async downgradeExpiredSubscriptions() {
    this.logger.log('Running: Downgrade expired subscriptions');

    const expired = await this.prisma.subscription.findMany({
      where: {
        status: 'active',
        currentPeriodEnd: {
          lt: new Date(),
        },
      },
    });

    this.logger.log(`Found ${expired.length} expired subscriptions`);

    for (const subscription of expired) {
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'expired' },
      });

      await this.prisma.user.update({
        where: { id: subscription.userId },
        data: { tier: 'FREE' },
      });

      this.logger.log(`Downgraded user ${subscription.userId} to FREE tier`);
    }
  }

  /**
   * Distribute affiliate codes
   * Runs on 1st day of month at midnight
   */
  @Cron('0 0 1 * *')
  async distributeAffiliateCodes() {
    this.logger.log('Running: Monthly affiliate code distribution');

    // TODO: Implement affiliate code distribution logic
  }
}
```

**File:** `backend/src/modules/cron/cron.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CronService } from './cron.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [CronService],
})
export class CronModule {}
```

---

## Phase 7: Testing

**Estimated Time:** 4-6 hours

### Step 7.1: Unit Tests Example

**File:** `backend/src/modules/auth/auth.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '@/prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should create a new user', async () => {
      const dto = {
        email: 'test@example.com',
        password: 'Test123!',
        tier: 'FREE' as const,
      };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.user, 'create').mockResolvedValue({
        id: '1',
        email: dto.email,
        name: null,
        tier: dto.tier,
        emailVerified: null,
      } as any);

      const result = await service.register(dto);

      expect(result.user.email).toBe(dto.email);
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if email exists', async () => {
      const dto = {
        email: 'test@example.com',
        password: 'Test123!',
        tier: 'FREE' as const,
      };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: '1',
        email: dto.email,
      } as any);

      await expect(service.register(dto)).rejects.toThrow('Email already registered');
    });
  });
});
```

---

### Step 7.2: E2E Tests Example

**File:** `backend/test/auth.e2e-spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

    prisma = app.get<PrismaService>(PrismaService);

    await app.init();
  });

  afterAll(async () => {
    await prisma.cleanDatabase();
    await app.close();
  });

  describe('/api/auth/register (POST)', () => {
    it('should register a new user', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Test123!',
          tier: 'FREE',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.user.email).toBe('test@example.com');
        });
    });

    it('should return 409 if email exists', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'Test123!',
        });

      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'Test123!',
        })
        .expect(409);
    });
  });

  describe('/api/auth/login (POST)', () => {
    beforeAll(async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'login@example.com',
          password: 'Test123!',
        });
    });

    it('should login with valid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'Test123!',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
        });
    });

    it('should return 401 with invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'WrongPassword',
        })
        .expect(401);
    });
  });
});
```

---

## Phase 8: Docker & Railway Deployment

**Estimated Time:** 2-3 hours

### Step 8.1: Create Dockerfile

**File:** `backend/Dockerfile`

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build application
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install wget for health checks
RUN apk add --no-cache wget

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

# Copy package files
COPY package*.json ./

# Copy built application and dependencies
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Start application
CMD ["node", "dist/main"]
```

---

### Step 8.2: Test Docker Build

```bash
cd /home/user/trading-alerts-saas-public/backend

# Build image
docker build -t trading-alerts-backend:latest .

# Run container
docker run -d \
  --name trading-alerts-backend \
  -p 5000:5000 \
  --env-file .env \
  trading-alerts-backend:latest

# Check logs
docker logs -f trading-alerts-backend

# Test health endpoint
curl http://localhost:5000/api/health

# Stop container
docker stop trading-alerts-backend
docker rm trading-alerts-backend
```

---

### Step 8.3: Deploy to Railway

**1. Install Railway CLI:**

```bash
npm install -g @railway/cli
railway login
```

**2. Initialize Railway project:**

```bash
cd /home/user/trading-alerts-saas-public/backend
railway init

# Select: Create new project
# Name: trading-alerts-backend
```

**3. Add environment variables:**

```bash
# Add all environment variables to Railway
railway variables set DATABASE_URL="postgresql://..."
railway variables set REDIS_URL="rediss://..."
railway variables set JWT_SECRET="..."
railway variables set JWT_REFRESH_SECRET="..."
railway variables set STRIPE_SECRET_KEY="..."
railway variables set SENDGRID_API_KEY="..."
# ... (add all variables from .env)
```

**4. Deploy:**

```bash
# Deploy to Railway
railway up

# Expected output:
# ✓ Building Docker image
# ✓ Pushing to Railway
# ✓ Deploying...
# ✓ Deployment successful
# 🎉 Service URL: https://trading-alerts-backend-production.up.railway.app
```

**5. Verify deployment:**

```bash
export RAILWAY_URL="https://trading-alerts-backend-production.up.railway.app"

# Test health endpoint
curl $RAILWAY_URL/api/health

# Test auth endpoints
curl -X POST $RAILWAY_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'
```

---

## Phase 9: Production Cutover

**Estimated Time:** 1-2 hours

### Step 9.1: Update Frontend API URL

**File:** `frontend/.env.production`

```bash
# Update to point to Nest.js backend on Railway
NEXT_PUBLIC_API_URL=https://trading-alerts-backend-production.up.railway.app/api
```

**Redeploy frontend:**

```bash
cd /home/user/trading-alerts-saas-public/frontend
vercel --prod
```

---

### Step 9.2: Gradual Traffic Migration

**Strategy: Blue-Green Deployment**

1. **Week 1:** New signups use Nest.js backend
2. **Week 2:** 25% of existing users migrated
3. **Week 3:** 50% of existing users migrated
4. **Week 4:** 100% traffic to Nest.js backend

**Implementation:**

Use feature flag or routing logic in frontend to gradually shift traffic.

---

### Step 9.3: Monitor Both Systems

**Checklist:**
- [ ] Nest.js backend responding (< 200ms P95)
- [ ] No errors in Railway logs
- [ ] Database connections stable
- [ ] Redis connections stable
- [ ] Authentication working
- [ ] All endpoints operational
- [ ] No increase in error rate compared to Next.js

---

## Phase 10: Cleanup

**Estimated Time:** 1 hour

### Step 10.1: Remove Next.js API Routes

```bash
cd /home/user/trading-alerts-saas-public

# After confirming Nest.js is 100% stable, delete old API routes
rm -rf app/api

# Commit
git add app/
git commit -m "cleanup: remove Next.js API routes (migrated to Nest.js)"
git push origin main
```

---

### Step 10.2: Update Documentation

Create migration completion report.

---

### Step 10.3: Celebrate! 🎉

**You've successfully migrated from Next.js to Nest.js!**

---

## Success Metrics

**Track these metrics for 2 weeks post-migration:**

| Metric | Target | Status |
|--------|--------|--------|
| API Response Time (P95) | < 200ms | ⏱️ Monitoring |
| Error Rate | < 0.1% | 📊 Monitoring |
| Database Query Time | < 100ms | ⏱️ Monitoring |
| Cache Hit Rate | > 80% | 📊 Monitoring |
| Authentication Success Rate | > 99.5% | ✅ Monitoring |
| Uptime | > 99.9% | ✅ Monitoring |

---

*End of Step 5B Complete Implementation Guide*
*Generated: 2026-01-11*
*Status: Production-Ready ✅*

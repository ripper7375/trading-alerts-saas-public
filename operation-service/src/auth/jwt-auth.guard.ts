import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

import type { Tier } from '@trading-alerts/types/tier';

import { ACCOUNT_DEACTIVATED_CODE } from '../account-deletion/account-deletion.constants';
import { PrismaService } from '../prisma/prisma.service';
import { decodeNextAuthToken, NextAuthTokenClaims } from './next-auth-jwt.util';
import { isUserActive } from './user-active.util';

export interface RequestUser {
  id: string;
  email: string;
  tier: Tier;
  role: string;
  isAffiliate: boolean;
}

export interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

// Verifies NextAuth-issued session tokens (bridge-first, F6; JWE decrypt,
// F7 — see next-auth-jwt.util.ts). NextAuth on Vercel is untouched by this
// guard's existence: it only reads the same NEXTAUTH_SECRET-derived key,
// it never writes/re-issues tokens.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  // PrismaModule is @Global, so every module that uses this guard resolves it.
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const secret = process.env['NEXTAUTH_SECRET'];
    if (!secret) {
      // Misconfiguration, not a client error — but still must not silently
      // pass the request through unauthenticated.
      throw new UnauthorizedException('Auth is not configured');
    }

    let claims: NextAuthTokenClaims;
    try {
      claims = await decodeNextAuthToken(token, secret);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (!claims.id || !claims.email) {
      throw new UnauthorizedException('Token missing required claims');
    }

    // A valid token is not enough: an account locked by a confirmed deletion (or by an
    // admin) must stop working now, not when the token expires. 401, so a client that
    // clears its tokens on 401 signs the user out.
    if (!(await isUserActive(this.prisma, claims.id))) {
      throw new UnauthorizedException({
        statusCode: 401,
        error: ACCOUNT_DEACTIVATED_CODE,
        message: 'This account is deactivated',
      });
    }

    (request as AuthenticatedRequest).user = {
      id: claims.id,
      email: claims.email,
      // Default-deny: an absent/unrecognized tier claim resolves to FREE, never
      // PRO — Session 11-2 (DECISION-LOG.md), fixing a live default-allow gap
      // (this previously defaulted to 'PRO').
      tier: claims.tier === 'PRO' ? 'PRO' : 'FREE',
      role: claims.role || 'USER',
      isAffiliate: !!claims.isAffiliate,
    };

    return true;
  }

  private extractBearerToken(request: Request): string | undefined {
    const header = request.headers['authorization'];
    if (!header || Array.isArray(header)) return undefined;
    const [scheme, value] = header.split(' ');
    if (scheme !== 'Bearer' || !value) return undefined;
    return value;
  }
}

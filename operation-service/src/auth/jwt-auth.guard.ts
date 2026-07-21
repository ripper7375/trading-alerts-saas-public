import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

import { decodeNextAuthToken, NextAuthTokenClaims } from './next-auth-jwt.util';

export interface RequestUser {
  id: string;
  email: string;
  tier: string;
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

    (request as AuthenticatedRequest).user = {
      id: claims.id,
      email: claims.email,
      tier: claims.tier,
      role: claims.role,
      isAffiliate: claims.isAffiliate,
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

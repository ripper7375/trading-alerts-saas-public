import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

import { PrismaService } from '../prisma/prisma.service';
import { decodeNextAuthToken, NextAuthTokenClaims } from './next-auth-jwt.util';
import {
  ACCOUNT_DEACTIVATED_CODE,
  SESSION_EXPIRED_CODE,
  SESSION_REVOKED_CODE,
  getSessionState,
  judgeSession,
} from './user-active.util';

/** What the 401 says for each reason a verified token is refused. */
const REFUSAL_MESSAGES: Record<string, string> = {
  [ACCOUNT_DEACTIVATED_CODE]: 'This account is deactivated',
  [SESSION_REVOKED_CODE]: 'This session has ended',
  [SESSION_EXPIRED_CODE]: 'This session has expired',
};

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

// Verifies NextAuth-issued session tokens — same hybrid-auth bridge as
// operation-service's JwtAuthGuard (F6/F7). Money-service reads the same
// NEXTAUTH_SECRET-derived key; it never writes/re-issues tokens.
//
// CODE-02A: a decoded token is also compared with the account behind it (cached 30 s;
// the rules are in user-active.util.ts), exactly as operation-service's guard does.
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

    // A valid token is not enough: an account locked by a confirmed deletion (or by an admin), a
    // session ended by a version change and an ADMIN session past its 12 hours must stop working
    // now, not when the token expires. 401, so a client that clears its tokens on 401 signs the
    // user out.
    const verdict = judgeSession(
      claims,
      await getSessionState(this.prisma, claims.id)
    );
    if (!verdict.ok) {
      throw new UnauthorizedException({
        statusCode: 401,
        error: verdict.code,
        message: REFUSAL_MESSAGES[verdict.code],
      });
    }

    // Role and tier come from the database (the snapshot above), not from the token, so
    // AdminGuard and the tier checks see the current values within the cache window. With no
    // snapshot (a lookup error, or no row outside production) the claims of the verified token
    // stand.
    (request as AuthenticatedRequest).user = {
      id: claims.id,
      email: claims.email,
      tier: verdict.state?.tier ?? claims.tier,
      role: verdict.state?.role ?? claims.role,
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

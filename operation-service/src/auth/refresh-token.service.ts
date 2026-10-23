import { createHash, randomBytes } from 'crypto';

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { ExpiredTokenError, InvalidTokenError } from './errors';

// F23 (DECISION-LOG.md, Session 3-2): hashed-at-rest + revocable refresh
// tokens. The raw token is a high-entropy random secret (32 bytes), never
// stored — only its SHA-256 digest, looked up by unique index. SHA-256 (not
// bcrypt) is deliberate: bcrypt's per-hash salt makes unique-index lookup
// impossible (you'd have to compare against every stored hash), and its
// slow-hashing property defends against a threat model (guessing a low-
// entropy password) this doesn't have — the token itself already has ~256
// bits of entropy.
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, matches NextAuth's session.maxAge

export interface IssuedRefreshToken {
  rawToken: string;
  expiresAt: Date;
}

/** What validating a refresh token tells the caller (CODE-02A: and when its session started). */
export interface ValidatedRefreshToken {
  id: string;
  userId: string;
  /** When the person signed in; NULL for a token issued before the column existed. */
  sessionStartedAt: Date | null;
}

export interface RefreshTokenContext {
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class RefreshTokenService {
  constructor(private readonly prisma: PrismaService) {}

  private hash(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * `sessionStartedAt` is when the person signed in (CODE-02A): a sign-in leaves it out and the
   * token gets the current time; a rotation passes the old token's value forward, `null` included
   * (a rotation never invents a login time), so a session cannot be made younger by rotating.
   */
  async issue(
    userId: string,
    context: RefreshTokenContext = {},
    sessionStartedAt: Date | null = new Date()
  ): Promise<IssuedRefreshToken> {
    const rawToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await this.prisma.refreshToken.create({
      data: {
        hashedToken: this.hash(rawToken),
        userId,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        expiresAt,
        sessionStartedAt,
      },
    });

    return { rawToken, expiresAt };
  }

  /**
   * Validates a raw refresh token: must exist, be unexpired, and unrevoked.
   * Throws (never returns null) so callers can't treat a thrown error as a
   * silent pass-through — same discipline as JwtAuthGuard's decode path.
   */
  async validate(rawToken: string): Promise<ValidatedRefreshToken> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { hashedToken: this.hash(rawToken) },
    });

    if (!record || record.revokedAt) {
      throw new InvalidTokenError('Refresh token is invalid or revoked');
    }

    if (record.expiresAt < new Date()) {
      throw new ExpiredTokenError('Refresh token has expired');
    }

    return {
      id: record.id,
      userId: record.userId,
      sessionStartedAt: record.sessionStartedAt,
    };
  }

  async revokeByRawToken(rawToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { hashedToken: this.hash(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeById(id: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Rotation: validates the presented token, revokes it, and issues a fresh
   * one — standard refresh-token-rotation practice (limits the blast radius
   * of a leaked token to a single use). New behavior, not a port: the old
   * RefreshToken stub was never wired into any real flow (F4 census), so
   * there is no prior "rotate" behavior to preserve.
   */
  async rotate(
    rawToken: string,
    context: RefreshTokenContext = {}
  ): Promise<{
    userId: string;
    issued: IssuedRefreshToken;
    sessionStartedAt: Date | null;
  }> {
    const { id, userId, sessionStartedAt } = await this.validate(rawToken);
    await this.revokeById(id);
    const issued = await this.issue(userId, context, sessionStartedAt);
    return { userId, issued, sessionStartedAt };
  }
}

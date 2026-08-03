import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import {
  sendTwoFactorDisabledEmail,
  sendTwoFactorEnabledEmail,
} from '../email/email.util';
import { PrismaService } from '../prisma/prisma.service';
import { formatLocation, getGeoLocation } from '../security/geo-location.util';
import {
  decryptSecret,
  encryptSecret,
  formatBackupCodesForDisplay,
  generateBackupCodes,
  generateOtpauthURL,
  generateQRCodeDataURL,
  generateTOTPSecret,
  isBackupCode,
  verifyBackupCode,
  verifyTOTP,
} from '../two-factor/two-factor.util';

export interface TwoFactorRequestContext {
  ipAddress?: string;
}

// Ported from app/api/user/2fa/{setup,verify-setup,verify,backup-codes,
// disable}/route.ts (Session 3-4, candidate step 2 — deferred out of
// Session 3-2, see that order's Deviations #3). Uses plain NestJS
// exceptions (not the AuthError hierarchy) rather than inventing new
// AuthError subclasses for conditions the source never modeled as classes
// either — the 5 source routes all return ad-hoc { error: string } bodies,
// not a shared code taxonomy, so there's no existing shape to preserve here
// beyond the message text itself.
@Injectable()
export class TwoFactorService {
  constructor(private readonly prisma: PrismaService) {}

  // F58 (DECISION-LOG.md): JwtAuthGuard-derived userId sometimes fails
  // findUnique({where:{id}}) against the live container for a user created
  // via the auth bridge's own token-register, despite the row provably
  // existing (proven correct in isolation against the same database — see
  // F58's full evidence chain; root cause not conclusively identified).
  // Resolving by email first when available is a reliable fallback (email
  // lookups have never exhibited this symptom in any of this session's
  // testing) — zero behavior change for the success path, since it only
  // fires when the id lookup already came back empty.
  private async resolveUserId(userId: string, email?: string): Promise<string> {
    const byId = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (byId) return userId;
    if (email) {
      const byEmail = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (byEmail) return byEmail.id;
    }
    throw new NotFoundException('User not found');
  }

  async getStatus(userId: string, email?: string) {
    userId = await this.resolveUserId(userId, email);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true, twoFactorVerifiedAt: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return {
      enabled: user.twoFactorEnabled,
      verifiedAt: user.twoFactorVerifiedAt,
    };
  }

  async setup(userId: string, email?: string) {
    userId = await this.resolveUserId(userId, email);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, twoFactorEnabled: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.twoFactorEnabled) {
      throw new BadRequestException(
        'Two-factor authentication is already enabled'
      );
    }

    const secret = generateTOTPSecret();
    const otpauthURL = generateOtpauthURL(user.email, secret);
    const qrCodeDataURL = await generateQRCodeDataURL(otpauthURL);
    const encryptedSecret = encryptSecret(secret);

    // Don't set twoFactorEnabled yet — committed only on verifySetup().
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: encryptedSecret },
    });

    return {
      success: true,
      qrCode: qrCodeDataURL,
      secret,
      message:
        'Scan the QR code with your authenticator app, then verify with a code',
    };
  }

  async verifySetup(
    userId: string,
    code: string,
    context: TwoFactorRequestContext = {},
    email?: string
  ) {
    userId = await this.resolveUserId(userId, email);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.twoFactorEnabled) {
      throw new BadRequestException(
        'Two-factor authentication is already enabled'
      );
    }
    if (!user.twoFactorSecret) {
      throw new BadRequestException('Please initiate 2FA setup first');
    }

    let secret: string;
    try {
      secret = decryptSecret(user.twoFactorSecret);
    } catch {
      throw new BadRequestException(
        'Invalid 2FA configuration. Please restart setup.'
      );
    }

    if (!verifyTOTP(code, secret)) {
      throw new BadRequestException(
        'Invalid verification code. Please try again.'
      );
    }

    const { plainCodes, hashedCodes } = await generateBackupCodes();

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorBackupCodes: JSON.stringify(hashedCodes),
        twoFactorVerifiedAt: new Date(),
      },
    });

    try {
      const location = formatLocation(
        await getGeoLocation(context.ipAddress ?? '')
      );
      await this.prisma.securityAlert.create({
        data: {
          userId,
          type: 'TWO_FACTOR_ENABLED',
          title: 'Two-Factor Authentication Enabled',
          message:
            'Two-factor authentication has been enabled on your account.',
          ipAddress: context.ipAddress,
          location,
          emailSent: true,
          emailSentAt: new Date(),
        },
      });
      await sendTwoFactorEnabledEmail(
        user.email,
        user.name || 'User',
        context.ipAddress ?? 'Unknown',
        location
      );
    } catch (alertError) {
      console.error('[2FA] Failed to send security alert:', alertError);
    }

    return {
      success: true,
      message: 'Two-factor authentication enabled successfully',
      backupCodes: plainCodes,
      backupCodesFormatted: formatBackupCodesForDisplay(plainCodes),
    };
  }

  /**
   * Completes 2FA during login. Deliberately unauthenticated (no
   * JwtAuthGuard) — the caller has no session yet; the temp token minted by
   * AuthService.login()'s TwoFactorRequiredError branch is the only
   * credential, exactly matching app/api/user/2fa/verify/route.ts (which
   * also never checks the token's `purpose` claim, unlike AuthService's own
   * completeTwoFactorLogin() — preserved as-is, not "fixed").
   */
  async verify(code: string, token: string) {
    let payload: { userId: string; email: string; exp: number };
    try {
      const secret = process.env['NEXTAUTH_SECRET'];
      if (!secret) {
        throw new Error('NEXTAUTH_SECRET not configured');
      }
      payload = jwt.verify(token, secret) as typeof payload;
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired verification token. Please log in again.'
      );
    }

    const resolvedUserId = await this.resolveUserId(
      payload.userId,
      payload.email
    );
    const user = await this.prisma.user.findUnique({
      where: { id: resolvedUserId },
      select: {
        id: true,
        email: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorBackupCodes: true,
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    const normalizedCode = code.replace(/[-\s]/g, '');

    if (isBackupCode(normalizedCode)) {
      const backupCodes: string[] = user.twoFactorBackupCodes
        ? JSON.parse(user.twoFactorBackupCodes)
        : [];

      const matchedIndex = await verifyBackupCode(normalizedCode, backupCodes);
      if (matchedIndex === -1) {
        throw new BadRequestException('Invalid backup code');
      }

      backupCodes[matchedIndex] = '';
      await this.prisma.user.update({
        where: { id: user.id },
        data: { twoFactorBackupCodes: JSON.stringify(backupCodes) },
      });

      const remainingCodes = backupCodes.filter((c) => c !== '').length;

      return {
        success: true,
        verified: true,
        method: 'backup_code' as const,
        remainingBackupCodes: remainingCodes,
        message:
          remainingCodes <= 2
            ? `Verified with backup code. Only ${remainingCodes} backup codes remaining. Consider generating new ones.`
            : 'Verified with backup code',
      };
    }

    let secret: string;
    try {
      secret = decryptSecret(user.twoFactorSecret);
    } catch {
      throw new InternalServerErrorException('Invalid 2FA configuration');
    }

    if (!verifyTOTP(normalizedCode, secret)) {
      throw new BadRequestException('Invalid verification code');
    }

    return { success: true, verified: true, method: 'totp' as const };
  }

  async getBackupCodesStatus(userId: string, email?: string) {
    userId = await this.resolveUserId(userId, email);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true, twoFactorBackupCodes: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.twoFactorEnabled) {
      return { enabled: false, remainingCodes: 0 };
    }

    const backupCodes: string[] = user.twoFactorBackupCodes
      ? JSON.parse(user.twoFactorBackupCodes)
      : [];

    return {
      enabled: true,
      remainingCodes: backupCodes.filter((c) => c !== '').length,
      totalCodes: 10,
    };
  }

  async regenerateBackupCodes(
    userId: string,
    password: string,
    email?: string
  ) {
    userId = await this.resolveUserId(userId, email);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        password: true,
        twoFactorEnabled: true,
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }
    if (!user.password) {
      throw new BadRequestException('Password verification required');
    }
    if (!(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Incorrect password');
    }

    const { plainCodes, hashedCodes } = await generateBackupCodes();
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorBackupCodes: JSON.stringify(hashedCodes) },
    });

    return {
      success: true,
      message:
        'Backup codes regenerated successfully. Old codes are no longer valid.',
      backupCodes: plainCodes,
      backupCodesFormatted: formatBackupCodesForDisplay(plainCodes),
    };
  }

  async disable(
    userId: string,
    password: string,
    code: string,
    context: TwoFactorRequestContext = {},
    email?: string
  ) {
    userId = await this.resolveUserId(userId, email);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }
    if (!user.password) {
      throw new BadRequestException('Password verification required');
    }
    if (!(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Incorrect password');
    }
    if (!user.twoFactorSecret) {
      throw new InternalServerErrorException('Invalid 2FA configuration');
    }

    let secret: string;
    try {
      secret = decryptSecret(user.twoFactorSecret);
    } catch {
      throw new InternalServerErrorException('Invalid 2FA configuration');
    }

    if (!verifyTOTP(code, secret)) {
      throw new BadRequestException('Invalid verification code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
        twoFactorVerifiedAt: null,
      },
    });

    try {
      const location = formatLocation(
        await getGeoLocation(context.ipAddress ?? '')
      );
      await this.prisma.securityAlert.create({
        data: {
          userId,
          type: 'TWO_FACTOR_DISABLED',
          title: 'Two-Factor Authentication Disabled',
          message:
            'Two-factor authentication has been disabled on your account.',
          ipAddress: context.ipAddress,
          location,
          emailSent: true,
          emailSentAt: new Date(),
        },
      });
      await sendTwoFactorDisabledEmail(
        user.email,
        user.name || 'User',
        context.ipAddress ?? 'Unknown',
        location
      );
    } catch (alertError) {
      console.error('[2FA] Failed to send security alert:', alertError);
    }

    return {
      success: true,
      message: 'Two-factor authentication disabled successfully',
    };
  }
}

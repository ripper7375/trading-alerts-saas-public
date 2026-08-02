import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { decodeNextAuthToken } from '../auth/next-auth-jwt.util';
import { TwoFactorBackupCodesDto } from '../auth/dto/two-factor-backup-codes.dto';
import { TwoFactorDisableDto } from '../auth/dto/two-factor-disable.dto';
import { TwoFactorVerifySetupDto } from '../auth/dto/two-factor-verify-setup.dto';
import { TwoFactorVerifyDto } from '../auth/dto/two-factor-verify.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  changePasswordSchema,
  deletionCancelSchema,
  deletionConfirmSchema,
  updatePreferencesSchema,
  updateProfileSchema,
} from './users.schemas';
import { UsersService } from './users.service';
import type {
  ChangePasswordDto,
  DeletionCancelDto,
  DeletionConfirmDto,
  UpdatePreferencesDto,
  UpdateProfileDto,
} from './dto/user.dto';

/**
 * Ports the 14 monolith `app/api/user/*` route files (19 endpoints total —
 * see Deviations for 3 endpoints the APPROVED order's own Step 2 handler
 * list omitted or mis-cited, found while reading real SOURCE). Session
 * 4B-11.
 *
 * Guards are applied per-METHOD, never at the class level (L45-class rule,
 * extended to auth guards by this session's own CONFIRM finding): 3 of the
 * 19 endpoints are unauthenticated BY DESIGN in SOURCE —
 * `POST /user/2fa/verify` (mid-login challenge, no session exists yet),
 * `POST /user/account/deletion-confirm` (public email-link token flow), and
 * `POST /user/account/deletion-cancel` (accepts EITHER an anonymous token
 * OR a logged-in session). A class-level `@UseGuards(JwtAuthGuard)` would
 * 401 all three before they ever run.
 *
 * @module users/users.controller
 */
@Controller('user')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ─── Profile ──────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Req() request: AuthenticatedRequest) {
    return this.usersService.getProfile(request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile')
  @HttpCode(200)
  async updateProfile(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(updateProfileSchema)) dto: UpdateProfileDto
  ) {
    return this.usersService.updateProfile(
      request.user.id,
      request.user.email,
      dto
    );
  }

  // ─── Preferences ──────────────────────────────────────────────────────
  // SOURCE (app/api/user/preferences/route.ts) exports GET/PUT, not
  // GET/PATCH — the APPROVED order's own Step 2 text said PATCH; corrected
  // here against real SOURCE (Deviations).

  @UseGuards(JwtAuthGuard)
  @Get('preferences')
  async getPreferences(@Req() request: AuthenticatedRequest) {
    return this.usersService.getPreferences(request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('preferences')
  @HttpCode(200)
  async updatePreferences(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(updatePreferencesSchema))
    dto: UpdatePreferencesDto
  ) {
    return this.usersService.updatePreferences(request.user.id, dto);
  }

  // ─── Password ─────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('password')
  @HttpCode(200)
  async changePassword(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(changePasswordSchema)) dto: ChangePasswordDto
  ) {
    return this.usersService.changePassword(request.user.id, dto, {
      ipAddress: request.ip,
    });
  }

  // ─── Sessions & History ───────────────────────────────────────────────
  // SOURCE's sessions/route.ts has BOTH GET (list) and DELETE (revoke-all)
  // handlers at the bare /sessions path — the APPROVED order's own Step 2
  // text only listed the [id] DELETE, omitting the bulk one (Deviations).

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  async getSessions(@Req() request: AuthenticatedRequest) {
    const sessionToken = this.extractBearerToken(request);
    if (sessionToken) {
      const userAgent = request.headers['user-agent'] || '';
      const ip = this.resolveClientIp(request);
      await this.usersService.trackSession(
        request.user.id,
        sessionToken,
        userAgent,
        ip
      );
    }
    return this.usersService.getSessions(request.user.id, sessionToken);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions')
  @HttpCode(200)
  async revokeAllSessions(@Req() request: AuthenticatedRequest) {
    const sessionToken = this.extractBearerToken(request);
    return this.usersService.revokeAllSessions(request.user.id, sessionToken);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:id')
  @HttpCode(200)
  async revokeSession(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string
  ) {
    return this.usersService.revokeSession(id, request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('login-history')
  async getLoginHistory(
    @Req() request: AuthenticatedRequest,
    @Query('limit') limitParam?: string,
    @Query('offset') offsetParam?: string
  ) {
    const limit = Math.min(parseInt(limitParam || '20', 10), 100);
    const offset = parseInt(offsetParam || '0', 10);
    return this.usersService.getLoginHistory(request.user.id, limit, offset);
  }

  // ─── 2FA ──────────────────────────────────────────────────────────────
  // GET /user/2fa/setup (status) is a real SOURCE handler
  // (app/api/user/2fa/setup/route.ts exports both GET and POST) that the
  // APPROVED order's own Step 2 handler list omitted entirely — added here
  // to preserve full parity (Deviations).

  @UseGuards(JwtAuthGuard)
  @Get('2fa/setup')
  async get2FAStatus(@Req() request: AuthenticatedRequest) {
    return this.usersService.get2FAStatus(request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/setup')
  @HttpCode(200)
  async setup2FA(@Req() request: AuthenticatedRequest) {
    return this.usersService.setup2FA(request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/verify-setup')
  @HttpCode(200)
  async verifySetup2FA(
    @Req() request: AuthenticatedRequest,
    @Body() dto: TwoFactorVerifySetupDto
  ) {
    return this.usersService.verifySetup2FA(
      request.user.id,
      dto.code,
      request.ip
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('2fa/backup-codes')
  async getBackupCodesStatus(@Req() request: AuthenticatedRequest) {
    return this.usersService.getBackupCodesStatus(request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/backup-codes')
  @HttpCode(200)
  async regenerateBackupCodes(
    @Req() request: AuthenticatedRequest,
    @Body() dto: TwoFactorBackupCodesDto
  ) {
    return this.usersService.regenerateBackupCodes(
      request.user.id,
      dto.password
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/disable')
  @HttpCode(200)
  async disable2FA(
    @Req() request: AuthenticatedRequest,
    @Body() dto: TwoFactorDisableDto
  ) {
    return this.usersService.disable2FA(
      request.user.id,
      dto.password,
      dto.code,
      request.ip
    );
  }

  // No JwtAuthGuard: mid-login challenge, no session exists yet — matches
  // app/api/user/2fa/verify/route.ts and the existing
  // TwoFactorController.verify() exactly.
  @Post('2fa/verify')
  @HttpCode(200)
  async verify2FA(@Body() dto: TwoFactorVerifyDto) {
    return this.usersService.verify2FA(dto.code, dto.token);
  }

  // ─── Account Deletion ─────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('account/deletion-request')
  @HttpCode(200)
  async requestDeletion(@Req() request: AuthenticatedRequest) {
    return this.usersService.requestDeletion(request.user.id);
  }

  // No JwtAuthGuard: public email-link token flow, matches
  // app/api/user/account/deletion-confirm/route.ts exactly (zero auth
  // check in SOURCE).
  @Post('account/deletion-confirm')
  @HttpCode(200)
  async confirmDeletion(
    @Body(new ZodValidationPipe(deletionConfirmSchema))
    dto: DeletionConfirmDto
  ) {
    return this.usersService.confirmDeletion(dto.token);
  }

  // No JwtAuthGuard: SOURCE accepts EITHER an anonymous token OR a logged-in
  // session (app/api/user/account/deletion-cancel/route.ts's own dual-mode
  // branch) — a blanket guard would 401 the token-only path. Session is
  // resolved manually, non-throwing, from an optional Bearer header.
  @Post('account/deletion-cancel')
  @HttpCode(200)
  async cancelDeletion(
    @Req() request: Request,
    @Body(new ZodValidationPipe(deletionCancelSchema)) dto: DeletionCancelDto
  ) {
    const userId = dto.token ? undefined : await this.tryResolveUserId(request);
    return this.usersService.cancelDeletion(dto.token, userId);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  private extractBearerToken(request: Request): string | undefined {
    const header = request.headers['authorization'];
    if (!header || Array.isArray(header)) return undefined;
    const [scheme, value] = header.split(' ');
    if (scheme !== 'Bearer' || !value) return undefined;
    return value;
  }

  private resolveClientIp(request: Request): string {
    const forwardedFor = request.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
      return forwardedFor.split(',')[0]?.trim() || 'Unknown';
    }
    return request.ip || 'Unknown';
  }

  /** Non-throwing: returns undefined on any missing/invalid/expired token. */
  private async tryResolveUserId(
    request: Request
  ): Promise<string | undefined> {
    const token = this.extractBearerToken(request);
    if (!token) return undefined;
    const secret = process.env['NEXTAUTH_SECRET'];
    if (!secret) return undefined;
    try {
      const claims = await decodeNextAuthToken(token, secret);
      return claims.id;
    } catch {
      return undefined;
    }
  }
}

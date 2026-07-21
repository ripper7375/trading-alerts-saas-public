import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { TwoFactorBackupCodesDto } from './dto/two-factor-backup-codes.dto';
import { TwoFactorDisableDto } from './dto/two-factor-disable.dto';
import { TwoFactorVerifySetupDto } from './dto/two-factor-verify-setup.dto';
import { TwoFactorVerifyDto } from './dto/two-factor-verify.dto';
import { AuthenticatedRequest, JwtAuthGuard } from './jwt-auth.guard';
import { TwoFactorService } from './two-factor.service';

@Controller('auth/2fa')
export class TwoFactorController {
  constructor(private readonly twoFactorService: TwoFactorService) {}

  @UseGuards(JwtAuthGuard)
  @Get('status')
  async status(@Req() request: AuthenticatedRequest) {
    return this.twoFactorService.getStatus(request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('setup')
  @HttpCode(200)
  async setup(@Req() request: AuthenticatedRequest) {
    return this.twoFactorService.setup(request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify-setup')
  @HttpCode(200)
  async verifySetup(
    @Req() request: AuthenticatedRequest,
    @Body() dto: TwoFactorVerifySetupDto
  ) {
    return this.twoFactorService.verifySetup(request.user.id, dto.code, {
      ipAddress: request.ip,
    });
  }

  // No JwtAuthGuard: this completes login itself, before any session
  // exists — see TwoFactorService.verify()'s own comment.
  @Post('verify')
  @HttpCode(200)
  async verify(@Body() dto: TwoFactorVerifyDto) {
    return this.twoFactorService.verify(dto.code, dto.token);
  }

  @UseGuards(JwtAuthGuard)
  @Get('backup-codes')
  async backupCodesStatus(@Req() request: AuthenticatedRequest) {
    return this.twoFactorService.getBackupCodesStatus(request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('backup-codes')
  @HttpCode(200)
  async regenerateBackupCodes(
    @Req() request: AuthenticatedRequest,
    @Body() dto: TwoFactorBackupCodesDto
  ) {
    return this.twoFactorService.regenerateBackupCodes(
      request.user.id,
      dto.password
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('disable')
  @HttpCode(200)
  async disable(
    @Req() request: AuthenticatedRequest,
    @Body() dto: TwoFactorDisableDto
  ) {
    return this.twoFactorService.disable(
      request.user.id,
      dto.password,
      dto.code,
      { ipAddress: request.ip }
    );
  }
}

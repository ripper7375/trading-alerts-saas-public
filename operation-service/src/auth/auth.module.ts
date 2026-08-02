import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { TwoFactorController } from './two-factor.controller';
import { TwoFactorService } from './two-factor.service';

@Module({
  controllers: [AuthController, TwoFactorController],
  providers: [AuthService, RefreshTokenService, TwoFactorService],
  // TwoFactorService exported for UsersModule (Session 4B-11) to reuse
  // directly rather than re-implementing 2FA logic.
  exports: [TwoFactorService],
})
export class AuthModule {}

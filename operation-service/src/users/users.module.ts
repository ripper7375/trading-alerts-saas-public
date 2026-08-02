import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * User profile/preferences/password/sessions/2FA/account-deletion domain
 * module (Session 4B-11). `PrismaModule`/`RedisModule` are `@Global()`
 * (established Session 4B-1/4B-2) — no explicit import needed.
 * `AuthModule` is imported to inject its exported `TwoFactorService`.
 *
 * @module users/users.module
 */
@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}

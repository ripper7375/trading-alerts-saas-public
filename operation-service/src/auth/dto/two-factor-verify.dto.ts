import { IsString, MinLength } from 'class-validator';

// code covers both TOTP (6 digits) and backup codes (8 hex chars, optional
// dash) — matches app/api/user/2fa/verify/route.ts's zod schema
// (z.string().min(6)), which deliberately doesn't fix a max length/format
// so both code shapes pass this layer; two-factor.util.ts's isBackupCode()
// decides which check to actually run.
export class TwoFactorVerifyDto {
  @IsString()
  @MinLength(6, { message: 'Code is required' })
  code!: string;

  @IsString()
  @MinLength(1, { message: 'Token is required' })
  token!: string;
}

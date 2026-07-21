import { IsString, MinLength } from 'class-validator';

// Matches app/api/auth/reset-password/route.ts's zod schema exactly (min 8,
// no complexity rules — unlike RegisterDto's password, which does enforce
// them; that asymmetry is in the source, not introduced by this port).
export class ResetPasswordDto {
  @IsString()
  @MinLength(1, { message: 'Reset token is required' })
  token!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password!: string;
}

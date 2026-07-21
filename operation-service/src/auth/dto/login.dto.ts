import { IsString, MinLength } from 'class-validator';

// Not @IsEmail — the special '__2fa_verified__' sentinel value (matching
// lib/auth/auth-options.ts's authorize()) is not a real email address, and
// must still validate to reach the 2FA-completion branch.
export class LoginDto {
  @IsString()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

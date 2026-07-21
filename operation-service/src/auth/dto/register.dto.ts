import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

// Password rule set ported verbatim from app/api/auth/register/route.ts's
// zod schema (Session 3-2 finding: this route, not lib/auth/*, is the real
// SOURCE for /auth/register's validation behavior — the order's file
// inventory only enumerated lib/auth/* files; recorded in Deviations).
export class RegisterDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/[A-Z]/, {
    message: 'Password must contain at least one uppercase letter',
  })
  @Matches(/[a-z]/, {
    message: 'Password must contain at least one lowercase letter',
  })
  @Matches(/[0-9]/, { message: 'Password must contain at least one number' })
  @Matches(/[!@#$%^&*(),.?":{}|<>]/, {
    message: 'Password must contain at least one special character',
  })
  password!: string;

  @IsOptional()
  @IsString()
  name?: string;
}

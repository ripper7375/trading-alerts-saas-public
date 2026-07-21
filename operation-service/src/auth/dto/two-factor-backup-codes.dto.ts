import { IsString, MinLength } from 'class-validator';

export class TwoFactorBackupCodesDto {
  @IsString()
  @MinLength(1, { message: 'Password is required' })
  password!: string;
}

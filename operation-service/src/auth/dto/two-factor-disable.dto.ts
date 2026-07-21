import { IsNumberString, IsString, Length, MinLength } from 'class-validator';

export class TwoFactorDisableDto {
  @IsString()
  @MinLength(1, { message: 'Password is required' })
  password!: string;

  @Length(6, 6, { message: 'Code must be 6 digits' })
  @IsNumberString({}, { message: 'Code must be numeric' })
  code!: string;
}

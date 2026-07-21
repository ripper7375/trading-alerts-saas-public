import { IsNumberString, Length } from 'class-validator';

export class TwoFactorVerifySetupDto {
  @Length(6, 6, { message: 'Code must be 6 digits' })
  @IsNumberString({}, { message: 'Code must be numeric' })
  code!: string;
}

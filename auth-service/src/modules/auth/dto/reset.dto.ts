import { IsString, MinLength } from 'class-validator';
export class ResetDto {
  @IsString() token: string;
  @IsString() @MinLength(8) newPassword: string;
}

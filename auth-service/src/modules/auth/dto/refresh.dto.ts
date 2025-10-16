import { IsString } from 'class-validator';
export class RefreshDto {
  @IsString() refreshToken: string; // (web có thể đọc từ cookie HttpOnly)
}

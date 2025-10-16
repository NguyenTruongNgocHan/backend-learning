import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

type Expires =
  | number
  | `${number}${'s' | 'm' | 'h' | 'd'}`; // ví dụ '15m', '30d'

@Injectable()
export class TokensService {
  constructor(private jwt: JwtService) {}

  signAccess(payload: any) {
    const expiresIn: Expires =
      (process.env.JWT_ACCESS_EXPIRES ?? '15m') as Expires;

    return this.jwt.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET!,
      expiresIn,
    });
  }

  signRefresh(payload: any) {
    const expiresIn: Expires =
      (process.env.JWT_REFRESH_EXPIRES ?? '30d') as Expires;

    return this.jwt.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET!,
      expiresIn,
    });
  }

  verifyAccess(token: string) {
    return this.jwt.verifyAsync(token, {
      secret: process.env.JWT_ACCESS_SECRET!,
    });
  }

  verifyRefresh(token: string) {
    return this.jwt.verifyAsync(token, {
      secret: process.env.JWT_REFRESH_SECRET!,
    });
  }
}

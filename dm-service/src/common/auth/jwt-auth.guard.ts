import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const header = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException('Missing token');

    try {
      const payload = jwt.verify(token, process.env.JWT_PUBLIC_KEY!, {
        algorithms: ['RS256'],
        audience: process.env.JWT_AUDIENCE,
        issuer: process.env.JWT_ISSUER,
      }) as any;
      req.user = { id: payload.sub, email: payload.email, roles: payload.roles ?? [] };
      return true;
    } catch (e) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}

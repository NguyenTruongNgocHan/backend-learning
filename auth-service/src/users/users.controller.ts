import { Controller, Get, Req } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private users: UsersService) {}
  @Get('me')
  me(@Req() req: any) {
    const token = (req.headers.authorization||'').replace('Bearer ','');
    const payload = token ? JSON.parse(Buffer.from(token.split('.')[1],'base64').toString()) : {};
    return this.users.me(payload.sub);
  }
}

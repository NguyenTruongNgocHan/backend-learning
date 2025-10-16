import { Body, Controller, Headers, Ip, Post, Req, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

@Controller('auth')
@UsePipes(new ValidationPipe({ whitelist: true }))
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto.email, dto.password, dto.displayName);
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Ip() ip: string, @Headers('user-agent') ua: string) {
    return this.auth.login(dto.email, dto.password, ua, ip);
  }

  @Post('token/refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  logout(@Req() req: any) {
    // Lấy userId & sessionId từ AccessToken (ở MVP ta nhận từ header cho đơn giản)
    // Thực tế: dùng JwtGuard để gắn req.user, req.user.sid
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const payload = token ? JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()) : {};
    return this.auth.logout(payload.sub, payload.sid);
  }
}

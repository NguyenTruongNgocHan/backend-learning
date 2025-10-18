import { Body, Controller, Headers, Ip, Post, Req, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ForgotDto } from './dto/forgot.dto';
import { VerifyOtpDto } from './dto/verifyotp.dto';
import { ResetDto } from './dto/reset.dto';
import { SendOtpDto } from './dto/sendotp.dto';
import { PasswordService } from './password.service';
import { VerifyService } from './verify.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';


@Controller('auth')
@UsePipes(new ValidationPipe({ whitelist: true }))
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly password: PasswordService,
    private readonly prisma: PrismaService,       
    private readonly verifyService: VerifyService
  ) { }

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

  @Post('password/forgot')
  async forgot(@Body() dto: ForgotDto) {
    return this.password.forgotPassword(dto.email);;
  }

  @Post('password/reset')
  async reset(@Body() dto: ResetDto) {
    return this.password.resetPassword(dto.token, dto.newPassword);
  }
  @Post('verify/send')
async sendOtp(@Body() dto: SendOtpDto) {
  return this.verifyService.sendEmailOTP(dto.email);
}


  @Post('verify/confirm')
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.verifyService.verifyEmailOTP(dto.userId, dto.otp);
  }



}

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../prisma/prisma.module';
import { MailerModule } from '../../mailer/mailer.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokensService } from './tokens.service';
import { HashService } from './hash.service';
import { PasswordService } from './password.service';
import { VerifyService } from './verify.service';

@Module({
  imports: [PrismaModule, MailerModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, HashService, TokensService, PasswordService, VerifyService],
  exports: [AuthService],
})
export class AuthModule {}

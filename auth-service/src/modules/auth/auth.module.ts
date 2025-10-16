import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from '../auth/auth.service';
import { AuthController } from '../auth/auth.controller';
import { TokensService } from './tokens.service';
import { HashService } from './hash.service';

@Module({
  imports: [JwtModule.register({})],
  providers: [AuthService, TokensService, HashService],
  controllers: [AuthController],
  exports: [TokensService],
})
export class AuthModule {}

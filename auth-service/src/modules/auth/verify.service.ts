// src/modules/auth/verify.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MailerService } from '../../mailer/mailer.service';
import * as crypto from 'crypto';
import { add } from 'date-fns';

@Injectable()
export class VerifyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
  ) {}

  async sendEmailOTP(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException('Email not found');

    await this.prisma.emailVerificationToken.updateMany({
      where: { userId: user.id, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date() },
    });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = add(new Date(), { minutes: 15 });

    await this.prisma.emailVerificationToken.create({
      data: { userId: user.id, otpHash, expiresAt },
    });

    await this.mailer.sendVerifyEmail(email, otp);
    return { ok: true, userId: user.id, expiresAt };
  }

  async verifyEmailOTP(userId: string, inputOtp: string) {
    const token = await this.prisma.emailVerificationToken.findFirst({
      where: { userId, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!token) throw new BadRequestException('OTP not found or expired');

    const inputHash = crypto.createHash('sha256').update(inputOtp).digest('hex');
    if (inputHash !== token.otpHash) throw new BadRequestException('Invalid OTP');

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: token.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { status: 'ACTIVE' },
      }),
    ]);
    return { ok: true };
  }
}

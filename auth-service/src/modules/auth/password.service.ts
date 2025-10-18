import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HashService } from './hash.service';
import { MailerService } from '../../mailer/mailer.service';
import { addMinutes } from 'date-fns';
import * as crypto from 'crypto';

@Injectable()
export class PasswordService {
  constructor(
    private prisma: PrismaService,
    private hash: HashService,
    private mailer: MailerService,
  ) {}

  /** B1: Gửi email reset password (tạo token reset, lưu hash) */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException('Email not found');

    // Tạo raw token và hash
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = await this.hash.hash(rawToken);
    const expiresAt = addMinutes(new Date(), 15);

    // (tuỳ chọn) vô hiệu các token chưa dùng còn hạn của user trước đó
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    });

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const base = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${base.replace(/\/+$/, '')}/reset-password?token=${rawToken}`;

    await this.mailer.sendForgotPasswordEmail(user.email, rawToken);

    // hoặc nếu bạn muốn gửi HTML tuỳ biến:
    // await this.mailer.send({ to: user.email, subject: 'Reset your password', html: `...${resetUrl}...` });

    return { ok: true };
  }

  /** B2: Đặt lại mật khẩu sau khi có token (raw) */
  async resetPassword(rawToken: string, newPassword: string) {
    // Lấy các token còn hạn & chưa dùng gần đây để so hash
    const candidates = await this.prisma.passwordResetToken.findMany({
      where: { consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 50, // giới hạn tìm kiếm an toàn
    });

    let tokenRow: (typeof candidates)[number] | null = null;
    for (const row of candidates) {
      if (await this.hash.verify(row.tokenHash, rawToken)) {
        tokenRow = row;
        break;
      }
    }

    if (!tokenRow) throw new BadRequestException('Invalid or expired token');

    // Đổi mật khẩu & consume token
    const newHash = await this.hash.hash(newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: tokenRow.userId },
        data: { passwordHash: newHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: tokenRow.id },
        data: { consumedAt: new Date() },
      }),
      // (tuỳ chọn) consume luôn mọi token chưa dùng khác của user để tránh reuse
      this.prisma.passwordResetToken.updateMany({
        where: {
          userId: tokenRow.userId,
          consumedAt: null,
          expiresAt: { gt: new Date() },
          NOT: { id: tokenRow.id },
        },
        data: { consumedAt: new Date() },
      }),
    ]);

    return { ok: true, message: 'Password reset successfully' };
  }
}

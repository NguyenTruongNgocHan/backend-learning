import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HashService } from './hash.service';
import { TokensService } from './tokens.service';
import { VerifyService } from './verify.service';
import { MailerService } from 'src/mailer/mailer.service';
import { add } from 'date-fns';
import * as crypto from 'crypto';

function nowPlus(dur: string | number) {
  if (typeof dur === 'number') return new Date(Date.now() + dur);
  const m = /(\d+)([smhd])/i.exec(dur)!;
  const n = parseInt(m[1], 10), u = m[2].toLowerCase();
  if (u === 's') return add(new Date(), { seconds: n });
  if (u === 'm') return add(new Date(), { minutes: n });
  if (u === 'h') return add(new Date(), { hours: n });
  if (u === 'd') return add(new Date(), { days: n });
  return add(new Date(), { days: 30 });
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private hash: HashService,
    private tokens: TokensService,
    private mailer: MailerService,
    private verify: VerifyService,
  ) { }

  async register(email: string, password: string, displayName?: string) {
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new BadRequestException('Email already registered');

    const user = await this.prisma.user.create({
      data: {
        email,
        // CHÚ Ý: passwordHash trong schema là String? => vẫn hash nhưng code login phải guard null
        passwordHash: await this.hash.hash(password),
        status: 'PENDING',
        profile: { create: { displayName } },
        roles: { create: { role: { connect: { name: 'LEARNER' } } } },
      },
      include: { profile: true, roles: { include: { role: true } } },
    });

    await this.verify.sendEmailOTP(user.email);
    return { id: user.id, email: user.email };
  }

  async login(email: string, password: string, deviceInfo?: string, ip?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new ForbiddenException('Invalid credentials');
    if (user.status === 'BANNED') throw new ForbiddenException('User banned');
    if (user.status !== 'ACTIVE') throw new ForbiddenException('Email not verified');

    // passwordHash là String? => guard
    if (!user.passwordHash) throw new ForbiddenException('Invalid credentials');
    const ok = await this.hash.verify(user.passwordHash, password);
    if (!ok) throw new ForbiddenException('Invalid credentials');

    const accessExp = process.env.JWT_ACCESS_EXPIRES || '15m';
    const refreshExp = process.env.JWT_REFRESH_EXPIRES || '30d';

    // Session schema: KHÔNG có issuedAt, có createdAt (default), expiresAt (bắt buộc)
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        deviceInfo: deviceInfo ?? null,
        ipAddress: ip ?? null,
        expiresAt: nowPlus(refreshExp), // session sống ít nhất bằng refresh
      },
    });

    const roles = user.roles.map(r => r.role.name);
    const payload = { sub: user.id, sid: session.id, roles };

    const accessToken = await this.tokens.signAccess(payload);
    const refreshToken = await this.tokens.signRefresh({ sub: user.id, sid: session.id });

    // DB RefreshToken hiện chỉ có: id, userId, token, createdAt, expiresAt, revokedAt
    const { exp } = (await this.tokens.verifyRefresh(refreshToken)) as any;

    await this.prisma.refreshToken.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        token: refreshToken,                 // LƯU PLAIN theo schema hiện tại
        expiresAt: new Date(exp * 1000),
      },
    });

    return { accessToken, refreshToken, user: { id: user.id, email: user.email, roles } };
  }

  async refresh(oldRefreshToken: string) {
    // 1) verify chữ ký/token hết hạn?
    let payload: any;
    try {
      payload = await this.tokens.verifyRefresh(oldRefreshToken);
    } catch {
      throw new ForbiddenException('Invalid refresh token');
    }

    // 2) tìm token đúng trong DB (schema không có hash/family/sessionId)
    const row = await this.prisma.refreshToken.findUnique({
      where: { token: oldRefreshToken }, // token @unique
    });

    if (!row || row.revokedAt) throw new ForbiddenException('Invalid refresh token');
    if (row.expiresAt < new Date()) throw new ForbiddenException('Refresh token expired');

    // 3) phát cặp mới, revoke cũ (đơn giản, không rotation family)
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { roles: { include: { role: true } } },
    });
    const roles = user?.roles.map(r => r.role.name) ?? [];

    const accessToken = await this.tokens.signAccess({ sub: payload.sub, sid: payload.sid, roles });
    const newRefresh = await this.tokens.signRefresh({ sub: payload.sub, sid: payload.sid });
    const { exp } = (await this.tokens.verifyRefresh(newRefresh)) as any;

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { token: oldRefreshToken },
        data: { revokedAt: new Date() },
      }),
      this.prisma.refreshToken.create({
        data: {
          id: crypto.randomUUID(),
          userId: payload.sub,
          token: newRefresh,
          expiresAt: new Date(exp * 1000),
        },
      }),
    ]);

    return { accessToken, refreshToken: newRefresh };
  }

  async logout(userId: string, sessionId: string) {
    // Session: có id, userId, revokedAt
    await this.prisma.$transaction([
      this.prisma.session.updateMany({
        where: { id: sessionId, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      // RefreshToken schema không có sessionId → revoke theo userId + token còn sống cùng sid (nếu muốn ràng hơn, xoá theo userId thôi)
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }
}

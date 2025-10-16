import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HashService } from './hash.service';
import { TokensService } from './tokens.service';
import { add } from 'date-fns';
import * as crypto from 'crypto';

function nowPlus(dur: string | number) {
  // dur: '15m' | '30d' -> chỉ dùng cho refresh/session
  if (typeof dur === 'number') return new Date(Date.now() + dur);
  const m = /(\d+)([smhd])/i.exec(dur)!;
  const n = parseInt(m[1],10), u = m[2].toLowerCase();
  if (u==='s') return add(new Date(), { seconds:n });
  if (u==='m') return add(new Date(), { minutes:n });
  if (u==='h') return add(new Date(), { hours:n });
  if (u==='d') return add(new Date(), { days:n });
  return add(new Date(), { days:30 });
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private hash: HashService,
    private tokens: TokensService,
  ) {}

  async register(email: string, password: string, displayName?: string) {
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new BadRequestException('Email already registered');

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await this.hash.hash(password),
        status: 'PENDING',
        profile: { create: { displayName } },
        roles: { create: { role: { connect: { name: 'LEARNER' } } } },
      },
      include: { profile: true, roles: { include: { role:true } } },
    });

    // TODO: gửi email verify (Phase 3)
    return { id: user.id, email: user.email };
  }

  async login(email: string, password: string, deviceInfo?: string, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { email }, include: { roles:{include:{role:true}} }});
    if (!user) throw new ForbiddenException('Invalid credentials');
    if (user.status === 'BANNED') throw new ForbiddenException('User banned');

    const ok = await this.hash.verify(user.passwordHash, password);
    if (!ok) throw new ForbiddenException('Invalid credentials');

    // tạo session
    const accessExp = process.env.JWT_ACCESS_EXPIRES || '15m';
    const refreshExp = process.env.JWT_REFRESH_EXPIRES || '30d';
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        deviceInfo,
        ipAddress: ip,
        issuedAt: new Date(),
        expiresAt: nowPlus(refreshExp), // cho phép refresh trong vòng tuổi của refresh token
      },
    });

    // refresh token opaque (jwt cũng được) -> ở đây dùng JWT rồi hash để lưu
    const payload = { sub: user.id, sid: session.id, roles: user.roles.map(r=>r.role.name) };
    const accessToken = await this.tokens.signAccess(payload);
    const refreshToken = await this.tokens.signRefresh({ sub: user.id, sid: session.id, fam: crypto.randomUUID() });

    const { exp } = (await this.tokens.verifyRefresh(refreshToken)) as any;
    const tokenHash = await this.hash.hash(refreshToken);
    const familyId = (await this.tokens.verifyRefresh(refreshToken) as any).fam;

    await this.prisma.refreshToken.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        sessionId: session.id,
        tokenHash,
        familyId,
        issuedAt: new Date(),
        expiresAt: new Date(exp * 1000),
      },
    });

    return { accessToken, refreshToken, user: { id: user.id, email: user.email, roles: payload.roles } };
  }

  async refresh(oldRefreshToken: string) {
    // tìm token khớp bằng cách verify rồi check hash
    let payload: any;
    try { payload = await this.tokens.verifyRefresh(oldRefreshToken); }
    catch { throw new ForbiddenException('Invalid refresh token'); }

    const tokenRows = await this.prisma.refreshToken.findMany({
      where: { userId: payload.sub, sessionId: payload.sid, revokedAt: null },
      orderBy: { issuedAt: 'desc' },
      take: 5,
    });

    // check reuse: token không tồn tại trong DB (bị lộ/đã dùng) => revoke cả family
    let found = null as null | typeof tokenRows[number];
    for (const row of tokenRows) {
      if (await this.hash.verify(row.tokenHash, oldRefreshToken)) { found = row; break; }
    }
    if (!found) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: payload.fam, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new ForbiddenException('Token reuse detected');
    }
    if (found.expiresAt < new Date()) throw new ForbiddenException('Refresh token expired');

    // rotate: revoke cũ, phát cặp mới
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, include: { roles:{include:{role:true}} }});
    const roles = user?.roles.map(r=>r.role.name) ?? [];

    const accessToken = await this.tokens.signAccess({ sub: payload.sub, sid: payload.sid, roles });
    const newRefresh = await this.tokens.signRefresh({ sub: payload.sub, sid: payload.sid, fam: found.familyId });
    const { exp } = (await this.tokens.verifyRefresh(newRefresh)) as any;

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({ where: { id: found.id }, data: { revokedAt: new Date(), replacedBy: 'rotated' }}),
      this.prisma.refreshToken.create({
        data: {
          id: crypto.randomUUID(),
          userId: payload.sub,
          sessionId: payload.sid,
          tokenHash: await this.hash.hash(newRefresh),
          familyId: found.familyId,
          issuedAt: new Date(),
          expiresAt: new Date(exp * 1000),
        }
      })
    ]);

    return { accessToken, refreshToken: newRefresh };
  }

  async logout(userId: string, sessionId: string) {
    await this.prisma.$transaction([
      this.prisma.session.updateMany({
        where: { id: sessionId, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }
}

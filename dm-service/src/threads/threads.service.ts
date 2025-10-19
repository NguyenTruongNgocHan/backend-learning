import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ThreadsService {
  constructor(private prisma: PrismaService) {}

  private buildThreadKey(a: string, b: string) {
    return a < b ? `${a}_${b}` : `${b}_${a}`;
  }

  async createOrGetOneToOne(meId: string, peerId: string) {
    if (meId === peerId) throw new BadRequestException('Cannot DM yourself');
    const threadKey = this.buildThreadKey(meId, peerId);

    // tìm thread 1-1 có sẵn
    let thread = await this.prisma.dMThread.findUnique({ where: { threadKey } });

    if (!thread) {
      // tạo mới trong transaction
      thread = await this.prisma.$transaction(async (tx) => {
        const created = await tx.dMThread.create({
          data: { kind: 'ONE_TO_ONE', threadKey },
        });
        await tx.dMParticipant.createMany({
          data: [
            { threadId: created.id, userId: meId },
            { threadId: created.id, userId: peerId },
          ],
        });
        return created;
      });
    } else {
      // đảm bảo me đã là participant (phòng trường hợp lệch data)
      const count = await this.prisma.dMParticipant.count({
        where: { threadId: thread.id, userId: meId },
      });
      if (count === 0) throw new ForbiddenException('Not a participant of this thread');
    }

    // trả chi tiết cơ bản + participants
    const [participants, lastMessage] = await Promise.all([
      this.prisma.dMParticipant.findMany({
        where: { threadId: thread.id },
        select: { userId: true, lastReadId: true, mutedUntil: true },
      }),
      this.prisma.dMMessage.findFirst({
        where: { threadId: thread.id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, senderId: true, content: true, kind: true, createdAt: true },
      }),
    ]);

    return { thread, participants, lastMessage };
  }
}

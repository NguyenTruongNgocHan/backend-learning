import { Module } from '@nestjs/common';
import { ThreadsService } from './threads.service';
import { ThreadsController } from './threads.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ThreadsController],
  providers: [ThreadsService, PrismaService],
})
export class ThreadsModule {}

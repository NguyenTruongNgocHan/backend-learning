import { Body, Controller, Post, UseGuards, Req } from '@nestjs/common';
import { ThreadsService } from './threads.service';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { CreateOneToOneDto } from './dto/create-one-to-one.dto';
import type { Request } from 'express';

@Controller('threads')
@UseGuards(JwtAuthGuard)
export class ThreadsController {
  constructor(private readonly threads: ThreadsService) {}

  @Post('one-to-one')
  async createOneToOne(@Body() dto: CreateOneToOneDto, @Req() req: Request) {
    const meId = (req as any).user.id as string;
    return this.threads.createOrGetOneToOne(meId, dto.peerId);
  }
}

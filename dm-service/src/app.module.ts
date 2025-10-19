import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThreadsModule } from './threads/threads.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThreadsModule,
  ],
})
export class AppModule {}

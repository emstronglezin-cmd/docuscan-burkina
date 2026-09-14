import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SaspayService } from './saspay.service';

@Module({
  imports: [ConfigModule],
  providers: [SaspayService],
  exports: [SaspayService],
})
export class SaspayModule {}

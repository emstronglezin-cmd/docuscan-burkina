import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditPack } from './entities/credit-pack.entity';
import { CreditPacksService } from './credit-packs.service';
import { CreditPacksController, AdminCreditPacksController } from './credit-packs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CreditPack])],
  controllers: [CreditPacksController, AdminCreditPacksController],
  providers: [CreditPacksService],
  exports: [CreditPacksService],
})
export class CreditPacksModule {}

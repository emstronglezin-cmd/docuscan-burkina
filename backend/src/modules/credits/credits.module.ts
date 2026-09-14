import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { CreditTransaction } from './entities/credit-transaction.entity';
import { CreditsService } from './credits.service';
import { CreditsController } from './credits.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, CreditTransaction])],
  controllers: [CreditsController],
  providers: [CreditsService],
  exports: [CreditsService],
})
export class CreditsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SaspayPayment } from './entities/saspay-payment.entity';
import { User } from '../users/entities/user.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController, SaspayWebhookController } from './payments.controller';
import { UsersRepositoryLite } from './users-repository-lite';
import { SaspayModule } from '../saspay/saspay.module';
import { CreditPacksModule } from '../credit-packs/credit-packs.module';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SaspayPayment, User]),
    SaspayModule,
    CreditPacksModule,
    CreditsModule,
  ],
  controllers: [PaymentsController, SaspayWebhookController],
  providers: [PaymentsService, UsersRepositoryLite],
})
export class PaymentsModule {}

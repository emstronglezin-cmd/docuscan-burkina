import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { CreditTransaction } from '../credits/entities/credit-transaction.entity';
import { SaspayPayment } from '../payments/entities/saspay-payment.entity';
import { DocumentExportLog } from '../documents/entities/document-log.entity';
import { AdminAuditLog } from './entities/admin-audit-log.entity';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, CreditTransaction, SaspayPayment, DocumentExportLog, AdminAuditLog]),
    CreditsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

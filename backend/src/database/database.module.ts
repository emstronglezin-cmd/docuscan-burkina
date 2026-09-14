import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../modules/users/entities/user.entity';
import { CreditTransaction } from '../modules/credits/entities/credit-transaction.entity';
import { CreditPack } from '../modules/credit-packs/entities/credit-pack.entity';
import { SaspayPayment } from '../modules/payments/entities/saspay-payment.entity';
import { DocumentExportLog } from '../modules/documents/entities/document-log.entity';
import { AdminAuditLog } from '../modules/admin/entities/admin-audit-log.entity';
import { AppConfig } from '../config/configuration';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const db = config.get<AppConfig['database']>('database')!;
        return {
          type: 'postgres' as const,
          host: db.host,
          port: db.port,
          username: db.username,
          password: db.password,
          database: db.name,
          ssl: db.ssl ? { rejectUnauthorized: false } : false,
          entities: [User, CreditTransaction, CreditPack, SaspayPayment, DocumentExportLog, AdminAuditLog],
          synchronize: db.synchronize,
          migrationsRun: false,
          logging: process.env.DB_LOGGING === 'true',
        };
      },
    }),
  ],
})
export class DatabaseModule {}

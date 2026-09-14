import 'dotenv/config';
import { DataSource } from 'typeorm';
import { User } from '../modules/users/entities/user.entity';
import { CreditTransaction } from '../modules/credits/entities/credit-transaction.entity';
import { CreditPack } from '../modules/credit-packs/entities/credit-pack.entity';
import { SaspayPayment } from '../modules/payments/entities/saspay-payment.entity';
import { DocumentExportLog } from '../modules/documents/entities/document-log.entity';
import { AdminAuditLog } from '../modules/admin/entities/admin-audit-log.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'docuscan',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: [User, CreditTransaction, CreditPack, SaspayPayment, DocumentExportLog, AdminAuditLog],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
});

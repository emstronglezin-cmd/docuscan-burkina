import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1000000000000 implements MigrationInterface {
  name = 'InitialSchema1000000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TYPE "user_role_enum" AS ENUM ('USER', 'ADMIN', 'SUPERADMIN')
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "passwordHash" character varying NOT NULL,
        "fullName" character varying,
        "phone" character varying,
        "role" "user_role_enum" NOT NULL DEFAULT 'USER',
        "creditBalance" integer NOT NULL DEFAULT 0,
        "isActive" boolean NOT NULL DEFAULT true,
        "refreshTokenHash" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_users_email" ON "users" ("email")`);

    await queryRunner.query(`
      CREATE TYPE "credit_transaction_type_enum" AS ENUM ('PURCHASE', 'SCAN', 'REFUND', 'ADMIN_ADJUSTMENT')
    `);

    await queryRunner.query(`
      CREATE TABLE "credit_transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "type" "credit_transaction_type_enum" NOT NULL,
        "amount" integer NOT NULL,
        "balanceBefore" integer NOT NULL,
        "balanceAfter" integer NOT NULL,
        "reference" character varying NOT NULL,
        "paymentReference" character varying,
        "description" character varying,
        "adjustedByAdminId" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_credit_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_credit_transactions_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_credit_transactions_reference" ON "credit_transactions" ("reference")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_credit_transactions_userId" ON "credit_transactions" ("userId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "credit_packs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "credits" integer NOT NULL,
        "priceFcfa" integer NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "isPopular" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_credit_packs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "saspay_payment_status_enum" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED')
    `);
    await queryRunner.query(`
      CREATE TYPE "saspay_payment_method_enum" AS ENUM ('SOFTPAY', 'CHECKOUT')
    `);

    await queryRunner.query(`
      CREATE TABLE "saspay_payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "creditPackId" uuid,
        "creditsRequested" integer NOT NULL,
        "amountFcfa" integer NOT NULL,
        "method" "saspay_payment_method_enum" NOT NULL,
        "saspayReference" character varying,
        "checkoutUrl" character varying,
        "status" "saspay_payment_status_enum" NOT NULL DEFAULT 'PENDING',
        "network" character varying,
        "phone" character varying,
        "creditsApplied" boolean NOT NULL DEFAULT false,
        "rawResponse" jsonb,
        "lastWebhookPayload" jsonb,
        "idempotencyKey" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_saspay_payments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_saspay_payments_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_saspay_payments_pack" FOREIGN KEY ("creditPackId") REFERENCES "credit_packs"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_saspay_payments_reference" ON "saspay_payments" ("saspayReference") WHERE "saspayReference" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_saspay_payments_userId" ON "saspay_payments" ("userId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "document_export_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "fileName" character varying,
        "pageCount" integer NOT NULL,
        "fileSizeBytes" integer,
        "creditTransactionId" character varying NOT NULL,
        "platform" character varying NOT NULL DEFAULT 'mobile',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_document_export_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_document_export_logs_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_document_export_logs_userId" ON "document_export_logs" ("userId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "admin_audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "adminId" character varying NOT NULL,
        "adminEmail" character varying NOT NULL,
        "action" character varying NOT NULL,
        "targetUserId" character varying,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admin_audit_logs" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "document_export_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "saspay_payments"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "saspay_payment_method_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "saspay_payment_status_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "credit_packs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "credit_transactions"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "credit_transaction_type_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_role_enum"`);
  }
}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CreditsModule } from './modules/credits/credits.module';
import { CreditPacksModule } from './modules/credit-packs/credit-packs.module';
import { SaspayModule } from './modules/saspay/saspay.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { AdminModule } from './modules/admin/admin.module';
import { AppController } from './app.controller';
import { BootstrapService } from './bootstrap.service';
import { User } from './modules/users/entities/user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 100 }],
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    TypeOrmModule.forFeature([User]),
    AuthModule,
    UsersModule,
    CreditsModule,
    CreditPacksModule,
    SaspayModule,
    PaymentsModule,
    DocumentsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    BootstrapService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}

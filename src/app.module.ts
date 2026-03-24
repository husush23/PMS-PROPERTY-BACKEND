import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompanyModule } from './modules/company/company.module';
import { AdminModule } from './modules/admin/admin.module';
import { PropertyModule } from './modules/property/property.module';
import { UnitModule } from './modules/unit/unit.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { LeaseModule } from './modules/lease/lease.module';
import { PaymentModule } from './modules/payment/payment.module';
import { PaymentMethodsModule } from './modules/payment-method/payment-methods.module';
import { ExpenseModule } from './modules/expense/expense.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { ReportsModule } from './modules/reports/reports.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ContactModule } from './modules/contact/contact.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { PlanModule } from './modules/plan/plan.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { SubscriptionPaymentModule } from './modules/subscription-payment/subscription-payment.module';
import { UtilityModule } from './modules/utility/utility.module';
import appConfig from './config/app.config';
import dbConfig from './config/db.config';
import jwtConfig from './config/jwt.config';
import mailConfig from './config/mail.config';
import cacheConfig from './config/cache.config';

import { APP_GUARD } from '@nestjs/core';
import { SubscriptionGuard } from './modules/subscription/guards/subscription.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, dbConfig, jwtConfig, mailConfig, cacheConfig],
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 10,
    }]),
    ScheduleModule.forRoot(), // Enable cron jobs for scheduled tasks
    DatabaseModule,
    AuthModule,
    CompanyModule,
    AdminModule,
    PropertyModule,
    UnitModule,
    TenantModule,
    LeaseModule,
    PaymentModule,
    PaymentMethodsModule,
    ExpenseModule,
    AccountingModule,
    ReportsModule,
    DashboardModule,
    ContactModule,
    PlanModule,
    SubscriptionModule,
    SubscriptionPaymentModule,
    UtilityModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: SubscriptionGuard,
    },
  ],
})
export class AppModule { }

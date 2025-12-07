import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { PropertyModule } from './modules/property/property.module';
import { UnitModule } from './modules/unit/unit.module';
import { LeaseModule } from './modules/lease/lease.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { PaymentModule } from './modules/payment/payment.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { DocumentModule } from './modules/document/document.module';
import { NotificationModule } from './modules/notification/notification.module';

@Module({
  imports: [
    AuthModule,
    UserModule,
    PropertyModule,
    UnitModule,
    LeaseModule,
    TenantModule,
    PaymentModule,
    MaintenanceModule,
    DocumentModule,
    NotificationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantController } from './tenant.controller';
import { TenantDashboardController } from './tenant-dashboard.controller';
import { TenantService } from './tenant.service';
import { TenantDashboardService } from './tenant-dashboard.service';
import { TenantProfile } from './entities/tenant-profile.entity';
import { TenantInvitation } from './entities/tenant-invitation.entity';
import { User } from '../user/entities/user.entity';
import { Company } from '../company/entities/company.entity';
import { UserCompany } from '../company/entities/user-company.entity';
import { Lease } from '../lease/entities/lease.entity';
import { Unit } from '../unit/entities/unit.entity';
import { Property } from '../property/entities/property.entity';
import { RentCycle } from '../rent-cycle/entities/rent-cycle.entity';
import { Payment } from '../payment/entities/payment.entity';
import { UserModule } from '../user/user.module';
import { CompanyModule } from '../company/company.module';
import { NotificationModule } from '../notification/notification.module';
import { RentCycleModule } from '../rent-cycle/rent-cycle.module';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TenantProfile,
      TenantInvitation,
      User,
      Company,
      UserCompany,
      Lease,
      Unit,
      Property,
      RentCycle,
      Payment,
    ]),
    forwardRef(() => UserModule),
    forwardRef(() => CompanyModule),
    NotificationModule,
    RentCycleModule,
    AccountingModule,
  ],
  controllers: [TenantController, TenantDashboardController],
  providers: [TenantService, TenantDashboardService],
  exports: [TenantService],
})
export class TenantModule {}

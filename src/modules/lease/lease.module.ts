import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaseController } from './lease.controller';
import { LeaseService } from './lease.service';
import { LeaseSchedulerService } from './lease-scheduler.service';
import { Lease } from './entities/lease.entity';
import { Unit } from '../unit/entities/unit.entity';
import { Property } from '../property/entities/property.entity';
import { Company } from '../company/entities/company.entity';
import { User } from '../user/entities/user.entity';
import { TenantProfile } from '../tenant/entities/tenant-profile.entity';
import { UserCompany } from '../company/entities/user-company.entity';
import { Payment } from '../payment/entities/payment.entity';
import { TenantModule } from '../tenant/tenant.module';
import { PaymentModule } from '../payment/payment.module';
import { RentCycleModule } from '../rent-cycle/rent-cycle.module';
import { CompanyModule } from '../company/company.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Lease,
      Unit,
      Property,
      Company,
      User,
      TenantProfile,
      UserCompany,
      Payment,
    ]),
    forwardRef(() => TenantModule),
    forwardRef(() => PaymentModule),
    forwardRef(() => RentCycleModule),
    CompanyModule,
  ],
  controllers: [LeaseController],
  providers: [LeaseService, LeaseSchedulerService],
  exports: [LeaseService, LeaseSchedulerService],
})
export class LeaseModule {}

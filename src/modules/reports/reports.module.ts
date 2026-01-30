import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { RentCycle } from '../rent-cycle/entities/rent-cycle.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Lease } from '../lease/entities/lease.entity';
import { Unit } from '../unit/entities/unit.entity';
import { Property } from '../property/entities/property.entity';
import { User } from '../user/entities/user.entity';
import { TenantProfile } from '../tenant/entities/tenant-profile.entity';
import { AccountingEntry } from '../accounting/entities/accounting-entry.entity';
import { CompanyModule } from '../company/company.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RentCycle,
      Payment,
      Lease,
      Unit,
      Property,
      User,
      TenantProfile,
      AccountingEntry,
    ]),
    CompanyModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}

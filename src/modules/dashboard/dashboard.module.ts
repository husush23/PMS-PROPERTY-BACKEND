import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Payment } from '../payment/entities/payment.entity';
import { Lease } from '../lease/entities/lease.entity';
import { User } from '../user/entities/user.entity';
import { Unit } from '../unit/entities/unit.entity';
import { ReportsModule } from '../reports/reports.module';
import { CompanyModule } from '../company/company.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Lease, User, Unit]),
    ReportsModule,
    CompanyModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}

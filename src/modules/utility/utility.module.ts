import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UtilityService } from './utility.service';
import { UtilityController } from './utility.controller';
import { UtilityMeter } from './entities/utility-meter.entity';
import { UtilityReading } from './entities/utility-reading.entity';
import { Unit } from '../unit/entities/unit.entity';
import { Property } from '../property/entities/property.entity';
import { RentCycle } from '../rent-cycle/entities/rent-cycle.entity';
import { RentCycleLineItem } from '../rent-cycle/entities/rent-cycle-line-item.entity';
import { Lease } from '../lease/entities/lease.entity';
import { Payment } from '../payment/entities/payment.entity';
import { User } from '../user/entities/user.entity';
import { UserCompany } from '../company/entities/user-company.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UtilityMeter,
      UtilityReading,
      Unit,
      Property,
      RentCycle,
      RentCycleLineItem,
      Lease,
      Payment,
      User,
      UserCompany,
    ]),
  ],
  controllers: [UtilityController],
  providers: [UtilityService],
  exports: [UtilityService],
})
export class UtilityModule {}

import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RentCycleController } from './rent-cycle.controller';
import { RentCycleService } from './rent-cycle.service';
import { RentCycleGenerationService } from './rent-cycle-generation.service';
import { RentCycle } from './entities/rent-cycle.entity';
import { RentCycleLineItem } from './entities/rent-cycle-line-item.entity';
import { Lease } from '../lease/entities/lease.entity';
import { Payment } from '../payment/entities/payment.entity';
import { UserCompany } from '../company/entities/user-company.entity';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RentCycle,
      RentCycleLineItem,
      Lease,
      Payment,
      UserCompany,
      User,
    ]),
  ],
  controllers: [RentCycleController],
  providers: [RentCycleService, RentCycleGenerationService],
  exports: [RentCycleService, RentCycleGenerationService],
})
export class RentCycleModule {}


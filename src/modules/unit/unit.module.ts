import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UnitController } from './unit.controller';
import { UnitService } from './unit.service';
import { Unit } from './entities/unit.entity';
import { Property } from '../property/entities/property.entity';
import { Company } from '../company/entities/company.entity';
import { UserCompany } from '../company/entities/user-company.entity';
import { User } from '../user/entities/user.entity';
import { Lease } from '../lease/entities/lease.entity';
import { RentCycle } from '../rent-cycle/entities/rent-cycle.entity';
import { Payment } from '../payment/entities/payment.entity';
import { CompanyModule } from '../company/company.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Unit,
      Property,
      Company,
      UserCompany,
      User,
      Lease,
      RentCycle,
      Payment,
    ]),
    CompanyModule,
  ],
  controllers: [UnitController],
  providers: [UnitService],
  exports: [UnitService],
})
export class UnitModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertyController } from './property.controller';
import { PropertyService } from './property.service';
import { Property } from './entities/property.entity';
import { Company } from '../company/entities/company.entity';
import { UserCompany } from '../company/entities/user-company.entity';
import { User } from '../user/entities/user.entity';
import { Unit } from '../unit/entities/unit.entity';
import { Lease } from '../lease/entities/lease.entity';
import { RentCycle } from '../rent-cycle/entities/rent-cycle.entity';
import { Payment } from '../payment/entities/payment.entity';
import { UnitModule } from '../unit/unit.module';
import { CompanyModule } from '../company/company.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Property,
      Company,
      UserCompany,
      User,
      Unit,
      Lease,
      RentCycle,
      Payment,
    ]),
    UnitModule,
    CompanyModule,
  ],
  controllers: [PropertyController],
  providers: [PropertyService],
  exports: [PropertyService],
})
export class PropertyModule {}

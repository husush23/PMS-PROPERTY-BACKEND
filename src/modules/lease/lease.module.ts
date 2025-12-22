import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaseController } from './lease.controller';
import { LeaseService } from './lease.service';
import { Lease } from './entities/lease.entity';
import { Unit } from '../unit/entities/unit.entity';
import { Property } from '../property/entities/property.entity';
import { Company } from '../company/entities/company.entity';
import { User } from '../user/entities/user.entity';
import { TenantProfile } from '../tenant/entities/tenant-profile.entity';
import { UserCompany } from '../company/entities/user-company.entity';
import { TenantModule } from '../tenant/tenant.module';

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
    ]),
    forwardRef(() => TenantModule),
  ],
  controllers: [LeaseController],
  providers: [LeaseService],
  exports: [LeaseService],
})
export class LeaseModule {}

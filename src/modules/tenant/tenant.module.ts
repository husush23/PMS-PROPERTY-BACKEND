import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { TenantProfile } from './entities/tenant-profile.entity';
import { TenantInvitation } from './entities/tenant-invitation.entity';
import { User } from '../user/entities/user.entity';
import { Company } from '../company/entities/company.entity';
import { UserCompany } from '../company/entities/user-company.entity';
import { UserModule } from '../user/user.module';
import { CompanyModule } from '../company/company.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TenantProfile,
      TenantInvitation,
      User,
      Company,
      UserCompany,
    ]),
    forwardRef(() => UserModule),
    forwardRef(() => CompanyModule),
    NotificationModule,
  ],
  controllers: [TenantController],
  providers: [TenantService],
  exports: [TenantService],
})
export class TenantModule {}

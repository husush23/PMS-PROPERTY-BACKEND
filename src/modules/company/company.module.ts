import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyController } from './company.controller';
import { CompanySettingsController } from './company-settings.controller';
import { CompanySettingsAliasController } from './company-settings-alias.controller';
import { SettingsBootstrapController } from './settings-bootstrap.controller';
import { CompanyService } from './company.service';
import { CompanySettingsService } from './company-settings.service';
import { CompanySettingsResolver } from './company-settings-resolver.service';
import { Company } from './entities/company.entity';
import { CompanySettings } from './entities/company-settings.entity';
import { UserCompany } from './entities/user-company.entity';
import { CompanyInvitation } from './entities/company-invitation.entity';
import { User } from '../user/entities/user.entity';
import { NotificationModule } from '../notification/notification.module';
import { PaymentMethodsModule } from '../payment-method/payment-methods.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Company,
      CompanySettings,
      UserCompany,
      CompanyInvitation,
      User,
    ]),
    forwardRef(() => NotificationModule),
    PaymentMethodsModule,
  ],
  controllers: [
    CompanyController,
    CompanySettingsController,
    CompanySettingsAliasController,
    SettingsBootstrapController,
  ],
  providers: [CompanyService, CompanySettingsService, CompanySettingsResolver],
  exports: [CompanyService, CompanySettingsService, CompanySettingsResolver],
})
export class CompanyModule {}

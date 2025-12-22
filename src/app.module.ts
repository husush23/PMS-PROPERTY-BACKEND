import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { SampleModule } from './modules/sample/sample.module';
import { CompanyModule } from './modules/company/company.module';
import { AdminModule } from './modules/admin/admin.module';
import { PropertyModule } from './modules/property/property.module';
import { UnitModule } from './modules/unit/unit.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { LeaseModule } from './modules/lease/lease.module';
import appConfig from './config/app.config';
import dbConfig from './config/db.config';
import jwtConfig from './config/jwt.config';
import mailConfig from './config/mail.config';
import cacheConfig from './config/cache.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, dbConfig, jwtConfig, mailConfig, cacheConfig],
    }),
    DatabaseModule,
    AuthModule,
    CompanyModule,
    AdminModule,
    PropertyModule,
    UnitModule,
    TenantModule,
    LeaseModule,
    SampleModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

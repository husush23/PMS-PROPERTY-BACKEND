import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertyController } from './property.controller';
import { PropertyService } from './property.service';
import { Property } from './entities/property.entity';
import { Company } from '../company/entities/company.entity';
import { UserCompany } from '../company/entities/user-company.entity';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Property, Company, UserCompany, User]),
  ],
  controllers: [PropertyController],
  providers: [PropertyService],
  exports: [PropertyService],
})
export class PropertyModule {}









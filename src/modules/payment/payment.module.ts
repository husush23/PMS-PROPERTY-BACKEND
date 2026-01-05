import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { RentGenerationService } from './rent-generation.service';
import { OverdueHandlerService } from './overdue-handler.service';
import { PaymentSchedulerService } from './payment-scheduler.service';
import { Payment } from './entities/payment.entity';
import { Lease } from '../lease/entities/lease.entity';
import { User } from '../user/entities/user.entity';
import { Company } from '../company/entities/company.entity';
import { UserCompany } from '../company/entities/user-company.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Lease, User, Company, UserCompany]),
  ],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    RentGenerationService,
    OverdueHandlerService,
    PaymentSchedulerService,
  ],
  exports: [
    PaymentService,
    RentGenerationService,
    OverdueHandlerService,
    PaymentSchedulerService,
  ],
})
export class PaymentModule {}

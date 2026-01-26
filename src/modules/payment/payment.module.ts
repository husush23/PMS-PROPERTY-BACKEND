import { Module, forwardRef } from '@nestjs/common';
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
import { RentCycleModule } from '../rent-cycle/rent-cycle.module';
import { RentCycle } from '../rent-cycle/entities/rent-cycle.entity';
import { PaymentMethodEntity } from '../payment-method/entities/payment-method.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Payment,
      Lease,
      User,
      Company,
      UserCompany,
      RentCycle,
      PaymentMethodEntity,
    ]),
    forwardRef(() => RentCycleModule),
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

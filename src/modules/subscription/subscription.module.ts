import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { CompanySubscriptionController } from './company-subscription.controller';
import { Subscription } from './entities/subscription.entity';
import { Plan } from '../plan/entities/plan.entity';
import { Company } from '../company/entities/company.entity';
import { SubscriptionPayment } from '../subscription-payment/entities/subscription-payment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, Plan, Company, SubscriptionPayment])
  ],
  controllers: [SubscriptionController, CompanySubscriptionController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule { }

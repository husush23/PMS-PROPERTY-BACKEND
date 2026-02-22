import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionPaymentService } from './subscription-payment.service';
import { SubscriptionPayment } from './entities/subscription-payment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SubscriptionPayment])],
  providers: [SubscriptionPaymentService],
  exports: [SubscriptionPaymentService],
})
export class SubscriptionPaymentModule { }

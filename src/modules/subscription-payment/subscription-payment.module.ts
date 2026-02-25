import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionPaymentService } from './subscription-payment.service';
import { SubscriptionPayment } from './entities/subscription-payment.entity';
import { SubscriptionPaymentController } from './subscription-payment.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SubscriptionPayment])],
  controllers: [SubscriptionPaymentController],
  providers: [SubscriptionPaymentService],
  exports: [SubscriptionPaymentService],
})
export class SubscriptionPaymentModule { }

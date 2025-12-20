import { Controller } from '@nestjs/common';
import { PaymentService } from './payment.service';

@Controller({ path: 'payments', version: '1' })
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}
}







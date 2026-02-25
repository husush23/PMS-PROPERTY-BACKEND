import { Controller, Get, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { SubscriptionPaymentService } from './subscription-payment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Subscription Payments')
@Controller('subscription-payments')
@UseGuards(JwtAuthGuard)
export class SubscriptionPaymentController {
    constructor(private readonly subscriptionPaymentService: SubscriptionPaymentService) { }

    @Get('my-company')
    @ApiOperation({ summary: 'Get subscription payment history for the current company' })
    @ApiResponse({ status: 200, description: 'Return payment history' })
    async getMyCompanyPayments(@Request() req: any) {
        const companyId = req.user.companyId;
        if (!companyId) {
            throw new ForbiddenException('Please select a company to view payment history');
        }
        return this.subscriptionPaymentService.findByCompany(companyId);
    }
}

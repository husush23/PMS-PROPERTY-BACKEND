import { Controller, Get, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { SubscriptionPaymentService } from './subscription-payment.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { AuthUser } from '../../common/decorators/auth-user.decorator';

@ApiTags('Subscription Payments')
@Controller('subscription-payments')
@UseGuards(JwtAuthGuard)
export class SubscriptionPaymentController {
    constructor(private readonly subscriptionPaymentService: SubscriptionPaymentService) { }

    @Public()
    @Get('my-company')
    @ApiOperation({ summary: 'Get subscription payment history for the current company' })
    @ApiResponse({ status: 200, description: 'Return payment history' })
    async getMyCompanyPayments(@AuthUser() user: any) {
        const companyId = user.companyId;
        if (!companyId) {
            throw new ForbiddenException('Please select a company to view payment history');
        }
        return this.subscriptionPaymentService.findByCompany(companyId);
    }
}

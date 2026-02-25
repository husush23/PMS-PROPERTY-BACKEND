import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { PlanType } from './entities/subscription.entity';
import { AuthUser } from '../../common/decorators/auth-user.decorator';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class SubscriptionController {
    constructor(private readonly subscriptionService: SubscriptionService) { }

    @Post('record-payment')
    async recordPayment(@Body() data: {
        companyId: string;
        planType: PlanType;
        amount: number;
        referenceNumber?: string;
        proofImageUrl?: string;
    }, @AuthUser() user: any) {
        const result = await this.subscriptionService.recordSubscriptionPayment({
            ...data,
            recordedBy: user.id
        });
        return {
            success: true,
            data: result
        };
    }

    @Get()
    async findAll() {
        const result = await this.subscriptionService.findAll();
        return {
            success: true,
            data: result
        };
    }
}

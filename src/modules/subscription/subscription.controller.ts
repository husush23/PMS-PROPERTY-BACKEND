import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { AssignSubscriptionDto } from './dto/assign-subscription.dto';
import { AddDaysDto } from './dto/add-days.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class SubscriptionController {
    constructor(private readonly subscriptionService: SubscriptionService) { }

    @Post('assign')
    assign(@Body() assignSubscriptionDto: AssignSubscriptionDto) {
        return this.subscriptionService.assignSubscription(
            assignSubscriptionDto.companyId,
            assignSubscriptionDto.planId,
            assignSubscriptionDto.billingCycle,
            assignSubscriptionDto.startDate,
            assignSubscriptionDto.endDate,
            assignSubscriptionDto.status,
        );
    }

    @Post(':id/add-days')
    addDays(@Param('id') id: string, @Body() addDaysDto: AddDaysDto) {
        return this.subscriptionService.addManualDays(id, addDaysDto.days);
    }

    @Post(':id/cancel')
    cancel(@Param('id') id: string) {
        return this.subscriptionService.cancelSubscription(id);
    }

    @Get()
    findAll() {
        return this.subscriptionService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.subscriptionService.findOne(id);
    }
}

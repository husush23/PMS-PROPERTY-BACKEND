import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionService } from '../subscription.service';

@Injectable()
export class SubscriptionGuard implements CanActivate {
    constructor(
        private readonly subscriptionService: SubscriptionService,
        private readonly reflector: Reflector
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        // Super admin bypasses
        if (user?.isSuperAdmin) {
            return true;
        }

        // If no company context (e.g. user creating company), allow?
        // Usually routes that need subscription are under /company or require company context
        if (!user?.companyId) {
            return true;
        }

        const hasActiveSubscription = await this.subscriptionService.checkSubscriptionStatus(user.companyId);
        if (!hasActiveSubscription) {
            throw new ForbiddenException('Company subscription is expired or inactive.');
        }

        return true;
    }
}

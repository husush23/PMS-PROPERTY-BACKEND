import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionService } from '../subscription.service';
import { SubscriptionStatus } from '../entities/subscription.entity';
import { SKIP_SUBSCRIPTION_KEY } from '../../../common/decorators/skip-subscription.decorator';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';

@Injectable()
export class SubscriptionGuard implements CanActivate {
    constructor(
        private readonly subscriptionService: SubscriptionService,
        private readonly reflector: Reflector
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        // Bypass if marked with @SkipSubscription or @Public
        const skipSubscription = this.reflector.getAllAndOverride<boolean>(SKIP_SUBSCRIPTION_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (skipSubscription || isPublic) {
            return true;
        }

        // Super admin bypasses
        if (user?.isSuperAdmin) {
            return true;
        }

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

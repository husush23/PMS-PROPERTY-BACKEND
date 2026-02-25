import { Controller, Get, Param, ParseUUIDPipe, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { UserRole } from '../../shared/enums/user-role.enum';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('companies')
@Controller({ path: 'companies', version: '1' })
export class CompanySubscriptionController {
    constructor(private readonly subscriptionService: SubscriptionService) { }

    @Public()
    @Get(':companyId/subscription')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Get company subscription details (Company Admin or Super Admin only)' })
    @ApiParam({ name: 'companyId', type: 'string', format: 'uuid' })
    @ApiResponse({ status: 200, description: 'Subscription details retrieved successfully' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    @ApiResponse({ status: 404, description: 'Subscription not found' })
    async getCompanySubscription(
        @Param('companyId', ParseUUIDPipe) companyId: string,
        @AuthUser() user: { id: string, companyId?: string, role?: string, isSuperAdmin?: boolean }
    ) {
        // Access check: Super Admin or Company Admin of the specific company
        const isSuperAdmin = user.isSuperAdmin;
        const isOwnCompanyAdmin = user.companyId === companyId && user.role === UserRole.COMPANY_ADMIN;

        if (!isSuperAdmin && !isOwnCompanyAdmin) {
            throw new ForbiddenException('Only company administrators can view their subscription details.');
        }

        const subscription = await this.subscriptionService.getSubscriptionByCompanyId(companyId);
        return {
            success: true,
            data: subscription
        };
    }
}

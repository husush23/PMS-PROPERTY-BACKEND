import { Controller, Get, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TenantDashboardService } from './tenant-dashboard.service';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../shared/enums/user-role.enum';
import { TenantDashboardResponseDto } from './dto/tenant-dashboard.response.dto';

@ApiTags('tenant')
@Controller({ path: 'tenant', version: '1' })
export class TenantDashboardController {
  constructor(private readonly dashboardService: TenantDashboardService) {}

  @Get('dashboard')
  @Roles(UserRole.TENANT)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get tenant dashboard (current rent, balance, next rent, recent payments, lease summary)',
    description:
      'Returns all data needed for the tenant dashboard in one request. Requires tenant role. Fails with 404 when tenant has no active lease.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard data',
    type: TenantDashboardResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions (tenant role required)',
  })
  @ApiResponse({
    status: 404,
    description: 'No active lease found for this tenant',
  })
  async getDashboard(
    @AuthUser() user: { id: string },
  ): Promise<{ success: true; data: TenantDashboardResponseDto }> {
    const data = await this.dashboardService.getDashboard(user.id);
    return { success: true, data };
  }
}

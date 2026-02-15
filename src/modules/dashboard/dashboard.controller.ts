import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CompanyAccessGuard } from '../../common/guards/company-access.guard';
import { UserRole } from '../../shared/enums/user-role.enum';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { DashboardSummaryResponseDto } from './dto/dashboard-summary-response.dto';

@ApiTags('dashboard')
@Controller({ path: 'dashboard', version: '1' })
@UseGuards(CompanyAccessGuard, RolesGuard)
@Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER, UserRole.LANDLORD, UserRole.CASHIER)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) { }

  @Get('summary')
  @ApiCookieAuth('access_token')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get dashboard summary',
    description:
      'Returns all data needed for the main landlord/admin dashboard: stats cards (totalProperties, activeTenants, totalRevenue, growthRate), optional outstanding balance and occupancy, currency, and recent activity.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard summary retrieved successfully',
    type: DashboardSummaryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Company context is required. Select a company first.',
  })
  async getSummary(
    @Query() query: DashboardQueryDto,
    @AuthUser() user: { companyId?: string; isSuperAdmin?: boolean },
  ) {
    const companyId = user.companyId;
    if (!companyId) {
      throw new BadRequestException(
        'Company context is required for dashboard. Select a company first.',
      );
    }
    const data = await this.dashboardService.getSummary(companyId, query);
    return { success: true, data };
  }
}

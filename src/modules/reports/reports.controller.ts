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
} from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CompanyAccessGuard } from '../../common/guards/company-access.guard';
import { UserRole } from '../../shared/enums/user-role.enum';
import { FinancialReportQueryDto } from './dto/financial-query.dto';
import { OccupancyReportQueryDto } from './dto/occupancy-query.dto';
import { TenantsReportQueryDto } from './dto/tenants-query.dto';
import { PropertiesReportQueryDto } from './dto/properties-query.dto';
import { FinancialReportResponseDto } from './dto/financial-report-response.dto';
import { OccupancyReportResponseDto } from './dto/occupancy-report-response.dto';
import { TenantsReportResponseDto } from './dto/tenants-report-response.dto';
import { PropertiesReportResponseDto } from './dto/properties-report-response.dto';

@ApiTags('reports')
@Controller({ path: 'reports', version: '1' })
@UseGuards(CompanyAccessGuard, RolesGuard)
@Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  private getCompanyId(user: { companyId?: string; isSuperAdmin?: boolean }): string {
    if (user.companyId) return user.companyId;
    if (user.isSuperAdmin) {
      throw new BadRequestException(
        'Company context is required for reports. Select a company first.',
      );
    }
    throw new BadRequestException('Company context is required for reports.');
  }

  @Get('financial')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get financial report (invoiced, collected, outstanding, breakdowns)' })
  @ApiResponse({
    status: 200,
    description: 'Financial report retrieved successfully',
    type: FinancialReportResponseDto,
  })
  async getFinancialReport(
    @Query() query: FinancialReportQueryDto,
    @AuthUser() user: { companyId?: string; isSuperAdmin?: boolean },
  ) {
    const companyId = this.getCompanyId(user);
    const data = await this.reportsService.getFinancialReport(companyId, query);
    return { success: true, data };
  }

  @Get('occupancy')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get occupancy report (units, occupied, vacant, list)' })
  @ApiResponse({
    status: 200,
    description: 'Occupancy report retrieved successfully',
    type: OccupancyReportResponseDto,
  })
  async getOccupancyReport(
    @Query() query: OccupancyReportQueryDto,
    @AuthUser() user: { companyId?: string; isSuperAdmin?: boolean },
  ) {
    const companyId = this.getCompanyId(user);
    const data = await this.reportsService.getOccupancyReport(companyId, query);
    return { success: true, data };
  }

  @Get('tenants')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get tenant report (list with balances, summary)' })
  @ApiResponse({
    status: 200,
    description: 'Tenant report retrieved successfully',
    type: TenantsReportResponseDto,
  })
  async getTenantsReport(
    @Query() query: TenantsReportQueryDto,
    @AuthUser() user: { companyId?: string; isSuperAdmin?: boolean },
  ) {
    const companyId = this.getCompanyId(user);
    const data = await this.reportsService.getTenantsReport(companyId, query);
    return { success: true, data };
  }

  @Get('properties')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get property report (per-property metrics and summary)' })
  @ApiResponse({
    status: 200,
    description: 'Property report retrieved successfully',
    type: PropertiesReportResponseDto,
  })
  async getPropertiesReport(
    @Query() query: PropertiesReportQueryDto,
    @AuthUser() user: { companyId?: string; isSuperAdmin?: boolean },
  ) {
    const companyId = this.getCompanyId(user);
    const data = await this.reportsService.getPropertiesReport(companyId, query);
    return { success: true, data };
  }
}

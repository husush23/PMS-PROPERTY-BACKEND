import {
  Controller,
  Get,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { UserRole } from '../../shared/enums/user-role.enum';
import { AccountingService } from './accounting.service';
import { AccountingSummaryResponseDto } from './dto/accounting-summary-response.dto';

@ApiTags('accounting')
@Controller({ path: 'accounting', version: '1' })
@UseGuards(RolesGuard)
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) { }

  @Get('summary')
  @ApiCookieAuth('access_token')
  @Roles(
    UserRole.COMPANY_ADMIN,
    UserRole.MANAGER,
    UserRole.LANDLORD,
    UserRole.CASHIER,
  )
  @ApiOperation({ summary: 'Get accounting summary (read-only)' })
  @ApiQuery({
    name: 'companyId',
    type: 'string',
    format: 'uuid',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Accounting summary retrieved successfully',
    type: AccountingSummaryResponseDto,
  })
  async getSummary(
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @AuthUser() user: { id: string },
  ) {
    const summary = await this.accountingService.getSummary(
      companyId,
      user.id,
    );
    return {
      success: true,
      data: summary,
    };
  }
}

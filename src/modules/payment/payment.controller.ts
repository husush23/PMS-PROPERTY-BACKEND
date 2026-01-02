import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiCookieAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { ReversePaymentDto } from './dto/reverse-payment.dto';
import { UserRole } from '../../shared/enums/user-role.enum';

@ApiTags('payments')
@Controller({ path: 'payments', version: '1' })
@UseGuards(RolesGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCookieAuth('access_token')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER, UserRole.LANDLORD)
  @ApiOperation({
    summary: 'Create a new payment (COMPANY_ADMIN/MANAGER/LANDLORD only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment created successfully',
    type: PaymentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  async create(
    @Body() createPaymentDto: CreatePaymentDto,
    @AuthUser() user: { id: string },
  ) {
    const payment = await this.paymentService.create(createPaymentDto, user.id);
    return {
      success: true,
      data: payment,
      message: 'Payment created successfully',
    };
  }

  @Get()
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'List payments with filtering and pagination' })
  @ApiResponse({
    status: 200,
    description: 'Payments retrieved successfully',
  })
  async findAll(
    @Query() query: ListPaymentsQueryDto,
    @AuthUser() user: { id: string },
  ) {
    const result = await this.paymentService.findAll(query, user.id);
    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get('tenant/:tenantId/balance')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get tenant balance' })
  @ApiParam({ name: 'tenantId', type: 'string', format: 'uuid' })
  @ApiQuery({
    name: 'companyId',
    type: 'string',
    format: 'uuid',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Tenant balance retrieved successfully',
  })
  async getTenantBalance(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @AuthUser() user: { id: string },
  ) {
    const balance = await this.paymentService.getTenantBalance(
      tenantId,
      companyId,
      user.id,
    );
    return {
      success: true,
      data: balance,
    };
  }

  @Get('lease/:leaseId/balance')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get lease balance' })
  @ApiParam({ name: 'leaseId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Lease balance retrieved successfully',
  })
  async getLeaseBalance(
    @Param('leaseId', ParseUUIDPipe) leaseId: string,
    @AuthUser() user: { id: string },
  ) {
    const balance = await this.paymentService.getLeaseBalance(leaseId, user.id);
    return {
      success: true,
      data: balance,
    };
  }

  @Get('tenant/:tenantId/history')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get payment history for tenant' })
  @ApiParam({ name: 'tenantId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Payment history retrieved successfully',
  })
  async getTenantHistory(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @AuthUser() user: { id: string },
  ) {
    const history = await this.paymentService.getPaymentHistory(
      tenantId,
      undefined,
      user.id,
    );
    return {
      success: true,
      data: history,
    };
  }

  @Get('lease/:leaseId/history')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get payment history for lease' })
  @ApiParam({ name: 'leaseId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Payment history retrieved successfully',
  })
  async getLeaseHistory(
    @Param('leaseId', ParseUUIDPipe) leaseId: string,
    @AuthUser() user: { id: string },
  ) {
    const history = await this.paymentService.getPaymentHistory(
      undefined,
      leaseId,
      user.id,
    );
    return {
      success: true,
      data: history,
    };
  }

  @Get(':id')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get payment by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Payment retrieved successfully',
    type: PaymentResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Payment not found',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @AuthUser() user: { id: string },
  ) {
    const payment = await this.paymentService.findOne(id, user.id);
    return {
      success: true,
      data: payment,
    };
  }

  @Patch(':id')
  @ApiCookieAuth('access_token')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary:
      'Update payment (limited fields only) (COMPANY_ADMIN/MANAGER only)',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Payment updated successfully',
    type: PaymentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid update or validation failed',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Payment not found',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePaymentDto: UpdatePaymentDto,
    @AuthUser() user: { id: string },
  ) {
    const payment = await this.paymentService.update(
      id,
      updatePaymentDto,
      user.id,
    );
    return {
      success: true,
      data: payment,
      message: 'Payment updated successfully',
    };
  }

  @Post(':id/reverse')
  @ApiCookieAuth('access_token')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Reverse a payment (COMPANY_ADMIN/MANAGER only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Payment reversed successfully',
    type: PaymentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Payment cannot be reversed',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Payment not found',
  })
  async reverse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() reversePaymentDto: ReversePaymentDto,
    @AuthUser() user: { id: string },
  ) {
    const payment = await this.paymentService.reverse(
      id,
      reversePaymentDto,
      user.id,
    );
    return {
      success: true,
      data: payment,
      message: 'Payment reversed successfully',
    };
  }

  @Post(':id/mark-failed')
  @ApiCookieAuth('access_token')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Mark payment as failed (COMPANY_ADMIN/MANAGER only)',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Payment marked as failed successfully',
    type: PaymentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Payment cannot be marked as failed',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Payment not found',
  })
  async markAsFailed(
    @Param('id', ParseUUIDPipe) id: string,
    @AuthUser() user: { id: string },
  ) {
    const payment = await this.paymentService.markAsFailed(id, user.id);
    return {
      success: true,
      data: payment,
      message: 'Payment marked as failed successfully',
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('access_token')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Soft delete payment (COMPANY_ADMIN/MANAGER only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Payment deleted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Payment cannot be deleted',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Payment not found',
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @AuthUser() user: { id: string },
  ) {
    await this.paymentService.softDelete(id, user.id);
    return {
      success: true,
      message: 'Payment deleted successfully',
    };
  }
}

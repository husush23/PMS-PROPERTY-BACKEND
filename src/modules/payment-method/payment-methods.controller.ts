import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaymentMethodsService } from './payment-methods.service';
import { CompanyContext } from '../../common/decorators/company-context.decorator';
import { CompanyAccessGuard } from '../../common/guards/company-access.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../shared/enums/user-role.enum';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import { PaymentMethodResponseDto } from './dto/payment-method-response.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Payment } from '../payment/entities/payment.entity';
import { Repository } from 'typeorm';

@ApiTags('payment-methods')
@Controller({ path: 'payment-methods', version: '1' })
@UseGuards(CompanyAccessGuard)
export class PaymentMethodsController {
  constructor(
    private readonly paymentMethodsService: PaymentMethodsService,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
  ) {}

  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List payment methods (global + company)' })
  @ApiResponse({
    status: 200,
    description: 'Payment methods retrieved successfully',
    type: [PaymentMethodResponseDto],
  })
  async list(
    @CompanyContext() companyId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const methods = await this.paymentMethodsService.list(
      companyId,
      includeInactive === 'true',
    );
    return {
      success: true,
      data: methods,
    };
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  @Roles(UserRole.COMPANY_ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Create a company payment method (COMPANY_ADMIN only)' })
  @ApiResponse({
    status: 201,
    description: 'Payment method created successfully',
    type: PaymentMethodResponseDto,
  })
  async create(
    @CompanyContext() companyId: string,
    @Body() dto: CreatePaymentMethodDto,
  ) {
    const method = await this.paymentMethodsService.create(companyId, dto);
    return {
      success: true,
      data: method,
      message: 'Payment method created successfully',
    };
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @Roles(UserRole.COMPANY_ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Update a company payment method (COMPANY_ADMIN only)' })
  @ApiResponse({
    status: 200,
    description: 'Payment method updated successfully',
    type: PaymentMethodResponseDto,
  })
  async update(
    @CompanyContext() companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentMethodDto,
  ) {
    const method = await this.paymentMethodsService.update(companyId, id, dto);
    return {
      success: true,
      data: method,
      message: 'Payment method updated successfully',
    };
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @Roles(UserRole.COMPANY_ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Delete a company payment method (COMPANY_ADMIN only)' })
  @ApiResponse({
    status: 200,
    description: 'Payment method deleted successfully',
  })
  async remove(@CompanyContext() companyId: string, @Param('id') id: string) {
    await this.paymentMethodsService.remove(companyId, id);
    return {
      success: true,
      message: 'Payment method disabled successfully',
    };
  }
}

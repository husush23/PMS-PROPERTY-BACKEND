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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { LeaseService } from './lease.service';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { CreateLeaseDto } from './dto/create-lease.dto';
import { UpdateLeaseDto } from './dto/update-lease.dto';
import { LeaseResponseDto } from './dto/lease-response.dto';
import { ListLeasesQueryDto } from './dto/list-leases-query.dto';
import { TerminateLeaseDto } from './dto/terminate-lease.dto';
import { RenewLeaseDto } from './dto/renew-lease.dto';
import { TransferLeaseDto } from './dto/transfer-lease.dto';

@ApiTags('leases')
@Controller({ path: 'leases', version: '1' })
export class LeaseController {
  constructor(private readonly leaseService: LeaseService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'Create a new lease (starts as DRAFT) (COMPANY_ADMIN/MANAGER/LANDLORD only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Lease created successfully',
    type: LeaseResponseDto,
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
    @Body() createLeaseDto: CreateLeaseDto,
    @AuthUser() user: { id: string },
  ) {
    const lease = await this.leaseService.create(createLeaseDto, user.id);
    return {
      success: true,
      data: lease,
      message: 'Lease created successfully',
    };
  }

  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List leases with filtering and pagination' })
  @ApiResponse({
    status: 200,
    description: 'Leases retrieved successfully',
  })
  async findAll(
    @Query() query: ListLeasesQueryDto,
    @AuthUser() user: { id: string },
  ) {
    const result = await this.leaseService.findAll(query, user.id);
    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get lease by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Lease retrieved successfully',
    type: LeaseResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Lease not found',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @AuthUser() user: { id: string },
  ) {
    const lease = await this.leaseService.findOne(id, user.id);
    return {
      success: true,
      data: lease,
    };
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'Update lease (limited if ACTIVE) (COMPANY_ADMIN/MANAGER/LANDLORD only)',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Lease updated successfully',
    type: LeaseResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Lease not found',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateLeaseDto: UpdateLeaseDto,
    @AuthUser() user: { id: string },
  ) {
    const lease = await this.leaseService.update(id, updateLeaseDto, user.id);
    return {
      success: true,
      data: lease,
      message: 'Lease updated successfully',
    };
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Activate lease (DRAFT → ACTIVE) (COMPANY_ADMIN/MANAGER only)',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Lease activated successfully',
    type: LeaseResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Lease cannot be activated',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
    @AuthUser() user: { id: string },
  ) {
    const lease = await this.leaseService.activate(id, user.id);
    return {
      success: true,
      data: lease,
      message: 'Lease activated successfully',
    };
  }

  @Post(':id/terminate')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'Terminate lease (ACTIVE → TERMINATED) (COMPANY_ADMIN/MANAGER only)',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Lease terminated successfully',
    type: LeaseResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Lease cannot be terminated',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  async terminate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() terminateLeaseDto: TerminateLeaseDto,
    @AuthUser() user: { id: string },
  ) {
    const lease = await this.leaseService.terminate(
      id,
      terminateLeaseDto,
      user.id,
    );
    return {
      success: true,
      data: lease,
      message: 'Lease terminated successfully',
    };
  }

  @Post(':id/renew')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'Renew lease (create new from existing) (COMPANY_ADMIN/MANAGER only)',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 201,
    description: 'Lease renewed successfully',
    type: LeaseResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Lease cannot be renewed',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  async renew(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() renewLeaseDto: RenewLeaseDto,
    @AuthUser() user: { id: string },
  ) {
    const lease = await this.leaseService.renew(id, renewLeaseDto, user.id);
    return {
      success: true,
      data: lease,
      message: 'Lease renewed successfully',
    };
  }

  @Post(':id/transfer')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'Transfer lease (terminate old + create new) (COMPANY_ADMIN/MANAGER only)',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 201,
    description: 'Lease transferred successfully',
    type: LeaseResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Lease cannot be transferred',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  async transfer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() transferLeaseDto: TransferLeaseDto,
    @AuthUser() user: { id: string },
  ) {
    const lease = await this.leaseService.transfer(
      id,
      transferLeaseDto,
      user.id,
    );
    return {
      success: true,
      data: lease,
      message: 'Lease transferred successfully',
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete lease (only if DRAFT) (COMPANY_ADMIN/MANAGER only)',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Lease deleted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete active lease',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @AuthUser() user: { id: string },
  ) {
    await this.leaseService.delete(id, user.id);
    return {
      success: true,
      message: 'Lease deleted successfully',
    };
  }

  @Get('unit/:unitId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get lease history for a unit' })
  @ApiParam({ name: 'unitId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Lease history retrieved successfully',
    type: [LeaseResponseDto],
  })
  async getLeaseHistoryByUnit(
    @Param('unitId', ParseUUIDPipe) unitId: string,
    @AuthUser() user: { id: string },
  ) {
    const leases = await this.leaseService.getLeaseHistoryByUnit(
      unitId,
      user.id,
    );
    return {
      success: true,
      data: leases,
    };
  }

  @Get('tenant/:tenantId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get lease history for a tenant' })
  @ApiParam({ name: 'tenantId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Lease history retrieved successfully',
    type: [LeaseResponseDto],
  })
  async getLeaseHistoryByTenant(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @AuthUser() user: { id: string },
  ) {
    const leases = await this.leaseService.getLeaseHistoryByTenant(
      tenantId,
      user.id,
    );
    return {
      success: true,
      data: leases,
    };
  }
}

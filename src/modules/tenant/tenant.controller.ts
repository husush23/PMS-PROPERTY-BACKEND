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
import { Public } from '../../common/decorators/public.decorator';
import {
  BusinessException,
  ErrorCode,
} from '../../common/exceptions/business.exception';
import { ERROR_MESSAGES } from '../../common/constants/error-messages.constant';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { InviteTenantDto } from './dto/invite-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantResponseDto } from './dto/tenant-response.dto';
import { ListTenantsQueryDto } from './dto/list-tenants-query.dto';
import { AcceptTenantInviteDto } from './dto/accept-tenant-invite.dto';

@ApiTags('tenants')
@Controller({ path: 'tenants', version: '1' })
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'Invite a tenant to a company by email only (creates user if needed, sends invitation). Profile data will be collected when tenant accepts the invitation.',
  })
  @ApiResponse({
    status: 201,
    description: 'Tenant invitation sent successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  @ApiResponse({
    status: 409,
    description: 'Tenant already exists in this company',
  })
  async inviteTenant(
    @Body() inviteDto: InviteTenantDto & { companyId?: string },
    @AuthUser()
    user: { id: string; companyId?: string; isSuperAdmin?: boolean },
  ) {
    // For super admins, companyId must be provided in request body
    // For regular users, use request body or fallback to JWT companyId
    const companyId = inviteDto.companyId || user.companyId;

    if (!companyId) {
      // Super admin must provide companyId in request body
      if (user.isSuperAdmin) {
        throw new BusinessException(
          ErrorCode.COMPANY_CONTEXT_REQUIRED,
          'Please specify the company ID in the request body.',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Regular users need to select a company first
      throw new BusinessException(
        ErrorCode.COMPANY_CONTEXT_REQUIRED,
        ERROR_MESSAGES.COMPANY_CONTEXT_REQUIRED,
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.tenantService.inviteTenant(companyId, inviteDto, user.id);
    return {
      success: true,
      message: 'Tenant invitation sent successfully',
    };
  }

  @Post('accept-invitation')
  @HttpCode(HttpStatus.OK)
  @Public()
  @ApiOperation({
    summary:
      'Accept tenant invitation and complete profile (public endpoint, token-based). Requires token, password, name, and optional profile fields.',
  })
  @ApiResponse({
    status: 200,
    description: 'Invitation accepted successfully and profile completed',
  })
  @ApiResponse({
    status: 400,
    description: 'Invitation expired, already accepted, or invalid',
  })
  @ApiResponse({
    status: 404,
    description: 'Invitation not found',
  })
  async acceptInvitation(
    @Body() acceptInviteDto: AcceptTenantInviteDto,
    @AuthUser() user: { id: string },
  ) {
    await this.tenantService.acceptTenantInvitation(acceptInviteDto);
    return {
      success: true,
      message: 'Tenant invitation accepted successfully',
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create a tenant directly (COMPANY_ADMIN/MANAGER only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Tenant created successfully',
    type: TenantResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Company not found or user not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Tenant already exists in this company',
  })
  async create(
    @Body() createDto: CreateTenantDto & { companyId?: string },
    @AuthUser()
    user: { id: string; companyId?: string; isSuperAdmin?: boolean },
  ) {
    // For super admins, companyId must be provided in request body
    // For regular users, use request body or fallback to JWT companyId
    const companyId = createDto.companyId || user.companyId;

    if (!companyId) {
      // Super admin must provide companyId in request body
      if (user.isSuperAdmin) {
        throw new BusinessException(
          ErrorCode.COMPANY_CONTEXT_REQUIRED,
          'Please specify the company ID in the request body.',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Regular users need to select a company first
      throw new BusinessException(
        ErrorCode.COMPANY_CONTEXT_REQUIRED,
        ERROR_MESSAGES.COMPANY_CONTEXT_REQUIRED,
        HttpStatus.BAD_REQUEST,
      );
    }

    const tenant = await this.tenantService.create(
      companyId,
      createDto,
      user.id,
    );
    return {
      success: true,
      data: tenant,
      message: 'Tenant created successfully',
    };
  }

  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'List tenants (filtered by company, tenants can only see themselves)',
  })
  @ApiQuery({ name: 'companyId', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Tenants retrieved successfully',
  })
  async findAll(
    @Query() query: ListTenantsQueryDto & { companyId?: string },
    @AuthUser()
    user: { id: string; companyId?: string; isSuperAdmin?: boolean },
  ) {
    // For super admins, companyId must be provided in query params
    // For regular users, use query params or fallback to JWT companyId
    const companyId = query.companyId || user.companyId;

    if (!companyId) {
      // Super admin must provide companyId in query params
      if (user.isSuperAdmin) {
        throw new BusinessException(
          ErrorCode.COMPANY_CONTEXT_REQUIRED,
          'Please specify the company ID in the query parameters.',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Regular users need to select a company first
      throw new BusinessException(
        ErrorCode.COMPANY_CONTEXT_REQUIRED,
        ERROR_MESSAGES.COMPANY_CONTEXT_REQUIRED,
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = await this.tenantService.findAll(companyId, query, user.id);
    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get tenant details (tenant can only see own profile)',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Tenant retrieved successfully',
    type: TenantResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions (tenants can only view own data)',
  })
  @ApiResponse({
    status: 404,
    description: 'Tenant not found',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) tenantId: string,
    @AuthUser() user: { id: string },
  ) {
    const tenant = await this.tenantService.findOne(tenantId, user.id);
    return {
      success: true,
      data: tenant,
    };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update tenant (tenant can update own profile)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Tenant updated successfully',
    type: TenantResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 403,
    description:
      'Insufficient permissions (tenants can only update own profile)',
  })
  @ApiResponse({
    status: 404,
    description: 'Tenant not found',
  })
  async update(
    @Param('id', ParseUUIDPipe) tenantId: string,
    @Body() updateDto: UpdateTenantDto,
    @AuthUser() user: { id: string },
  ) {
    const tenant = await this.tenantService.update(
      tenantId,
      updateDto,
      user.id,
    );
    return {
      success: true,
      data: tenant,
      message: 'Tenant updated successfully',
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Remove tenant (COMPANY_ADMIN/MANAGER only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Tenant removed successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Tenant not found',
  })
  async delete(
    @Param('id', ParseUUIDPipe) tenantId: string,
    @AuthUser() user: { id: string },
  ) {
    await this.tenantService.delete(tenantId, user.id);
    return {
      success: true,
      message: 'Tenant removed successfully',
    };
  }
}

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { CreateCompanyDto } from '../company/dto/create-company.dto';
import { UpdateCompanyDto } from '../company/dto/update-company.dto';
import { CompanyResponseDto } from '../company/dto/company-response.dto';
import { UserResponseDto } from '../user/dto/user-response.dto';
import { UpdateUserDto } from '../user/dto/update-user.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { ListCompaniesQueryDto } from './dto/list-companies-query.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { SystemStatsResponseDto } from './dto/system-stats-response.dto';

@ApiTags('admin')
@Controller({ path: 'admin', version: '1' })
@UseGuards(SuperAdminGuard)
@ApiBearerAuth('JWT-auth')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // Company Management Routes
  @Get('companies')
  @ApiOperation({ summary: 'List all companies (super admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Companies retrieved successfully',
  })
  async findAllCompanies(@Query() query: ListCompaniesQueryDto) {
    const result = await this.adminService.findAllCompanies(query);
    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get('companies/:id')
  @ApiOperation({ summary: 'Get company by ID (super admin only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Company retrieved successfully',
    type: CompanyResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Company not found',
  })
  async findCompanyById(@Param('id', ParseUUIDPipe) id: string) {
    const company = await this.adminService.findCompanyById(id);
    return {
      success: true,
      data: company,
    };
  }

  @Post('companies')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new company (super admin only)' })
  @ApiBody({ type: CreateCompanyDto })
  @ApiResponse({
    status: 201,
    description: 'Company created successfully',
    type: CompanyResponseDto,
  })
  async createCompany(@Body() createCompanyDto: CreateCompanyDto) {
    const company = await this.adminService.createCompany(createCompanyDto);
    return {
      success: true,
      data: company,
      message: 'Company created successfully',
    };
  }

  @Put('companies/:id')
  @ApiOperation({ summary: 'Update company (super admin only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: UpdateCompanyDto })
  @ApiResponse({
    status: 200,
    description: 'Company updated successfully',
    type: CompanyResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Company not found',
  })
  async updateCompany(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCompanyDto: UpdateCompanyDto,
  ) {
    const company = await this.adminService.updateCompany(id, updateCompanyDto);
    return {
      success: true,
      data: company,
      message: 'Company updated successfully',
    };
  }

  @Delete('companies/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete company (super admin only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Company deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Company not found',
  })
  async deleteCompany(@Param('id', ParseUUIDPipe) id: string) {
    await this.adminService.deleteCompany(id);
    return {
      success: true,
      message: 'Company deleted successfully',
    };
  }

  // User Management Routes
  @Get('users')
  @ApiOperation({
    summary: 'List all users across all companies (super admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
  })
  async findAllUsers(@Query() query: ListUsersQueryDto) {
    const result = await this.adminService.findAllUsers(query);
    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user by ID (super admin only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'User retrieved successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async findUserById(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.adminService.findUserById(id);
    return {
      success: true,
      data: user,
    };
  }

  @Post('users/:id/make-super-admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Promote user to super admin (super admin only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'User promoted to super admin successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async makeSuperAdmin(@Param('id', ParseUUIDPipe) id: string) {
    await this.adminService.promoteToSuperAdmin(id);
    return {
      success: true,
      message: 'User promoted to super admin successfully',
    };
  }

  @Delete('users/:id/remove-super-admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove super admin status from user (super admin only)',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Super admin status removed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot remove the last super admin',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async removeSuperAdmin(@Param('id', ParseUUIDPipe) id: string) {
    await this.adminService.removeSuperAdmin(id);
    return {
      success: true,
      message: 'Super admin status removed successfully',
    };
  }

  @Patch('users/:id/activate')
  @ApiOperation({ summary: 'Activate or deactivate user (super admin only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        isActive: { type: 'boolean' },
      },
      required: ['isActive'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'User activation status updated successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async activateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('isActive') isActive: boolean,
  ) {
    const user = await this.adminService.activateUser(id, isActive);
    return {
      success: true,
      data: user,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
    };
  }

  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Create a new user (super admin only). Optionally assign to a company.',
  })
  @ApiBody({ type: CreateAdminUserDto })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 404,
    description: 'Company not found (if companyId provided)',
  })
  @ApiResponse({
    status: 409,
    description: 'User with this email already exists',
  })
  async createUser(@Body() createUserDto: CreateAdminUserDto) {
    const user = await this.adminService.createUser(createUserDto);
    return {
      success: true,
      data: user,
      message: 'User created successfully',
    };
  }

  @Put('users/:id')
  @ApiOperation({ summary: 'Update user (full update, super admin only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Email already exists',
  })
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const user = await this.adminService.updateUser(id, updateUserDto);
    return {
      success: true,
      data: user,
      message: 'User updated successfully',
    };
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Update user (partial update, super admin only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Email already exists',
  })
  async patchUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const user = await this.adminService.updateUser(id, updateUserDto);
    return {
      success: true,
      data: user,
      message: 'User updated successfully',
    };
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Delete user (soft delete by default, hard delete with ?hard=true, super admin only)',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiQuery({
    name: 'hard',
    required: false,
    type: Boolean,
    description: 'Set to true for hard delete (permanent removal)',
  })
  @ApiResponse({
    status: 200,
    description: 'User deleted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete last super admin',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async deleteUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('hard') hard?: string,
  ) {
    const hardDelete = hard === 'true';
    await this.adminService.deleteUser(id, hardDelete);
    return {
      success: true,
      message: `User ${hardDelete ? 'permanently deleted' : 'deactivated'} successfully`,
    };
  }

  // System Statistics Routes
  @Get('stats')
  @ApiOperation({ summary: 'Get system-wide statistics (super admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    type: SystemStatsResponseDto,
  })
  async getSystemStats() {
    const stats = await this.adminService.getSystemStats();
    return {
      success: true,
      data: stats,
    };
  }

  @Get('overview')
  @ApiOperation({
    summary: 'Get system overview dashboard data (super admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Overview data retrieved successfully',
  })
  async getOverview() {
    // For now, return stats. Can be expanded later with more detailed data
    const stats = await this.adminService.getSystemStats();
    return {
      success: true,
      data: stats,
    };
  }
}

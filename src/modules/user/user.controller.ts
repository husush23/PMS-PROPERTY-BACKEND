import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { BusinessException, ErrorCode } from '../../common/exceptions/business.exception';
import { ERROR_MESSAGES } from '../../common/constants/error-messages.constant';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { CompanyContext } from '../../common/decorators/company-context.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CompanyAccessGuard } from '../../common/guards/company-access.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { UserRole } from '../../shared/enums/user-role.enum';
import { AddUserToCompanyDto } from '../company/dto/add-user-to-company.dto';

@ApiTags('users')
@Controller({ path: 'users', version: '1' })
@UseGuards(CompanyAccessGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiBearerAuth('JWT-auth')
  @Roles(UserRole.ADMIN, UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Get paginated list of users in current company' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 10, max: 100)' })
  @ApiResponse({
    status: 200,
    description: 'List of users retrieved successfully',
    type: [UserResponseDto],
  })
  async findAll(
    @Query() paginationQuery: PaginationQueryDto,
    @CompanyContext() companyId: string,
  ) {
    try {
      const result = await this.userService.findAll(companyId, paginationQuery);
      return {
        success: true,
        data: result.data,
        pagination: result.pagination,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to retrieve users',
      };
    }
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get a user by ID (must be in same company or viewing own profile)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User retrieved successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CompanyContext() companyId: string,
    @AuthUser() currentUser: { id: string; role: UserRole },
  ) {
    // Allow if admin/manager OR if viewing own profile
    const isAdminOrManager = [
      UserRole.ADMIN,
      UserRole.COMPANY_ADMIN,
      UserRole.MANAGER,
    ].includes(currentUser.role);
    const isOwnProfile = currentUser.id === id;

    if (!isAdminOrManager && !isOwnProfile) {
      throw new BusinessException(
        ErrorCode.INSUFFICIENT_PERMISSIONS,
        'You can only view your own profile.',
        403,
      );
    }

    try {
      const user = await this.userService.findById(id, companyId);
      return {
        success: true,
        data: user,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to retrieve user',
      };
    }
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  @Roles(UserRole.ADMIN, UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new user in current company' })
  @ApiBody({ type: CreateUserDto })
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
    status: 403,
    description: 'Insufficient permissions',
  })
  @ApiResponse({
    status: 409,
    description: 'User with this email already exists',
  })
  async create(
    @Body() createUserDto: CreateUserDto,
    @CompanyContext() companyId: string,
    @AuthUser() currentUser: { role: UserRole },
  ) {
    // Default role based on who's creating (can be overridden later via company management)
    const defaultRole = UserRole.TENANT;
    
    const user = await this.userService.create(createUserDto, companyId, defaultRole);
    return {
      success: true,
      data: user,
      message: 'User created successfully',
    };
  }

  @Put(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a user (full update)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'User ID' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CompanyContext() companyId: string,
    @AuthUser() currentUser: { id: string; role: UserRole },
  ) {
    // Check permissions
    const isAdminOrManager = [
      UserRole.ADMIN,
      UserRole.COMPANY_ADMIN,
      UserRole.MANAGER,
    ].includes(currentUser.role);
    const isOwnProfile = currentUser.id === id;

    if (!isAdminOrManager && !isOwnProfile) {
      throw new BusinessException(
        ErrorCode.CAN_ONLY_UPDATE_OWN_PROFILE,
        ERROR_MESSAGES.CAN_ONLY_UPDATE_OWN_PROFILE,
        403,
      );
    }

    // If user updating themselves, they can only update name and email (not password via this endpoint)
    if (isOwnProfile && !isAdminOrManager) {
      // Remove password from update if user is updating themselves
      // Password changes should use dedicated endpoint
      const { password, ...safeUpdate } = updateUserDto;
      if (password) {
        throw new BusinessException(
          ErrorCode.BAD_REQUEST,
          'Please use the password change endpoint to update your password.',
          400,
        );
      }
      const user = await this.userService.update(id, safeUpdate, companyId);
      return {
        success: true,
        data: user,
        message: 'Profile updated successfully',
      };
    }

    try {
      const user = await this.userService.update(id, updateUserDto, companyId);
      return {
        success: true,
        data: user,
        message: 'User updated successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to update user',
      };
    }
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a user (partial update)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'User ID' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async patch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CompanyContext() companyId: string,
    @AuthUser() currentUser: { id: string; role: UserRole },
  ) {
    // Same logic as PUT
    return this.update(id, updateUserDto, companyId, currentUser);
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @Roles(UserRole.ADMIN, UserRole.COMPANY_ADMIN)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove user from company (COMPANY_ADMIN only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User removed from company successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Only company administrators can remove users',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CompanyContext() companyId: string,
  ) {
    try {
      const deleted = await this.userService.delete(id, companyId);
      return {
        success: deleted,
        message: deleted
          ? 'User removed from company successfully'
          : 'Failed to remove user',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to delete user',
      };
    }
  }
}

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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { Public } from '../../common/decorators/public.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';

@ApiTags('users')
@Controller({ path: 'users', version: '1' })
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get paginated list of users' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 10, max: 100)' })
  @ApiResponse({
    status: 200,
    description: 'List of users retrieved successfully',
    type: [UserResponseDto],
  })
  async findAll(@Query() paginationQuery: PaginationQueryDto) {
    try {
      const result = await this.userService.findAll(paginationQuery);
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

  @Public()
  @Get('test')
  @ApiOperation({ summary: 'Test database connection' })
  @ApiResponse({
    status: 200,
    description: 'Database connection test result',
  })
  async testConnection() {
    try {
      const result = await this.userService.findAll({ page: 1, limit: 1 });
      return {
        success: true,
        message: 'Database connection successful!',
        userCount: result.pagination.total,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Database connection failed',
        error: error.message,
      };
    }
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a user by ID' })
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
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    try {
      const user = await this.userService.findById(id);
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

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new user' })
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
    status: 409,
    description: 'User with this email already exists',
  })
  async create(@Body() createUserDto: CreateUserDto) {
    try {
      const user = await this.userService.create(createUserDto);
      return {
        success: true,
        data: user,
        message: 'User created successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to create user',
      };
    }
  }

  @Public()
  @Put(':id')
  @ApiOperation({ summary: 'Update a user (full update)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'User ID' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 409,
    description: 'User with this email already exists',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    try {
      const user = await this.userService.update(id, updateUserDto);
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

  @Public()
  @Patch(':id')
  @ApiOperation({ summary: 'Update a user (partial update)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'User ID' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 409,
    description: 'User with this email already exists',
  })
  async patch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    try {
      const user = await this.userService.update(id, updateUserDto);
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

  @Public()
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a user' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    try {
      const deleted = await this.userService.delete(id);
      return {
        success: deleted,
        message: deleted ? 'User deleted successfully' : 'Failed to delete user',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to delete user',
      };
    }
  }
}







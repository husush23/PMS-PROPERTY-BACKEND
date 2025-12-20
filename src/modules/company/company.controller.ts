import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
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
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CompanyService } from './company.service';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompanyResponseDto } from './dto/company-response.dto';
import { AddUserToCompanyDto } from './dto/add-user-to-company.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

@ApiTags('companies')
@Controller({ path: 'companies', version: '1' })
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new company (works for users without companies)' })
  @ApiResponse({
    status: 201,
    description: 'Company created successfully',
    type: CompanyResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 409,
    description: 'Company with this slug already exists',
  })
  async create(
    @Body() createCompanyDto: CreateCompanyDto,
    @AuthUser() user: { id: string },
  ) {
    const company = await this.companyService.create(createCompanyDto, user.id);
    return {
      success: true,
      data: company,
      message: 'Company created successfully',
    };
  }

  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: "Get user's companies" })
  @ApiResponse({
    status: 200,
    description: 'Companies retrieved successfully',
    type: [CompanyResponseDto],
  })
  async findAll(@AuthUser() user: { id: string }) {
    const companies = await this.companyService.findAll(user.id);
    return {
      success: true,
      data: companies,
    };
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get company by ID' })
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
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @AuthUser() user: { id: string },
  ) {
    const company = await this.companyService.findOne(id, user.id);
    return {
      success: true,
      data: company,
    };
  }

  @Put(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update company (COMPANY_ADMIN only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Company updated successfully',
    type: CompanyResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Only company administrators can update company',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCompanyDto: UpdateCompanyDto,
    @AuthUser() user: { id: string },
  ) {
    const company = await this.companyService.update(id, updateCompanyDto, user.id);
    return {
      success: true,
      data: company,
      message: 'Company updated successfully',
    };
  }

  @Post(':id/users')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Add user to company (COMPANY_ADMIN/MANAGER only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 201,
    description: 'User added to company successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  @ApiResponse({
    status: 409,
    description: 'User is already assigned to this company',
  })
  async addUser(
    @Param('id', ParseUUIDPipe) companyId: string,
    @Body() addUserDto: AddUserToCompanyDto,
    @AuthUser() user: { id: string },
  ) {
    await this.companyService.addUserToCompany(companyId, addUserDto, user.id);
    return {
      success: true,
      message: 'User added to company successfully',
    };
  }

  @Put(':id/users/:userId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update user role in company (COMPANY_ADMIN only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'User role updated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Only company administrators can update user roles',
  })
  async updateUserRole(
    @Param('id', ParseUUIDPipe) companyId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() updateRoleDto: UpdateUserRoleDto,
    @AuthUser() user: { id: string },
  ) {
    await this.companyService.updateUserRole(
      companyId,
      userId,
      updateRoleDto,
      user.id,
    );
    return {
      success: true,
      message: 'User role updated successfully',
    };
  }

  @Delete(':id/users/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Remove user from company (COMPANY_ADMIN only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'User removed from company successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Only company administrators can remove users',
  })
  async removeUser(
    @Param('id', ParseUUIDPipe) companyId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @AuthUser() user: { id: string },
  ) {
    await this.companyService.removeUserFromCompany(companyId, userId, user.id);
    return {
      success: true,
      message: 'User removed from company successfully',
    };
  }
}


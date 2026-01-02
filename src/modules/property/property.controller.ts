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
import { PropertyService } from './property.service';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertyResponseDto } from './dto/property-response.dto';
import { ListPropertiesQueryDto } from './dto/list-properties-query.dto';

@ApiTags('properties')
@Controller({ path: 'properties', version: '1' })
export class PropertyController {
  constructor(private readonly propertyService: PropertyService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create a new property (COMPANY_ADMIN/MANAGER only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Property created successfully',
    type: PropertyResponseDto,
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
    description: 'Company not found',
  })
  async create(
    @Body() createPropertyDto: CreatePropertyDto,
    @AuthUser() user: { id: string },
  ) {
    const property = await this.propertyService.create(
      createPropertyDto,
      user.id,
    );
    return {
      success: true,
      data: property,
      message: 'Property created successfully',
    };
  }

  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List properties with filtering and pagination' })
  @ApiResponse({
    status: 200,
    description: 'Properties retrieved successfully',
  })
  async findAll(
    @Query() query: ListPropertiesQueryDto,
    @AuthUser() user: { id: string },
  ) {
    const result = await this.propertyService.findAll(query, user.id);
    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get property by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Property retrieved successfully',
    type: PropertyResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Property not found',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @AuthUser() user: { id: string },
  ) {
    const property = await this.propertyService.findOne(id, user.id);
    return {
      success: true,
      data: property,
    };
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update property (COMPANY_ADMIN/MANAGER only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Property updated successfully',
    type: PropertyResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Property not found',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePropertyDto: UpdatePropertyDto,
    @AuthUser() user: { id: string },
  ) {
    const property = await this.propertyService.update(
      id,
      updatePropertyDto,
      user.id,
    );
    return {
      success: true,
      data: property,
      message: 'Property updated successfully',
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete property (COMPANY_ADMIN only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Property deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Only company administrators can delete properties',
  })
  @ApiResponse({
    status: 404,
    description: 'Property not found',
  })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @AuthUser() user: { id: string },
  ) {
    await this.propertyService.delete(id, user.id);
    return {
      success: true,
      message: 'Property deleted successfully',
    };
  }
}

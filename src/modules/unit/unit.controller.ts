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
} from '@nestjs/swagger';
import { UnitService } from './unit.service';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitResponseDto } from './dto/unit-response.dto';
import { ListUnitsQueryDto } from './dto/list-units-query.dto';

@ApiTags('units')
@Controller({ path: 'units', version: '1' })
export class UnitController {
  constructor(private readonly unitService: UnitService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new unit (COMPANY_ADMIN/MANAGER only)' })
  @ApiResponse({
    status: 201,
    description: 'Unit created successfully',
    type: UnitResponseDto,
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
    description: 'Property not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Unit number already exists for this property',
  })
  async create(
    @Body() createUnitDto: CreateUnitDto,
    @AuthUser() user: { id: string },
  ) {
    const unit = await this.unitService.create(createUnitDto, user.id);
    return {
      success: true,
      data: unit,
      message: 'Unit created successfully',
    };
  }

  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List units with filtering and pagination' })
  @ApiResponse({
    status: 200,
    description: 'Units retrieved successfully',
  })
  async findAll(
    @Query() query: ListUnitsQueryDto,
    @AuthUser() user: { id: string },
  ) {
    const result = await this.unitService.findAll(query, user.id);
    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get unit by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Unit retrieved successfully',
    type: UnitResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Unit not found',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @AuthUser() user: { id: string },
  ) {
    const unit = await this.unitService.findOne(id, user.id);
    return {
      success: true,
      data: unit,
    };
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update unit (COMPANY_ADMIN/MANAGER only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Unit updated successfully',
    type: UnitResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Unit not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Unit number already exists for this property',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUnitDto: UpdateUnitDto,
    @AuthUser() user: { id: string },
  ) {
    const unit = await this.unitService.update(id, updateUnitDto, user.id);
    return {
      success: true,
      data: unit,
      message: 'Unit updated successfully',
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete unit (COMPANY_ADMIN only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Unit deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Only company administrators can delete units',
  })
  @ApiResponse({
    status: 404,
    description: 'Unit not found',
  })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @AuthUser() user: { id: string },
  ) {
    await this.unitService.delete(id, user.id);
    return {
      success: true,
      message: 'Unit deleted successfully',
    };
  }

  @Get('by-property/:propertyId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all units for a property' })
  @ApiParam({ name: 'propertyId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Units retrieved successfully',
    type: [UnitResponseDto],
  })
  @ApiResponse({
    status: 404,
    description: 'Property not found',
  })
  async findByProperty(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @AuthUser() user: { id: string },
  ) {
    const units = await this.unitService.findByProperty(propertyId, user.id);
    return {
      success: true,
      data: units,
    };
  }
}

import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
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
} from '@nestjs/swagger';
import { RentCycleService } from './rent-cycle.service';
import { RentCycleGenerationService } from './rent-cycle-generation.service';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateRentCycleDto } from './dto/create-rent-cycle.dto';
import { RentCycleResponseDto } from './dto/rent-cycle-response.dto';
import { ListRentCyclesQueryDto } from './dto/list-rent-cycles-query.dto';
import { UserRole } from '../../shared/enums/user-role.enum';

@ApiTags('rent-cycles')
@Controller({ path: 'rent-cycles', version: '1' })
@UseGuards(RolesGuard)
export class RentCycleController {
  constructor(
    private readonly rentCycleService: RentCycleService,
    private readonly rentCycleGenerationService: RentCycleGenerationService,
  ) {}

  @Get()
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'List rent cycles (invoices) with filtering and pagination' })
  @ApiResponse({
    status: 200,
    description: 'Rent cycles retrieved successfully',
  })
  async findAll(
    @Query() query: ListRentCyclesQueryDto,
    @AuthUser() user: { id: string },
  ) {
    const result = await this.rentCycleService.findAll(query, user.id);
    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get('upcoming')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get upcoming rent cycles (due today or future, not paid)' })
  @ApiResponse({
    status: 200,
    description: 'Upcoming rent cycles retrieved successfully',
  })
  async getUpcoming(@AuthUser() user: { id: string }) {
    const result = await this.rentCycleService.findAll(
      { upcoming: true, sortBy: 'dueDate', sortOrder: 'ASC' },
      user.id,
    );
    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get('overdue')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get overdue rent cycles' })
  @ApiResponse({
    status: 200,
    description: 'Overdue rent cycles retrieved successfully',
  })
  async getOverdue(@AuthUser() user: { id: string }) {
    const result = await this.rentCycleService.findAll(
      { statuses: 'OVERDUE', sortBy: 'dueDate', sortOrder: 'ASC' },
      user.id,
    );
    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get('lease/:leaseId')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get all rent cycles for a lease' })
  @ApiParam({ name: 'leaseId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Rent cycles retrieved successfully',
  })
  async findByLeaseId(
    @Param('leaseId', ParseUUIDPipe) leaseId: string,
    @AuthUser() user: { id: string },
  ) {
    const cycles = await this.rentCycleService.findByLeaseId(leaseId, user.id);
    return {
      success: true,
      data: cycles,
    };
  }

  @Get(':id')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get rent cycle by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Rent cycle retrieved successfully',
    type: RentCycleResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Rent cycle not found',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @AuthUser() user: { id: string },
  ) {
    const cycle = await this.rentCycleService.findOne(id, user.id);
    return {
      success: true,
      data: cycle,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCookieAuth('access_token')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Create a new rent cycle (invoice) manually (COMPANY_ADMIN/MANAGER only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Rent cycle created successfully',
    type: RentCycleResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed',
  })
  async create(
    @Body() createDto: CreateRentCycleDto,
    @AuthUser() user: { id: string },
  ) {
    const cycle = await this.rentCycleService.create(createDto, user.id);
    return {
      success: true,
      data: cycle,
      message: 'Rent cycle created successfully',
    };
  }

  @Post(':id/apply-late-fee')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('access_token')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Apply late fee to a rent cycle (COMPANY_ADMIN/MANAGER only)',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Late fee applied successfully',
    type: RentCycleResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Late fee already applied or invalid request',
  })
  async applyLateFee(
    @Param('id', ParseUUIDPipe) id: string,
    @AuthUser() user: { id: string },
  ) {
    const cycle = await this.rentCycleService.applyLateFee(id, user.id);
    return {
      success: true,
      data: cycle,
      message: 'Late fee applied successfully',
    };
  }
}


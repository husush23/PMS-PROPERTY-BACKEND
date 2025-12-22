import { IsOptional, IsInt, Min, Max, IsEnum, IsString, IsUUID, IsDateString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { LeaseStatus } from '../../../shared/enums/lease-status.enum';
import { LeaseType } from '../../../shared/enums/lease-type.enum';

export class ListLeasesQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (1-indexed)',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Search by lease number or tenant name',
    example: 'LEASE-2024',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by lease status',
    enum: LeaseStatus,
    example: LeaseStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(LeaseStatus)
  status?: LeaseStatus;

  @ApiPropertyOptional({
    description: 'Filter by lease type',
    enum: LeaseType,
    example: LeaseType.LONG_TERM,
  })
  @IsOptional()
  @IsEnum(LeaseType)
  leaseType?: LeaseType;

  @ApiPropertyOptional({
    description: 'Filter by tenant ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4')
  tenantId?: string;

  @ApiPropertyOptional({
    description: 'Filter by unit ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4')
  unitId?: string;

  @ApiPropertyOptional({
    description: 'Filter by property ID (via unit)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4')
  propertyId?: string;

  @ApiPropertyOptional({
    description: 'Filter by company ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4')
  companyId?: string;

  @ApiPropertyOptional({
    description: 'Filter leases starting from this date',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Start date from must be a valid date string' })
  startDateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter leases starting until this date',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Start date to must be a valid date string' })
  startDateTo?: string;

  @ApiPropertyOptional({
    description: 'Filter leases ending from this date',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString({}, { message: 'End date from must be a valid date string' })
  endDateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter leases ending until this date',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString({}, { message: 'End date to must be a valid date string' })
  endDateTo?: string;

  @ApiPropertyOptional({
    description: 'Filter leases expiring soon (within next 30 days)',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  expiringSoon?: boolean;

  @ApiPropertyOptional({
    description: 'Sort by field',
    example: 'startDate',
    enum: ['startDate', 'endDate', 'createdAt', 'leaseNumber', 'monthlyRent'],
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort order',
    example: 'DESC',
    enum: ['ASC', 'DESC'],
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}


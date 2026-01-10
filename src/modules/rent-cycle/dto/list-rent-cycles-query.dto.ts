import {
  IsOptional,
  IsUUID,
  IsDateString,
  IsInt,
  Min,
  IsString,
  IsEnum,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RentCycleStatus } from '../../../shared/enums/rent-cycle-status.enum';

export class ListRentCyclesQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page must be an integer' })
  @Min(1, { message: 'Page must be at least 1' })
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filter by lease ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Lease ID must be a valid UUID' })
  leaseId?: string;

  @ApiPropertyOptional({
    description: 'Filter by tenant ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Tenant ID must be a valid UUID' })
  tenantId?: string;

  @ApiPropertyOptional({
    description: 'Filter by company ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Company ID must be a valid UUID' })
  companyId?: string;

  @ApiPropertyOptional({
    description: 'Filter by status (comma-separated for multiple)',
    example: 'PENDING,DUE',
  })
  @IsOptional()
  @IsString()
  statuses?: string;

  @ApiPropertyOptional({
    description: 'Filter invoices with due date from this date (inclusive)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Due date from must be a valid date string' })
  dueDateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter invoices with due date until this date (inclusive)',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Due date to must be a valid date string' })
  dueDateTo?: string;

  @ApiPropertyOptional({
    description: 'Filter for upcoming invoices (due today or future, not paid)',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  upcoming?: boolean;

  @ApiPropertyOptional({
    description: 'Sort field',
    default: 'dueDate',
    example: 'dueDate',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'dueDate';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['ASC', 'DESC'],
    default: 'ASC',
    example: 'ASC',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'ASC';

  @ApiPropertyOptional({
    description: 'Exclude voided invoices from results',
    default: true,
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'excludeVoided must be a boolean' })
  excludeVoided?: boolean = true;

  @ApiPropertyOptional({
    description: 'Filter by invoice type',
    enum: ['all', 'rent', 'deposit'],
    default: 'all',
    example: 'all',
  })
  @IsOptional()
  @IsString()
  @IsIn(['all', 'rent', 'deposit'], {
    message: 'invoiceType must be one of: all, rent, deposit',
  })
  invoiceType?: 'all' | 'rent' | 'deposit' = 'all';
}


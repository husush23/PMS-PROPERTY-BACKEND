import {
  IsOptional,
  IsUUID,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus } from '../../../shared/enums/payment-status.enum';
import { PaymentType } from '../../../shared/enums/payment-type.enum';
import { PaymentMethod } from '../../../shared/enums/payment-method.enum';

export class ListPaymentsQueryDto {
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
    description: 'Filter by tenant ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Tenant ID must be a valid UUID' })
  tenantId?: string;

  @ApiPropertyOptional({
    description: 'Filter by lease ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Lease ID must be a valid UUID' })
  leaseId?: string;

  @ApiPropertyOptional({
    description: 'Filter by company ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Company ID must be a valid UUID' })
  companyId?: string;

  @ApiPropertyOptional({
    description: 'Filter by payment status',
    enum: PaymentStatus,
    example: PaymentStatus.PAID,
  })
  @IsOptional()
  @IsEnum(PaymentStatus, { message: 'Status must be a valid PaymentStatus enum value' })
  status?: PaymentStatus;

  @ApiPropertyOptional({
    description: 'Filter by payment type',
    enum: PaymentType,
    example: PaymentType.RENT,
  })
  @IsOptional()
  @IsEnum(PaymentType, { message: 'Payment type must be a valid PaymentType enum value' })
  paymentType?: PaymentType;

  @ApiPropertyOptional({
    description: 'Filter by payment method',
    enum: PaymentMethod,
    example: PaymentMethod.CASH,
  })
  @IsOptional()
  @IsEnum(PaymentMethod, { message: 'Payment method must be a valid PaymentMethod enum value' })
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({
    description: 'Filter payments from this date (inclusive)',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Start date must be a valid date string' })
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Filter payments until this date (inclusive)',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString({}, { message: 'End date must be a valid date string' })
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Sort field',
    default: 'paymentDate',
    example: 'paymentDate',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'paymentDate';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
    example: 'DESC',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}


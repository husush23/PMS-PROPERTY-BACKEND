import {
  IsOptional,
  IsUUID,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExpenseCategory } from '../enums/expense-category.enum';

export class ListExpensesQueryDto {
  @ApiProperty({
    description: 'Company ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4', { message: 'Company ID must be a valid UUID' })
  companyId: string;

  @ApiPropertyOptional({
    description: 'Property ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Property ID must be a valid UUID' })
  propertyId?: string;

  @ApiPropertyOptional({
    description: 'Lease ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Lease ID must be a valid UUID' })
  leaseId?: string;

  @ApiPropertyOptional({
    description: 'Expense category',
    enum: ExpenseCategory,
    example: ExpenseCategory.MAINTENANCE,
  })
  @IsOptional()
  @IsEnum(ExpenseCategory, {
    message: 'Category must be a valid ExpenseCategory enum value',
  })
  category?: ExpenseCategory;

  @ApiPropertyOptional({
    description: 'Expenses from this date (inclusive)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString({}, { message: 'From date must be a valid date string' })
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Expenses to this date (inclusive)',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateString({}, { message: 'To date must be a valid date string' })
  toDate?: string;

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
}

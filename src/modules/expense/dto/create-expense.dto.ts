import {
  IsUUID,
  IsEnum,
  IsOptional,
  IsString,
  IsDateString,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExpenseCategory } from '../enums/expense-category.enum';

export class CreateExpenseDto {
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

  @ApiProperty({
    description: 'Expense category',
    enum: ExpenseCategory,
    example: ExpenseCategory.MAINTENANCE,
  })
  @IsEnum(ExpenseCategory, {
    message: 'Category must be a valid ExpenseCategory enum value',
  })
  category: ExpenseCategory;

  @ApiPropertyOptional({
    description: 'Expense description',
    example: 'AC repair invoice',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Expense amount',
    example: 1500.0,
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Amount must be a valid number with up to 2 decimal places' },
  )
  @Min(0.01, { message: 'Amount must be greater than 0' })
  @Type(() => Number)
  amount: number;

  @ApiProperty({
    description: 'Expense date',
    example: '2026-01-15',
  })
  @IsDateString({}, { message: 'Expense date must be a valid date string' })
  expenseDate: string;
}

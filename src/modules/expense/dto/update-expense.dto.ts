import {
  IsOptional,
  IsUUID,
  IsEnum,
  IsDateString,
  IsNumber,
  Min,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ExpenseCategory } from '../enums/expense-category.enum';

export class UpdateExpenseDto {
  @ApiPropertyOptional({
    description: 'Property ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Property ID must be a valid UUID' })
  propertyId?: string | null;

  @ApiPropertyOptional({
    description: 'Lease ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Lease ID must be a valid UUID' })
  leaseId?: string | null;

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
    description: 'Expense description',
    example: 'AC repair invoice',
  })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({
    description: 'Expense amount',
    example: 1500.0,
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Amount must be a valid number with up to 2 decimal places' },
  )
  @Min(0.01, { message: 'Amount must be greater than 0' })
  @Type(() => Number)
  amount?: number;

  @ApiPropertyOptional({
    description: 'Expense date',
    example: '2026-01-15',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Expense date must be a valid date string' })
  expenseDate?: string;
}

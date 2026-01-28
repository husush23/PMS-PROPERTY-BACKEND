import {
  IsString,
  IsOptional,
  IsUUID,
  IsDateString,
  IsArray,
  ValidateNested,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RentCycleLineItemType } from '../../../shared/enums/rent-cycle-line-item-type.enum';

export class CreateRentCycleLineItemDto {
  @ApiProperty({
    description: 'Line item type',
    enum: RentCycleLineItemType,
    example: RentCycleLineItemType.RENT,
  })
  @IsEnum(RentCycleLineItemType, {
    message: 'Line item type must be a valid RentCycleLineItemType enum value',
  })
  type: RentCycleLineItemType;

  @ApiProperty({
    description: 'Amount for this line item',
    example: 40000.0,
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Amount must be a valid number with up to 2 decimal places' },
  )
  @Min(0, { message: 'Amount must be non-negative' })
  @Type(() => Number)
  amount: number;

  @ApiPropertyOptional({
    description: 'Description of the line item',
    example: 'Monthly rent for January 2026',
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateRentCycleDto {
  @ApiProperty({
    description: 'Lease ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4', { message: 'Lease ID must be a valid UUID' })
  leaseId: string;

  @ApiProperty({
    description: 'Billing period (format: YYYY-MM)',
    example: '2026-01',
  })
  @IsString()
  period: string;

  @ApiPropertyOptional({
    description: 'Due date for this invoice',
    example: '2026-01-05',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Due date must be a valid date string' })
  dueDate?: string;

  @ApiProperty({
    description: 'Line items for this invoice',
    type: [CreateRentCycleLineItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRentCycleLineItemDto)
  lineItems: CreateRentCycleLineItemDto[];
}


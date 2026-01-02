import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsDateString,
  IsNumber,
  IsBoolean,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '../../../shared/enums/payment-method.enum';
import { PaymentType } from '../../../shared/enums/payment-type.enum';

export class CreatePaymentDto {
  @ApiProperty({
    description: 'Lease ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4', { message: 'Lease ID must be a valid UUID' })
  leaseId: string;

  @ApiProperty({
    description: 'Payment amount',
    example: 1500.0,
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Amount must be a valid number with up to 2 decimal places' },
  )
  @Min(0.01, { message: 'Amount must be greater than 0' })
  @Type(() => Number)
  amount: number;

  @ApiPropertyOptional({
    description: 'Currency code (default: KES)',
    default: 'KES',
    example: 'KES',
  })
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Currency code must be at least 3 characters' })
  currency?: string;

  @ApiProperty({
    description: 'Payment date',
    example: '2024-01-15',
  })
  @IsDateString({}, { message: 'Payment date must be a valid date string' })
  paymentDate: string;

  @ApiProperty({
    description: 'Payment method',
    enum: PaymentMethod,
    example: PaymentMethod.CASH,
  })
  @IsEnum(PaymentMethod, {
    message: 'Payment method must be a valid PaymentMethod enum value',
  })
  paymentMethod: PaymentMethod;

  @ApiProperty({
    description: 'Payment type',
    enum: PaymentType,
    example: PaymentType.RENT,
  })
  @IsEnum(PaymentType, {
    message: 'Payment type must be a valid PaymentType enum value',
  })
  paymentType: PaymentType;

  @ApiPropertyOptional({
    description: 'Reference/receipt/transaction code',
    example: 'TXN-123456',
  })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({
    description: 'Period for rent payments (e.g., "2025-03")',
    example: '2025-03',
  })
  @IsOptional()
  @IsString()
  period?: string;

  @ApiPropertyOptional({
    description: 'Payment notes',
    example: 'Monthly rent payment for March 2025',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Whether this is a partial payment',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isPartial?: boolean;

  @ApiPropertyOptional({
    description: 'Balance after this payment (snapshot)',
    example: 500.0,
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'Balance after must be a valid number with up to 2 decimal places',
    },
  )
  @Type(() => Number)
  balanceAfter?: number;

  @ApiPropertyOptional({
    description: 'Receipt/image/PDF attachment URL',
    example: 'https://example.com/receipts/receipt-123.pdf',
  })
  @IsOptional()
  @IsString()
  attachmentUrl?: string;
}

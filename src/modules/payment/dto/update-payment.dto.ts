import { IsString, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus } from '../../../shared/enums/payment-status.enum';

export class UpdatePaymentDto {
  @ApiPropertyOptional({
    description: 'Payment notes',
    example: 'Updated payment notes',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Receipt/image/PDF attachment URL',
    example: 'https://example.com/receipts/receipt-123.pdf',
  })
  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @ApiPropertyOptional({
    description: 'Period for rent payments (e.g., "2025-03")',
    example: '2025-03',
  })
  @IsOptional()
  @IsString()
  period?: string;

  @ApiPropertyOptional({
    description:
      'Payment status (limited transitions: PENDING → PAID, PAID → REFUNDED)',
    enum: PaymentStatus,
    example: PaymentStatus.PAID,
  })
  @IsOptional()
  @IsEnum(PaymentStatus, {
    message: 'Status must be a valid PaymentStatus enum value',
  })
  status?: PaymentStatus;
}

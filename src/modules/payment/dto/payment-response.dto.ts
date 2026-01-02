import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus } from '../../../shared/enums/payment-status.enum';
import { PaymentMethod } from '../../../shared/enums/payment-method.enum';
import { PaymentType } from '../../../shared/enums/payment-type.enum';

export class PaymentResponseDto {
  @ApiProperty({
    description: 'Payment ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Company ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  companyId: string;

  @ApiProperty({
    description: 'Tenant ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  tenantId: string;

  @ApiPropertyOptional({
    description: 'Tenant name (derived from user)',
    example: 'John Doe',
  })
  tenantName?: string;

  @ApiProperty({
    description: 'Lease ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  leaseId: string;

  @ApiPropertyOptional({
    description: 'Lease number (derived from lease)',
    example: 'LEASE-2024-001',
  })
  leaseNumber?: string;

  @ApiProperty({
    description: 'Payment amount',
    example: 1500.0,
  })
  amount: number;

  @ApiProperty({
    description: 'Currency code',
    default: 'KES',
    example: 'KES',
  })
  currency: string;

  @ApiProperty({
    description: 'Payment date',
    example: '2024-01-15',
  })
  paymentDate: Date;

  @ApiProperty({
    description: 'Payment method',
    enum: PaymentMethod,
    example: PaymentMethod.CASH,
  })
  paymentMethod: PaymentMethod;

  @ApiProperty({
    description: 'Payment type',
    enum: PaymentType,
    example: PaymentType.RENT,
  })
  paymentType: PaymentType;

  @ApiProperty({
    description: 'Payment status',
    enum: PaymentStatus,
    example: PaymentStatus.PAID,
  })
  status: PaymentStatus;

  @ApiPropertyOptional({
    description: 'Reference/receipt/transaction code',
    example: 'TXN-123456',
  })
  reference?: string;

  @ApiProperty({
    description: 'User ID who recorded the payment',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  recordedBy: string;

  @ApiPropertyOptional({
    description: 'Period for rent payments (e.g., "2025-03")',
    example: '2025-03',
  })
  period?: string;

  @ApiPropertyOptional({
    description: 'Payment notes',
    example: 'Monthly rent payment for March 2025',
  })
  notes?: string;

  @ApiProperty({
    description: 'Whether this is a partial payment',
    default: false,
  })
  isPartial: boolean;

  @ApiPropertyOptional({
    description: 'Balance after this payment (snapshot)',
    example: 500.0,
  })
  balanceAfter?: number;

  @ApiPropertyOptional({
    description: 'Receipt/image/PDF attachment URL',
    example: 'https://example.com/receipts/receipt-123.pdf',
  })
  attachmentUrl?: string;

  @ApiProperty({
    description: 'Whether the payment is active',
    default: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Created at timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Updated at timestamp',
  })
  updatedAt: Date;

  // Derived fields
  @ApiPropertyOptional({
    description: 'Tenant balance (computed)',
    example: 500.0,
  })
  tenantBalance?: number;

  @ApiPropertyOptional({
    description: 'Lease balance (computed)',
    example: 500.0,
  })
  leaseBalance?: number;

  @ApiPropertyOptional({
    description: 'Whether payment is overdue (computed)',
    default: false,
  })
  isOverdue?: boolean;

  @ApiPropertyOptional({
    description: 'Last payment date for tenant/lease (computed)',
    example: '2024-01-15',
  })
  lastPaymentDate?: Date;
}

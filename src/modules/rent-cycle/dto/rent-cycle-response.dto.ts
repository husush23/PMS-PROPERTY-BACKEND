import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RentCycleStatus } from '../../../shared/enums/rent-cycle-status.enum';
import { RentCycleLineItemType } from '../../../shared/enums/rent-cycle-line-item-type.enum';
import { RentCycleCategory } from '../../../shared/enums/rent-cycle-category.enum';

export class RentCycleLineItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: RentCycleLineItemType })
  type: RentCycleLineItemType;

  @ApiProperty()
  amount: number;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  isLateFee: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'For UTILITY line items created after utility-dedup migration: links to the billed UtilityReading. Omitted or null for legacy rows or non-utility lines.',
  })
  utilityReadingId?: string | null;
}

export class RentCycleResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  leaseId: string;

  @ApiPropertyOptional()
  leaseNumber?: string;

  @ApiProperty()
  companyId: string;

  @ApiProperty()
  tenantId: string;

  @ApiPropertyOptional()
  tenantName?: string;

  @ApiProperty({
    description:
      'Structured invoice number: INV-{period}-{RENT|UTILITY|DEPOSIT}-{seq}. Utility bills use a separate cycle with category UTILITY (not a -U suffix). Legacy data may differ.',
    example: 'INV-2024-01-RENT-001',
  })
  invoiceNumber: string;

  @ApiProperty()
  period: string;

  @ApiProperty({ enum: RentCycleCategory })
  category: RentCycleCategory;

  @ApiProperty()
  dueDate: Date;

  @ApiPropertyOptional({ nullable: true })
  periodStartDate?: Date | null; // Explicit period start - when invoice period begins

  @ApiPropertyOptional({ nullable: true })
  periodEndDate?: Date | null; // Explicit period end - when invoice period ends

  @ApiProperty()
  totalAmountDue: number;

  @ApiPropertyOptional({
    description:
      'Total rent-only amount derived from line items (type=RENT)',
    example: 45000,
  })
  invoiceRentTotal: number;

  @ApiPropertyOptional({
    description:
      'Total utility-only amount derived from line items (type=UTILITY)',
    example: 5000,
  })
  invoiceUtilityTotal: number;

  @ApiPropertyOptional({
    description:
      'Total rent-portion of the invoice (derived from rent-cycle line items)',
    example: 45000,
  })
  rentTotal: number;

  @ApiPropertyOptional({
    description:
      'Total utility-portion of the invoice (derived from rent-cycle line items)',
    example: 5000,
  })
  utilityTotal: number;

  @ApiPropertyOptional({
    description:
      'Total other-portion of the invoice (sum of all line-item types except RENT and UTILITY)',
    example: 2500,
  })
  otherTotal: number;

  @ApiProperty()
  amountPaid: number; // Calculated from payments

  @ApiProperty()
  balance: number; // totalAmountDue - amountPaid

  @ApiProperty({ enum: RentCycleStatus })
  status: RentCycleStatus; // Calculated dynamically

  @ApiProperty({ type: [RentCycleLineItemResponseDto] })
  lineItems: RentCycleLineItemResponseDto[];

  @ApiPropertyOptional()
  paymentsCount?: number;

  @ApiProperty({ default: false })
  isDeposit: boolean; // True if this is a deposit invoice (separate from rent invoices)

  @ApiProperty({ default: false })
  isVoid: boolean; // True if invoice is voided (cancelled/admin action)

  @ApiPropertyOptional({ nullable: true })
  voidReason?: string | null; // Reason for voiding the invoice (if voided)

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}


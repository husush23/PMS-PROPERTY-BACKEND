import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RentCycleStatus } from '../../../shared/enums/rent-cycle-status.enum';
import { RentCycleLineItemType } from '../../../shared/enums/rent-cycle-line-item-type.enum';

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

  @ApiProperty()
  invoiceNumber: string;

  @ApiProperty()
  period: string;

  @ApiProperty()
  dueDate: Date;

  @ApiPropertyOptional({ nullable: true })
  periodStartDate?: Date | null; // Explicit period start - when invoice period begins

  @ApiPropertyOptional({ nullable: true })
  periodEndDate?: Date | null; // Explicit period end - when invoice period ends

  @ApiProperty()
  totalAmountDue: number;

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


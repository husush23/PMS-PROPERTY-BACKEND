import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RentCycleStatus } from '../../../shared/enums/rent-cycle-status.enum';
import { PaymentFrequency } from '../../../shared/enums/payment-frequency.enum';

/** Display status for recent payments: PENDING | APPROVED (PAID) | REJECTED (FAILED/REFUNDED/CANCELLED) */
export type TenantDashboardPaymentStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED';

/**
 * Current rent (latest invoice with status PAID / DUE / OVERDUE).
 */
export class TenantDashboardCurrentRentDto {
  @ApiPropertyOptional({
    description: 'Invoice (rent cycle) ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
  invoiceId: string | null;

  @ApiPropertyOptional({
    description: 'Period start date (YYYY-MM-DD)',
    example: '2024-01-01',
    nullable: true,
  })
  periodStartDate: string | null;

  @ApiPropertyOptional({
    description: 'Period end date (YYYY-MM-DD)',
    example: '2024-01-31',
    nullable: true,
  })
  periodEndDate: string | null;

  @ApiProperty({
    description: 'Amount due for this period',
    example: 1500,
  })
  amount: number;

  @ApiProperty({
    description: 'Due date (YYYY-MM-DD)',
    example: '2024-01-15',
  })
  dueDate: string;

  @ApiProperty({
    description: 'Invoice status',
    enum: [RentCycleStatus.PAID, RentCycleStatus.DUE, RentCycleStatus.OVERDUE],
    example: RentCycleStatus.DUE,
  })
  status: RentCycleStatus.PAID | RentCycleStatus.DUE | RentCycleStatus.OVERDUE;

  @ApiPropertyOptional({
    description: 'Grace period end date (YYYY-MM-DD)',
    example: '2024-01-22',
    nullable: true,
  })
  gracePeriodEndsAt?: string | null;

  @ApiPropertyOptional({
    description: 'Late fee amount applied (if any)',
    example: 50,
    nullable: true,
  })
  lateFeeApplied?: number | null;
}

/**
 * Next rent due (computed from lease; no invoice required).
 */
export class TenantDashboardNextRentDto {
  @ApiProperty({
    description: 'Next due date (YYYY-MM-DD)',
    example: '2024-02-15',
  })
  dueDate: string;

  @ApiProperty({
    description: 'Rent amount',
    example: 1500,
  })
  amount: number;

  @ApiProperty({
    description: 'Payment frequency',
    enum: PaymentFrequency,
    example: PaymentFrequency.MONTHLY,
  })
  frequency: PaymentFrequency;

  @ApiPropertyOptional({
    description:
      'When the next charge is prorated (mid-month move-in), number of days in that partial period',
    example: 17,
    nullable: true,
  })
  prorationDays?: number | null;

  @ApiPropertyOptional({
    description:
      'Human-readable proration line, e.g. "Prorated rent for 17 days"',
    nullable: true,
  })
  prorationSummary?: string | null;

  @ApiPropertyOptional({
    description:
      'When next charge is prorated, date (YYYY-MM-DD) of the first full monthly rent after that',
    example: '2024-04-01',
    nullable: true,
  })
  nextFullRentDueDate?: string | null;

  @ApiPropertyOptional({
    description:
      'Human-readable hint for first full rent, e.g. "Next full rent due on 2024-04-01"',
    nullable: true,
  })
  nextFullRentSummary?: string | null;
}

/**
 * Recent payment item for dashboard.
 */
export class TenantDashboardRecentPaymentDto {
  @ApiProperty({
    description: 'Payment ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Payment date (YYYY-MM-DD or ISO string)',
    example: '2024-01-10',
  })
  date: string;

  @ApiProperty({
    description: 'Payment amount',
    example: 1500,
  })
  amount: number;

  @ApiProperty({
    description: 'Payment method',
    example: 'BANK',
  })
  method: string;

  @ApiProperty({
    description: 'Payment status (PENDING | APPROVED | REJECTED)',
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    example: 'APPROVED',
  })
  status: TenantDashboardPaymentStatus;
}

/**
 * Lease summary for dashboard.
 */
export class TenantDashboardLeaseSummaryDto {
  @ApiProperty({
    description: 'Lease ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  leaseId: string;

  @ApiProperty({
    description: 'Unit name/number',
    example: '101',
  })
  unitName: string;

  @ApiProperty({
    description: 'Property name',
    example: 'Sunset Apartments',
  })
  propertyName: string;

  @ApiProperty({
    description: 'Lease start date (YYYY-MM-DD)',
    example: '2024-01-01',
  })
  startDate: string;

  @ApiPropertyOptional({
    description: 'Lease end date (YYYY-MM-DD)',
    example: '2025-12-31',
    nullable: true,
  })
  endDate?: string | null;
}

/**
 * Tenant dashboard response (MVP).
 */
export class TenantDashboardResponseDto {
  @ApiProperty({
    description: 'Current rent (latest invoice with status PAID/DUE/OVERDUE)',
    type: TenantDashboardCurrentRentDto,
  })
  currentRent: TenantDashboardCurrentRentDto;

  @ApiProperty({
    description: 'Outstanding balance (DUE + OVERDUE only; exclude future/pending)',
    example: 0,
  })
  outstandingBalance: number;

  @ApiProperty({
    description: 'Tenant credit balance (liability)',
    example: 0,
  })
  creditBalance: number;

  @ApiProperty({
    description: 'Next rent due (computed from lease)',
    type: TenantDashboardNextRentDto,
  })
  nextRent: TenantDashboardNextRentDto;

  @ApiProperty({
    description: 'Last 5 payments (newest first)',
    type: [TenantDashboardRecentPaymentDto],
  })
  recentPayments: TenantDashboardRecentPaymentDto[];

  @ApiProperty({
    description: 'Lease summary',
    type: TenantDashboardLeaseSummaryDto,
  })
  leaseSummary: TenantDashboardLeaseSummaryDto;
}

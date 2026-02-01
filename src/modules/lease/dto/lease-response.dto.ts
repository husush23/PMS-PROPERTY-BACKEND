import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeaseStatus } from '../../../shared/enums/lease-status.enum';
import { LeaseType } from '../../../shared/enums/lease-type.enum';
import { PaymentFrequency } from '../../../shared/enums/payment-frequency.enum';
import { LateFeeType } from '../../../shared/enums/late-fee-type.enum';

export class LeaseResponseDto {
  @ApiProperty({
    description: 'Lease ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Tenant user ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  tenantId: string;

  @ApiPropertyOptional({
    description: 'Tenant name (derived from user)',
    example: 'John Doe',
  })
  tenantName?: string;

  @ApiPropertyOptional({
    description: 'Tenant email (derived from user)',
    example: 'john.doe@example.com',
  })
  tenantEmail?: string;

  @ApiProperty({
    description: 'Unit ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  unitId: string;

  @ApiPropertyOptional({
    description: 'Unit number (derived from unit)',
    example: '101',
  })
  unitNumber?: string;

  @ApiPropertyOptional({
    description: 'Property ID (derived from unit)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  propertyId?: string;

  @ApiPropertyOptional({
    description: 'Property name (derived from unit)',
    example: 'Sunset Apartments',
  })
  propertyName?: string;

  @ApiProperty({
    description: 'Company ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  companyId: string;

  @ApiPropertyOptional({
    description: 'Landlord user ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  landlordUserId?: string;

  @ApiPropertyOptional({
    description: 'Lease number',
    example: 'LEASE-2024-001',
  })
  leaseNumber?: string;

  @ApiProperty({
    description: 'Lease status',
    enum: LeaseStatus,
    example: LeaseStatus.ACTIVE,
  })
  status: LeaseStatus;

  @ApiProperty({
    description: 'Lease type',
    enum: LeaseType,
    example: LeaseType.LONG_TERM,
  })
  leaseType: LeaseType;

  @ApiProperty({
    description: 'Lease start date',
    example: '2024-01-01',
  })
  startDate: Date;

  @ApiProperty({
    description: 'Lease end date',
    example: '2024-12-31',
  })
  endDate: Date;

  @ApiPropertyOptional({
    description: 'Move-in date',
    example: '2024-01-01',
  })
  moveInDate?: Date;

  @ApiPropertyOptional({
    description: 'Move-out date',
    example: '2024-12-31',
  })
  moveOutDate?: Date;

  @ApiPropertyOptional({
    description: 'Signed date',
    example: '2023-12-15',
  })
  signedDate?: Date;

  @ApiPropertyOptional({
    description: 'Renewal date',
    example: '2024-11-01',
  })
  renewalDate?: Date;

  @ApiPropertyOptional({
    description: 'Notice to vacate date',
    example: '2024-11-01',
  })
  noticeToVacateDate?: Date;

  // Billing Controls
  @ApiPropertyOptional({
    description: 'Billing start date',
    example: '2024-01-01',
  })
  billingStartDate?: Date;

  @ApiPropertyOptional({
    description: 'Whether first month is prorated',
    default: false,
  })
  proratedFirstMonth?: boolean;

  @ApiPropertyOptional({
    description: 'Grace period in days',
    default: 0,
  })
  gracePeriodDays?: number;

  @ApiPropertyOptional({
    description: 'Day of month when rent is due (1-28)',
    example: 5,
  })
  rentDueDay?: number;

  @ApiPropertyOptional({
    description: 'Next rent due date (derived, not authoritative)',
    example: '2024-02-05',
  })
  nextRentDueDate?: Date;

  @ApiPropertyOptional({
    description: 'Payment frequency',
    enum: PaymentFrequency,
    default: PaymentFrequency.MONTHLY,
  })
  paymentFrequency?: PaymentFrequency;

  @ApiPropertyOptional({
    description: 'Late fee type',
    enum: LateFeeType,
    default: LateFeeType.FIXED,
  })
  lateFeeType?: LateFeeType;

  @ApiPropertyOptional({
    description: 'Late fee value (amount if FIXED, percentage if PERCENTAGE)',
    example: 50.0,
  })
  lateFeeValue?: number;

  // Financial
  @ApiProperty({
    description: 'Monthly rent amount',
    example: 1500.0,
  })
  monthlyRent: number;

  @ApiPropertyOptional({
    description: 'Credit balance from advance payments',
    example: 250.0,
  })
  creditBalance?: number;

  @ApiPropertyOptional({
    description: 'Security deposit amount',
    example: 1500.0,
  })
  securityDeposit?: number;

  @ApiPropertyOptional({
    description: 'Pet deposit amount',
    example: 500.0,
  })
  petDeposit?: number;

  @ApiPropertyOptional({
    description: 'Pet rent amount per month',
    example: 50.0,
  })
  petRent?: number;

  @ApiPropertyOptional({
    description: 'Late fee amount',
    example: 50.0,
  })
  lateFeeAmount?: number;

  @ApiPropertyOptional({
    description: 'Whether utilities are included in rent',
    default: false,
  })
  utilitiesIncluded?: boolean;

  @ApiPropertyOptional({
    description: 'Utility costs if not included in rent',
    example: 100.0,
  })
  utilityCosts?: number;

  @ApiPropertyOptional({
    description: 'Currency code',
    default: 'USD',
  })
  currency?: string;

  // Termination Metadata
  @ApiPropertyOptional({
    description: 'Termination reason',
  })
  terminationReason?: string;

  @ApiPropertyOptional({
    description: 'User ID who terminated the lease',
  })
  terminatedBy?: string;

  @ApiPropertyOptional({
    description: 'Termination notes',
  })
  terminationNotes?: string;

  @ApiPropertyOptional({
    description: 'Actual termination date',
  })
  actualTerminationDate?: Date;

  // Renewal Linking
  @ApiPropertyOptional({
    description: 'Previous lease ID if this is a renewal',
  })
  renewedFromLeaseId?: string;

  @ApiPropertyOptional({
    description: 'New lease ID if this lease was renewed',
  })
  renewedToLeaseId?: string;

  // Terms & Conditions
  @ApiPropertyOptional({
    description: 'Lease term in months',
  })
  leaseTerm?: number;

  @ApiPropertyOptional({
    description: 'Renewal options',
  })
  renewalOptions?: string;

  @ApiPropertyOptional({
    description: 'Notice period in days',
  })
  noticePeriod?: number;

  @ApiPropertyOptional({
    description: 'Pet policy',
  })
  petPolicy?: string;

  @ApiPropertyOptional({
    description: 'Smoking policy',
  })
  smokingPolicy?: string;

  @ApiPropertyOptional({
    description: 'General lease terms',
  })
  terms?: string;

  // Additional
  @ApiPropertyOptional({
    description: 'Co-tenant user IDs',
    type: [String],
  })
  coTenants?: string[];

  @ApiPropertyOptional({
    description: 'Guarantor information',
  })
  guarantorInfo?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Lease document URLs',
    type: [String],
  })
  documents?: string[];

  @ApiPropertyOptional({
    description: 'Notes',
  })
  notes?: string;

  @ApiPropertyOptional({
    description: 'Tags for categorization',
    type: [String],
  })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'User ID who created the lease',
  })
  createdBy?: string;

  @ApiProperty({
    description: 'Created at timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Updated at timestamp',
  })
  updatedAt: Date;
}

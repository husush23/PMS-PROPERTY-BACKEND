import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TenantResponseDto } from './tenant-response.dto';
import { LeaseStatus } from '../../../shared/enums/lease-status.enum';

/**
 * Summary of an active lease for a tenant (for details view).
 */
export class TenantActiveLeaseSummaryDto {
  @ApiProperty({
    description: 'Lease ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Unit ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  unitId: string;

  @ApiProperty({
    description: 'Unit number',
    example: '101',
  })
  unitNumber: string;

  @ApiProperty({
    description: 'Property ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  propertyId: string;

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

  @ApiProperty({
    description: 'Lease end date (YYYY-MM-DD)',
    example: '2025-12-31',
  })
  endDate: string;

  @ApiProperty({
    description: 'Lease status',
    enum: LeaseStatus,
    example: LeaseStatus.ACTIVE,
  })
  status: LeaseStatus;

  @ApiPropertyOptional({
    description: 'Monthly rent',
    example: 1500,
    nullable: true,
  })
  monthlyRent?: number | null;

  @ApiPropertyOptional({
    description: 'Lease number',
    example: 'LEASE-2024-001',
    nullable: true,
  })
  leaseNumber?: string | null;
}

/**
 * Financial summary for the tenant (e.g. current month across all leases).
 */
export class TenantFinancialSummaryDto {
  @ApiProperty({
    description: 'Currency code',
    example: 'KES',
  })
  currency: string;

  @ApiProperty({
    description: 'Total rent invoiced for the period',
    example: 3000,
  })
  totalRentDue: number;

  @ApiProperty({
    description: 'Total rent collected for the period',
    example: 3000,
  })
  totalRentCollected: number;

  @ApiProperty({
    description: 'Outstanding balance (invoiced - collected)',
    example: 0,
  })
  outstandingBalance: number;

  @ApiPropertyOptional({
    description: 'Period start (YYYY-MM-DD)',
    example: '2025-01-01',
    nullable: true,
  })
  periodStart?: string | null;

  @ApiPropertyOptional({
    description: 'Period end (YYYY-MM-DD)',
    example: '2025-01-31',
    nullable: true,
  })
  periodEnd?: string | null;
}

/**
 * Tenant details response including active leases and financial summary.
 * Used for GET /tenants/:id.
 */
export class TenantDetailsResponseDto extends TenantResponseDto {
  @ApiProperty({
    description: 'Active leases for this tenant',
    type: [TenantActiveLeaseSummaryDto],
    example: [],
  })
  activeLeases: TenantActiveLeaseSummaryDto[];

  @ApiPropertyOptional({
    description: 'Financial summary for current month (null if no active leases)',
    type: TenantFinancialSummaryDto,
    nullable: true,
  })
  financialSummary?: TenantFinancialSummaryDto | null;
}

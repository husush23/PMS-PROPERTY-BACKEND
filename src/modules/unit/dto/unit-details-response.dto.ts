import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UnitResponseDto } from './unit-response.dto';
import { LeaseStatus } from '../../../shared/enums/lease-status.enum';

/**
 * Summary of the current lease for a unit (when occupied).
 */
export class UnitCurrentLeaseSummaryDto {
  @ApiProperty({
    description: 'Lease ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

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

  @ApiProperty({
    description: 'Tenant user ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  tenantId: string;

  @ApiPropertyOptional({
    description: 'Tenant display name',
    example: 'John Doe',
    nullable: true,
  })
  tenantName?: string | null;

  @ApiPropertyOptional({
    description: 'Tenant email',
    example: 'john.doe@example.com',
    nullable: true,
  })
  tenantEmail?: string | null;

  @ApiPropertyOptional({
    description: 'Monthly rent for this lease',
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
 * Financial summary for the unit (e.g. current month).
 */
export class UnitFinancialSummaryDto {
  @ApiProperty({
    description: 'Currency code',
    example: 'KES',
  })
  currency: string;

  @ApiProperty({
    description: 'Total rent invoiced for the period',
    example: 1500,
  })
  totalRentDue: number;

  @ApiProperty({
    description: 'Total rent collected for the period',
    example: 1500,
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
 * Unit details response including property name, current lease (if any), and financial summary.
 * Used for GET /units/:id.
 */
export class UnitDetailsResponseDto extends UnitResponseDto {
  @ApiProperty({
    description: 'Property name the unit belongs to',
    example: 'Sunset Apartments',
  })
  propertyName: string;

  @ApiPropertyOptional({
    description: 'Current active lease (null if unit is vacant)',
    type: UnitCurrentLeaseSummaryDto,
    nullable: true,
  })
  currentLease?: UnitCurrentLeaseSummaryDto | null;

  @ApiPropertyOptional({
    description: 'Financial summary for current month (null if no lease)',
    type: UnitFinancialSummaryDto,
    nullable: true,
  })
  financial?: UnitFinancialSummaryDto | null;
}

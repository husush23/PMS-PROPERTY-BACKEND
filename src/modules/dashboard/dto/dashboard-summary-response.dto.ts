import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardRecentActivityItemDto {
  @ApiProperty({
    description: 'Activity type',
    enum: ['payment', 'lease_started'],
    example: 'payment',
  })
  type: 'payment' | 'lease_started';

  @ApiProperty({
    description: 'Human-readable title/description',
    example: 'Payment received: $1,500 from John Doe',
  })
  title: string;

  @ApiProperty({
    description: 'ISO date string of the event',
    example: '2026-02-01',
  })
  date: string;

  @ApiPropertyOptional({
    description: 'Entity ID for linking',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id?: string;

  @ApiPropertyOptional({
    description: 'Additional context (e.g. tenant name, unit number)',
  })
  metadata?: Record<string, unknown>;
}

export class DashboardSummaryResponseDto {
  @ApiProperty({ description: 'Total number of properties', example: 12 })
  totalProperties: number;

  @ApiProperty({
    description: 'Count of tenants with at least one active lease',
    example: 45,
  })
  activeTenants: number;

  @ApiProperty({
    description: 'Total revenue collected in the period (e.g. current month)',
    example: 125000,
  })
  totalRevenue: number;

  @ApiPropertyOptional({
    description: 'Revenue growth rate vs previous period (percentage)',
    example: 5.2,
  })
  growthRate?: number;

  @ApiPropertyOptional({
    description: 'Total outstanding balance (DUE + OVERDUE)',
    example: 15000,
  })
  outstandingBalance?: number;

  @ApiPropertyOptional({
    description: 'Occupancy rate (0-100)',
    example: 92,
  })
  occupancyRate?: number;

  @ApiPropertyOptional({
    description: 'Occupied units count',
    example: 46,
  })
  occupiedUnits?: number;

  @ApiPropertyOptional({
    description: 'Total units count',
    example: 50,
  })
  totalUnits?: number;

  @ApiPropertyOptional({
    description: 'Company default currency for formatting',
    example: 'USD',
  })
  currency?: string;

  @ApiPropertyOptional({
    description: 'Recent activity items (payments, lease starts)',
    type: [DashboardRecentActivityItemDto],
  })
  recentActivity?: DashboardRecentActivityItemDto[];
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PropertyResponseDto } from './property-response.dto';

/**
 * Occupancy summary for a property (e.g. as of today).
 */
export class PropertyOccupancySummaryDto {
  @ApiProperty({
    description: 'Number of units with an active lease',
    example: 42,
  })
  occupiedUnits: number;

  @ApiProperty({
    description: 'Total number of active units at the property',
    example: 50,
  })
  totalUnits: number;

  @ApiProperty({
    description: 'Occupancy rate (0-100)',
    example: 84,
  })
  occupancyRatePercent: number;

  @ApiPropertyOptional({
    description: 'Date the occupancy snapshot is for (YYYY-MM-DD)',
    example: '2025-01-30',
    nullable: true,
  })
  asOfDate?: string;
}

/**
 * Financial summary for a property (e.g. current month).
 */
export class PropertyFinancialSummaryDto {
  @ApiProperty({
    description: 'Currency code',
    example: 'KES',
  })
  currency: string;

  @ApiProperty({
    description: 'Total rent invoiced for the period',
    example: 500000,
  })
  totalRentDue: number;

  @ApiProperty({
    description: 'Total rent collected for the period',
    example: 480000,
  })
  totalRentCollected: number;

  @ApiProperty({
    description: 'Outstanding balance (invoiced - collected)',
    example: 20000,
  })
  outstandingBalance: number;

  @ApiPropertyOptional({
    description: 'Period start (YYYY-MM-DD)',
    example: '2025-01-01',
    nullable: true,
  })
  periodStart?: string;

  @ApiPropertyOptional({
    description: 'Period end (YYYY-MM-DD)',
    example: '2025-01-31',
    nullable: true,
  })
  periodEnd?: string;
}

/**
 * Property details response including occupancy and financial summary.
 * Used for GET /properties/:id.
 */
export class PropertyDetailsResponseDto extends PropertyResponseDto {
  @ApiPropertyOptional({
    description: 'Occupancy summary as of today',
    type: PropertyOccupancySummaryDto,
    nullable: true,
  })
  occupancy?: PropertyOccupancySummaryDto | null;

  @ApiPropertyOptional({
    description: 'Financial summary for current month',
    type: PropertyFinancialSummaryDto,
    nullable: true,
  })
  financial?: PropertyFinancialSummaryDto | null;
}

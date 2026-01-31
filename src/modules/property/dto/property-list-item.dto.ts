import { ApiProperty } from '@nestjs/swagger';
import { PropertyResponseDto } from './property-response.dto';

/**
 * List item for GET /properties. Includes basic property info plus occupancy for card lists.
 */
export class PropertyListItemDto extends PropertyResponseDto {
  @ApiProperty({
    description: 'Number of units with an active lease',
    example: 42,
  })
  declare occupiedUnits: number;

  @ApiProperty({
    description: 'Occupancy rate (0-100). Percentage of units that are occupied.',
    example: 84,
  })
  occupancyRatePercent: number;
}

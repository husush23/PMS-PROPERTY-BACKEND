import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UnitResponseDto } from './unit-response.dto';

/**
 * List item for GET /units. Includes basic unit info plus property name and occupancy.
 */
export class UnitListItemDto extends UnitResponseDto {
  @ApiProperty({
    description: 'Property name the unit belongs to',
    example: 'Sunset Apartments',
  })
  propertyName: string;

  @ApiProperty({
    description: 'Whether the unit is currently occupied or vacant',
    enum: ['occupied', 'vacant'],
    example: 'occupied',
  })
  occupancyStatus: 'occupied' | 'vacant';

  @ApiPropertyOptional({
    description: 'Current active lease ID (present when occupancyStatus is occupied)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
  currentLeaseId?: string | null;
}

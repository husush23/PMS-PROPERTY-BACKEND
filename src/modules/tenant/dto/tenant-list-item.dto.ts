import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TenantResponseDto } from './tenant-response.dto';

/**
 * List item for GET /tenants. Includes basic tenant info plus current unit/property for card lists.
 */
export class TenantListItemDto extends TenantResponseDto {
  @ApiProperty({
    description: 'Number of active leases for this tenant',
    example: 1,
  })
  activeLeaseCount: number;

  @ApiPropertyOptional({
    description: 'Unit number of current/primary active lease (null if none)',
    example: '101',
    nullable: true,
  })
  currentUnitNumber?: string | null;

  @ApiPropertyOptional({
    description: 'Property name of current/primary active lease (null if none)',
    example: 'Sunset Apartments',
    nullable: true,
  })
  currentPropertyName?: string | null;
}

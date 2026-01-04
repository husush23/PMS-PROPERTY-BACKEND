import { ApiProperty } from '@nestjs/swagger';

export class CreateUnitsGroupResponseDto {
  @ApiProperty({
    description: 'Number of units created',
    example: 15,
  })
  createdUnits: number;

  @ApiProperty({
    description: 'Property ID where units were created',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  propertyId: string;
}


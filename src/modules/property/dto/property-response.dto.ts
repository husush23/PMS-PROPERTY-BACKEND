import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PropertyType } from '../../../shared/enums/property-type.enum';
import { PropertyStatus } from '../../../shared/enums/property-status.enum';

export class PropertyResponseDto {
  @ApiProperty({
    description: 'Property unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Property name',
    example: 'Sunset Apartments',
  })
  name: string;

  @ApiProperty({
    description: 'Company ID that owns the property',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  companyId: string;

  @ApiProperty({
    description: 'Property type',
    enum: PropertyType,
    example: PropertyType.APARTMENT,
  })
  propertyType: PropertyType;

  @ApiProperty({
    description: 'Property status',
    enum: PropertyStatus,
    example: PropertyStatus.AVAILABLE,
  })
  status: PropertyStatus;

  @ApiPropertyOptional({
    description: 'Street address',
    example: '123 Main Street',
    nullable: true,
  })
  address: string | null;

  @ApiPropertyOptional({
    description: 'City',
    example: 'New York',
    nullable: true,
  })
  city: string | null;

  @ApiPropertyOptional({
    description: 'State or Province',
    example: 'NY',
    nullable: true,
  })
  state: string | null;

  @ApiPropertyOptional({
    description: 'ZIP or Postal code',
    example: '10001',
    nullable: true,
  })
  zipCode: string | null;

  @ApiPropertyOptional({
    description: 'Country',
    example: 'United States',
    nullable: true,
  })
  country: string | null;

  @ApiPropertyOptional({
    description: 'Contact phone number',
    example: '+1234567890',
    nullable: true,
  })
  phone: string | null;

  @ApiPropertyOptional({
    description: 'Contact email address',
    example: 'property@example.com',
    nullable: true,
  })
  email: string | null;

  @ApiPropertyOptional({
    description: 'Property description',
    example: 'A beautiful apartment complex in the heart of the city',
    nullable: true,
  })
  description: string | null;

  @ApiPropertyOptional({
    description: 'Latitude coordinate',
    example: 40.7128,
    nullable: true,
  })
  latitude: number | null;

  @ApiPropertyOptional({
    description: 'Longitude coordinate',
    example: -74.006,
    nullable: true,
  })
  longitude: number | null;

  @ApiPropertyOptional({
    description: 'Year the property was built',
    example: 2020,
    nullable: true,
  })
  yearBuilt: number | null;

  @ApiPropertyOptional({
    description: 'Total square footage',
    example: 50000,
    nullable: true,
  })
  squareFootage: number | null;

  @ApiPropertyOptional({
    description: 'Number of floors',
    example: 5,
    nullable: true,
  })
  floors: number | null;

  @ApiPropertyOptional({
    description: 'Number of parking spaces',
    example: 20,
    nullable: true,
  })
  parkingSpaces: number | null;

  @ApiPropertyOptional({
    description: 'Total number of units',
    example: 50,
    nullable: true,
  })
  totalUnits: number | null;

  @ApiPropertyOptional({
    description:
      'Number of units (computed from Units relation, 0 if no units exist)',
    example: 45,
  })
  numberOfUnits: number;

  @ApiPropertyOptional({
    description: 'Array of image URLs',
    example: ['https://example.com/image1.jpg'],
    type: [String],
    nullable: true,
  })
  images: string[] | null;

  @ApiProperty({
    description: 'Property active status',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Property creation timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Property last update timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;
}

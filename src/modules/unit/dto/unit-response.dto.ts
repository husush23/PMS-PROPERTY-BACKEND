import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UnitStatus } from '../../../shared/enums/unit-status.enum';
import { UnitType } from '../../../shared/enums/unit-type.enum';
import { LeaseType } from '../../../shared/enums/lease-type.enum';

export class UnitResponseDto {
  @ApiProperty({
    description: 'Unit unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Property ID that the unit belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  propertyId: string;

  @ApiProperty({
    description: 'Company ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  companyId: string;

  @ApiProperty({
    description: 'Unit number or identifier',
    example: '101',
  })
  unitNumber: string;

  @ApiProperty({
    description: 'Unit status',
    enum: UnitStatus,
    example: UnitStatus.AVAILABLE,
  })
  status: UnitStatus;

  @ApiProperty({
    description: 'Unit type',
    enum: UnitType,
    example: UnitType.ONE_BEDROOM,
  })
  unitType: UnitType;

  @ApiProperty({
    description: 'Monthly rent amount',
    example: 1500.00,
  })
  monthlyRent: number;

  @ApiPropertyOptional({
    description: 'Square footage',
    example: 800,
    nullable: true,
  })
  squareFootage: number | null;

  @ApiPropertyOptional({
    description: 'Number of bedrooms',
    example: 2,
    nullable: true,
  })
  bedrooms: number | null;

  @ApiPropertyOptional({
    description: 'Number of bathrooms',
    example: 1.5,
    nullable: true,
  })
  bathrooms: number | null;

  @ApiPropertyOptional({
    description: 'Security deposit amount',
    example: 1500.00,
    nullable: true,
  })
  depositAmount: number | null;

  @ApiPropertyOptional({
    description: 'Floor number',
    example: 3,
    nullable: true,
  })
  floorNumber: number | null;

  @ApiPropertyOptional({
    description: 'Unit description',
    example: 'Beautiful one-bedroom apartment with great views',
    nullable: true,
  })
  description: string | null;

  @ApiPropertyOptional({
    description: 'Array of image URLs',
    example: ['https://example.com/image1.jpg'],
    type: [String],
    nullable: true,
  })
  images: string[] | null;

  @ApiPropertyOptional({
    description: 'Array of unit features',
    example: ['balcony', 'furnished', 'AC'],
    type: [String],
    nullable: true,
  })
  features: string[] | null;

  @ApiPropertyOptional({
    description: 'Internal notes',
    example: 'Recently renovated',
    nullable: true,
  })
  notes: string | null;

  @ApiPropertyOptional({
    description: 'Lease type',
    enum: LeaseType,
    example: LeaseType.LONG_TERM,
    nullable: true,
  })
  leaseType: LeaseType | null;

  @ApiPropertyOptional({
    description: 'Has parking included',
    example: true,
    nullable: true,
  })
  hasParking: boolean | null;

  @ApiPropertyOptional({
    description: 'Parking spot number',
    example: 'P-12',
    nullable: true,
  })
  parkingSpotNumber: string | null;

  @ApiPropertyOptional({
    description: 'Pet friendly',
    example: false,
    nullable: true,
  })
  petFriendly: boolean | null;

  @ApiPropertyOptional({
    description: 'Furnished unit',
    example: true,
    nullable: true,
  })
  furnished: boolean | null;

  @ApiPropertyOptional({
    description: 'Utilities included in rent',
    example: true,
    nullable: true,
  })
  utilitiesIncluded: boolean | null;

  @ApiPropertyOptional({
    description: 'Notes about utilities',
    example: 'Water and electricity included',
    nullable: true,
  })
  utilityNotes: string | null;

  @ApiPropertyOptional({
    description: 'Late fee amount',
    example: 50.00,
    nullable: true,
  })
  lateFeeAmount: number | null;

  @ApiPropertyOptional({
    description: 'Pet deposit amount',
    example: 300.00,
    nullable: true,
  })
  petDeposit: number | null;

  @ApiPropertyOptional({
    description: 'Additional monthly pet rent',
    example: 50.00,
    nullable: true,
  })
  petRent: number | null;

  @ApiPropertyOptional({
    description: 'Access code or key identifier',
    example: '1234',
    nullable: true,
  })
  accessCode: string | null;

  @ApiProperty({
    description: 'Unit active status',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Unit creation timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Unit last update timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;
}


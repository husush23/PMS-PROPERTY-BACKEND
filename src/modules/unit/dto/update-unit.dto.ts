import { IsOptional, IsEnum, IsString, IsNumber, IsArray, IsBoolean, IsUUID, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UnitStatus } from '../../../shared/enums/unit-status.enum';
import { UnitType } from '../../../shared/enums/unit-type.enum';
import { LeaseType } from '../../../shared/enums/lease-type.enum';

export class UpdateUnitDto {
  @ApiPropertyOptional({
    description: 'Property ID that the unit belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Property ID must be a valid UUID' })
  propertyId?: string;

  @ApiPropertyOptional({
    description: 'Company ID (will be auto-populated from Property if not provided)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Company ID must be a valid UUID' })
  companyId?: string;

  @ApiPropertyOptional({
    description: 'Unit number or identifier',
    example: '101',
  })
  @IsOptional()
  @IsString()
  unitNumber?: string;

  @ApiPropertyOptional({
    description: 'Unit status',
    enum: UnitStatus,
    example: UnitStatus.AVAILABLE,
  })
  @IsOptional()
  @IsEnum(UnitStatus, { message: 'Status must be a valid UnitStatus enum value' })
  status?: UnitStatus;

  @ApiPropertyOptional({
    description: 'Unit type',
    enum: UnitType,
    example: UnitType.ONE_BEDROOM,
  })
  @IsOptional()
  @IsEnum(UnitType, { message: 'Unit type must be a valid UnitType enum value' })
  unitType?: UnitType;

  @ApiPropertyOptional({
    description: 'Monthly rent amount',
    example: 1500.00,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Monthly rent must be a valid number with up to 2 decimal places' })
  @Min(0, { message: 'Monthly rent must be a positive number' })
  @Type(() => Number)
  monthlyRent?: number;

  @ApiPropertyOptional({
    description: 'Square footage',
    example: 800,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Square footage must be an integer' })
  @Min(0, { message: 'Square footage must be a positive number' })
  squareFootage?: number;

  @ApiPropertyOptional({
    description: 'Number of bedrooms',
    example: 2,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Bedrooms must be an integer' })
  @Min(0, { message: 'Bedrooms must be a non-negative number' })
  bedrooms?: number;

  @ApiPropertyOptional({
    description: 'Number of bathrooms (can include half bathrooms, e.g., 1.5)',
    example: 1.5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 }, { message: 'Bathrooms must be a valid number with up to 1 decimal place' })
  @Min(0, { message: 'Bathrooms must be a non-negative number' })
  bathrooms?: number;

  @ApiPropertyOptional({
    description: 'Security deposit amount',
    example: 1500.00,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Deposit amount must be a valid number with up to 2 decimal places' })
  @Min(0, { message: 'Deposit amount must be a positive number' })
  depositAmount?: number;

  @ApiPropertyOptional({
    description: 'Floor number',
    example: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Floor number must be an integer' })
  floorNumber?: number;

  @ApiPropertyOptional({
    description: 'Unit description',
    example: 'Beautiful one-bedroom apartment with great views',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Array of image URLs',
    example: ['https://example.com/image1.jpg'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({
    description: 'Array of unit features',
    example: ['balcony', 'furnished', 'AC'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @ApiPropertyOptional({
    description: 'Internal notes',
    example: 'Recently renovated',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Lease type',
    enum: LeaseType,
    example: LeaseType.LONG_TERM,
  })
  @IsOptional()
  @IsEnum(LeaseType, { message: 'Lease type must be a valid LeaseType enum value' })
  leaseType?: LeaseType;

  @ApiPropertyOptional({
    description: 'Has parking included',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasParking?: boolean;

  @ApiPropertyOptional({
    description: 'Parking spot number or identifier',
    example: 'P-12',
  })
  @IsOptional()
  @IsString()
  parkingSpotNumber?: string;

  @ApiPropertyOptional({
    description: 'Pet friendly',
    example: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  petFriendly?: boolean;

  @ApiPropertyOptional({
    description: 'Furnished unit',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  furnished?: boolean;

  @ApiPropertyOptional({
    description: 'Utilities included in rent',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  utilitiesIncluded?: boolean;

  @ApiPropertyOptional({
    description: 'Notes about utilities',
    example: 'Water and electricity included',
  })
  @IsOptional()
  @IsString()
  utilityNotes?: string;

  @ApiPropertyOptional({
    description: 'Late fee amount',
    example: 50.00,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Late fee amount must be a valid number with up to 2 decimal places' })
  @Min(0, { message: 'Late fee amount must be a positive number' })
  lateFeeAmount?: number;

  @ApiPropertyOptional({
    description: 'Pet deposit amount',
    example: 300.00,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Pet deposit must be a valid number with up to 2 decimal places' })
  @Min(0, { message: 'Pet deposit must be a positive number' })
  petDeposit?: number;

  @ApiPropertyOptional({
    description: 'Additional monthly pet rent',
    example: 50.00,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Pet rent must be a valid number with up to 2 decimal places' })
  @Min(0, { message: 'Pet rent must be a positive number' })
  petRent?: number;

  @ApiPropertyOptional({
    description: 'Access code or key identifier',
    example: '1234',
  })
  @IsOptional()
  @IsString()
  accessCode?: string;

  @ApiPropertyOptional({
    description: 'Unit active status',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}

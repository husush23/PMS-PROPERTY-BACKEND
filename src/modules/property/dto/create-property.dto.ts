import {
  IsString,
  IsEnum,
  IsOptional,
  IsEmail,
  IsInt,
  Min,
  IsArray,
  IsUUID,
  IsLatitude,
  IsLongitude,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PropertyType } from '../../../shared/enums/property-type.enum';
import { PropertyStatus } from '../../../shared/enums/property-status.enum';

export class CreatePropertyDto {
  @ApiProperty({
    description: 'Property name',
    example: 'Sunset Apartments',
  })
  @IsString()
  @MinLength(2, { message: 'Property name must be at least 2 characters long' })
  name: string;

  @ApiProperty({
    description: 'Company ID that owns the property',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4', { message: 'Company ID must be a valid UUID' })
  companyId: string;

  @ApiProperty({
    description: 'Property type',
    enum: PropertyType,
    example: PropertyType.APARTMENT,
  })
  @IsEnum(PropertyType, {
    message: 'Property type must be a valid PropertyType enum value',
  })
  propertyType: PropertyType;

  @ApiPropertyOptional({
    description: 'Property status',
    enum: PropertyStatus,
    example: PropertyStatus.AVAILABLE,
  })
  @IsOptional()
  @IsEnum(PropertyStatus, {
    message: 'Status must be a valid PropertyStatus enum value',
  })
  status?: PropertyStatus;

  @ApiPropertyOptional({
    description: 'Street address',
    example: '123 Main Street',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'City',
    example: 'New York',
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'State or Province',
    example: 'NY',
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({
    description: 'ZIP or Postal code',
    example: '10001',
  })
  @IsOptional()
  @IsString()
  zipCode?: string;

  @ApiPropertyOptional({
    description: 'Country',
    example: 'United States',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    description: 'Contact phone number',
    example: '+1234567890',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Contact email address',
    example: 'property@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @ApiPropertyOptional({
    description: 'Property description',
    example: 'A beautiful apartment complex in the heart of the city',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Latitude coordinate',
    example: 40.7128,
  })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude({ message: 'Latitude must be a valid latitude value' })
  latitude?: number;

  @ApiPropertyOptional({
    description: 'Longitude coordinate',
    example: -74.006,
  })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude({ message: 'Longitude must be a valid longitude value' })
  longitude?: number;

  @ApiPropertyOptional({
    description: 'Year the property was built',
    example: 2020,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Year built must be an integer' })
  @Min(1800, { message: 'Year built must be after 1800' })
  yearBuilt?: number;

  @ApiPropertyOptional({
    description: 'Total square footage',
    example: 50000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Square footage must be an integer' })
  @Min(0, { message: 'Square footage must be a positive number' })
  squareFootage?: number;

  @ApiPropertyOptional({
    description: 'Number of floors',
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Floors must be an integer' })
  @Min(0, { message: 'Floors must be a positive number' })
  floors?: number;

  @ApiPropertyOptional({
    description: 'Number of parking spaces',
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Parking spaces must be an integer' })
  @Min(0, { message: 'Parking spaces must be a positive number' })
  parkingSpaces?: number;

  @ApiPropertyOptional({
    description: 'Total number of units (can be auto-counted from Units table)',
    example: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Total units must be an integer' })
  @Min(0, { message: 'Total units must be a positive number' })
  totalUnits?: number;

  @ApiPropertyOptional({
    description: 'Array of image URLs',
    example: [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg',
    ],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}

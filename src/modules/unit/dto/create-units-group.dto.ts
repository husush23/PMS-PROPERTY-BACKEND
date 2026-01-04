import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UnitType } from '../../../shared/enums/unit-type.enum';

export class UnitGroupDto {
  @ApiProperty({
    description: 'Number of units to create in this group',
    example: 10,
    minimum: 1,
  })
  @IsInt({ message: 'Count must be an integer' })
  @Min(1, { message: 'Count must be at least 1' })
  @Type(() => Number)
  count: number;

  @ApiPropertyOptional({
    description: 'Number of bedrooms',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Bedrooms must be an integer' })
  @Min(0, { message: 'Bedrooms must be a non-negative number' })
  bedrooms?: number;

  @ApiPropertyOptional({
    description: 'Number of bathrooms (can include half bathrooms, e.g., 1.5)',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 1 },
    { message: 'Bathrooms must be a valid number with up to 1 decimal place' },
  )
  @Min(0, { message: 'Bathrooms must be a non-negative number' })
  bathrooms?: number;

  @ApiProperty({
    description: 'Monthly rent amount',
    example: 500.0,
    minimum: 0,
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'Rent must be a valid number with up to 2 decimal places',
    },
  )
  @Min(0, { message: 'Rent must be a positive number' })
  @Type(() => Number)
  rent: number;

  @ApiPropertyOptional({
    description: 'Square footage (size)',
    example: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Size must be an integer' })
  @Min(0, { message: 'Size must be a positive number' })
  size?: number;

  @ApiPropertyOptional({
    description: 'Unit type (if not provided, will be derived from bedrooms)',
    enum: UnitType,
    example: UnitType.ONE_BEDROOM,
  })
  @IsOptional()
  @IsEnum(UnitType, {
    message: 'Unit type must be a valid UnitType enum value',
  })
  unitType?: UnitType;

  @ApiPropertyOptional({
    description: 'Security deposit amount',
    example: 500.0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'Deposit amount must be a valid number with up to 2 decimal places',
    },
  )
  @Min(0, { message: 'Deposit amount must be a positive number' })
  depositAmount?: number;

  @ApiPropertyOptional({
    description: 'Floor number',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Floor number must be an integer' })
  floorNumber?: number;

  @ApiPropertyOptional({
    description: 'Unit description',
    example: 'Standard unit',
  })
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Internal notes',
    example: 'Group created units',
  })
  @IsOptional()
  notes?: string;
}

export class CreateUnitsGroupDto {
  @ApiProperty({
    description: 'Array of unit groups to create',
    type: [UnitGroupDto],
    example: [
      {
        count: 10,
        bedrooms: 1,
        bathrooms: 1,
        rent: 500,
        size: 50,
      },
      {
        count: 5,
        bedrooms: 2,
        bathrooms: 2,
        rent: 800,
        size: 80,
      },
    ],
  })
  @IsArray({ message: 'Groups must be an array' })
  @ValidateNested({ each: true })
  @Type(() => UnitGroupDto)
  groups: UnitGroupDto[];
}


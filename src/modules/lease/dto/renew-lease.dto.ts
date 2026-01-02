import {
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  IsNumber,
  IsBoolean,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeaseType } from '../../../shared/enums/lease-type.enum';

export class RenewLeaseDto {
  @ApiProperty({
    description: 'New lease start date',
    example: '2025-01-01',
  })
  @IsDateString({}, { message: 'Start date must be a valid date string' })
  startDate: string;

  @ApiProperty({
    description: 'New lease end date',
    example: '2025-12-31',
  })
  @IsDateString({}, { message: 'End date must be a valid date string' })
  endDate: string;

  @ApiProperty({
    description: 'New monthly rent amount',
    example: 1600.0,
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'Monthly rent must be a valid number with up to 2 decimal places',
    },
  )
  @Min(0, { message: 'Monthly rent must be a positive number' })
  @Type(() => Number)
  monthlyRent: number;

  @ApiPropertyOptional({
    description: 'Lease type',
    enum: LeaseType,
  })
  @IsOptional()
  @IsEnum(LeaseType, {
    message: 'Lease type must be a valid LeaseType enum value',
  })
  leaseType?: LeaseType;

  @ApiPropertyOptional({
    description: 'New security deposit amount',
    example: 1600.0,
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'Security deposit must be a valid number with up to 2 decimal places',
    },
  )
  @Min(0, { message: 'Security deposit must be a positive number' })
  @Type(() => Number)
  securityDeposit?: number;

  @ApiPropertyOptional({
    description: 'Whether first month is prorated',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  proratedFirstMonth?: boolean;

  @ApiPropertyOptional({
    description: 'Grace period in days',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(0, { message: 'Grace period days must be a non-negative number' })
  gracePeriodDays?: number;
}

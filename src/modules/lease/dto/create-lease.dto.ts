import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsDateString,
  IsNumber,
  IsBoolean,
  IsInt,
  IsArray,
  IsObject,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeaseType } from '../../../shared/enums/lease-type.enum';

export class CreateLeaseDto {
  @ApiProperty({
    description: 'Tenant user ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4', { message: 'Tenant ID must be a valid UUID' })
  tenantId: string;

  @ApiProperty({
    description: 'Unit ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4', { message: 'Unit ID must be a valid UUID' })
  unitId: string;

  @ApiPropertyOptional({
    description: 'Landlord user ID (optional, defaults to company admin)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Landlord user ID must be a valid UUID' })
  landlordUserId?: string;

  @ApiPropertyOptional({
    description: 'Lease number (auto-generated if not provided)',
    example: 'LEASE-2024-001',
  })
  @IsOptional()
  @IsString()
  leaseNumber?: string;

  @ApiProperty({
    description: 'Lease type',
    enum: LeaseType,
    example: LeaseType.LONG_TERM,
  })
  @IsEnum(LeaseType, { message: 'Lease type must be a valid LeaseType enum value' })
  leaseType: LeaseType;

  @ApiProperty({
    description: 'Lease start date',
    example: '2024-01-01',
  })
  @IsDateString({}, { message: 'Start date must be a valid date string' })
  startDate: string;

  @ApiProperty({
    description: 'Lease end date',
    example: '2024-12-31',
  })
  @IsDateString({}, { message: 'End date must be a valid date string' })
  endDate: string;

  @ApiPropertyOptional({
    description: 'Move-in date',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Move-in date must be a valid date string' })
  moveInDate?: string;

  @ApiPropertyOptional({
    description: 'Move-out date',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Move-out date must be a valid date string' })
  moveOutDate?: string;

  @ApiPropertyOptional({
    description: 'Signed date',
    example: '2023-12-15',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Signed date must be a valid date string' })
  signedDate?: string;

  @ApiPropertyOptional({
    description: 'Renewal date',
    example: '2024-11-01',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Renewal date must be a valid date string' })
  renewalDate?: string;

  @ApiPropertyOptional({
    description: 'Notice to vacate date',
    example: '2024-11-01',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Notice to vacate date must be a valid date string' })
  noticeToVacateDate?: string;

  // Billing Controls
  @ApiPropertyOptional({
    description: 'Billing start date (can differ from startDate)',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Billing start date must be a valid date string' })
  billingStartDate?: string;

  @ApiPropertyOptional({
    description: 'Whether first month is prorated',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  proratedFirstMonth?: boolean;

  @ApiPropertyOptional({
    description: 'Grace period in days after due date before late fees',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Grace period days must be an integer' })
  @Min(0, { message: 'Grace period days must be a non-negative number' })
  gracePeriodDays?: number;

  // Financial
  @ApiProperty({
    description: 'Monthly rent amount',
    example: 1500.00,
  })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Monthly rent must be a valid number with up to 2 decimal places' })
  @Min(0, { message: 'Monthly rent must be a positive number' })
  @Type(() => Number)
  monthlyRent: number;

  @ApiPropertyOptional({
    description: 'Security deposit amount',
    example: 1500.00,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Security deposit must be a valid number with up to 2 decimal places' })
  @Min(0, { message: 'Security deposit must be a positive number' })
  @Type(() => Number)
  securityDeposit?: number;

  @ApiPropertyOptional({
    description: 'Pet deposit amount',
    example: 500.00,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Pet deposit must be a valid number with up to 2 decimal places' })
  @Min(0, { message: 'Pet deposit must be a positive number' })
  @Type(() => Number)
  petDeposit?: number;

  @ApiPropertyOptional({
    description: 'Pet rent amount per month',
    example: 50.00,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Pet rent must be a valid number with up to 2 decimal places' })
  @Min(0, { message: 'Pet rent must be a positive number' })
  @Type(() => Number)
  petRent?: number;

  @ApiPropertyOptional({
    description: 'Late fee amount',
    example: 50.00,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Late fee amount must be a valid number with up to 2 decimal places' })
  @Min(0, { message: 'Late fee amount must be a positive number' })
  @Type(() => Number)
  lateFeeAmount?: number;

  @ApiPropertyOptional({
    description: 'Whether utilities are included in rent',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  utilitiesIncluded?: boolean;

  @ApiPropertyOptional({
    description: 'Utility costs if not included in rent',
    example: 100.00,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Utility costs must be a valid number with up to 2 decimal places' })
  @Min(0, { message: 'Utility costs must be a positive number' })
  @Type(() => Number)
  utilityCosts?: number;

  @ApiPropertyOptional({
    description: 'Currency code (default: KES)',
    default: 'KES',
    example: 'KES',
  })
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Currency code must be at least 3 characters' })
  currency?: string;

  // Terms & Conditions
  @ApiPropertyOptional({
    description: 'Lease term in months',
    example: 12,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Lease term must be an integer' })
  @Min(1, { message: 'Lease term must be at least 1 month' })
  leaseTerm?: number;

  @ApiPropertyOptional({
    description: 'Renewal options',
    example: 'Option to renew for 12 months at market rate',
  })
  @IsOptional()
  @IsString()
  renewalOptions?: string;

  @ApiPropertyOptional({
    description: 'Notice period in days',
    example: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Notice period must be an integer' })
  @Min(0, { message: 'Notice period must be a non-negative number' })
  noticePeriod?: number;

  @ApiPropertyOptional({
    description: 'Pet policy',
    example: 'Dogs and cats allowed, max 2 pets, breed restrictions apply',
  })
  @IsOptional()
  @IsString()
  petPolicy?: string;

  @ApiPropertyOptional({
    description: 'Smoking policy',
    example: 'No smoking allowed inside the unit',
  })
  @IsOptional()
  @IsString()
  smokingPolicy?: string;

  @ApiPropertyOptional({
    description: 'General lease terms',
    example: 'Standard lease terms apply',
  })
  @IsOptional()
  @IsString()
  terms?: string;

  // Additional
  @ApiPropertyOptional({
    description: 'Co-tenant user IDs',
    example: ['123e4567-e89b-12d3-a456-426614174001'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true, message: 'Each co-tenant ID must be a valid UUID' })
  coTenants?: string[];

  @ApiPropertyOptional({
    description: 'Guarantor information',
    example: { name: 'John Doe', phone: '1234567890', relationship: 'Parent' },
  })
  @IsOptional()
  @IsObject()
  guarantorInfo?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Lease document URLs',
    example: ['https://example.com/lease-agreement.pdf'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documents?: string[];

  @ApiPropertyOptional({
    description: 'Notes',
    example: 'First-time tenant, excellent references',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Tags for categorization',
    example: ['priority', 'renewal'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}


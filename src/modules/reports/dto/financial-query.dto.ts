import { IsOptional, IsUUID, IsDateString, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

function toDateString(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === 'string') return value.trim();
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

export class FinancialReportQueryDto {
  @ApiPropertyOptional({
    description:
      'Start date (ISO date YYYY-MM-DD). Defaults to first day of current month when omitted.',
    example: '2026-01-01',
  })
  @IsOptional()
  @Transform(({ value }) => toDateString(value))
  @IsDateString(
    {},
    { message: 'startDate must be a valid ISO date string (YYYY-MM-DD)' },
  )
  startDate?: string;

  @ApiPropertyOptional({
    description:
      'End date (ISO date YYYY-MM-DD). Defaults to last day of current month when omitted.',
    example: '2026-12-31',
  })
  @IsOptional()
  @Transform(({ value }) => toDateString(value))
  @IsDateString(
    {},
    { message: 'endDate must be a valid ISO date string (YYYY-MM-DD)' },
  )
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by property ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'propertyId must be a valid UUID' })
  propertyId?: string;

  @ApiPropertyOptional({
    description: 'Filter by currency (default: company default currency)',
    example: 'USD',
  })
  @IsOptional()
  @IsString()
  currency?: string;
}

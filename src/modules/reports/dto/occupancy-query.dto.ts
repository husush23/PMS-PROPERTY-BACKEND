import { IsOptional, IsUUID, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

function toDateString(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === 'string') return value.trim();
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

export class OccupancyReportQueryDto {
  @ApiPropertyOptional({
    description: 'Date as of which to compute occupancy (ISO date YYYY-MM-DD, default: today)',
    example: '2026-01-30',
  })
  @IsOptional()
  @Transform(({ value }) => toDateString(value))
  @IsDateString(
    {},
    { message: 'asOfDate must be a valid ISO date string (YYYY-MM-DD)' },
  )
  asOfDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by property ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'propertyId must be a valid UUID' })
  propertyId?: string;
}

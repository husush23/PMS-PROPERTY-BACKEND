import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class TerminateLeaseDto {
  @ApiPropertyOptional({
    description: 'Termination reason',
    example: 'Lease expired',
  })
  @IsOptional()
  @IsString()
  terminationReason?: string;

  @ApiPropertyOptional({
    description: 'Termination notes',
    example: 'Tenant chose not to renew',
  })
  @IsOptional()
  @IsString()
  terminationNotes?: string;

  @ApiPropertyOptional({
    description: 'Actual termination date (if different from today)',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Actual termination date must be a valid date string' },
  )
  actualTerminationDate?: string;
}

import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRentCycleDto {
  @ApiPropertyOptional({
    description: 'Notes or comments for this invoice',
    example: 'Invoice updated due to lease modification',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}


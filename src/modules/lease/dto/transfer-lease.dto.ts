import { IsUUID, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class TransferLeaseDto {
  @ApiPropertyOptional({
    description: 'New tenant user ID (if transferring to different tenant)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'New tenant ID must be a valid UUID' })
  newTenantId?: string;

  @ApiPropertyOptional({
    description: 'New unit ID (if transferring to different unit)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'New unit ID must be a valid UUID' })
  newUnitId?: string;
}


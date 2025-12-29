import { IsString, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReversePaymentDto {
  @ApiProperty({
    description: 'Reason for reversal',
    example: 'Payment made in error',
    minLength: 3,
  })
  @IsString()
  @MinLength(3, { message: 'Reason must be at least 3 characters' })
  reason: string;

  @ApiPropertyOptional({
    description: 'Additional notes about the reversal',
    example: 'Customer requested refund due to duplicate payment',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}


import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaymentMethodResponseDto {
  @ApiProperty({
    description: 'Payment method ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiPropertyOptional({
    description: 'Company ID (null for global methods)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  companyId?: string | null;

  @ApiProperty({
    description: 'Method name',
    example: 'M-Pesa',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'System code (used for global methods)',
    example: 'CASH',
  })
  code?: string | null;

  @ApiProperty({
    description: 'Whether method is global',
    example: true,
  })
  isGlobal: boolean;

  @ApiPropertyOptional({
    description: 'Provider name',
    example: 'Safaricom',
  })
  providerName?: string | null;

  @ApiPropertyOptional({
    description: 'Payment instructions',
    example: 'Paybill 123456, account: Invoice ID',
  })
  instructions?: string | null;

  @ApiProperty({
    description: 'Whether reference is required',
    example: false,
  })
  requiresReference: boolean;

  @ApiProperty({
    description: 'Whether method is active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}

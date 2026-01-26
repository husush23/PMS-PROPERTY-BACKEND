import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreatePaymentMethodDto {
  @ApiProperty({
    description: 'Payment method name',
    example: 'M-Pesa',
  })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({
    description: 'Provider name',
    example: 'Safaricom',
  })
  @IsOptional()
  @IsString()
  providerName?: string;

  @ApiPropertyOptional({
    description: 'Payment instructions',
    example: 'Paybill 123456, account: Invoice ID',
  })
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional({
    description: 'Whether reference is required',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  requiresReference?: boolean;
}

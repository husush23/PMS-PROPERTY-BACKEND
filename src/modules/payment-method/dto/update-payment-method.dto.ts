import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdatePaymentMethodDto {
  @ApiPropertyOptional({
    description: 'Payment method name',
    example: 'M-Pesa',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

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

  @ApiPropertyOptional({
    description: 'Whether method is active',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

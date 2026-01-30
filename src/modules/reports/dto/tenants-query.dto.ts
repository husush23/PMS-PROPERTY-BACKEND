import { IsOptional, IsUUID, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export type TenantReportStatus = 'active' | 'past';
export type TenantReportBalanceStatus = 'owing' | 'credit' | 'settled';

export class TenantsReportQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by property ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'propertyId must be a valid UUID' })
  propertyId?: string;

  @ApiPropertyOptional({
    description: 'Filter by tenant status',
    enum: ['active', 'past'],
    example: 'active',
  })
  @IsOptional()
  @IsString()
  @IsIn(['active', 'past'], {
    message: 'status must be one of: active, past',
  })
  status?: TenantReportStatus;

  @ApiPropertyOptional({
    description: 'Filter by balance status',
    enum: ['owing', 'credit', 'settled'],
    example: 'owing',
  })
  @IsOptional()
  @IsString()
  @IsIn(['owing', 'credit', 'settled'], {
    message: 'balanceStatus must be one of: owing, credit, settled',
  })
  balanceStatus?: TenantReportBalanceStatus;
}

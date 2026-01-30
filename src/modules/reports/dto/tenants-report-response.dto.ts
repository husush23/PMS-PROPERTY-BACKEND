import { ApiProperty } from '@nestjs/swagger';

export class TenantsReportTenantItemDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  tenantId: string;
  @ApiProperty({ example: 'John Doe' })
  name: string;
  @ApiProperty({ example: 1 })
  activeLeaseCount: number;
  @ApiProperty({ example: 120000 })
  totalPaid: number;
  @ApiProperty({ example: 5000 })
  outstandingBalance: number;
  @ApiProperty({ example: 0 })
  creditBalance: number;
  @ApiProperty({ example: '2026-01-15', nullable: true })
  lastPaymentDate: string | null;
  @ApiProperty({ example: '2026-01-31', nullable: true })
  lastInvoiceDate: string | null;
}

export class TenantsReportResponseDto {
  @ApiProperty({ example: 5 })
  tenantsWithBalance: number;
  @ApiProperty({ example: 2 })
  tenantsWithCredit: number;
  @ApiProperty({ type: [TenantsReportTenantItemDto] })
  tenants: TenantsReportTenantItemDto[];
}

import { ApiProperty } from '@nestjs/swagger';

export class FinancialReportBreakdownByMonthDto {
  @ApiProperty({ example: '2026-01' })
  month: string;
  @ApiProperty({ example: 50000 })
  totalInvoiced: number;
  @ApiProperty({ example: 48000 })
  totalCollected: number;
  @ApiProperty({ example: 2000 })
  outstandingBalance: number;
  @ApiProperty({ example: 500 })
  lateFeesCollected: number;
  @ApiProperty({ example: 1000 })
  creditsApplied: number;
  @ApiProperty({ example: 0 })
  refunds: number;
  @ApiProperty({ example: 48000 })
  netIncome: number;
}

export class FinancialReportBreakdownByPropertyDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  propertyId: string;
  @ApiProperty({ example: 'Building A' })
  propertyName: string;
  @ApiProperty({ example: 50000 })
  totalInvoiced: number;
  @ApiProperty({ example: 48000 })
  totalCollected: number;
  @ApiProperty({ example: 2000 })
  outstandingBalance: number;
  @ApiProperty({ example: 500 })
  lateFeesCollected: number;
  @ApiProperty({ example: 1000 })
  creditsApplied: number;
  @ApiProperty({ example: 0 })
  refunds: number;
  @ApiProperty({ example: 48000 })
  netIncome: number;
}

export class FinancialReportBreakdownByPaymentMethodDto {
  @ApiProperty({ example: 'MPESA' })
  paymentMethod: string;
  @ApiProperty({ example: 30000 })
  totalCollected: number;
  @ApiProperty({ example: 50 })
  paymentCount: number;
}

export class FinancialReportResponseDto {
  @ApiProperty({ example: 500000 })
  totalInvoiced: number;
  @ApiProperty({ example: 480000 })
  totalCollected: number;
  @ApiProperty({ example: 20000 })
  outstandingBalance: number;
  @ApiProperty({ example: 5000 })
  lateFeesCollected: number;
  @ApiProperty({ example: 10000 })
  creditsApplied: number;
  @ApiProperty({ example: 0 })
  refunds: number;
  @ApiProperty({ example: 480000 })
  netIncome: number;
  @ApiProperty({ type: [FinancialReportBreakdownByMonthDto] })
  byMonth: FinancialReportBreakdownByMonthDto[];
  @ApiProperty({ type: [FinancialReportBreakdownByPropertyDto] })
  byProperty: FinancialReportBreakdownByPropertyDto[];
  @ApiProperty({ type: [FinancialReportBreakdownByPaymentMethodDto] })
  byPaymentMethod: FinancialReportBreakdownByPaymentMethodDto[];
}

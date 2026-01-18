import { ApiProperty } from '@nestjs/swagger';

export class AccountingSummaryResponseDto {
  @ApiProperty({ example: 50000 })
  totalRentIncome: number;

  @ApiProperty({ example: 32000 })
  totalPaymentsReceived: number;

  @ApiProperty({ example: 18000 })
  totalOutstandingReceivables: number;

  @ApiProperty({ example: 12000 })
  totalExpenses: number;

  @ApiProperty({ example: 2500 })
  totalCreditLiability: number;

  @ApiProperty({ example: 4000 })
  totalDepositsLiability: number;

  @ApiProperty({ example: 38000 })
  netPosition: number;
}

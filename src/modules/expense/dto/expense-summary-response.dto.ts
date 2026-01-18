import { ApiProperty } from '@nestjs/swagger';
import { ExpenseCategory } from '../enums/expense-category.enum';

export class ExpenseSummaryResponseDto {
  @ApiProperty({ example: 12000 })
  totalExpenses: number;

  @ApiProperty({
    example: {
      MAINTENANCE: 5000,
      UTILITIES: 3000,
      TAX: 2000,
      REPAIR: 1500,
      OTHER: 500,
    },
  })
  expensesByCategory: Record<ExpenseCategory, number>;
}

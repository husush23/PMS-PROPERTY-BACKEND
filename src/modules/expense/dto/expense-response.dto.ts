import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExpenseCategory } from '../enums/expense-category.enum';

export class ExpenseResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  companyId: string;

  @ApiPropertyOptional({ nullable: true })
  propertyId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  leaseId?: string | null;

  @ApiProperty({ enum: ExpenseCategory })
  category: ExpenseCategory;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  expenseDate: Date;

  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ExpenseCategory } from '../enums/expense-category.enum';

/**
 * MVP EXPENSE TRACKING ONLY:
 * - Expenses are informational and do not affect rent, payments, invoices, or credit balance.
 * - No accounting ledger logic is implemented here.
 */
@Entity('expenses')
@Index(['companyId'])
@Index(['propertyId'])
@Index(['leaseId'])
@Index(['category'])
@Index(['expenseDate'])
export class Expense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  companyId: string;

  @Column('uuid', { nullable: true })
  propertyId: string | null;

  @Column('uuid', { nullable: true })
  leaseId: string | null;

  @Column({
    type: 'enum',
    enum: ExpenseCategory,
    enumName: 'expenses_category_enum',
  })
  category: ExpenseCategory;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'date' })
  expenseDate: Date;

  @Column('uuid')
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

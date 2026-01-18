import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { AccountingAccount } from '../enums/accounting-account.enum';
import { AccountingEntryDirection } from '../enums/accounting-entry-direction.enum';
import { AccountingReferenceType } from '../enums/accounting-reference-type.enum';

/**
 * Accounting rules:
 * - Invoices create income (legal rent obligation).
 * - Payments move cash but do not create income by themselves.
 * - Tenant credit is a liability until applied or refunded.
 */
@Entity('accounting_entries')
@Index(['companyId'])
@Index(['leaseId'])
@Index(['tenantId'])
@Index(['entryDate'])
@Index(['referenceType', 'referenceId'])
export class AccountingEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  companyId: string;

  @Column('uuid', { nullable: true })
  leaseId: string | null;

  @Column('uuid', { nullable: true })
  tenantId: string | null;

  @Column({
    type: 'enum',
    enum: AccountingAccount,
    enumName: 'accounting_entries_account_enum',
  })
  account: AccountingAccount;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: AccountingEntryDirection,
    enumName: 'accounting_entries_direction_enum',
  })
  direction: AccountingEntryDirection;

  @Column({
    type: 'enum',
    enum: AccountingReferenceType,
    enumName: 'accounting_entries_reference_type_enum',
  })
  referenceType: AccountingReferenceType;

  @Column('uuid')
  referenceId: string;

  @Column({ type: 'date' })
  entryDate: Date;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}

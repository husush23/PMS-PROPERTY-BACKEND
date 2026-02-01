import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Lease } from '../../lease/entities/lease.entity';
import { User } from '../../user/entities/user.entity';
import { Company } from '../../company/entities/company.entity';
import { PaymentStatus } from '../../../shared/enums/payment-status.enum';
import { PaymentMethod } from '../../../shared/enums/payment-method.enum';
import { PaymentType } from '../../../shared/enums/payment-type.enum';
import { PaymentMethodEntity } from '../../payment-method/entities/payment-method.entity';

@Entity('payments')
@Index(['companyId'])
@Index(['tenantId'])
@Index(['leaseId'])
@Index(['paymentDate'])
@Index(['status'])
@Index(['companyId', 'tenantId'])
@Index(['leaseId', 'paymentDate'])
@Index(['dueDate'])
@Index(['status', 'dueDate'])
@Index(['rentCycleId'])
@Index(['paymentMethodId'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  companyId: string;

  @Column('uuid')
  tenantId: string;

  @Column('uuid')
  leaseId: string;

  @Column('uuid', { nullable: true })
  rentCycleId: string | null; // Link to RentCycle (Invoice)

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amountDue: number; // Expected amount for this payment period

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  amountPaid: number; // Actual amount paid

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  balance: number; // amountDue - amountPaid

  @Column({ default: 'USD' })
  currency: string;

  @Column({ type: 'date' })
  paymentDate: Date;

  @Column({ type: 'date' })
  dueDate: Date; // When payment is due

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date | null; // When fully paid (balance = 0)

  @Column({
    type: 'enum',
    enum: PaymentMethod,
  })
  paymentMethod: PaymentMethod;

  @Column('uuid', { nullable: true })
  paymentMethodId: string | null;

  @Column({
    type: 'enum',
    enum: PaymentType,
  })
  paymentType: PaymentType;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({ nullable: true })
  reference: string;

  @Column('uuid')
  recordedBy: string;

  @Column({ nullable: true })
  period: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ default: false })
  isPartial: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  balanceAfter: number;

  @Column({ default: false })
  lateFeeApplied: boolean; // Late fee already applied

  @Column({ nullable: true })
  attachmentUrl: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isLegacy: boolean; // True for old payments before RentCycle system

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => Lease, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'leaseId' })
  lease: Lease;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: User;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @ManyToOne(() => PaymentMethodEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'paymentMethodId' })
  paymentMethodEntity?: PaymentMethodEntity;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'recordedBy' })
  recordedByUser: User;

  // RentCycle relationship - using string to avoid circular dependency
  @ManyToOne('RentCycle', 'payments', {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'rentCycleId' })
  rentCycle?: any; // Type will be resolved at runtime
}

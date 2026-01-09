import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Lease } from '../../lease/entities/lease.entity';
import { Payment } from '../../payment/entities/payment.entity';
import { RentCycleLineItem } from './rent-cycle-line-item.entity';

@Entity('rent_cycles')
@Index(['leaseId'])
@Index(['companyId'])
@Index(['tenantId'])
@Index(['period'])
@Index(['dueDate'])
@Index(['companyId', 'tenantId'])
@Index(['leaseId', 'dueDate'])
@Unique(['leaseId', 'period'])
export class RentCycle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  leaseId: string;

  @Column('uuid')
  companyId: string;

  @Column('uuid')
  tenantId: string;

  @Column({ unique: true })
  invoiceNumber: string; // Auto-generated: "INV-YYYY-MM-{sequence}"

  @Column()
  period: string; // Format: "YYYY-MM"

  @Column({ type: 'date' })
  dueDate: Date;

  @Column({ type: 'date', nullable: true })
  periodStartDate: Date; // Explicit period start - when invoice period begins

  @Column({ type: 'date', nullable: true })
  periodEndDate: Date; // Explicit period end - when invoice period ends

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalAmountDue: number; // Calculated from line items

  @Column({ default: false })
  isDeposit: boolean; // True if this is a deposit invoice (separate from rent invoices)

  @Column({ default: false })
  isVoid: boolean; // True if invoice is voided (cancelled/admin action)

  @Column({ type: 'text', nullable: true })
  voidReason: string; // Reason for voiding the invoice

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => Lease, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'leaseId' })
  lease: Lease;

  @OneToMany(() => RentCycleLineItem, (lineItem) => lineItem.rentCycle, {
    cascade: true,
    eager: false,
  })
  lineItems: RentCycleLineItem[];

  @OneToMany(() => Payment, (payment) => payment.rentCycle, {
    cascade: false,
    eager: false,
  })
  payments: Payment[];
}

